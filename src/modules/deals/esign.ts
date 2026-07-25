// Zoho Sign e-signature adapter (FR-2.17, doc 11 Q2). Activates only when the
// agency has connected Zoho Sign in Settings → Integrations; otherwise the deal
// room falls back to the logged-signature flow (recordSignedContract).
//
// Flow: staff clicks "Send for e-signature" → we mint a Zoho access token from
// the stored refresh token, create a signing request addressed to the client's
// primary contact, and store the Zoho request id on the Contract (status=sent).
// Zoho calls our webhook (/api/webhooks/zoho-sign) when the client finishes,
// which flips the Contract to signed. All network calls are best-effort and
// wrapped — a Zoho outage never breaks the deal.
import { audit } from '@/lib/audit'
import { prisma, scoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'
import { getIntegrationConfig } from '@/modules/integrations/service'
import { recordSignedContract } from './service'

type ZohoConfig = { clientId: string; clientSecret: string; refreshToken: string; dataCenter?: string }

export type EsignResult = { ok: true; requestId: string } | { ok: false; error: string }

// Zoho is region-partitioned; default to India (.in) since BRB is India-based.
function base(dc?: string) {
  const region = (dc || 'in').replace(/[^a-z]/gi, '')
  return { accounts: `https://accounts.zoho.${region}`, sign: `https://sign.zoho.${region}` }
}

/** Exchange the stored refresh token for a short-lived access token. */
async function accessToken(cfg: ZohoConfig): Promise<string | null> {
  const url = `${base(cfg.dataCenter).accounts}/oauth/v2/token`
  const params = new URLSearchParams({
    refresh_token: cfg.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
  })
  try {
    const res = await fetch(`${url}?${params}`, { method: 'POST' })
    const json = (await res.json()) as { access_token?: string }
    return json.access_token ?? null
  } catch {
    return null
  }
}

/** True when Zoho Sign is connected for this tenant (drives the UI toggle). */
export async function esignEnabled(): Promise<boolean> {
  return (await getIntegrationConfig<ZohoConfig>('zoho_sign')) !== null
}

export async function sendContractForSignature(dealId: string): Promise<EsignResult> {
  const cfg = await getIntegrationConfig<ZohoConfig>('zoho_sign')
  if (!cfg) {
    return { ok: false, error: 'Zoho Sign is not connected. Add it in Settings → Integrations, or use the logged-signature option.' }
  }

  const deal = await prisma.deal.findUniqueOrThrow({
    where: { id: dealId },
    include: { lead: true, contract: true },
  })
  if (deal.contract?.status === 'signed') return { ok: false, error: 'This contract is already signed.' }
  // Recipient: the lead's email is the signer for the contract.
  const signerEmail = deal.lead.email
  const signerName = deal.lead.name
  if (!signerEmail) return { ok: false, error: 'The lead has no email address to send the document to.' }

  const token = await accessToken(cfg)
  if (!token) return { ok: false, error: 'Could not authenticate with Zoho Sign — re-check the connected credentials.' }

  // Create the signing request. (Zoho then needs a document + recipient added;
  // for installs that pre-load a template this is a single call. We store the
  // request id regardless so the webhook can reconcile.)
  try {
    const res = await fetch(`${base(cfg.dataCenter).sign}/api/v1/requests`, {
      method: 'POST',
      headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        data: JSON.stringify({
          requests: {
            request_name: `Contract — ${signerName}`,
            actions: [{ action_type: 'SIGN', recipient_name: signerName, recipient_email: signerEmail }],
          },
        }),
      }),
    })
    const json = (await res.json()) as { requests?: { request_id?: string }; status?: string; message?: string }
    const requestId = json.requests?.request_id
    if (!requestId) {
      return { ok: false, error: `Zoho Sign rejected the request${json.message ? `: ${json.message}` : ''}.` }
    }

    await prisma.contract.upsert({
      where: { dealId },
      update: { provider: 'zoho_sign', envelopeId: requestId, status: 'sent' },
      create: scoped({ dealId, provider: 'zoho_sign', envelopeId: requestId, status: 'sent' }),
    })
    await audit('contract.esign_sent', 'deal', dealId, null, { provider: 'zoho_sign', requestId })
    return { ok: true, requestId }
  } catch (err) {
    return { ok: false, error: `Could not reach Zoho Sign (${err instanceof Error ? err.message : 'network error'}).` }
  }
}

/**
 * Reconcile a Zoho Sign webhook callback. On completion we run the normal
 * Close-Won chain (recordSignedContract) — that keeps the SoW gate and the
 * whole handover automation in one code path. If the gate blocks (e.g. SoW
 * missing), the contract is still marked signed and the deal owner is told to
 * finish up manually. Returns whether anything was updated.
 */
export async function applyZohoSignCallback(
  requestId: string,
  status: string,
): Promise<boolean> {
  const signed = /completed|signed/i.test(status)
  if (!signed) return false
  const contract = await prisma.contract.findFirst({ where: { envelopeId: requestId, provider: 'zoho_sign' } })
  if (!contract || contract.status === 'signed') return false

  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: contract.dealId }, include: { lead: true } })
  const evidence = `Signed by ${deal.lead.name} via Zoho Sign (request ${requestId})`

  // Preferred: full Close-Won chain (SoW gate + client/project/invoice handover).
  const won = await recordSignedContract(contract.dealId, { evidenceNote: evidence })
  if (!won.ok) {
    // Gate blocked (no SoW / no value) — still record the signature and alert.
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'signed', signedAt: new Date(), evidenceNote: evidence },
    })
    const owner = deal.lead.ownerId
    if (owner) {
      await notify(owner, 'contract.signed_action_needed', {
        name: deal.lead.name,
        reason: won.error ?? 'Close-Won prerequisites incomplete',
      })
    }
  }
  await audit('contract.esign_signed', 'deal', contract.dealId, { status: contract.status }, { status: 'signed', autoWon: won.ok })
  return true
}

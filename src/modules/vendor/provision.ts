// Remote client provisioning (vendor console): SSH into the client's server
// and run the installer non-interactively. Runs detached; progress streams
// into vendor_clients.install_log. SSH credentials are cleared on success.
import { randomBytes } from 'node:crypto'
import { Client as SshClient } from 'ssh2'
import { decryptJson } from '@/lib/crypto'
import { runWithTenant } from '@/lib/db/context'
import { prismaUnscoped } from '@/lib/db/prisma'
import { notify } from '@/lib/notify'

const INSTALL_URL = 'https://raw.githubusercontent.com/steven-patrick18/Zogency/main/deploy/install.sh'
const LOG_CAP = 60_000

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

async function appendLog(clientId: string, chunk: string) {
  const row = await prismaUnscoped.vendorClient.findUnique({ where: { id: clientId } })
  if (!row) return
  const next = (row.installLog + chunk).slice(-LOG_CAP)
  await prismaUnscoped.vendorClient.update({
    where: { id: clientId },
    data: { installLog: next },
  })
}

/** Fire-and-forget: kicks off the remote install and returns immediately. */
export function startProvisioning(tenantId: string, vendorClientId: string, actorUserId: string) {
  queueMicrotask(() => {
    runProvisioning(tenantId, vendorClientId, actorUserId).catch(async (err) => {
      await prismaUnscoped.vendorClient.update({
        where: { id: vendorClientId },
        data: { status: 'failed' },
      })
      await appendLog(vendorClientId, `\n[provisioner] fatal: ${err instanceof Error ? err.message : String(err)}\n`)
    })
  })
}

async function runProvisioning(tenantId: string, vendorClientId: string, actorUserId: string) {
  const client = await prismaUnscoped.vendorClient.findUniqueOrThrow({ where: { id: vendorClientId } })
  if (!client.sshPasswordEnc) throw new Error('SSH credentials missing — re-enter them and retry')
  const { password } = decryptJson<{ password: string }>(client.sshPasswordEnc)
  const setupToken = randomBytes(24).toString('base64url')
  const publicKey = process.env.ZOGENCY_LICENSE_PUBLIC_KEY ?? ''

  await prismaUnscoped.vendorClient.update({
    where: { id: vendorClientId },
    data: { status: 'installing', installLog: `[provisioner] connecting to ${client.serverIp} as ${client.sshUser}…\n` },
  })

  const env = [
    `ZOGENCY_DOMAIN=${shellQuote(client.domain)}`,
    `ZOGENCY_TENANT_NAME=${shellQuote(client.companyName)}`,
    `ZOGENCY_ADMIN_EMAIL=${shellQuote(client.contactEmail)}`,
    `ZOGENCY_ADMIN_SETUP_TOKEN=${shellQuote(setupToken)}`,
    `ZOGENCY_LICENSE_KEY=${shellQuote(client.licenseKey)}`,
    publicKey ? `ZOGENCY_LICENSE_PUBLIC_KEY=${shellQuote(publicKey)}` : '',
    // Enables the client-side auto-updater polling this master's release channel.
    process.env.AUTH_URL ? `ZOGENCY_MASTER_URL=${shellQuote(process.env.AUTH_URL)}` : '',
  ].filter(Boolean).join(' ')

  const sudo = client.sshUser === 'root' ? '' : 'sudo -E '
  const command = `curl -fsSL ${INSTALL_URL} | ${sudo}${env} bash`

  const exitCode = await new Promise<number>((resolve, reject) => {
    const ssh = new SshClient()
    ssh
      .on('ready', () => {
        appendLog(vendorClientId, '[provisioner] connected — running installer…\n')
        ssh.exec(`${env} bash -c ${shellQuote(command)}`, { pty: false }, (err, stream) => {
          if (err) {
            ssh.end()
            return reject(err)
          }
          let buffer = ''
          const flush = () => {
            if (buffer) {
              const out = buffer
              buffer = ''
              void appendLog(vendorClientId, out)
            }
          }
          const timer = setInterval(flush, 2000)
          stream
            .on('data', (d: Buffer) => { buffer += d.toString() })
            .stderr.on('data', (d: Buffer) => { buffer += d.toString() })
          stream.on('close', (code: number) => {
            clearInterval(timer)
            flush()
            ssh.end()
            resolve(code ?? 1)
          })
        })
      })
      .on('error', reject)
      .connect({
        host: client.serverIp,
        port: 22,
        username: client.sshUser,
        password,
        readyTimeout: 20_000,
      })
  })

  if (exitCode !== 0) {
    await prismaUnscoped.vendorClient.update({
      where: { id: vendorClientId },
      data: { status: 'failed' },
    })
    await appendLog(vendorClientId, `\n[provisioner] installer exited with code ${exitCode}\n`)
    return
  }

  const setupLink = `https://${client.domain}/setup/${setupToken}`
  await prismaUnscoped.vendorClient.update({
    where: { id: vendorClientId },
    data: {
      status: 'installed',
      installedAt: new Date(),
      setupLink,
      sshPasswordEnc: null, // credentials are never kept after success
    },
  })
  await appendLog(
    vendorClientId,
    `\n[provisioner] ✔ installed. Setup link: ${setupLink}\n[provisioner] SSH credentials cleared.\n`,
  )
  await runWithTenant({ tenantId }, () =>
    notify(actorUserId, 'vendor.installed', { company: client.companyName, domain: client.domain }),
  )
}

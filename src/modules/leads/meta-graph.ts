// Meta Lead Ads — Graph API lead retrieval (doc 09 §2.1).
//
// A live leadgen webhook carries only the lead's ID, never its answers:
//   { entry: [{ id: <pageId>, changes: [{ value: { leadgen_id: "…" } }] }] }
// The actual field_data has to be fetched from the Graph API with the Page
// access token. Test payloads sent from Meta's webhook tester DO inline
// field_data, which is why intake appeared to work without this step.

export const META_GRAPH_VERSION = 'v21.0'

export type MetaField = { name: string; values: string[] }

/** True when the payload already carries the answers (Meta's test sender). */
export function hasInlineFieldData(raw: unknown): boolean {
  const r = raw as Record<string, unknown>
  if (Array.isArray(r?.field_data)) return true
  const value = (r?.entry as Array<{ changes?: Array<{ value?: Record<string, unknown> }> }>)?.[0]
    ?.changes?.[0]?.value
  return Array.isArray(value?.field_data)
}

/** Pulls the leadgen_id out of a live webhook envelope. */
export function extractLeadgenId(raw: unknown): string | null {
  const r = raw as Record<string, unknown>
  const direct = r?.leadgen_id
  if (typeof direct === 'string' && direct) return direct
  const value = (r?.entry as Array<{ changes?: Array<{ value?: { leadgen_id?: string } }> }>)?.[0]
    ?.changes?.[0]?.value
  return value?.leadgen_id || null
}

export function leadDetailUrl(leadgenId: string, version = META_GRAPH_VERSION): string {
  return `https://graph.facebook.com/${version}/${encodeURIComponent(leadgenId)}?fields=field_data,created_time`
}

/**
 * Fetches one lead's answers. The token goes in the Authorization header rather
 * than the query string so it cannot leak into logs or error messages.
 * `fetchImpl` is injectable for tests.
 */
export async function fetchMetaLeadFields(
  leadgenId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MetaField[]> {
  const res = await fetchImpl(leadDetailUrl(leadgenId), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const body = (await res.json().catch(() => null)) as
    | { field_data?: MetaField[]; error?: { message?: string; code?: number } }
    | null

  if (!res.ok) {
    const detail = body?.error?.message ?? `HTTP ${res.status}`
    // Meta's token errors are the common case here and the message is the
    // actionable part — surface it on the webhook_events row.
    throw new Error(`Meta Graph API rejected the lead fetch: ${detail}`)
  }
  if (!Array.isArray(body?.field_data)) {
    throw new Error('Meta Graph API returned no field_data for this lead')
  }
  return body.field_data
}

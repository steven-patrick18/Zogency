import { describe, expect, it, vi } from 'vitest'
import {
  extractLeadgenId,
  fetchMetaLeadFields,
  hasInlineFieldData,
  leadDetailUrl,
} from './meta-graph'
import { mapPayload } from './intake'

// What Meta actually POSTs for a live lead — no answers, just an ID.
const LIVE_WEBHOOK = {
  object: 'page',
  entry: [
    {
      id: '102938475',
      time: 1790000000,
      changes: [
        {
          field: 'leadgen',
          value: {
            leadgen_id: '1122334455',
            page_id: '102938475',
            form_id: '998877',
            created_time: 1790000000,
          },
        },
      ],
    },
  ],
}

// What Meta's webhook TESTER sends — answers inlined, which is why intake
// looked like it worked without a Graph API call.
const TEST_WEBHOOK = {
  entry: [
    {
      changes: [
        {
          value: {
            field_data: [
              { name: 'full_name', values: ['Rahul Verma'] },
              { name: 'phone_number', values: ['+919812345678'] },
            ],
          },
        },
      ],
    },
  ],
}

describe('hasInlineFieldData', () => {
  it('is false for a live leadgen webhook', () => {
    expect(hasInlineFieldData(LIVE_WEBHOOK)).toBe(false)
  })

  it('is true for a test payload with answers inlined', () => {
    expect(hasInlineFieldData(TEST_WEBHOOK)).toBe(true)
  })

  it('is true for a bare field_data object (post-fetch shape)', () => {
    expect(hasInlineFieldData({ field_data: [{ name: 'email', values: ['a@b.com'] }] })).toBe(true)
  })
})

describe('extractLeadgenId', () => {
  it('reads the id out of the live envelope', () => {
    expect(extractLeadgenId(LIVE_WEBHOOK)).toBe('1122334455')
  })

  it('accepts a bare leadgen_id', () => {
    expect(extractLeadgenId({ leadgen_id: '55' })).toBe('55')
  })

  it('returns null when there is nothing to fetch', () => {
    expect(extractLeadgenId({ entry: [] })).toBeNull()
    expect(extractLeadgenId({})).toBeNull()
  })
})

describe('leadDetailUrl', () => {
  it('requests field_data and escapes the id — and carries no token', () => {
    const url = leadDetailUrl('112/233')
    expect(url).toContain('/v21.0/112%2F233')
    expect(url).toContain('fields=field_data')
    expect(url).not.toContain('access_token')
  })
})

describe('fetchMetaLeadFields', () => {
  const ok = (body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))

  it('returns the field data and sends the token as a bearer header', async () => {
    const fetchImpl = ok({ field_data: [{ name: 'full_name', values: ['Asha'] }] })
    const fields = await fetchMetaLeadFields('1122', 'tok-secret', fetchImpl as unknown as typeof fetch)

    expect(fields).toEqual([{ name: 'full_name', values: ['Asha'] }])
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).not.toContain('tok-secret') // never in the query string
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-secret')
  })

  it("surfaces Meta's own error message on a rejected token", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Error validating access token', code: 190 } }), {
          status: 400,
        }),
    )
    await expect(
      fetchMetaLeadFields('1122', 'stale', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow('Error validating access token')
  })

  it('throws when the response carries no field_data', async () => {
    const fetchImpl = ok({ id: '1122' })
    await expect(
      fetchMetaLeadFields('1122', 'tok', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow('no field_data')
  })
})

describe('mapPayload on fetched Graph data', () => {
  it('maps the post-fetch shape into a lead', () => {
    const input = mapPayload('meta', {
      field_data: [
        { name: 'full_name', values: ['Rahul Verma'] },
        { name: 'phone_number', values: ['+919812345678'] },
        { name: 'email', values: ['rahul@verma.test'] },
        { name: 'city', values: ['Pune'] },
      ],
    })
    expect(input).toMatchObject({
      name: 'Rahul Verma',
      phone: '+919812345678',
      email: 'rahul@verma.test',
      city: 'Pune',
      sourceName: 'Meta Lead Ads',
    })
  })

  it('would have produced an empty name from the raw live webhook — the bug this fixes', () => {
    expect(mapPayload('meta', LIVE_WEBHOOK).name).toBe('')
  })
})

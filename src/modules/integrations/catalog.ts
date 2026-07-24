// Integration catalog (doc 09 + doc 11 Q1–Q5 decisions).
// Every provider a marketing agency needs, self-serve per tenant: agencies
// connect their OWN accounts and go live when their keys are ready (Q5).
// IVR supports all four Indian CPaaS vendors, tenant-selectable (Q1).

export type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'password' | 'select'
  options?: string[]
  required?: boolean
  hint?: string
}

export type ProviderDef = {
  provider: string // integration_credentials.provider key
  name: string
  category: string
  fields: FieldDef[]
  webhookPath?: string // shown so the agency can paste it into the vendor console
  note?: string
}

export const INTEGRATION_CATALOG: ProviderDef[] = [
  // ── Lead sources ──────────────────────────────────────────────────────────
  {
    provider: 'meta',
    name: 'Meta Lead Ads',
    category: 'Lead sources',
    webhookPath: '/api/webhooks/meta',
    fields: [
      { key: 'pageId', label: 'Facebook Page ID', required: true },
      { key: 'pageToken', label: 'Page access token', type: 'password', required: true },
      { key: 'appSecret', label: 'App secret (webhook signature)', type: 'password' },
      { key: 'verifyToken', label: 'Webhook verify token', required: true, hint: 'Any string — paste the same value in the Meta webhook setup' },
    ],
  },
  {
    provider: 'google',
    name: 'Google Ads Lead Form',
    category: 'Lead sources',
    webhookPath: '/api/webhooks/google',
    fields: [
      { key: 'key', label: 'Lead form webhook key', type: 'password', required: true, hint: 'Set the same key in the lead form extension webhook config' },
    ],
  },
  {
    provider: 'website_form',
    name: 'Website form / generic intake',
    category: 'Lead sources',
    webhookPath: '/api/webhooks/website-form',
    fields: [
      { key: 'key', label: 'Form API key', type: 'password', required: true, hint: 'POST leads with ?key=<this> from your website' },
    ],
  },
  // ── Telephony (Q1: all four vendors supported; the agency picks one) ──────
  {
    provider: 'ivr',
    name: 'IVR / Cloud telephony',
    category: 'Telephony',
    webhookPath: '/api/webhooks/ivr',
    note: 'Pick your vendor and paste its API credentials — call events post to the webhook below.',
    fields: [
      { key: 'vendor', label: 'Vendor', type: 'select', options: ['exotel', 'knowlarity', 'ozonetel', 'myoperator'], required: true },
      { key: 'key', label: 'Webhook key', type: 'password', required: true, hint: 'Appended as ?key= on the webhook URL' },
      { key: 'apiKey', label: 'API key / SID', type: 'password', required: true },
      { key: 'apiToken', label: 'API token / secret', type: 'password' },
      { key: 'virtualNumber', label: 'Virtual number (caller ID)' },
    ],
  },
  // ── Messaging ─────────────────────────────────────────────────────────────
  {
    provider: 'whatsapp',
    name: 'WhatsApp Cloud API',
    category: 'Messaging',
    fields: [
      { key: 'phoneNumberId', label: 'Phone number ID', required: true },
      { key: 'wabaId', label: 'WhatsApp Business Account ID', required: true },
      { key: 'token', label: 'Permanent access token', type: 'password', required: true },
    ],
    note: 'Requires Meta Business verification + approved message templates.',
  },
  {
    provider: 'msg91',
    name: 'MSG91 SMS (DLT)',
    category: 'Messaging',
    fields: [
      { key: 'authKey', label: 'Auth key', type: 'password', required: true },
      { key: 'senderId', label: 'DLT sender ID', required: true },
    ],
  },
  // ── Email ─────────────────────────────────────────────────────────────────
  {
    provider: 'email',
    name: 'Transactional email',
    category: 'Email',
    fields: [
      { key: 'vendor', label: 'Vendor', type: 'select', options: ['ses', 'sendgrid', 'smtp'], required: true },
      { key: 'apiKey', label: 'API key (SES access key / SendGrid key)', type: 'password' },
      { key: 'apiSecret', label: 'API secret (SES secret key)', type: 'password' },
      { key: 'smtpHost', label: 'SMTP host (smtp vendor only)' },
      { key: 'smtpUser', label: 'SMTP user' },
      { key: 'smtpPass', label: 'SMTP password', type: 'password' },
      { key: 'fromAddress', label: 'From address', required: true },
    ],
  },
  // ── Documents & finance (Q2/Q3: Zoho) ─────────────────────────────────────
  {
    provider: 'zoho_sign',
    name: 'Zoho Sign (e-signature)',
    category: 'Documents & finance',
    fields: [
      { key: 'clientId', label: 'Client ID', required: true },
      { key: 'clientSecret', label: 'Client secret', type: 'password', required: true },
      { key: 'refreshToken', label: 'Refresh token', type: 'password', required: true },
    ],
    note: 'Contract/PO e-signature (FR-2.17) and campaign sign-offs — replaces the logged-approval fallback once connected.',
  },
  {
    provider: 'zoho_books',
    name: 'Zoho Books (accounting)',
    category: 'Documents & finance',
    fields: [
      { key: 'clientId', label: 'Client ID', required: true },
      { key: 'clientSecret', label: 'Client secret', type: 'password', required: true },
      { key: 'refreshToken', label: 'Refresh token', type: 'password', required: true },
      { key: 'organizationId', label: 'Organization ID', required: true },
    ],
    note: 'Invoice push + payment-status pull (FR-8.4). Zoho Books stays the books of record.',
  },
  {
    provider: 'razorpay',
    name: 'Razorpay (payment links)',
    category: 'Documents & finance',
    fields: [
      { key: 'keyId', label: 'Key ID', required: true },
      { key: 'keySecret', label: 'Key secret', type: 'password', required: true },
    ],
  },
  // ── Other ─────────────────────────────────────────────────────────────────
  {
    provider: 'google_calendar',
    name: 'Google Calendar',
    category: 'Other',
    fields: [
      { key: 'clientId', label: 'OAuth client ID', required: true },
      { key: 'clientSecret', label: 'OAuth client secret', type: 'password', required: true },
    ],
    note: 'Kickoff calls, campaign scheduling, interview slots.',
  },
  {
    provider: 'storage_s3',
    name: 'Object storage (S3-compatible)',
    category: 'Other',
    fields: [
      { key: 'endpoint', label: 'Endpoint URL', required: true },
      { key: 'bucket', label: 'Bucket', required: true },
      { key: 'accessKey', label: 'Access key', type: 'password', required: true },
      { key: 'secretKey', label: 'Secret key', type: 'password', required: true },
      { key: 'region', label: 'Region', hint: 'e.g. ap-south-1 (Mumbai)' },
    ],
    note: 'Call recordings (12-month retention NFR) and creative-asset files.',
  },
  // Q4: any other API the agency wants to register for future automations.
  {
    provider: 'custom',
    name: 'Custom API',
    category: 'Other',
    fields: [
      { key: 'name', label: 'Integration name', required: true },
      { key: 'baseUrl', label: 'Base URL', required: true },
      { key: 'apiKey', label: 'API key / token', type: 'password' },
      { key: 'headerName', label: 'Auth header name', hint: 'e.g. Authorization or X-API-Key' },
      { key: 'notes', label: 'Notes' },
    ],
    note: 'Register any other tool your agency uses — available to automations and future connectors.',
  },
]

export const SENSITIVE_TYPES = new Set(['password'])

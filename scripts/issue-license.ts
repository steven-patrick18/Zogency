// Zogency license issuer (doc 02 §11.1). Run by the vendor, never shipped to clients.
//   npx tsx scripts/issue-license.ts --gen-keys
//   ZOGENCY_LICENSE_PRIVATE_KEY=<b64> npx tsx scripts/issue-license.ts \
//     --customer "BRB Digital" --plan pro --seats 10 --days 365
import { createPrivateKey, generateKeyPairSync, randomUUID, sign as edSign } from 'node:crypto'

const args = new Map<string, string>()
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args.set(argv[i].slice(2), argv[i + 1] ?? 'true')
}

if (args.has('gen-keys')) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  console.log('ZOGENCY_LICENSE_PUBLIC_KEY=' + publicKey.export({ format: 'der', type: 'spki' }).toString('base64'))
  console.log('ZOGENCY_LICENSE_PRIVATE_KEY=' + privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'))
  process.exit(0)
}

const privB64 = process.env.ZOGENCY_LICENSE_PRIVATE_KEY
if (!privB64) {
  console.error('Set ZOGENCY_LICENSE_PRIVATE_KEY (see --gen-keys). Never commit it.')
  process.exit(1)
}

const days = Number(args.get('days') ?? 365)
const now = new Date()
const claims = {
  licenseId: randomUUID(),
  customer: args.get('customer') ?? 'Unknown',
  plan: args.get('plan') ?? 'pro',
  seats: Number(args.get('seats') ?? 10),
  features: (args.get('features') ?? 'all').split(','),
  issuedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString(),
  graceDays: Number(args.get('grace') ?? 14),
}

const payload = Buffer.from(JSON.stringify(claims))
const key = createPrivateKey({ key: Buffer.from(privB64, 'base64'), format: 'der', type: 'pkcs8' })
const signature = edSign(null, payload, key)
const license = `zgy1.${payload.toString('base64url')}.${signature.toString('base64url')}`

console.log(JSON.stringify(claims, null, 2))
console.log('\nLicense key:\n' + license)

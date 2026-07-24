// Credential encryption at rest (doc 02 §6.3): AES-256-GCM, key from env.
// Stored format: zgyenc1.<iv b64url>.<authTag b64url>.<ciphertext b64url>
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import { requireSecret } from '@/lib/secret-guard'

function key(): Buffer {
  const secret = requireSecret(
    process.env.ZOGENCY_CREDENTIALS_KEY ?? process.env.AUTH_SECRET,
    'ZOGENCY_CREDENTIALS_KEY',
    'dev-only-fallback',
  )
  return createHash('sha256').update(secret).digest()
}

export function encryptJson(data: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const plaintext = Buffer.from(JSON.stringify(data), 'utf-8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return `zgyenc1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function decryptJson<T = Record<string, unknown>>(stored: string): T {
  // Legacy dev rows were plain JSON — accept them so nothing breaks mid-migration.
  if (!stored.startsWith('zgyenc1.')) return JSON.parse(stored) as T
  const [, ivB64, tagB64, dataB64] = stored.split('.')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ])
  return JSON.parse(plaintext.toString('utf-8')) as T
}

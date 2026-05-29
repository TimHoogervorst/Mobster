import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const KEY_LENGTH = 32 // 256 bits

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes), got ${keyHex.length} characters`,
    )
  }
  return key
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a hex-encoded string in the format: iv:tag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt a hex-encoded ciphertext string produced by encrypt().
 * Returns the original plaintext string.
 * Throws if the ciphertext has been tampered with.
 */
export function decrypt(encoded: string): string {
  const key = getKey()
  const parts = encoded.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format: expected iv:tag:ciphertext')
  }

  const [ivHex, tagHex, encryptedHex] = parts as [string, string, string]

  if (ivHex.length !== IV_LENGTH * 2) {
    throw new Error('Invalid IV length')
  }
  if (tagHex.length !== TAG_LENGTH * 2) {
    throw new Error('Invalid auth tag length')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  try {
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch (error) {
    throw new Error('Decryption failed: ciphertext may have been tampered with')
  }
}

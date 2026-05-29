import { describe, it, expect, beforeAll } from 'vitest'
import { encrypt, decrypt } from './encryption'

// Set a known key for testing
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes = 64 hex chars
})

describe('encrypt', () => {
  it('should produce a hex-encoded string with iv:tag:ciphertext format', () => {
    const result = encrypt('hello world')
    const parts = result.split(':')
    expect(parts).toHaveLength(3)
    // iv is 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32)
    // tag is 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32)
    // ciphertext is variable length
    expect(parts[2]!.length).toBeGreaterThan(0)
  })

  it('should produce different ciphertexts for the same plaintext', () => {
    const a = encrypt('same text')
    const b = encrypt('same text')
    expect(a).not.toBe(b) // Different IVs mean different ciphertexts
  })

  it('should produce different ciphertexts for different plaintexts', () => {
    const a = encrypt('text one')
    const b = encrypt('text two')
    expect(a).not.toBe(b)
  })
})

describe('decrypt', () => {
  it('should roundtrip correctly', () => {
    const original = 'my secret github token'
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('should handle empty strings', () => {
    const encrypted = encrypt('')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe('')
  })

  it('should handle unicode text', () => {
    const original = 'token with ünicode 🎉'
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('should handle long text', () => {
    const original = 'x'.repeat(10000)
    const encrypted = encrypt(original)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('should throw on tampered ciphertext', () => {
    const encrypted = encrypt('secret')
    const tampered = encrypted.slice(0, -2) + 'ff'
    expect(() => decrypt(tampered)).toThrow('Decryption failed')
  })

  it('should throw on invalid format', () => {
    expect(() => decrypt('not-valid')).toThrow('Invalid encrypted data format')
  })

  it('should throw on wrong IV length', () => {
    expect(() => decrypt('aa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:cc')).toThrow('Invalid IV length')
  })

  it('should throw when ENCRYPTION_KEY is not set', () => {
    const oldKey = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY')
    process.env.ENCRYPTION_KEY = oldKey
  })
})

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Mock state
let mockFiles: Record<string, Buffer | string> = {}
let isEncryptionAvailableValue = true

// Mock electron safeStorage
vi.mock('electron', () => {
  return {
    app: {
      getPath: () => __dirname
    },
    safeStorage: {
      isEncryptionAvailable: () => isEncryptionAvailableValue,
      encryptString: (str: string) => {
        // Simple mock encryption (prefix with "encrypted:")
        return Buffer.from('encrypted:' + str, 'utf-8')
      },
      decryptString: (buf: Buffer) => {
        const str = buf.toString('utf-8')
        if (!str.startsWith('encrypted:')) {
          throw new Error('Decryption failed')
        }
        return str.substring('encrypted:'.length)
      }
    }
  }
})

// Mock fs to work entirely in-memory
vi.mock('fs', () => {
  return {
    existsSync: (p: string) => {
      return p in mockFiles
    },
    writeFileSync: (p: string, data: any) => {
      mockFiles[p] = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')
    },
    readFileSync: (p: string) => {
      if (!(p in mockFiles)) throw new Error('File not found')
      return mockFiles[p]
    }
  }
})

import { saveApiKey, getApiKey } from './api-store'

describe('Secure API Key Store (api-store.ts)', () => {
  beforeEach(() => {
    mockFiles = {}
    isEncryptionAvailableValue = true
  })

  it('should encrypt and save API keys when safeStorage encryption is available', () => {
    saveApiKey('chatgpt', 'sk-gpt-12345')
    
    // Check that getApiKey returns the correctly decrypted value
    expect(getApiKey('chatgpt')).toBe('sk-gpt-12345')

    // Double check that the saved file in mockFiles has our mocked "encrypted:" prefix
    const filePath = path.join(__dirname, 'api-keys.enc')
    expect(mockFiles[filePath]).toBeDefined()
    const content = mockFiles[filePath].toString('utf-8')
    expect(content).toContain('encrypted:')
    expect(content).toContain('sk-gpt-12345')
  })

  it('should save API keys as plain JSON when safeStorage encryption is NOT available', () => {
    isEncryptionAvailableValue = false

    saveApiKey('claude', 'sk-claude-67890')

    // Check retrieval works cleanly
    expect(getApiKey('claude')).toBe('sk-claude-67890')

    // Verify the saved file is raw unencrypted JSON
    const filePath = path.join(__dirname, 'api-keys.enc')
    const rawContent = mockFiles[filePath].toString('utf-8')
    expect(rawContent).not.toContain('encrypted:')
    
    const parsed = JSON.parse(rawContent)
    expect(parsed.claude).toBe('sk-claude-67890')
  })

  it('should fallback gracefully to plain JSON if decryption fails on an encrypted file', () => {
    // Write unencrypted plain JSON directly to the mock store
    const filePath = path.join(__dirname, 'api-keys.enc')
    const plainJson = JSON.stringify({ gemini: 'sk-gemini-abc' })
    mockFiles[filePath] = Buffer.from(plainJson, 'utf-8')

    // Even if encryption is reported as available, decryptString will throw on "plainJson" 
    // because it doesn't start with the "encrypted:" mock prefix.
    // It must fall back to direct UTF-8 JSON parsing.
    isEncryptionAvailableValue = true
    
    expect(getApiKey('gemini')).toBe('sk-gemini-abc')
  })

  it('should delete a key from the store when saving an empty key', () => {
    saveApiKey('grok', 'sk-grok-111')
    expect(getApiKey('grok')).toBe('sk-grok-111')

    // Clear key
    saveApiKey('grok', '')
    expect(getApiKey('grok')).toBeNull()
  })

  it('should return null if the keys store file does not exist', () => {
    expect(getApiKey('deepseek')).toBeNull()
  })
})

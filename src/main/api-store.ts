import { safeStorage, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const KEYS_PATH = join(app.getPath('userData'), 'api-keys.enc')

export function saveApiKey(serviceId: string, key: string): void {
  const existing = loadAllKeys()
  if (!key) {
    delete existing[serviceId]
  } else {
    existing[serviceId] = key
  }
  
  try {
    const jsonStr = JSON.stringify(existing)
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(jsonStr)
      writeFileSync(KEYS_PATH, encrypted)
    } else {
      // Fallback in case encryption is not available (e.g. headless Linux tests)
      writeFileSync(KEYS_PATH, Buffer.from(jsonStr, 'utf-8'))
    }
  } catch (err) {
    console.error('Error saving API key:', err)
  }
}

export function getApiKey(serviceId: string): string | null {
  const all = loadAllKeys()
  return all[serviceId] ?? null
}

function loadAllKeys(): Record<string, string> {
  if (!existsSync(KEYS_PATH)) return {}
  try {
    const raw = readFileSync(KEYS_PATH)
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return JSON.parse(safeStorage.decryptString(raw))
      } catch {
        // In case it was written as plain text fallback or decryption failed
        return JSON.parse(raw.toString('utf-8'))
      }
    } else {
      return JSON.parse(raw.toString('utf-8'))
    }
  } catch (err) {
    console.error('Error loading API keys:', err)
    return {}
  }
}

import { execSync } from 'child_process'
import { readFileSync, copyFileSync, existsSync, unlinkSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir, homedir } from 'os'
import { createDecipheriv } from 'crypto'
import { session } from 'electron'
import Database from 'better-sqlite3'

function findBestCookieFile(): { file: string; localState: string } {
  const browsers = [
    join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
    join(homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data'),
    join(homedir(), 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data'),
  ]

  let best: { file: string; localState: string } | null = null
  let bestCount = -1

  for (const base of browsers) {
    const localState = join(base, 'Local State')
    if (!existsSync(localState)) continue

    let dirs: string[] = []
    try { dirs = readdirSync(base) } catch { continue }

    for (const dir of dirs) {
      if (dir !== 'Default' && !dir.startsWith('Profile')) continue
      for (const sub of [join('Network', 'Cookies'), 'Cookies']) {
        const p = join(base, dir, sub)
        if (!existsSync(p)) continue
        try {
          const db = new Database(p, { readonly: true, fileMustExist: true })
          const row = db.prepare(`SELECT COUNT(*) as n FROM cookies WHERE host_key LIKE '%.google.com'`).get() as { n: number }
          db.close()
          if (row.n > bestCount) { bestCount = row.n; best = { file: p, localState } }
        } catch {}
        break
      }
    }
  }

  if (!best || bestCount === 0) {
    // Build debug info
    const checked: string[] = []
    for (const base of browsers) {
      if (!existsSync(join(base, 'Local State'))) { checked.push(`MISSING: ${base}`); continue }
      let dirs: string[] = []
      try { dirs = readdirSync(base).filter(d => d === 'Default' || d.startsWith('Profile')) } catch {}
      for (const dir of dirs) {
        for (const sub of [join('Network', 'Cookies'), 'Cookies']) {
          const p = join(base, dir, sub)
          if (existsSync(p)) {
            try {
              const db = new Database(p, { readonly: true, fileMustExist: true })
              const total = (db.prepare('SELECT COUNT(*) as n FROM cookies').get() as any).n
              db.close()
              checked.push(`${p} — total: ${total}`)
            } catch (e: any) { checked.push(`${p} — error: ${e.message}`) }
            break
          }
        }
      }
    }
    throw new Error('No Google cookies found.\n' + checked.join('\n'))
  }
  return { ...best, googleCount: bestCount }
}

function getAesKey(localStatePath: string): Buffer {
  const state = JSON.parse(readFileSync(localStatePath, 'utf-8'))
  const encB64: string = state.os_crypt.encrypted_key
  const enc = Buffer.from(encB64, 'base64').slice(5).toString('base64')
  const ps = `Add-Type -AssemblyName System.Security; [System.Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect([System.Convert]::FromBase64String('${enc}'), $null, 'CurrentUser'))`
  const encoded = Buffer.from(ps, 'utf16le').toString('base64')
  const out = execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, { encoding: 'utf-8' }).trim()
  return Buffer.from(out, 'base64')
}

let firstDecryptError = ''
let firstPrefix = ''

function decryptValue(encrypted: Buffer, key: Buffer): string | null {
  const buf = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted)
  if (buf.length < 3) return null
  const prefix = buf.slice(0, 3).toString('latin1')
  if (!firstPrefix) firstPrefix = buf.slice(0, 6).toString('hex')
  if (prefix !== 'v10' && prefix !== 'v11') return null
  try {
    const nonce = buf.slice(3, 15)
    const tag = buf.slice(buf.length - 16)
    const cipher = buf.slice(15, buf.length - 16)
    const dec = createDecipheriv('aes-256-gcm', key, nonce)
    dec.setAuthTag(tag)
    return dec.update(cipher).toString('utf8') + dec.final().toString('utf8')
  } catch (e: any) {
    if (!firstDecryptError) firstDecryptError = e.message
    return null
  }
}

export async function importChromeGoogleCookies(partition: string): Promise<number> {
  const { file: cookieFile, localState, googleCount } = findBestCookieFile()
  const key = getAesKey(localState)

  const tmp = join(tmpdir(), `mm-cookies-${Date.now()}.db`)
  copyFileSync(cookieFile, tmp)
  for (const ext of ['-wal', '-shm']) {
    const src = cookieFile + ext
    if (existsSync(src)) copyFileSync(src, tmp + ext)
  }

  let count = 0
  let decryptFailed = 0
  firstDecryptError = ''
  firstPrefix = ''
  const db = new Database(tmp, { readonly: true, fileMustExist: true })
  try {
    const rows = db.prepare(`
      SELECT host_key, name, path, encrypted_value, expires_utc, is_secure, is_httponly, samesite
      FROM cookies
      WHERE host_key LIKE '%.google.com' OR host_key LIKE '%.googleapis.com'
    `).all() as any[]

    if (rows.length === 0) throw new Error(`Query returned 0 rows from copied file. Original had ${googleCount} rows — WAL copy issue.`)

    const ses = session.fromPartition(partition)
    for (const row of rows) {
      const encBuf = row.encrypted_value as Buffer
      const value = decryptValue(encBuf, key)
      if (value === null) { decryptFailed++; continue }
      try {
        await ses.cookies.set({
          url: `https://${row.host_key.replace(/^\./, '')}`,
          name: row.name,
          value,
          domain: row.host_key,
          path: row.path || '/',
          secure: !!row.is_secure,
          httpOnly: !!row.is_httponly,
          expirationDate: row.expires_utc ? row.expires_utc / 1000000 - 11644473600 : undefined,
          sameSite: row.samesite === 2 ? 'strict' : row.samesite === 1 ? 'lax' : 'no_restriction',
        })
        count++
      } catch { /* skip invalid */ }
    }
  } finally {
    db.close()
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(tmp + ext) } catch {}
    }
  }

  if (count === 0 && decryptFailed > 0) {
    throw new Error(`Found ${decryptFailed} Google cookies but all failed to decrypt.\nKey length: ${key.length}\nFirst 6 bytes (hex): ${firstPrefix}\nDecrypt error: ${firstDecryptError}`)
  }
  return count
}

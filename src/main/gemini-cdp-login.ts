import { spawn } from 'child_process'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { session } from 'electron'
import * as http from 'http'
import WebSocket from 'ws'

const CDP_PORT = 19222
const PROFILE_DIR = join(tmpdir(), 'multimind-gemini-profile')

function findChrome(): string {
  const candidates = [
    join(process.env['PROGRAMFILES'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['LOCALAPPDATA'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]
  const found = candidates.find(p => existsSync(p))
  if (!found) throw new Error('Chrome not found. Install Google Chrome to use Gemini login.')
  return found
}

function httpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve(data) } })
    })
    req.on('error', reject)
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function cdpGetCookies(wsUrl: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const t = setTimeout(() => { ws.terminate(); reject(new Error('CDP timeout')) }, 8000)
    ws.on('open', () => ws.send(JSON.stringify({ id: 1, method: 'Network.getAllCookies' })))
    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString())
      if (msg.id === 1) { clearTimeout(t); ws.close(); resolve(msg.result?.cookies ?? []) }
    })
    ws.on('error', e => { clearTimeout(t); reject(e) })
  })
}

export function startGeminiCdpLogin(
  partition: string,
  onDone: (loggedIn: boolean) => void
): () => void {
  const chromePath = findChrome()

  try { rmSync(PROFILE_DIR, { recursive: true, force: true }) } catch {}
  mkdirSync(PROFILE_DIR, { recursive: true })

  const proc = spawn(chromePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-extensions',
    'https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app',
  ], { detached: false, stdio: 'ignore' })

  let stopped = false
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const cleanup = () => {
    if (stopped) return
    stopped = true
    if (pollTimer) clearInterval(pollTimer)
    try { proc.kill() } catch {}
    setTimeout(() => { try { rmSync(PROFILE_DIR, { recursive: true, force: true }) } catch {} }, 2000)
  }

  const poll = async () => {
    if (stopped) return
    try {
      const targets: any[] = await httpGet(`http://localhost:${CDP_PORT}/json`)
      const target = targets.find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (!target) return

      const cookies = await cdpGetCookies(target.webSocketDebuggerUrl)
      const hasSession = cookies.some(c =>
        c.name === '__Secure-3PSID' && c.domain?.includes('google.com')
      )
      if (!hasSession) return

      const ses = session.fromPartition(partition)
      for (const c of cookies) {
        if (!c.domain?.includes('google.com') && !c.domain?.includes('googleapis.com')) continue
        try {
          await ses.cookies.set({
            url: `https://${c.domain.replace(/^\./, '')}`,
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/',
            secure: c.secure,
            httpOnly: c.httpOnly,
            expirationDate: c.expires > 0 ? c.expires : undefined,
            sameSite: c.sameSite?.toLowerCase() === 'strict' ? 'strict'
              : c.sameSite?.toLowerCase() === 'lax' ? 'lax' : 'no_restriction',
          })
        } catch {}
      }
      cleanup()
      onDone(true)
    } catch { /* Chrome not ready yet */ }
  }

  setTimeout(() => {
    if (!stopped) { poll(); pollTimer = setInterval(poll, 3000) }
  }, 2000)

  // Auto-timeout 5 min
  setTimeout(() => { if (!stopped) { cleanup(); onDone(false) } }, 5 * 60 * 1000)

  return cleanup
}

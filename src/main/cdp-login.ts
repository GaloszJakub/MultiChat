import { spawn } from 'child_process'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { session } from 'electron'
import * as http from 'http'
import WebSocket from 'ws'
import type { ServiceId } from './services/types'

interface CdpConfig {
  port: number
  loginUrl: string
  loggedInUrl: string
  sessionCookie: string  // cookie name that only exists after login
  captureDomains: string[]
}

const CONFIGS: Record<ServiceId, CdpConfig> = {
  gemini: {
    port: 19222,
    loginUrl: 'https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app',
    loggedInUrl: 'https://gemini.google.com',
    sessionCookie: '__Secure-3PSID',
    captureDomains: ['google.com', 'googleapis.com'],
  },
  chatgpt: {
    port: 19223,
    loginUrl: 'https://chatgpt.com',
    loggedInUrl: 'https://chatgpt.com',
    sessionCookie: '__Secure-next-auth.session-token',
    captureDomains: ['chatgpt.com', 'openai.com'],
  },
  claude: {
    port: 19224,
    loginUrl: 'https://claude.ai',
    loggedInUrl: 'https://claude.ai',
    sessionCookie: 'sessionKey',
    captureDomains: ['claude.ai', 'anthropic.com'],
  },
  grok: {
    port: 19225,
    loginUrl: 'https://x.com/i/grok',
    loggedInUrl: 'https://x.com',
    sessionCookie: 'auth_token',
    captureDomains: ['x.com', 'twitter.com', 'grok.com'],
  },
  kimi: {
    port: 19226,
    loginUrl: 'https://kimi.com',
    loggedInUrl: 'https://kimi.com',
    sessionCookie: 'kimi-auth',
    captureDomains: ['kimi.com', 'kimi.ai', 'moonshot.cn', 'www.kimi.com'],
  },
  deepseek: {
    port: 19227,
    loginUrl: 'https://chat.deepseek.com',
    loggedInUrl: 'https://chat.deepseek.com',
    sessionCookie: 'ds_session_id',
    captureDomains: ['deepseek.com', 'chat.deepseek.com'],
  },
}

function findChrome(): string {
  const candidates = [
    join(process.env['PROGRAMFILES'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['LOCALAPPDATA'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]
  const found = candidates.find(p => existsSync(p))
  if (!found) throw new Error('Chrome not found. Install Google Chrome to use this login.')
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

function cdpCommand(wsUrl: string, commands: { id: number; method: string; params?: any }[]): Promise<Map<number, any>> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    const results = new Map<number, any>()
    const ids = new Set(commands.map(c => c.id))
    const t = setTimeout(() => { ws.terminate(); reject(new Error('CDP timeout')) }, 8000)
    ws.on('open', () => commands.forEach(c => ws.send(JSON.stringify(c))))
    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString())
      if (ids.has(msg.id)) {
        results.set(msg.id, msg.result)
        if (results.size === ids.size) { clearTimeout(t); ws.close(); resolve(results) }
      }
    })
    ws.on('error', e => { clearTimeout(t); reject(e) })
  })
}

export function startCdpLogin(
  id: ServiceId,
  onDone: (loggedIn: boolean, localStorageData?: Record<string, string>) => void
): () => void {
  const config = CONFIGS[id]
  if (!config) { onDone(false); return () => {} }

  const chromePath = findChrome()
  const profileDir = join(tmpdir(), `multichat-cdp-${id}-${Date.now()}`)
  mkdirSync(profileDir, { recursive: true })

  const proc = spawn(chromePath, [
    `--remote-debugging-port=${config.port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-extensions',
    config.loginUrl,
  ], { detached: false, stdio: 'ignore' })

  let stopped = false
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let lastCookies: any[] = []
  let lastLocalStorage: Record<string, string> = {}

  const importCookies = async (wsUrl: string): Promise<boolean> => {
    try {
      const results = await cdpCommand(wsUrl, [
        { id: 1, method: 'Network.getAllCookies' },
      ])

      const cookies: any[] = results.get(1)?.cookies ?? []
      const hasSession = cookies.some(c => c.name.includes(config.sessionCookie))
      const domainCookies = cookies.filter(c => config.captureDomains.some(d => c.domain?.includes(d)))
      console.log(`[cdp:${id}] session cookie (${config.sessionCookie}):`, hasSession, `total:`, cookies.length)
      console.log(`[cdp:${id}] domain cookies:`, domainCookies.map(c => `${c.name}@${c.domain}`))
      if (!hasSession) return false

      const matching = cookies.filter(c =>
        config.captureDomains.some(d => c.domain?.includes(d))
      )
      if (matching.length === 0) return false

      const ses = session.fromPartition(`persist:${id}`)
      for (const c of matching) {
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
      return true
    } catch (e) {
      console.log(`[cdp:${id}] importCookies error:`, e)
      return false
    }
  }

  const cleanup = () => {
    if (stopped) return
    stopped = true
    if (pollTimer) clearInterval(pollTimer)
    try { proc.kill() } catch {}
    setTimeout(() => { try { rmSync(profileDir, { recursive: true, force: true }) } catch {} }, 2000)
  }

  const importAndFinish = async (cookies: any[]) => {
    // For Kimi and DeepSeek, grab all cookies (domain filter is too restrictive since it might use additional subdomains/domains for auth)
    const matching = (id === 'kimi' || id === 'deepseek')
      ? cookies
      : cookies.filter(c => config.captureDomains.some(d => c.domain?.includes(d)))
    console.log(`[cdp:${id}] Found ${matching.length} matching cookies to import.`)
    if (matching.length === 0) return false
    const ses = session.fromPartition(`persist:${id}`)
    for (const c of matching) {
      try {
        const url = `https://${c.domain.replace(/^\./, '')}`
        await ses.cookies.set({
          url,
          name: c.name, value: c.value,
          domain: c.domain, path: c.path || '/',
          secure: c.secure, httpOnly: c.httpOnly,
          expirationDate: c.expires > 0 ? c.expires : undefined,
          sameSite: c.sameSite?.toLowerCase() === 'strict' ? 'strict'
            : c.sameSite?.toLowerCase() === 'lax' ? 'lax' : 'no_restriction',
        })
        console.log(`[cdp:${id}] Imported cookie: ${c.name} (${c.domain})`)
      } catch (err: any) {
        console.error(`[cdp:${id}] Failed to import cookie ${c.name} (${c.domain}):`, err?.message ?? err)
      }
    }
    return true
  }

  const poll = async () => {
    if (stopped) return
    try {
      const targets: any[] = await httpGet(`http://localhost:${config.port}/json`)
      const pages = targets.filter((t: any) => t.type === 'page')
      console.log(`[cdp:${id}] pages:`, pages.map((t: any) => t.url))
      for (const target of pages) {
        if (!target.webSocketDebuggerUrl) continue
        try {
          const results = await cdpCommand(target.webSocketDebuggerUrl, [
            { id: 1, method: 'Network.getAllCookies' },
            { id: 2, method: 'Runtime.evaluate', params: { expression: `JSON.stringify(localStorage)` } }
          ])
          const cookies: any[] = results.get(1)?.cookies ?? []
          lastCookies = cookies

          const lsJson = results.get(2)?.result?.value ?? '{}'
          try {
            lastLocalStorage = JSON.parse(lsJson)
          } catch {}

          // Import immediately if session cookie found — don't wait for Chrome exit
          let hasSession = cookies.some(c => c.name.includes(config.sessionCookie))
          if (hasSession && (id === 'kimi' || id === 'deepseek')) {
            try {
              const expression = id === 'kimi'
                ? `(() => {
                    const userBtn = document.querySelector('.user-info-button')
                    const userName = document.querySelector('.user-name')
                    if (userBtn && userName && userName.innerText.trim().length > 0) return true
                    const avatar = document.querySelector('.user-avatar')
                    return !!(avatar && avatar.src && avatar.src.includes('avatar.moonshot.cn'))
                  })()`
                : `(() => {
                    const hasInput = !!document.querySelector('#chat-input')
                    const hasAvatar = !!document.querySelector('[class*="avatar"], [class*="profile"]')
                    return hasInput || hasAvatar
                  })()`

              const evalRes = await cdpCommand(target.webSocketDebuggerUrl, [
                {
                  id: 3,
                  method: 'Runtime.evaluate',
                  params: { expression }
                }
              ])
              const isLogged = evalRes.get(3)?.result?.value === true
              if (!isLogged) hasSession = false
            } catch {
              hasSession = false
            }
          }

          if (hasSession) {
            console.log(`[cdp:${id}] session cookie found — importing and finishing`)
            await importAndFinish(cookies)
            cleanup()
            onDone(true, lastLocalStorage)
            return
          }
        } catch {}
      }
    } catch (e) { console.log(`[cdp:${id}] poll error:`, e) }
  }

  proc.on('exit', async (code) => {
    console.log(`[cdp:${id}] Chrome exited with code`, code)
    if (stopped) return
    stopped = true
    if (pollTimer) clearInterval(pollTimer)
    // Import from last known cookies snapshot
    const imported = await importAndFinish(lastCookies)
    console.log(`[cdp:${id}] exit — imported: ${imported}`)
    onDone(imported, lastLocalStorage)
    setTimeout(() => { try { rmSync(profileDir, { recursive: true, force: true }) } catch {} }, 2000)
  })

  setTimeout(() => {
    if (!stopped) { poll(); pollTimer = setInterval(poll, 3000) }
  }, 2000)

  // Auto-timeout 5 min
  setTimeout(() => { if (!stopped) { cleanup(); onDone(false) } }, 5 * 60 * 1000)

  return cleanup
}

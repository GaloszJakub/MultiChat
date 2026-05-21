import { session } from 'electron'
import type { ServiceAdapter, WebContentsHost, ScrapeResult } from './types'

export const SELECTORS = {
  composer: 'textarea',
  sendButton: 'button[type="submit"], button[aria-label*="Send"]',
  loginIndicator: 'textarea[placeholder*="Grok"], textarea[placeholder*="Ask"], textarea[placeholder*="Message"], textarea[placeholder*="message"]',
  response: '[class*="message"]:last-of-type [class*="prose"], [class*="assistant"]:last-of-type',
  stopButton: 'button[aria-label*="Stop"], button[aria-label*="stop"]',
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const grokAdapter: ServiceAdapter = {
  id: 'grok',
  label: 'Grok',
  url: 'https://grok.com',
  partition: 'persist:grok',

  async isLoggedIn(_host: WebContentsHost): Promise<boolean> {
    try {
      const ses = session.fromPartition('persist:grok')
      const all = await ses.cookies.get({})
      return all.some(c => c.name === 'auth_token' && c.domain?.includes('x.com'))
    } catch {
      return false
    }
  },

  async submitPrompt(host: WebContentsHost, text: string): Promise<void> {
    const safeText = JSON.stringify(text)
    const found = await host.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('${SELECTORS.composer}')
        if (!el) return false
        el.focus()
        const dt = new DataTransfer()
        dt.setData('text/plain', ${safeText})
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
        return true
      })()
    `)

    if (!found) throw new Error('Grok composer not found')

    await delay(800)

    const sent = await host.webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('${SELECTORS.sendButton}')
        if (btn && !btn.disabled) { btn.click(); return true }
        return false
      })()
    `)

    if (!sent) {
      host.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' })
      host.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
    }
  },

  async scrapeResponse(host: WebContentsHost): Promise<ScrapeResult> {
    return host.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('${SELECTORS.response}')
        const streaming = !!document.querySelector('${SELECTORS.stopButton}')
        return { text: el?.innerText ?? '', done: !streaming }
      })()
    `)
  },
}

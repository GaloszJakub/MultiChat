import { session } from 'electron'
import type { ServiceAdapter, WebContentsHost, ScrapeResult } from './types'

export const SELECTORS = {
  composer: '#chat-input, textarea[placeholder*="Message"], textarea[placeholder*="message"], textarea',
  sendButton: 'button[aria-label="Send message"], div[role="button"][aria-label*="Send"], button[class*="send"], button.send-button',
  loginIndicator: '#chat-input',
  response: '[class*="ds-markdown"]:last-of-type, [class*="message-content"]:last-of-type',
  stopButton: 'button[aria-label="Stop"], div[role="button"][aria-label*="Stop"]',
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const deepseekAdapter: ServiceAdapter = {
  id: 'deepseek',
  label: 'DeepSeek',
  url: 'https://chat.deepseek.com',
  partition: 'persist:deepseek',

  async isLoggedIn(host: WebContentsHost): Promise<boolean> {
    try {
      const url = host.webContents.getURL()
      if (!url || url === 'about:blank') return false
      if (url.includes('/sign-in') || url.includes('/login')) return false

      return await host.webContents.executeJavaScript(`
        (() => {
          const hasInput = !!document.querySelector('#chat-input')
          const hasAvatar = !!document.querySelector('[class*="avatar"], [class*="profile"]')
          return hasInput || hasAvatar
        })()
      `).catch(() => false)
    } catch {
      return false
    }
  },

  async submitPrompt(host: WebContentsHost, text: string): Promise<void> {
    const escaped = text.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
    const found = await host.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('${SELECTORS.composer}')
        if (!el) return false
        el.focus()
        document.execCommand('selectAll', false, null)
        document.execCommand('insertText', false, \`${escaped}\`)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      })()
    `)
    if (!found) throw new Error('DeepSeek composer not found')
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
        const all = document.querySelectorAll('${SELECTORS.response}')
        const el = all[all.length - 1]
        const streaming = !!document.querySelector('${SELECTORS.stopButton}')
        return { text: el?.innerText ?? '', done: !streaming }
      })()
    `)
  },
}

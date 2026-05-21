import { session } from 'electron'
import type { ServiceAdapter, WebContentsHost, ScrapeResult } from './types'

export const SELECTORS = {
  composer: 'rich-textarea .ql-editor[contenteditable="true"]',
  sendButton: 'button[aria-label="Send message"]',
  loginIndicator: 'rich-textarea .ql-editor',
  response: 'model-response',
  stopButton: 'button[aria-label*="Stop"], button[aria-label*="stop"], .stop-button',
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const geminiAdapter: ServiceAdapter = {
  id: 'gemini',
  label: 'Gemini',
  url: 'https://gemini.google.com/app',
  partition: 'persist:gemini',

  async isLoggedIn(host: WebContentsHost): Promise<boolean> {
    try {
      const url = host.webContents.getURL()
      if (!url || url === 'about:blank' || url.includes('accounts.google.com')) return false
      const hasSignIn = await host.webContents.executeJavaScript(
        `!![...document.querySelectorAll('button,a')].find(el => el.textContent?.trim() === 'Zaloguj się')`
      ).catch(() => false)
      return !hasSignIn
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
        document.execCommand('selectAll', false, null)
        document.execCommand('insertText', false, ${safeText})
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }))
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }))
        return true
      })()
    `)

    if (!found) throw new Error('Gemini composer not found')

    await delay(800)

    const sent = await host.webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('${SELECTORS.sendButton}')
        if (btn) { btn.click(); return true }
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
        const all = document.querySelectorAll('model-response')
        const el = all[all.length - 1]
        const mc = el?.querySelector('message-content, .markdown')
        const text = mc?.innerText || mc?.textContent || ''
        const streaming = !!document.querySelector('${SELECTORS.stopButton}')
        return { text, done: !streaming }
      })()
    `)
  },
}

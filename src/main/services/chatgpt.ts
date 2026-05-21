import { session } from 'electron'
import type { ServiceAdapter, WebContentsHost, ScrapeResult } from './types'

export const SELECTORS = {
  composer: '#prompt-textarea',
  sendButton: '[data-testid="send-button"]',
  loginIndicator: '#prompt-textarea',
  response: '[data-message-author-role="assistant"]:last-of-type .markdown',
  stopButton: 'button[data-testid="stop-button"]',
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const chatgptAdapter: ServiceAdapter = {
  id: 'chatgpt',
  label: 'ChatGPT',
  url: 'https://chatgpt.com',
  partition: 'persist:chatgpt',

  async isLoggedIn(_host: WebContentsHost): Promise<boolean> {
    try {
      const ses = session.fromPartition('persist:chatgpt')
      const all = await ses.cookies.get({})
      return all.some(c => c.name.startsWith('__Secure-next-auth.session-token') && c.domain?.includes('chatgpt.com'))
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
        const dt = new DataTransfer()
        dt.setData('text/plain', \`${escaped}\`)
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
        return true
      })()
    `)

    if (!found) throw new Error('ChatGPT composer not found')

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
        const all = document.querySelectorAll('[data-message-author-role="assistant"] .markdown, [data-message-author-role="assistant"] .prose')
        const el = all[all.length - 1]
        const streaming = !!document.querySelector('${SELECTORS.stopButton}')
        return { text: el?.innerText ?? '', done: !streaming }
      })()
    `)
  },
}

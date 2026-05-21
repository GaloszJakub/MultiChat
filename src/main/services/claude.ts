import { session } from 'electron'
import type { ServiceAdapter, WebContentsHost, ScrapeResult } from './types'

export const SELECTORS = {
  composer: '[contenteditable="true"].ProseMirror',
  sendButton: 'button[aria-label="Send message"]',
  loginIndicator: '[contenteditable="true"].ProseMirror',
  response: '.font-claude-response',
  stopButton: 'button[aria-label="Stop response"]',
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const claudeAdapter: ServiceAdapter = {
  id: 'claude',
  label: 'Claude',
  url: 'https://claude.ai/new',
  partition: 'persist:claude',

  async isLoggedIn(_host: WebContentsHost): Promise<boolean> {
    try {
      const ses = session.fromPartition('persist:claude')
      const all = await ses.cookies.get({})
      return all.some(c => c.name === 'sessionKey' && c.domain?.includes('claude.ai'))
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

    if (!found) throw new Error('Claude composer not found')

    let sent = false
    for (let i = 0; i < 10; i++) {
      await delay(200)
      sent = await host.webContents.executeJavaScript(`
        (() => {
          const btn = document.querySelector('${SELECTORS.sendButton}')
          if (btn && !btn.disabled) { btn.click(); return true }
          return false
        })()
      `)
      if (sent) break
    }

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
        return { text: el?.innerText || el?.textContent || '', done: !streaming }
      })()
    `)
  },
}

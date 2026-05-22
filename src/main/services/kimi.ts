import type { ServiceAdapter, WebContentsHost, ScrapeResult } from './types'

export const SELECTORS = {
  composer: '[contenteditable="true"], .chat-input-editor, [data-lexical-editor="true"]',
  sendButton: '.send-button-container, button[class*="send"], .send-button-container button',
  loginIndicator: '#msh-chatinput-editor',
  response: '.chat-message--assistant .content, [class*="assistant"] [class*="content"]',
  stopButton: 'button[aria-label*="Stop"], button[aria-label*="stop"], button[class*="stop"]',
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const kimiAdapter: ServiceAdapter = {
  id: 'kimi',
  label: 'Kimi',
  url: 'https://kimi.com',
  partition: 'persist:kimi',

  async isLoggedIn(host: WebContentsHost): Promise<boolean> {
    try {
      const url = host.webContents.getURL()
      if (!url || url === 'about:blank') return false
      return await host.webContents.executeJavaScript(`
        (() => {
          const userBtn = document.querySelector('.user-info-button')
          const userName = document.querySelector('.user-name')
          if (userBtn && userName && userName.innerText.trim().length > 0) return true
          const avatar = document.querySelector('.user-avatar')
          return !!(avatar && avatar.src && avatar.src.includes('avatar.moonshot.cn'))
        })()
      `).catch(() => false)
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
        return true
      })()
    `)
    if (!found) throw new Error('Kimi composer not found')
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

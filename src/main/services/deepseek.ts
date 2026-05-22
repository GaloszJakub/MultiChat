import { session } from 'electron'
import type { ServiceAdapter, WebContentsHost, ScrapeResult } from './types'

export const SELECTORS = {
  composer: '#chat-input, textarea[placeholder*="Message"], textarea[placeholder*="message"], textarea',
  sendButton: 'button[aria-label="Send message"], div[role="button"][aria-label*="Send"], button[class*="send"], button.send-button',
  loginIndicator: '#chat-input',
  response: '[class*="ds-markdown"], [class*="message-content"]',
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
      const ses = session.fromPartition('persist:deepseek')
      const cookies = await ses.cookies.get({})
      try {
        const fs = require('fs')
        fs.writeFileSync('C:\\Users\\Kuba\\Documents\\GitHub\\MultiChat\\debug_cookies.json', JSON.stringify(cookies.map(c => ({ name: c.name, domain: c.domain })), null, 2))
      } catch (e) {}
      const hasCookie = cookies.some(c => c.name === 'ds_session_id' && c.domain?.includes('deepseek.com'))
      if (hasCookie) return true

      const url = host.webContents.getURL()
      if (!url || url === 'about:blank') return false
      if (url.includes('/sign-in') || url.includes('/login')) return false

      return await host.webContents.executeJavaScript(`
        (() => {
          const hasInput = !!document.querySelector('#chat-input, textarea')
          const hasAvatar = !!document.querySelector('[class*="avatar"], [class*="profile"]')
          return hasInput || hasAvatar
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

        const promptText = ${safeText}

        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          // Native React value setter for textareas
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
            || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
          if (setter) {
            setter.call(el, promptText)
          } else {
            el.value = promptText
          }
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        } else {
          // Fallback for contenteditable
          document.execCommand('selectAll', false, null)
          document.execCommand('insertText', false, promptText)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          
          // Secondary fallback using DataTransfer
          const dt = new DataTransfer()
          dt.setData('text/plain', promptText)
          el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
        }

        // Tiny delay and keypress simulator to ensure React state handles text changes
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }))
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }))
        return true
      })()
    `)

    if (!found) throw new Error('DeepSeek composer not found')
    await delay(600)

    const sent = await host.webContents.executeJavaScript(`
      (() => {
        // Try multiple selectors and strategies to find the send button
        let btn = document.querySelector('${SELECTORS.sendButton}')
        
        if (!btn) {
          // Chinese aria-label
          btn = document.querySelector('button[aria-label="发送"], div[role="button"][aria-label="发送"]')
        }
        if (!btn) {
          // English aria-label
          btn = document.querySelector('button[aria-label*="Send"], div[role="button"][aria-label*="Send"]')
        }
        if (!btn) {
          // Find any button in the same container as the chat-input
          const textarea = document.querySelector('#chat-input')
          if (textarea) {
            const parent = textarea.parentElement
            if (parent) {
              btn = parent.querySelector('button:not([aria-label*="attach"]):not([class*="attach"]), div[role="button"]:not([class*="attach"])')
            }
          }
        }
        if (!btn) {
          // Find button by label text
          const allBtns = [...document.querySelectorAll('button, div[role="button"]')]
          btn = allBtns.find(b => {
            const label = b.getAttribute('aria-label') || ''
            const text = b.innerText || ''
            return label.toLowerCase().includes('send') || label.includes('发送') || text.toLowerCase().includes('send') || text.includes('发送')
          })
        }

        if (btn && !btn.disabled) {
          btn.click()
          return true
        }

        // Fallback: Try dispatching Enter event on input directly via JS
        const el = document.querySelector('${SELECTORS.composer}')
        if (el) {
          el.focus()
          const enterDown = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          })
          el.dispatchEvent(enterDown)
          
          const enterUp = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          })
          el.dispatchEvent(enterUp)
          return true
        }

        return false
      })()
    `)

    if (!sent) {
      // Native electron keystroke fallback
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

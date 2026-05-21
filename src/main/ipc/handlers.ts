import { ipcMain, BrowserWindow, clipboard } from 'electron'
import { listSkills, readSkill, openSkillsDir, createSkill, deleteSkill } from '../skills'
import { importChromeGoogleCookies } from '../cookie-import'
import { startCdpLogin } from '../cdp-login'
import { IPC } from './channels'
import type { ViewManager } from '../views/manager'
import { adapterMap, adapters } from '../services/registry'
import type { ServiceId, BroadcastResult } from '../services/types'

let pollTimer: ReturnType<typeof setInterval> | null = null

export function registerHandlers(viewManager: ViewManager) {
  ipcMain.handle(IPC.VIEWS_SET_BOUNDS, (_e, bounds) => {
    viewManager.setBounds(bounds)
  })

  ipcMain.handle(IPC.VIEWS_RELOAD, (_e, id?: ServiceId) => {
    if (id) viewManager.reload(id)
    else viewManager.reloadAll()
  })

  ipcMain.handle(IPC.VIEWS_FOCUS, (_e, id: ServiceId) => {
    viewManager.focus(id)
  })

  ipcMain.handle(IPC.VIEWS_OPEN_DEVTOOLS, (_e, id: ServiceId) => {
    viewManager.openDevTools(id)
  })

  ipcMain.handle(IPC.VIEWS_LOGIN, (_e, id: ServiceId) => {
    viewManager.openLoginPopup(id)
  })

  ipcMain.handle(IPC.BROADCAST_SEND, async (_e, text: string, enabledIds: ServiceId[]): Promise<BroadcastResult[]> => {
    clipboard.writeText(text)

    const results: BroadcastResult[] = []
    const initialTexts = new Map<ServiceId, string>()

    for (const id of enabledIds) {
      const adapter = adapterMap.get(id)
      const view = viewManager.getView(id)
      if (!adapter || !view) continue
      try {
        view.webContents.focus()
        await new Promise(r => setTimeout(r, 200))
        const initRes = await adapter.scrapeResponse(view).catch(() => ({ text: '' }))
        initialTexts.set(id, initRes.text || '')
      } catch {
        initialTexts.set(id, '')
      }
    }

    for (const id of enabledIds) {
      const adapter = adapterMap.get(id)
      const view = viewManager.getView(id)
      if (!adapter || !view) { results.push({ id, ok: false, error: 'not found' }); continue }
      try {
        view.webContents.focus()
        await adapter.submitPrompt(view, text)
        results.push({ id, ok: true })
      } catch (err: any) {
        results.push({ id, ok: false, error: err?.message ?? String(err) })
      }
      await new Promise(r => setTimeout(r, 200))
    }

    // Start response polling for all successful sends
    const win = BrowserWindow.fromWebContents(_e.sender)
    if (win) {
      const successIds = results.filter(r => r.ok).map(r => r.id)
      startResponsePoller(win, viewManager, successIds, initialTexts)
    }

    return results
  })

  ipcMain.handle(IPC.IMPORT_CHROME_COOKIES, async (_e, partition: string) => {
    try {
      const count = await importChromeGoogleCookies(partition)
      viewManager.reload('gemini')
      return { ok: true, count }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) }
    }
  })

  // Services that block Electron WebViews need real Chrome via CDP
  const CDP_SERVICES = new Set<ServiceId>(['gemini', 'chatgpt', 'kimi', 'deepseek'])

  ipcMain.handle(IPC.CDP_LOGIN, (_e, id: ServiceId) => {
    if (CDP_SERVICES.has(id)) {
      const win = BrowserWindow.getAllWindows()[0]
      startCdpLogin(id, async (loggedIn, localStorageData) => {
        const view = viewManager.getView(id)
        const adapter = adapterMap.get(id)
        if (view && adapter) {
          if (loggedIn && localStorageData && Object.keys(localStorageData).length > 0) {
            const injectLs = async () => {
              for (const [key, val] of Object.entries(localStorageData)) {
                try {
                  const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                  const escapedVal = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
                  await view.webContents.executeJavaScript(`localStorage.setItem('${escapedKey}', '${escapedVal}')`)
                } catch (e) {
                  console.error('[CDP] failed to inject localStorage key:', key, e)
                }
              }
              view.webContents.removeListener('did-navigate', injectLs)
              view.webContents.reload()
            }
            view.webContents.on('did-navigate', injectLs)
          }
          await view.webContents.loadURL(adapter.url)
        } else {
          viewManager.reload(id)
        }
        win?.webContents.send(IPC.SERVICE_STATUS, { id, loggedIn })
      })
    } else {
      // Electron popup with same partition — cookies persist automatically
      viewManager.openLoginPopup(id)
    }
    return { ok: true }
  })

  const getWin = () => BrowserWindow.getAllWindows()[0]
  ipcMain.handle(IPC.WIN_MINIMIZE, () => getWin()?.minimize())
  ipcMain.handle(IPC.WIN_MAXIMIZE, () => {
    const w = getWin()
    if (!w) return
    w.isMaximized() ? w.unmaximize() : w.maximize()
  })
  ipcMain.handle(IPC.WIN_CLOSE, () => getWin()?.close())
  ipcMain.handle(IPC.WIN_IS_MAXIMIZED, () => getWin()?.isMaximized() ?? false)

  ipcMain.handle(IPC.SKILLS_LIST, () => listSkills())
  ipcMain.handle(IPC.SKILLS_READ, (_e, file: string) => readSkill(file))
  ipcMain.handle(IPC.SKILLS_OPEN_DIR, () => openSkillsDir())
  ipcMain.handle(IPC.SKILLS_CREATE, (_e, name: string, content: string) => {
    const file = createSkill(name, content)
    return { file }
  })
  ipcMain.handle(IPC.SKILLS_DELETE, (_e, file: string) => {
    deleteSkill(file)
    return { ok: true }
  })

  ipcMain.handle(IPC.VIEWS_NEW_CHAT, (_e, id: ServiceId) => {
    const adapter = adapterMap.get(id)
    const view = viewManager.getView(id)
    if (adapter && view) view.webContents.loadURL(adapter.url)
  })

  ipcMain.handle(IPC.SERVICE_SET_MODEL, async (_e, id: ServiceId, modelName: string) => {
    const view = viewManager.getView(id)
    if (!view) return { ok: false, error: 'view not found' }
    const escaped = modelName.replace(/'/g, "\\'")

    if (id === 'claude') {
      await view.webContents.executeJavaScript(`
        (() => {
          const btn = document.querySelector('button[aria-label^="Model:"]')
          if (!btn) return
          if (btn.getAttribute('aria-label')?.includes('${escaped}')) return
          btn.click()
          setTimeout(() => {
            const menus = [...document.querySelectorAll('[role="menu"]')]
            for (const menu of menus) {
              const items = [...menu.querySelectorAll('[role="menuitemradio"]')]
              const target = items.find(el => el.querySelector('.font-ui')?.textContent.trim() === '${escaped}')
              if (target) { target.click(); return }
            }
            const moreBtn = [...document.querySelectorAll('[role="menu"] [role="menuitem"]')]
              .find(el => el.textContent.trim().startsWith('More models'))
            if (moreBtn) {
              moreBtn.click()
              setTimeout(() => {
                const allItems = [...document.querySelectorAll('[role="menuitemradio"]')]
                const target = allItems.find(el => el.querySelector('.font-ui')?.textContent.trim() === '${escaped}')
                if (target) target.click()
              }, 300)
            }
          }, 300)
        })()
      `)
    } else if (id === 'gemini') {
      await view.webContents.executeJavaScript(`
        (async () => {
          const currentLabel = document.querySelector('gem-menu-item.selected span.label')
          if (currentLabel && currentLabel.innerText.trim().toLowerCase() === '${escaped}'.toLowerCase()) return true
          const trigger = document.querySelector('button.input-area-switch')
          if (!trigger) return false
          trigger.click()
          await new Promise((resolve, reject) => {
            let elapsed = 0
            const interval = setInterval(() => {
              if (document.querySelector('gem-menu[role="menu"]')) { clearInterval(interval); resolve(null) }
              elapsed += 50
              if (elapsed > 3000) { clearInterval(interval); reject(new Error('Menu timeout')) }
            }, 50)
          })
          const items = [...document.querySelectorAll('gem-menu-item[role="menuitem"]')]
          const target = items.find(item => {
            const label = item.querySelector('span.label')?.innerText?.trim() ?? ''
            return label.toLowerCase().includes('${escaped}'.toLowerCase())
          })
          if (!target) return false
          target.click()
          return true
        })()
      `)
    }

    return { ok: true }
  })

  ipcMain.handle(IPC.BROADCAST_SEQUENTIAL, async (_e, text: string, orderedIds: ServiceId[]): Promise<BroadcastResult[]> => {
    clipboard.writeText(text)
    const win = BrowserWindow.fromWebContents(_e.sender)
    const results: BroadcastResult[] = []
    let contextBlock = ''

    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      const adapter = adapterMap.get(id)
      const view = viewManager.getView(id)
      if (!adapter || !view) {
        results.push({ id, ok: false, error: 'not found' })
        continue
      }

      if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(IPC.SERIAL_PROGRESS, { currentId: id, index: i, total: orderedIds.length, done: false })
      }

      const fullPrompt = contextBlock
        ? `Original question:\n"${text}"\n\nPrevious model responses:\n${contextBlock}\n---\nReview the above and provide your own answer. What would you add, correct, or approach differently?`
        : text

      try {
        view.webContents.focus()
        await new Promise(r => setTimeout(r, 200))
        const initRes = await adapter.scrapeResponse(view).catch(() => ({ text: '' }))
        await adapter.submitPrompt(view, fullPrompt)
        results.push({ id, ok: true })

        if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
          const finalResponse = await waitForResponse(win, viewManager, id, initRes.text || '')
          contextBlock += `\n**${adapter.label}:**\n${finalResponse}\n`
        }
      } catch (err: any) {
        results.push({ id, ok: false, error: err?.message ?? String(err) })
      }

      await new Promise(r => setTimeout(r, 200))
    }

    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send(IPC.SERIAL_PROGRESS, { currentId: orderedIds[orderedIds.length - 1], index: orderedIds.length, total: orderedIds.length, done: true })
    }

    return results
  })

  startLoginPoller(viewManager)
}

function startLoginPoller(viewManager: ViewManager) {
  if (pollTimer) clearInterval(pollTimer)

  const check = async () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) {
      stopLoginPoller()
      return
    }

    for (const adapter of adapters) {
      const view = viewManager.getView(adapter.id)
      if (!view || view.webContents.isDestroyed()) continue
      try {
        const loggedIn = await adapter.isLoggedIn(view)
        if (win.isDestroyed() || win.webContents.isDestroyed()) return
        win.webContents.send(IPC.SERVICE_STATUS, {
          id: adapter.id,
          loggedIn,
        })
      } catch {
        // view not ready yet — skip
      }
    }
  }

  // First check after 3s (give pages time to load)
  setTimeout(() => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return
    check()
  }, 3000)
  pollTimer = setInterval(check, 4000)
}

export function stopLoginPoller() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startResponsePoller(win: BrowserWindow, viewManager: ViewManager, ids: ServiceId[], initialTexts: Map<ServiceId, string>) {
  const done = new Set<ServiceId>()
  const hasStarted = new Set<ServiceId>()
  const hadStopButton = new Map<ServiceId, boolean>()
  const lastTexts = new Map<ServiceId, string>()
  const stableTicks = new Map<ServiceId, number>()
  const started = Date.now()
  const TIMEOUT = 120_000

  const tick = async () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) {
      clearInterval(timer)
      return
    }

    for (const id of ids) {
      if (done.has(id)) continue
      const adapter = adapterMap.get(id)
      const view = viewManager.getView(id)
      if (!view || view.webContents.isDestroyed()) continue
      if (!adapter) continue
      try {
        const result = await adapter.scrapeResponse(view)
        const initialText = initialTexts.get(id) ?? ''
        const textChanged = result.text !== initialText
        const isStreaming = !result.done
        const elapsed = Date.now() - started

        if (textChanged || isStreaming) {
          hasStarted.add(id)
        }

        if (hasStarted.has(id)) {
          if (isStreaming) {
            hadStopButton.set(id, true)
          }

          const lastText = lastTexts.get(id) ?? ''
          let stable = stableTicks.get(id) ?? 0

          if (result.text !== lastText) {
            stable = 0
            stableTicks.set(id, 0)
          } else {
            stable += 1
            stableTicks.set(id, stable)
          }
          lastTexts.set(id, result.text)

          const hasStop = hadStopButton.get(id) ?? false
          let ready = false

          if (hasStop) {
            ready = result.done && stable >= 1 && result.text.length > 0
          } else {
            ready = stable >= 4 && result.text.length > 0 && elapsed > 3000
          }

          console.log(`[response:${id}] text length:`, result.text.length, 'done:', ready, 'stable:', stable, 'hasStop:', hasStop, 'preview:', result.text.slice(0, 80))
          if (win.isDestroyed() || win.webContents.isDestroyed()) {
            clearInterval(timer)
            return
          }
          win.webContents.send(IPC.SERVICE_RESPONSE, { id, text: result.text, done: ready })
          if (ready) done.add(id)
        } else {
          if (elapsed > 20000) {
            console.log(`[response:${id}] Start timeout - did not detect start after 20s`)
            done.add(id)
          }
        }
      } catch (e) { console.log(`[response:${id}] error:`, e) }
    }

    if (done.size === ids.length || Date.now() - started > TIMEOUT) {
      clearInterval(timer)
    }
  }

  // Start polling immediately (since we handle non-started state gracefully)
  const timer = setInterval(tick, 800)
  setTimeout(() => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return
    tick()
  }, 100)
}

function waitForResponse(
  win: BrowserWindow,
  viewManager: ViewManager,
  id: ServiceId,
  initialText: string,
): Promise<string> {
  return new Promise((resolve) => {
    const started = Date.now()
    const TIMEOUT = 120_000
    let lastText = initialText
    let stableTicks = 0
    let hasStarted = false
    let hadStopButton = false

    const tick = async () => {
      if (win.isDestroyed() || win.webContents.isDestroyed()) {
        clearInterval(timer)
        resolve(lastText)
        return
      }

      const adapter = adapterMap.get(id)
      const view = viewManager.getView(id)
      if (!adapter || !view || view.webContents.isDestroyed()) {
        clearInterval(timer)
        resolve(lastText)
        return
      }

      try {
        const result = await adapter.scrapeResponse(view)
        const textChanged = result.text !== initialText
        const isStreaming = !result.done
        const elapsed = Date.now() - started

        if (textChanged || isStreaming) {
          hasStarted = true
        }

        if (hasStarted) {
          if (isStreaming) {
            hadStopButton = true
          }

          if (result.text !== lastText) {
            stableTicks = 0
          } else {
            stableTicks++
          }
          lastText = result.text

          const ready = hadStopButton
            ? result.done && stableTicks >= 1 && result.text.length > 0
            : stableTicks >= 4 && result.text.length > 0 && elapsed > 3000

          // Send partial response to renderer
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            win.webContents.send(IPC.SERVICE_RESPONSE, { id, text: result.text, done: ready })
          }

          if (ready || elapsed > TIMEOUT) {
            clearInterval(timer)
            resolve(result.text)
          }
        } else {
          if (elapsed > 20000) {
            console.log(`[waitForResponse:${id}] Start timeout - did not detect start after 20s`)
            clearInterval(timer)
            resolve(lastText)
          }
        }
      } catch (e) {
        console.error(`[waitForResponse:${id}] error:`, e)
      }
    }

    const timer = setInterval(tick, 800)
    setTimeout(tick, 100)
  })
}

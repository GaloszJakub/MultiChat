import { ipcMain, BrowserWindow, clipboard, dialog } from 'electron'
import { listSkills, readSkill, openSkillsDir, createSkill, deleteSkill } from '../skills'
import { importChromeGoogleCookies } from '../cookie-import'
import { startCdpLogin } from '../cdp-login'
import { IPC } from './channels'
import { savePrompt, getHistory, clearHistory, saveConversation, getConversations, getConversationDetails, deleteConversation, clearAllConversations } from '../history'
import { saveApiKey, getApiKey } from '../api-store'
import { streamClaude } from '../api-adapters/claude-api'
import { streamOpenAI } from '../api-adapters/openai-api'
import type { ViewManager } from '../views/manager'
import { adapterMap, adapters } from '../services/registry'
import type { ServiceId, BroadcastResult } from '../services/types'
import * as fs from 'fs'
import * as path from 'path'

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

  ipcMain.handle(IPC.VIEWS_GET_URLS, () => {
    const urls: Record<string, string> = {}
    for (const [id, view] of viewManager.getAllViews()) {
      try {
        urls[id] = view.webContents.getURL()
      } catch (err) {
        console.error(`Error getting URL for ${id}:`, err)
      }
    }
    return urls
  })

  ipcMain.handle(IPC.VIEWS_LOAD_URL, (_e, id: ServiceId, url: string) => {
    const view = viewManager.getView(id)
    if (view) {
      view.webContents.loadURL(url).catch(err => {
        console.error(`Error loading URL for ${id}:`, err)
      })
    }
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
  const CDP_SERVICES = new Set<ServiceId>(['gemini', 'chatgpt', 'kimi', 'deepseek', 'claude'])

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

  const lastSelectedModels = new Map<ServiceId, string>()
  const lastSelectedThinking = new Map<ServiceId, string>()

  const logSync = (msg: string) => {
    try {
      const logDir = 'C:\\Users\\Kuba\\Documents\\GitHub\\MultiChat\\scratch'
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
      const logPath = path.join(logDir, 'model_sync.log')
      const time = new Date().toISOString()
      fs.appendFileSync(logPath, `[${time}] ${msg}\n`, 'utf8')
    } catch (e) {
      console.error('Failed to write sync log:', e)
    }
  }

  const syncModel = async (id: ServiceId, modelName: string, thinking?: string) => {
    logSync(`Starting syncModel for ${id} to ${modelName} (thinking: ${thinking})`)
    const view = viewManager.getView(id)
    if (!view) {
      logSync(`Error for ${id}: view not found`)
      return { ok: false, error: 'view not found' }
    }
    const escaped = modelName.replace(/'/g, "\\'")
    const escapedThinking = thinking ? thinking.replace(/'/g, "\\'") : ''

    try {
      if (id === 'chatgpt') {
        const result = await view.webContents.executeJavaScript(`
          (async () => {
            const targetModel = '${escaped}';
            
            function waitFor(selector, timeout = 4000) {
              return new Promise((resolve, reject) => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                const observer = new MutationObserver(() => {
                  const el = document.querySelector(selector);
                  if (el) { observer.disconnect(); resolve(el); }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeout);
              });
            }

            const btn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
            if (!btn) return { ok: false, reason: 'model button not found via [data-testid="model-switcher-dropdown-button"]' };
            const current = btn.innerText.trim();
            if (current.toLowerCase().includes(targetModel.toLowerCase())) {
              return { ok: true, reason: 'already set to ' + current };
            }

            btn.click();
            try {
              await waitFor('[role="menuitem"]');
            } catch (e) {
              return { ok: false, reason: 'timeout waiting for [role="menuitem"]' };
            }
            const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
            const target = items.find(el =>
              el.innerText.trim().toLowerCase().includes(targetModel.toLowerCase())
            );
            if (!target) {
              const options = items.map(el => el.innerText.trim().split('\\n')[0]).join(', ');
              return { ok: false, reason: 'target model ' + targetModel + ' not found in options: ' + options };
            }
            target.click();
            return { ok: true, reason: 'clicked target option' };
          })()
        `).catch(err => {
          logSync(`[ChatGPT JS Error]: ${err.message || String(err)}`)
          return { ok: false, error: err.message || String(err) }
        })
        logSync(`ChatGPT Sync Result: ${JSON.stringify(result)}`)
      } else if (id === 'claude') {
        const result = await view.webContents.executeJavaScript(`
          (async () => {
            const uiModel = '${escaped}';
            let targetKeyword = uiModel;
            if (uiModel.toLowerCase().includes('sonnet')) targetKeyword = 'Sonnet';
            else if (uiModel.toLowerCase().includes('opus')) targetKeyword = 'Opus';
            else if (uiModel.toLowerCase().includes('haiku')) targetKeyword = 'Haiku';

            function waitFor(selector, timeout = 4000) {
              return new Promise((resolve, reject) => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                const observer = new MutationObserver(() => {
                  const el = document.querySelector(selector);
                  if (el) { observer.disconnect(); resolve(el); }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeout);
              });
            }

            const btn = document.querySelector('[data-testid="model-selector-dropdown"]');
            if (!btn) return { ok: false, reason: 'model dropdown button not found via [data-testid="model-selector-dropdown"]' };
            const currentLabel = btn.getAttribute('aria-label') || btn.innerText;
            if (currentLabel.toLowerCase().includes(targetKeyword.toLowerCase())) {
              return { ok: true, reason: 'already set to ' + currentLabel };
            }

            btn.click();
            try {
              await waitFor('[role="menuitemradio"]');
            } catch (e) {
              return { ok: false, reason: 'timeout waiting for [role="menuitemradio"]' };
            }
            const items = Array.from(document.querySelectorAll('[role="menuitemradio"]'));
            const target = items.find(el =>
              el.innerText.trim().toLowerCase().includes(targetKeyword.toLowerCase())
            );
            if (!target) {
              const options = items.map(el => el.innerText.trim()).join(', ');
              return { ok: false, reason: 'target keyword ' + targetKeyword + ' not found in options: ' + options };
            }
            target.click();
            return { ok: true, reason: 'clicked target option' };
          })()
        `).catch(err => {
          logSync(`[Claude JS Error]: ${err.message || String(err)}`)
          return { ok: false, error: err.message || String(err) }
        })
        logSync(`Claude Sync Result: ${JSON.stringify(result)}`)
      } else if (id === 'gemini') {
        const result = await view.webContents.executeJavaScript(`
          (async () => {
            const uiModel = '${escaped}';
            const targetThinking = '${escapedThinking}';

            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

            function normalize(str) {
              return (str || '')
                .toLowerCase()
                .trim()
                .normalize('NFD')
                .replace(/[\\u0300-\\u036f]/g, '');
            }

            function matchesThinking(label, target) {
              const norm = normalize(label);
              const t = normalize(target);
              if (t.includes('standard')) {
                return norm.includes('standard');
              }
              if (t.includes('extend') || t.includes('rozszerz')) {
                return norm.includes('extend') || norm.includes('rozszerz');
              }
              return false;
            }

            function waitFor(selector, timeout = 3000) {
              return new Promise((resolve, reject) => {
                const found = document.querySelectorAll(selector);
                if (found.length) return resolve(Array.from(found));
                const observer = new MutationObserver(() => {
                  const els = document.querySelectorAll(selector);
                  if (els.length) {
                    observer.disconnect();
                    resolve(Array.from(els));
                  }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => {
                  observer.disconnect();
                  reject(new Error('Timeout waiting for: ' + selector));
                }, timeout);
              });
            }

            const btn = document.querySelector('[data-test-id="bard-mode-menu-button"]') || document.querySelector('button[aria-label*="mode picker"]');
            if (!btn) {
              return { ok: false, reason: 'Selector button not found' };
            }

            const uiLower = uiModel.toLowerCase();
            const isTargetPro = uiLower.includes('pro');

            // 1. Zsynchronizuj model jeśli to konieczne
            let labelLower = (btn.getAttribute('aria-label') || btn.innerText || '').toLowerCase();
            let modelAlreadyActive = false;
            if (uiLower.includes('pro') && labelLower.includes('pro')) {
              modelAlreadyActive = true;
            } else if (uiLower.includes('lite') && labelLower.includes('lite')) {
              modelAlreadyActive = true;
            } else if (uiLower.includes('flash') && !uiLower.includes('lite') && labelLower.includes('flash') && !labelLower.includes('lite')) {
              modelAlreadyActive = true;
            }

            let modelChanged = false;
            if (!modelAlreadyActive) {
              // Otwórz menu główne
              let mainMenu = document.querySelector('gem-menu[data-test-id="gem-mode-menu"]');
              if (!mainMenu) {
                btn.click();
                try {
                  await waitFor('gem-menu[data-test-id="gem-mode-menu"]', 3000);
                } catch (e) {
                  return { ok: false, reason: 'timeout waiting for main menu' };
                }
                mainMenu = document.querySelector('gem-menu[data-test-id="gem-mode-menu"]');
              }

              const items = Array.from(mainMenu.querySelectorAll('gem-menu-item'));
              let targetItem = null;
              for (const item of items) {
                const firstLine = (item.innerText || '').split('\\n')[0].trim().toLowerCase();
                if (uiLower.includes('pro') && firstLine.includes('pro')) {
                  targetItem = item;
                  break;
                } else if (uiLower.includes('lite') && (firstLine.includes('lite') || firstLine.includes('flash-lite'))) {
                  targetItem = item;
                  break;
                } else if (uiLower.includes('flash') && !uiLower.includes('lite') && firstLine.includes('flash') && !firstLine.includes('lite')) {
                  targetItem = item;
                  break;
                }
              }

              if (!targetItem) {
                btn.click(); // zamknij menu
                const available = Array.from(items).map(el => el.innerText.split('\\n')[0].trim()).join(', ');
                return { ok: false, reason: 'Target model ' + uiModel + ' not found in options: ' + available };
              }

              targetItem.click();
              modelChanged = true;
              // Poczekaj na zastosowanie zmiany modelu i ewentualne zamknięcie menu/przeładowanie UI
              await sleep(800);
            }

            // 2. Zsynchronizuj poziom myślenia (tylko dla Pro)
            if (isTargetPro && targetThinking) {
              // Ponownie pobierz przycisk, bo DOM mógł się zmienić
              const activeBtn = document.querySelector('[data-test-id="bard-mode-menu-button"]') || document.querySelector('button[aria-label*="mode picker"]');
              if (!activeBtn) {
                return { ok: false, reason: 'Selector button not found after model change' };
              }

              // Otwórz menu główne, jeśli nie jest otwarte
              let mainMenu = document.querySelector('gem-menu[data-test-id="gem-mode-menu"]');
              const menuWasAlreadyOpen = !!mainMenu;
              if (!mainMenu) {
                activeBtn.click();
                try {
                  await waitFor('gem-menu[data-test-id="gem-mode-menu"]', 3000);
                } catch (e) {
                  return { ok: false, reason: 'timeout waiting for main menu for thinking level' };
                }
                mainMenu = document.querySelector('gem-menu[data-test-id="gem-mode-menu"]');
              }

              // Znajdź element "Poziom myślenia"
              const thinkingItem = Array.from(mainMenu.querySelectorAll('gem-menu-item')).find(el => {
                const text = (el.innerText || '').toLowerCase();
                return !el.getAttribute('data-test-id') && (text.includes('poziom') || text.includes('thinking'));
              });

              if (!thinkingItem) {
                if (!menuWasAlreadyOpen) activeBtn.click();
                return { ok: false, reason: 'Thinking level menu item not found' };
              }

              const sublabelEl = thinkingItem.querySelector('.sublabel');
              const currentThinkingText = sublabelEl ? sublabelEl.innerText : '';

              if (matchesThinking(currentThinkingText, targetThinking)) {
                if (!menuWasAlreadyOpen) activeBtn.click();
                return { ok: true, reason: 'Thinking level ' + targetThinking + ' already active (sublabel: ' + currentThinkingText + ')' };
              }

              // Kliknij w "Poziom myślenia" aby otworzyć podmenu
              thinkingItem.click();
              let subMenu = null;
              try {
                const subMenus = await waitFor('gem-menu:not([data-test-id="gem-mode-menu"])', 3000);
                subMenu = subMenus[0];
              } catch (e) {
                if (!menuWasAlreadyOpen) activeBtn.click();
                return { ok: false, reason: 'timeout waiting for thinking level submenu' };
              }

              const subItems = Array.from(subMenu.querySelectorAll('gem-menu-item'));
              const targetSubItem = subItems.find(item => {
                const labelText = item.querySelector('.label')?.innerText || item.innerText || '';
                return matchesThinking(labelText, targetThinking);
              });

              if (!targetSubItem) {
                activeBtn.click();
                const available = subItems.map(el => el.querySelector('.label')?.innerText || el.innerText).join(', ');
                return { ok: false, reason: 'Target thinking level ' + targetThinking + ' not found in options: ' + available };
              }

              targetSubItem.click();
              await sleep(300);
              return { ok: true, reason: 'Changed model and thinking level successfully' };
            }

            return { ok: true, reason: modelChanged ? 'Model changed successfully' : 'Already set' };
          })()
        `).catch(err => {
          logSync(`[Gemini JS Error]: ${err.message || String(err)}`)
          return { ok: false, error: err.message || String(err) }
        })
        logSync(`Gemini Sync Result: ${JSON.stringify(result)}`)
      } else if (id === 'grok') {
        const result = await view.webContents.executeJavaScript(`
          (async () => {
            const uiModel = '${escaped}';
            let targetKeyword = 'Auto';
            if (uiModel.toLowerCase().includes('3')) targetKeyword = 'Expert';
            else if (uiModel.toLowerCase().includes('mini')) targetKeyword = 'Fast';
            else if (uiModel.toLowerCase().includes('2')) targetKeyword = 'Auto';

            function waitFor(selector, timeout = 4000) {
              return new Promise((resolve, reject) => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                const observer = new MutationObserver(() => {
                  const el = document.querySelector(selector);
                  if (el) { observer.disconnect(); resolve(el); }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeout);
              });
            }

            const MODELS = ['Fast', 'Auto', 'Expert', 'Heavy'];
            const btn = Array.from(document.querySelectorAll('button')).find(b =>
              b.getAttribute('aria-haspopup') === 'menu' &&
              MODELS.some(m => (b.innerText || '').includes(m))
            );
            if (!btn) return { ok: false, reason: 'Grok menu button not found' };

            const current = btn.innerText.trim();
            if (current.toLowerCase().includes(targetKeyword.toLowerCase())) {
              return { ok: true, reason: 'already set to ' + current };
            }

            btn.click();
            try {
              await waitFor('[role="menuitem"]');
            } catch (e) {
              return { ok: false, reason: 'timeout waiting for [role="menuitem"]' };
            }
            const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
            const target = items.find(el =>
              el.innerText.trim().toLowerCase().startsWith(targetKeyword.toLowerCase())
            );
            if (!target) {
              const options = items.map(el => el.innerText.trim()).join(', ');
              return { ok: false, reason: 'target not found in options: ' + options };
            }
            target.click();
            return { ok: true, reason: 'clicked target option' };
          })()
        `).catch(err => {
          logSync(`[Grok JS Error]: ${err.message || String(err)}`)
          return { ok: false, error: err.message || String(err) }
        })
        logSync(`Grok Sync Result: ${JSON.stringify(result)}`)
      } else if (id === 'deepseek') {
        const result = await view.webContents.executeJavaScript(`
          (async () => {
            const uiModel = '${escaped}';
            const isR1 = uiModel.toLowerCase().includes('r1');
            const targetRadio = isR1 ? 'Expert' : 'Instant';
            const enableDeepThink = isR1;

            function waitFor(selector, timeout = 4000) {
              return new Promise((resolve, reject) => {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                const observer = new MutationObserver(() => {
                  const el = document.querySelector(selector);
                  if (el) { observer.disconnect(); resolve(el); }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeout);
              });
            }

            try {
              await waitFor('[role="radio"]');
            } catch (e) {
              return { ok: false, reason: 'timeout waiting for [role="radio"]' };
            }
            const radios = Array.from(document.querySelectorAll('[role="radio"]'));
            const target = radios.find(el =>
              el.innerText.trim().toLowerCase().includes(targetRadio.toLowerCase())
            );
            if (!target) {
              const options = radios.map(el => el.innerText.trim()).join(', ');
              return { ok: false, reason: 'target not found in radios: ' + options };
            }

            if (target.getAttribute('aria-checked') !== 'true') {
              target.click();
            }

            await new Promise(r => setTimeout(r, 300));

            const deepThinkBtn = Array.from(document.querySelectorAll('.ds-toggle-button'))
              .find(b => (b.innerText || '').includes('DeepThink'));
            if (deepThinkBtn) {
              const isActive = deepThinkBtn.classList.contains('ds-toggle-button--selected');
              if (enableDeepThink !== isActive) {
                deepThinkBtn.click();
              }
            }
            return { ok: true, reason: 'processed successfully' };
          })()
        `).catch(err => {
          logSync(`[DeepSeek JS Error]: ${err.message || String(err)}`)
          return { ok: false, error: err.message || String(err) }
        })
        logSync(`DeepSeek Sync Result: ${JSON.stringify(result)}`)
      }
    } catch (e) {
      logSync(`syncModel overall error for ${id}: ${e instanceof Error ? e.message : String(e)}`)
      console.error('[SERVICE_SET_MODEL Error]', e)
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }

    return { ok: true }
  }

  // Auto-restore selected model when a view finishes loading
  for (const [id, view] of viewManager.getAllViews()) {
    view.webContents.on('did-finish-load', () => {
      const lastModel = lastSelectedModels.get(id)
      const lastThinking = lastSelectedThinking.get(id)
      if (lastModel) {
        setTimeout(async () => {
          try {
            await syncModel(id, lastModel, lastThinking)
          } catch (e) {
            console.error(`[AutoSync Model Error for ${id}]`, e)
          }
        }, 1000)
      }
    })
  }

  ipcMain.handle(IPC.SERVICE_SET_MODEL, async (_e, id: ServiceId, modelName: string, thinking?: string) => {
    lastSelectedModels.set(id, modelName)
    if (thinking) {
      lastSelectedThinking.set(id, thinking)
    } else {
      lastSelectedThinking.delete(id)
    }
    return await syncModel(id, modelName, thinking)
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

  ipcMain.handle(IPC.EXPORT_CONVERSATION, async (_e, serviceLabel: string, markdown: string) => {
    const win = BrowserWindow.fromWebContents(_e.sender)
    if (!win) return { ok: false }
    const result = await dialog.showSaveDialog(win, {
      title: 'Export conversation',
      defaultPath: `${serviceLabel}-${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false }
    const fs = require('fs')
    fs.writeFileSync(result.filePath, markdown, 'utf-8')
    return { ok: true }
  })

  ipcMain.handle(IPC.HISTORY_SAVE, (_e, text: string) => savePrompt(text))
  ipcMain.handle(IPC.HISTORY_GET, (_e, limit?: number) => getHistory(limit))
  ipcMain.handle(IPC.HISTORY_CLEAR, () => clearHistory())

  ipcMain.handle(IPC.CONVERSATION_SAVE, (_e, id: string, title: string, metadata: string, messages: any[]) => {
    saveConversation(id, title, metadata, messages)
  })
  ipcMain.handle(IPC.CONVERSATION_LIST, (_e, limit?: number) => {
    return getConversations(limit)
  })
  ipcMain.handle(IPC.CONVERSATION_GET, (_e, id: string) => {
    return getConversationDetails(id)
  })
  ipcMain.handle(IPC.CONVERSATION_DELETE, (_e, id: string) => {
    deleteConversation(id)
  })
  ipcMain.handle(IPC.CONVERSATION_CLEAR_ALL, () => {
    clearAllConversations()
  })

  ipcMain.handle(IPC.API_KEY_SET, (_e, id: ServiceId, key: string) => saveApiKey(id, key))
  ipcMain.handle(IPC.API_KEY_GET, (_e, id: ServiceId) => !!getApiKey(id))
  ipcMain.handle(IPC.API_KEY_DELETE, (_e, id: ServiceId) => saveApiKey(id, ''))

  ipcMain.handle(IPC.API_STREAM, async (_e, id: ServiceId, messages: { role: string; content: string }[], model?: string, thinking?: string) => {
    const key = getApiKey(id)
    if (!key) return { ok: false, error: 'no api key' }
    const win = BrowserWindow.fromWebContents(_e.sender)
    if (!win) return { ok: false }

    const API_CONFIGS: Record<string, { baseUrl: string; defaultModel: string }> = {
      chatgpt: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
      gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.5-flash' },
      grok: { baseUrl: 'https://api.x.ai/v1', defaultModel: 'grok-2-1212' },
      deepseek: { baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
      kimi: { baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
    }

    function getApiModelName(serviceId: string, uiModel?: string): string {
      if (serviceId === 'claude') {
        if (!uiModel) return 'claude-3-5-sonnet-20241022'
        const m = uiModel.toLowerCase()
        if (m.includes('opus')) return 'claude-3-opus-20240229'
        if (m.includes('haiku')) return 'claude-3-5-haiku-20241022'
        return 'claude-3-5-sonnet-20241022'
      }
      if (serviceId === 'gemini') {
        if (thinking === 'extended') {
          return 'gemini-2.0-flash-thinking-preview'
        }
        if (!uiModel) return 'gemini-2.5-flash'
        const m = uiModel.toLowerCase()
        if (m.includes('pro')) return 'gemini-2.5-pro'
        if (m.includes('lite')) return 'gemini-2.5-flash-lite'
        return 'gemini-2.5-flash'
      }
      if (serviceId === 'chatgpt') {
        if (!uiModel) return 'gpt-4o'
        const m = uiModel.toLowerCase()
        if (m.includes('o1-mini')) return 'o1-mini'
        if (m.includes('o1')) return 'o1'
        if (m.includes('o3-mini')) return 'o3-mini'
        if (m.includes('mini')) return 'gpt-4o-mini'
        return 'gpt-4o'
      }
      if (serviceId === 'grok') {
        if (!uiModel) return 'grok-2-1212'
        const m = uiModel.toLowerCase()
        if (m.includes('3')) return 'grok-3'
        if (m.includes('mini')) return 'grok-2-mini'
        return 'grok-2-1212'
      }
      if (serviceId === 'deepseek') {
        if (!uiModel) return 'deepseek-chat'
        const m = uiModel.toLowerCase()
        if (m.includes('r1') || m.includes('reasoner')) return 'deepseek-reasoner'
        return 'deepseek-chat'
      }
      if (serviceId === 'kimi') {
        if (!uiModel) return 'moonshot-v1-8k'
        const m = uiModel.toLowerCase()
        if (m.includes('32k')) return 'moonshot-v1-32k'
        if (m.includes('auto')) return 'moonshot-v1-auto'
        return 'moonshot-v1-8k'
      }
      return uiModel || ''
    }

    let fullText = ''
    try {
      let stream;
      if (id === 'claude') {
        const apiModel = getApiModelName('claude', model)
        stream = streamClaude(key, messages, apiModel)
      } else {
        const config = API_CONFIGS[id] || { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' }
        const apiModel = getApiModelName(id, model) || config.defaultModel
        stream = streamOpenAI(key, messages, apiModel, config.baseUrl)
      }

      for await (const chunk of stream) {
        fullText += chunk
        if (win.isDestroyed() || win.webContents.isDestroyed()) return { ok: false }
        win.webContents.send(IPC.SERVICE_RESPONSE, { id, text: fullText, done: false })
      }
      if (win.isDestroyed() || win.webContents.isDestroyed()) return { ok: false }
      win.webContents.send(IPC.SERVICE_RESPONSE, { id, text: fullText, done: true })
      return { ok: true }
    } catch (err: any) {
      console.error(`Error streaming direct API response for ${id}:`, err)
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(IPC.SERVICE_RESPONSE, { id, text: fullText + `\n\n[API Error: ${err?.message ?? String(err)}]`, done: true })
      }
      return { ok: false, error: err?.message ?? String(err) }
    }
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

import { BrowserView, BrowserWindow } from 'electron'
import { join } from 'path'
import { adapters, adapterMap } from '../services/registry'
import { IPC } from '../ipc/channels'
import type { ServiceId } from '../services/types'

const SERVICE_CSS: Record<ServiceId, string> = {
  chatgpt: `
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  `,
  claude: `
    /* Hide left sidebar */
    nav[aria-label="Main navigation"], aside, [class*="Sidebar"], [class*="sidebar"] { display: none !important; }
    /* Make main content fill width */
    main { max-width: 100% !important; }
    /* Hide top header nav links */
    header nav { display: none !important; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  `,
  gemini: `
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  `,
  kimi: `
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  `,
  deepseek: `
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  `,
  grok: `
    /* Hide X left sidebar navigation */
    [data-testid="SideNav_AccountSwitcher_Button"],
    [aria-label="Primary"], header[role="banner"],
    nav[aria-label="Primary"], [data-testid="AppTabBar_Home_Link"] { display: none !important; }
    /* Collapse left column */
    [data-testid="primaryColumn"] { max-width: 100% !important; }
    div[style*="width: 275px"], div[style*="width: 88px"] { display: none !important; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  `,
}

export interface ViewBounds {
  id: ServiceId
  x: number
  y: number
  width: number
  height: number
}

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export class ViewManager {
  private views = new Map<ServiceId, BrowserView>()
  private popups = new Map<ServiceId, BrowserWindow>()
  private win: BrowserWindow

  constructor(win: BrowserWindow) {
    this.win = win
    this.createViews()
  }

  private createViews() {
    for (const adapter of adapters) {
      const view = new BrowserView({
        webPreferences: {
          partition: adapter.partition,
          nodeIntegration: false,
          contextIsolation: false,
          preload: join(__dirname, 'anti-detection.js'),
        },
      })
      view.webContents.setUserAgent(CHROME_UA)
      view.webContents.setBackgroundThrottling(false)

      const injectCss = () => {
        const css = SERVICE_CSS[adapter.id]
        if (css) view.webContents.insertCSS(css).catch(() => {})
      }
      view.webContents.on('did-finish-load', injectCss)
      view.webContents.on('did-navigate-in-page', injectCss)

      this.win.addBrowserView(view)
      view.setBounds({ x: 0, y: 10000, width: 800, height: 600 })
      view.webContents.loadURL(adapter.url)
      this.views.set(adapter.id, view)
    }
  }

  getView(id: ServiceId): BrowserView | undefined {
    return this.views.get(id)
  }

  getAllViews(): Map<ServiceId, BrowserView> {
    return this.views
  }

  setBounds(bounds: ViewBounds[]) {
    const visibleIds = new Set(bounds.map(b => b.id))
    for (const [id, view] of this.views) {
      if (!visibleIds.has(id)) {
        view.setBounds({ x: 0, y: 10000, width: 800, height: 600 })
      }
    }
    for (const b of bounds) {
      const view = this.views.get(b.id)
      if (!view) continue
      if (b.width <= 0 || b.height <= 0) continue
      view.setBounds({
        x: Math.round(b.x),
        y: Math.round(b.y),
        width: Math.round(b.width),
        height: Math.round(b.height),
      })
    }
  }

  reload(id: ServiceId) {
    this.views.get(id)?.webContents.reload()
  }

  reloadAll() {
    this.views.forEach((v) => v.webContents.reload())
  }

  focus(id: ServiceId) {
    this.views.get(id)?.webContents.focus()
  }

  openDevTools(id: ServiceId) {
    this.views.get(id)?.webContents.openDevTools({ mode: 'detach' })
  }

  loginInView(id: ServiceId) {
    const adapter = adapterMap.get(id)
    const view = this.views.get(id)
    if (!adapter || !view) return

    const loginUrl = 'https://accounts.google.com/ServiceLogin?passive=true&continue=' +
      encodeURIComponent(adapter.url)

    view.webContents.loadURL(loginUrl)

    // After login redirect back to the service, reload to pick up session
    const onNavigate = async (event: any, url: string) => {
      if (url.startsWith(adapter.url) || url.includes('gemini.google.com')) {
        view.webContents.removeListener('did-navigate', onNavigate as any)
        this.win.webContents.send(IPC.SERVICE_STATUS, { id, loggedIn: true })
      }
    }
    view.webContents.on('did-navigate', onNavigate)
  }

  openLoginPopup(id: ServiceId) {
    // Only one popup per service at a time
    const existing = this.popups.get(id)
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return
    }

    const adapter = adapterMap.get(id)
    if (!adapter) return

    const popup = new BrowserWindow({
      width: 820,
      height: 720,
      title: `Sign in to ${adapter.label} — MultiChat`,
      // no parent — Google detects parent window as webview context
      webPreferences: {
        partition: adapter.partition, // same partition → shared cookies
        nodeIntegration: false,
        contextIsolation: false,
        preload: join(__dirname, 'anti-detection.js'),
      },
    })

    popup.setMenuBarVisibility(false)
    popup.webContents.setUserAgent(CHROME_UA)

    // For Google: go directly to ServiceLogin (not OAuth redirect) — avoids "unsafe browser" block
    const loginUrl = adapter.id === 'gemini'
      ? 'https://accounts.google.com/ServiceLogin?service=mail&passive=true&rm=false&continue=https://gemini.google.com/app&ss=1&scc=1<mpl=default&emr=1&osid=1'
      : adapter.url
    popup.loadURL(loginUrl)
    this.popups.set(id, popup)

    // Only auto-close if user was logged OUT when popup opened (i.e., they just logged in)
    let wasLoggedOutAtOpen = false
    adapter.isLoggedIn(popup).then(loggedIn => {
      wasLoggedOutAtOpen = !loggedIn
    }).catch(() => { wasLoggedOutAtOpen = true })

    const checkLogin = async () => {
      if (popup.isDestroyed()) return
      if (!wasLoggedOutAtOpen) return  // opened while already logged in — don't auto-close
      try {
        const loggedIn = await adapter.isLoggedIn(popup)
        if (loggedIn) {
          const view = this.views.get(id)
          if (view) view.webContents.loadURL(adapter.url)
          this.win.webContents.send(IPC.SERVICE_STATUS, { id, loggedIn: true })
          if (!popup.isDestroyed()) popup.close()
        }
      } catch {
        // page not ready yet
      }
    }

    popup.webContents.on('did-navigate', checkLogin)
    popup.webContents.on('did-navigate-in-page', checkLogin)
    popup.webContents.on('did-finish-load', checkLogin)

    popup.on('closed', () => {
      this.popups.delete(id)
      // Final check — user may have closed after logging in
      const view = this.views.get(id)
      if (!view) return
      adapter.isLoggedIn(view).then((loggedIn) => {
        this.win.webContents.send(IPC.SERVICE_STATUS, { id, loggedIn })
      }).catch(() => {})
    })
  }

  destroy() {
    for (const popup of this.popups.values()) {
      if (!popup.isDestroyed()) popup.close()
    }
    this.popups.clear()
    if (this.win && !this.win.isDestroyed()) {
      for (const view of this.views.values()) {
        try {
          if (!view.webContents.isDestroyed()) {
            ;(this.win as any).removeBrowserView(view)
          }
        } catch (e) {
          // ignore if already destroyed or detached
        }
      }
    }
    this.views.clear()
  }
}

import { app, BrowserWindow, shell, globalShortcut, session } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import { ViewManager } from './views/manager'
import { registerHandlers, stopLoginPoller } from './ipc/handlers'

// Remove Electron automation signals before app ready
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
app.commandLine.appendSwitch('disable-features', 'ChromeWhatsNewUI')

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const PARTITIONS = ['persist:chatgpt', 'persist:claude', 'persist:gemini', 'persist:grok', 'persist:kimi', 'persist:deepseek']

function setupSessions() {
  // Remove Electron/Chrome-headless signals from all partitions
  app.userAgentFallback = CHROME_UA

  for (const partition of PARTITIONS) {
    const ses = session.fromPartition(partition)
    ses.setUserAgent(CHROME_UA)

    // Strip headers that reveal Electron or headless Chrome
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders }
      delete headers['sec-ch-ua']
      delete headers['sec-ch-ua-mobile']
      delete headers['sec-ch-ua-platform']
      headers['sec-ch-ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"'
      headers['sec-ch-ua-mobile'] = '?0'
      headers['sec-ch-ua-platform'] = '"Windows"'
      callback({ requestHeaders: headers })
    })
  }
}

let win: BrowserWindow | null = null
let viewManager: ViewManager | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0E0E11',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Create views + register IPC immediately — before renderer loads
  viewManager = new ViewManager(win)
  registerHandlers(viewManager)

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.once('ready-to-show', () => {
    win!.show()
    // Debug shortcuts: Ctrl+Shift+1-4 opens devtools for each BrowserView
    const ids = ['chatgpt', 'claude', 'gemini', 'grok'] as const
    ids.forEach((id, i) => {
      globalShortcut.register(`CommandOrControl+Shift+${i + 1}`, () => {
        viewManager?.openDevTools(id)
      })
    })
    // Ctrl+Shift+0 = renderer devtools
    globalShortcut.register('CommandOrControl+Shift+0', () => {
      win?.webContents.openDevTools()
    })
  })

  win.on('close', () => {
    stopLoginPoller()
    viewManager?.destroy()
  })

  win.on('closed', () => {
    viewManager = null
    win = null
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.multichat.app')
  setupSessions()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

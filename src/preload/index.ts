import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../main/ipc/channels'
import type { ServiceId, BroadcastResult } from '../main/services/types'
import type { ViewBounds } from '../main/views/manager'

const api = {
  setViewBounds: (bounds: ViewBounds[]) => ipcRenderer.invoke(IPC.VIEWS_SET_BOUNDS, bounds),
  reloadView: (id?: ServiceId) => ipcRenderer.invoke(IPC.VIEWS_RELOAD, id),
  focusView: (id: ServiceId) => ipcRenderer.invoke(IPC.VIEWS_FOCUS, id),
  openLogin: (id: ServiceId) => ipcRenderer.invoke(IPC.VIEWS_LOGIN, id),
  openDevTools: (id: ServiceId) => ipcRenderer.invoke(IPC.VIEWS_OPEN_DEVTOOLS, id),
  broadcast: (text: string, enabledIds: ServiceId[]): Promise<BroadcastResult[]> =>
    ipcRenderer.invoke(IPC.BROADCAST_SEND, text, enabledIds),
  broadcastSequential: (text: string, orderedIds: ServiceId[]): Promise<BroadcastResult[]> =>
    ipcRenderer.invoke(IPC.BROADCAST_SEQUENTIAL, text, orderedIds),
  onServiceStatus: (cb: (payload: { id: ServiceId; loggedIn: boolean }) => void) => {
    const handler = (_e: any, payload: any) => cb(payload)
    ipcRenderer.on(IPC.SERVICE_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.SERVICE_STATUS, handler)
  },
  onSerialProgress: (cb: (payload: { currentId: ServiceId; index: number; total: number; done: boolean }) => void) => {
    const handler = (_e: any, payload: any) => cb(payload)
    ipcRenderer.on(IPC.SERIAL_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC.SERIAL_PROGRESS, handler)
  },
  onServiceResponse: (cb: (payload: { id: ServiceId; text: string; done: boolean }) => void) => {
    const handler = (_e: any, payload: any) => cb(payload)
    ipcRenderer.on(IPC.SERVICE_RESPONSE, handler)
    return () => ipcRenderer.removeListener(IPC.SERVICE_RESPONSE, handler)
  },
  importChromeCookies: (partition: string) => ipcRenderer.invoke(IPC.IMPORT_CHROME_COOKIES, partition),
  cdpLogin: (id: ServiceId) => ipcRenderer.invoke(IPC.CDP_LOGIN, id),
  skillsList: (): Promise<{ name: string; file: string }[]> => ipcRenderer.invoke(IPC.SKILLS_LIST),
  skillsRead: (file: string): Promise<string> => ipcRenderer.invoke(IPC.SKILLS_READ, file),
  skillsOpenDir: () => ipcRenderer.invoke(IPC.SKILLS_OPEN_DIR),
  skillsCreate: (name: string, content: string): Promise<{ file: string }> => ipcRenderer.invoke(IPC.SKILLS_CREATE, name, content),
  skillsDelete: (file: string): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.SKILLS_DELETE, file),
  newChat: (id: ServiceId) => ipcRenderer.invoke(IPC.VIEWS_NEW_CHAT, id),
  exportConversation: (serviceLabel: string, markdown: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.EXPORT_CONVERSATION, serviceLabel, markdown),
  setModel: (id: ServiceId, model: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.SERVICE_SET_MODEL, id, model),
  historySave: (text: string) => ipcRenderer.invoke(IPC.HISTORY_SAVE, text),
  historyGet: (limit?: number): Promise<{ id: number; text: string; created_at: number }[]> =>
    ipcRenderer.invoke(IPC.HISTORY_GET, limit),
  historyClear: () => ipcRenderer.invoke(IPC.HISTORY_CLEAR),
  apiKeySet: (id: ServiceId, key: string): Promise<void> => ipcRenderer.invoke(IPC.API_KEY_SET, id, key),
  apiKeyGet: (id: ServiceId): Promise<boolean> => ipcRenderer.invoke(IPC.API_KEY_GET, id),
  apiKeyDelete: (id: ServiceId): Promise<void> => ipcRenderer.invoke(IPC.API_KEY_DELETE, id),
  apiStream: (id: ServiceId, messages: { role: string; content: string }[], model?: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.API_STREAM, id, messages, model),

  winMinimize: () => ipcRenderer.invoke(IPC.WIN_MINIMIZE),
  winMaximize: () => ipcRenderer.invoke(IPC.WIN_MAXIMIZE),
  winClose: () => ipcRenderer.invoke(IPC.WIN_CLOSE),
  winIsMaximized: (): Promise<boolean> => ipcRenderer.invoke(IPC.WIN_IS_MAXIMIZED),
  platform: process.platform,
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api

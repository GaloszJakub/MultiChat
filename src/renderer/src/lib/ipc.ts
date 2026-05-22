import type { ServiceId, BroadcastResult } from '../../../main/services/types'
import type { ViewBounds } from '../../../main/views/manager'

declare global {
  interface Window {
    api: {
      setViewBounds: (bounds: ViewBounds[]) => Promise<void>
      reloadView: (id?: ServiceId) => Promise<void>
      focusView: (id: ServiceId) => Promise<void>
      openLogin: (id: ServiceId) => Promise<void>
      openDevTools: (id: ServiceId) => Promise<void>
      broadcast: (text: string, enabledIds: ServiceId[]) => Promise<BroadcastResult[]>
      broadcastSequential: (text: string, orderedIds: ServiceId[]) => Promise<BroadcastResult[]>
      onServiceStatus: (cb: (payload: { id: ServiceId; loggedIn: boolean }) => void) => () => void
      onSerialProgress: (cb: (payload: { currentId: ServiceId; index: number; total: number; done: boolean }) => void) => () => void
      onServiceResponse: (cb: (payload: { id: ServiceId; text: string; done: boolean }) => void) => () => void
      importChromeCookies: (partition: string) => Promise<{ ok: boolean; count?: number; error?: string }>
      cdpLogin: (id: ServiceId) => Promise<{ ok: boolean }>
      skillsList: () => Promise<{ name: string; file: string }[]>
      skillsRead: (file: string) => Promise<string>
      skillsOpenDir: () => Promise<void>
      skillsCreate: (name: string, content: string) => Promise<{ file: string }>
      skillsDelete: (file: string) => Promise<{ ok: boolean }>
      newChat: (id: ServiceId) => Promise<void>
      exportConversation: (serviceLabel: string, markdown: string) => Promise<{ ok: boolean }>
      setModel: (id: ServiceId, model: string, thinking?: string) => Promise<{ ok: boolean; error?: string }>
      historySave: (text: string) => Promise<void>
      historyGet: (limit?: number) => Promise<{ id: number; text: string; created_at: number }[]>
      historyClear: () => Promise<void>
      apiKeySet: (id: ServiceId, key: string) => Promise<void>
      apiKeyGet: (id: ServiceId) => Promise<boolean>
      apiKeyDelete: (id: ServiceId) => Promise<void>
      apiStream: (id: ServiceId, messages: { role: string; content: string }[], model?: string, thinking?: string) => Promise<{ ok: boolean; error?: string }>
      winMinimize: () => Promise<void>
      winMaximize: () => Promise<void>
      winClose: () => Promise<void>
      winIsMaximized: () => Promise<boolean>
      platform: string
    }
  }
}

export const api = window.api

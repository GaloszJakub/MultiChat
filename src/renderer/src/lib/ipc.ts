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
      winMinimize: () => Promise<void>
      winMaximize: () => Promise<void>
      winClose: () => Promise<void>
      winIsMaximized: () => Promise<boolean>
      platform: string
    }
  }
}

export const api = window.api

import type { WebContents } from 'electron'

export type ServiceId = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'kimi' | 'deepseek'

export interface WebContentsHost {
  webContents: WebContents
}

export interface ScrapeResult {
  text: string
  done: boolean
}

export interface ServiceAdapter {
  id: ServiceId
  label: string
  url: string
  partition: string
  isLoggedIn(host: WebContentsHost): Promise<boolean>
  submitPrompt(host: WebContentsHost, text: string): Promise<void>
  scrapeResponse(host: WebContentsHost): Promise<ScrapeResult>
}

export interface BroadcastResult {
  id: ServiceId
  ok: boolean
  error?: string
}

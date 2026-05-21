import { chatgptAdapter } from './chatgpt'
import { claudeAdapter } from './claude'
import { geminiAdapter } from './gemini'
import { grokAdapter } from './grok'
import { kimiAdapter } from './kimi'
import { deepseekAdapter } from './deepseek'
import type { ServiceAdapter, ServiceId } from './types'

export const adapters: ServiceAdapter[] = [chatgptAdapter, claudeAdapter, geminiAdapter, grokAdapter, kimiAdapter, deepseekAdapter]

export const adapterMap = new Map<ServiceId, ServiceAdapter>(adapters.map((a) => [a.id, a]))

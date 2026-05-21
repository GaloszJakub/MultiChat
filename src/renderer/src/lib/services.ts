import type { ServiceId } from '../../../main/services/types'

export interface ServiceConfig {
  id: ServiceId
  label: string
  model: string
  color: string
  tint: string
  url: string
}

export interface ModelOption {
  label: string
  value: string
}

export const SERVICE_MODELS: Partial<Record<ServiceId, ModelOption[]>> = {
  claude: [
    { label: 'Opus 4.7', value: 'Opus 4.7' },
    { label: 'Sonnet 4.6', value: 'Sonnet 4.6' },
    { label: 'Haiku 4.5', value: 'Haiku 4.5' },
    { label: 'Opus 4.6', value: 'Opus 4.6' },
    { label: 'Sonnet 4.5', value: 'Sonnet 4.5' },
  ],
  gemini: [
    { label: '3.1 Pro', value: '3.1 Pro' },
    { label: '3.5 Flash', value: '3.5 Flash' },
    { label: 'Flash-Lite', value: 'Flash-Lite' },
  ],
}

export const SERVICES: ServiceConfig[] = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    model: 'gpt-4o · web',
    color: '#10A37F',
    tint: 'rgba(16, 163, 127, 0.10)',
    url: 'chatgpt.com',
  },
  {
    id: 'claude',
    label: 'Claude',
    model: 'sonnet-4 · projects',
    color: '#D97757',
    tint: 'rgba(217, 119, 87, 0.10)',
    url: 'claude.ai',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    model: '2.5 pro · grounded',
    color: '#4285F4',
    tint: 'rgba(66, 133, 244, 0.10)',
    url: 'gemini.google.com',
  },
  {
    id: 'grok',
    label: 'Grok',
    model: 'grok-3 · fun mode',
    color: '#E7E7E7',
    tint: 'rgba(231, 231, 231, 0.06)',
    url: 'grok.com',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    model: 'k2 · moonshot',
    color: '#00C4B4',
    tint: 'rgba(0, 196, 180, 0.10)',
    url: 'kimi.ai',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    model: 'r1 · reasoning',
    color: '#4D6BFE',
    tint: 'rgba(77, 107, 254, 0.10)',
    url: 'chat.deepseek.com',
  },
]

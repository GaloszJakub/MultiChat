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
    { label: 'Sonnet 4.6', value: 'Sonnet 4.6' },
    { label: 'Opus 4.7', value: 'Opus 4.7' },
    { label: 'Haiku 4.5', value: 'Haiku 4.5' },
    { label: 'Opus 4.6', value: 'Opus 4.6' },
    { label: 'Sonnet 4.5', value: 'Sonnet 4.5' },
  ],
  gemini: [
    { label: '3.5 Flash', value: '3.5 Flash' },
    { label: '3.1 Pro', value: '3.1 Pro' },
    { label: '3.1 Flash-Lite', value: '3.1 Flash-Lite' },
  ],
  chatgpt: [
    { label: 'GPT-4o', value: 'GPT-4o' },
    { label: 'GPT-4o mini', value: 'GPT-4o mini' },
    { label: 'o1', value: 'o1' },
    { label: 'o1-mini', value: 'o1-mini' },
    { label: 'o3-mini', value: 'o3-mini' },
  ],
  grok: [
    { label: 'Grok 3', value: 'Grok 3' },
    { label: 'Grok 2', value: 'Grok 2' },
    { label: 'Grok 2 mini', value: 'Grok 2 mini' },
  ],
  kimi: [
    { label: 'moonshot-v1-8k', value: 'moonshot-v1-8k' },
    { label: 'moonshot-v1-32k', value: 'moonshot-v1-32k' },
    { label: 'moonshot-v1-auto', value: 'moonshot-v1-auto' },
  ],
  deepseek: [
    { label: 'DeepSeek R1', value: 'DeepSeek R1' },
    { label: 'DeepSeek V3', value: 'DeepSeek V3' },
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

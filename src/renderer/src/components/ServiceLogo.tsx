import React from 'react'
import type { ServiceId } from '../../../main/services/types'

interface Props {
  id: ServiceId
  size?: number
  color?: string
}

export function ServiceLogo({ id, size = 14, color }: Props) {
  switch (id) {
    case 'chatgpt':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M22.28 9.83a5.99 5.99 0 0 0-.52-4.92 6.06 6.06 0 0 0-6.52-2.9A6 6 0 0 0 5.1 4.1a5.99 5.99 0 0 0-4.01 2.9 6.06 6.06 0 0 0 .74 7.1 5.99 5.99 0 0 0 .52 4.92 6.06 6.06 0 0 0 6.52 2.9 5.99 5.99 0 0 0 4.51 2.01 6.06 6.06 0 0 0 5.78-4.2 5.99 5.99 0 0 0 4.01-2.9 6.06 6.06 0 0 0-.89-6.99z"
            fill={color ?? '#10A37F'}
          />
        </svg>
      )
    case 'claude':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? '#D97757'}>
          <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
        </svg>
      )
    case 'gemini':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? '#4285F4'}>
          <path d="M12 2 C12 8 16 12 22 12 C16 12 12 16 12 22 C12 16 8 12 2 12 C8 12 12 8 12 2 Z" />
        </svg>
      )
    case 'grok':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? '#E7E7E7'}>
          <path d="M3 3 L10 12 L3 21 L7 21 L12 14.5 L17 21 L21 21 L14 12 L21 3 L17 3 L12 9.5 L7 3 Z" />
        </svg>
      )
  }
}

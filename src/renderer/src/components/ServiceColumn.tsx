import React, { forwardRef } from 'react'
import { ServiceLogo } from './ServiceLogo'
import { StatusBadge } from './StatusBadge'
import type { Status } from './StatusBadge'
import type { ServiceConfig } from '../lib/services'
import { api } from '../lib/ipc'

interface Props {
  service: ServiceConfig
  status: Status
  enabled: boolean
}

export const ServiceColumn = forwardRef<HTMLDivElement, Props>(({ service, status, enabled }, ref) => {
  const isLoggedOut = status === 'loggedout'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        borderRight: '1px solid var(--hairline)',
        background: `linear-gradient(180deg, ${service.tint}, transparent 240px), var(--bg)`,
        overflow: 'hidden',
        minWidth: 0,
        opacity: enabled ? 1 : 0.45,
        transition: 'opacity 0.2s',
        position: 'relative',
      }}
    >
      {/* Accent bar */}
      <div style={{ height: 2, background: service.color, width: '100%' }} />

      {/* Header */}
      <div
        style={{
          padding: '12px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--hairline)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.015), transparent)',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            display: 'grid',
            placeItems: 'center',
            background:
              service.id === 'chatgpt' ? service.color
              : service.id === 'claude' ? service.color
              : service.id === 'gemini' ? 'rgba(66,133,244,0.15)'
              : '#000',
            border:
              service.id === 'gemini' ? `1px solid ${service.color}`
              : service.id === 'grok' ? '1px solid #444'
              : undefined,
            flexShrink: 0,
          }}
        >
          <ServiceLogo id={service.id} size={14} color="#fff" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-0.005em' }}>{service.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
            {service.model}
          </div>
        </div>

        <StatusBadge status={status} />
        <button
          onClick={() => api.openLogin(service.id)}
          title={`Open ${service.label} login`}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            width: 26,
            height: 26,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </button>
      </div>

      {/* Webview area — BrowserView is positioned over this div by main process */}
      <div
        ref={ref}
        style={{ position: 'relative', overflow: 'hidden', cursor: isLoggedOut ? 'default' : 'default' }}
      />

      {/* Footer */}
      <div
        style={{
          padding: '10px 12px 12px',
          borderTop: '1px solid var(--hairline)',
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.2))',
        }}
      >
        {isLoggedOut ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={() => api.cdpLogin(service.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              background: `rgba(${hexToRgb(service.color)}, 0.10)`,
              border: `1px solid rgba(${hexToRgb(service.color)}, 0.25)`,
              color: service.color,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Login via Chrome
          </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              fontSize: 11.5,
              cursor: 'text',
            }}
            onClick={() => api.focusView(service.id)}
          >
            <span style={{ flex: 1 }}>Reply to {service.label}…</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2 L11 13" />
              <path d="M22 2 L15 22 L11 13 L2 9 Z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
})

ServiceColumn.displayName = 'ServiceColumn'

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

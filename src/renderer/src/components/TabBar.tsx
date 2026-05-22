import React from 'react'
import { ServiceLogo } from './ServiceLogo'
import { SERVICES } from '../lib/services'
import type { ServiceConfig } from '../lib/services'
import type { ServiceId } from '../../../main/services/types'
import type { Status } from './StatusBadge'

interface Props {
  services: ServiceConfig[]
  activeId: ServiceId
  statuses: Record<ServiceId, Status>
  responseTimes?: Partial<Record<ServiceId, number>>
  onSelect: (id: ServiceId) => void
  onLogin: (id: ServiceId) => void
  onDevTools: (id: ServiceId) => void
  onNewChat: (id: ServiceId) => void
  onExport: (id: ServiceId) => void
  canExport?: boolean
  isCard?: boolean
  isApiKeyActive?: boolean
  onToggleViewMode?: (id: ServiceId) => void
}

export function TabBar({ services, activeId, statuses, responseTimes, onSelect, onLogin, onDevTools, onNewChat, onExport, canExport, isCard, isApiKeyActive, onToggleViewMode }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      borderBottom: '1px solid #1a1a1a',
      background: '#080808',
      flexShrink: 0,
      overflowX: 'auto',
      height: 36,
    }}>
      {services.map(s => {
        const active = s.id === activeId
        const loggedOut = statuses[s.id] === 'loggedout'
        const idx = SERVICES.findIndex(x => x.id === s.id)
        return (
          <button
            key={s.id}
            title={idx !== -1 ? `Ctrl+${idx + 1}` : undefined}
            onClick={() => onSelect(s.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '0 14px',
              background: active ? '#0E0E11' : 'transparent',
              border: 'none',
              borderBottom: active ? `2px solid ${s.color}` : '2px solid transparent',
              borderRight: '1px solid #1a1a1a',
              color: active ? '#ccc' : '#555',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'color 0.1s',
              position: 'relative',
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              background: active ? s.color + '25' : 'transparent',
              display: 'grid', placeItems: 'center', flexShrink: 0,
              transition: 'background 0.1s',
            }}>
              <ServiceLogo id={s.id} size={9} color={active ? s.color : loggedOut ? '#444' : '#666'} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ lineHeight: 1.1 }}>{s.label}</span>
              {responseTimes?.[s.id] && (
                <span style={{ fontSize: 9, color: '#666', marginTop: 1, lineHeight: 1 }}>{responseTimes[s.id]}s</span>
              )}
            </div>
            {/* Status dot */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: loggedOut ? '#333'
                : statuses[s.id] === 'sending' ? '#f5a623'
                : statuses[s.id] === 'waiting' ? '#4a5568'
                : statuses[s.id] === 'error' ? '#e05252'
                : active ? s.color : '#444',
              flexShrink: 0,
            }} />
          </button>
        )
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {services.find(s => s.id === activeId) && (() => {
        const s = services.find(s => s.id === activeId)!
        const loggedOut = statuses[s.id] === 'loggedout'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', borderLeft: '1px solid #1a1a1a' }}>
            {loggedOut && (
              <button
                onClick={() => onLogin(s.id)}
                style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 4,
                  border: `1px solid ${s.color}44`, background: s.color + '15',
                  color: s.color, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                }}
              >Login</button>
            )}

            {/* View Mode Toggle */}
            <button
              onClick={() => !isApiKeyActive && onToggleViewMode?.(s.id)}
              disabled={isApiKeyActive}
              title={isApiKeyActive ? "Forced to Card view via API Key" : `Switch to ${isCard ? 'Native (Browser)' : 'Custom (Card)'} view`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 5,
                height: 26,
                border: isCard ? `1px solid ${s.color}66` : '1px solid #2a2a2a',
                background: isCard ? `${s.color}18` : '#111',
                color: isCard ? s.color : '#777',
                cursor: isApiKeyActive ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 600,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: isApiKeyActive ? 0.7 : 1,
              }}
              onMouseEnter={e => {
                if (isApiKeyActive) return
                e.currentTarget.style.color = isCard ? '#fff' : '#ccc'
                e.currentTarget.style.borderColor = isCard ? s.color : '#444'
                e.currentTarget.style.background = isCard ? `${s.color}30` : '#1a1a1a'
                e.currentTarget.style.transform = 'translateY(-0.5px)'
                e.currentTarget.style.boxShadow = isCard ? `0 0 8px ${s.color}25` : 'none'
              }}
              onMouseLeave={e => {
                if (isApiKeyActive) return
                e.currentTarget.style.color = isCard ? s.color : '#777'
                e.currentTarget.style.borderColor = isCard ? `${s.color}66` : '#2a2a2a'
                e.currentTarget.style.background = isCard ? `${s.color}18` : '#111'
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isCard ? (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </>
                )}
              </svg>
              <span>{isApiKeyActive ? 'API' : isCard ? 'Card' : 'Native'}</span>
            </button>
            <button
              onClick={() => onNewChat(s.id)}
              title="New chat"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, borderRadius: 5,
                border: '1px solid #222', background: 'transparent',
                color: '#555', cursor: 'pointer', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#333' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#222' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 1.5l1.5 1.5L4 9.5 2 10l.5-2L9 1.5z"/>
                <path d="M2 11h8"/>
              </svg>
            </button>
            {canExport && (
              <button
                onClick={() => onExport(s.id)}
                title="Export conversation"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 5, height: 26,
                  border: '1px solid #2a2a2a', background: '#111',
                  color: '#777', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 11, fontWeight: 600, transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.background = '#1a1a1a' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#777'; e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.background = '#111' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 1v6M3 5l3 3 3-3M1 11h10"/>
                </svg>
                Export
              </button>
            )}
            <button
              onClick={() => onDevTools(s.id)}
              title="DevTools"
              style={{
                fontSize: 9, padding: '2px 5px', borderRadius: 4,
                border: '1px solid #222', background: 'transparent',
                color: '#444', cursor: 'pointer', fontFamily: 'monospace',
              }}
            >{'>'}_</button>
          </div>
        )
      })()}
    </div>
  )
}

import React from 'react'
import { ServiceLogo } from './ServiceLogo'
import type { ServiceConfig } from '../lib/services'
import type { ServiceId } from '../../../main/services/types'
import type { Status } from './StatusBadge'

interface Props {
  services: ServiceConfig[]
  activeId: ServiceId
  statuses: Record<ServiceId, Status>
  onSelect: (id: ServiceId) => void
  onLogin: (id: ServiceId) => void
  onDevTools: (id: ServiceId) => void
  onNewChat: (id: ServiceId) => void
  showSettings: boolean
  onToggleSettings: () => void
}

export function TabBar({ services, activeId, statuses, onSelect, onLogin, onDevTools, onNewChat, showSettings, onToggleSettings }: Props) {
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
        return (
          <button
            key={s.id}
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
            {s.label}
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

      {/* Settings gear */}
      <button
        onClick={onToggleSettings}
        title="Settings"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: '100%', flexShrink: 0,
          background: showSettings ? '#1a1a1a' : 'transparent',
          border: 'none', borderLeft: '1px solid #1a1a1a',
          borderBottom: showSettings ? '2px solid #666' : '2px solid transparent',
          cursor: 'pointer', color: showSettings ? '#aaa' : '#444',
          transition: 'color 0.1s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <circle cx="8" cy="8" r="2.5"/>
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
        </svg>
      </button>
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
            <button
              onClick={() => onNewChat(s.id)}
              title="New chat"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: 4,
                border: '1px solid #222', background: 'transparent',
                color: '#444', cursor: 'pointer',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 1.5l1.5 1.5L4 9.5 2 10l.5-2L9 1.5z"/>
                <path d="M2 11h8"/>
              </svg>
            </button>
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

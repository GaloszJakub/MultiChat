import React, { useState, useEffect } from 'react'
import { api } from '../lib/ipc'
import { BrandMark } from './BrandMark'

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    api.winIsMaximized().then(setMaximized)
    const interval = setInterval(() => {
      api.winIsMaximized().then(setMaximized)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const btnBase: React.CSSProperties = {
    width: 46,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#888',
    flexShrink: 0,
    WebkitAppRegion: 'no-drag' as any,
    transition: 'background 0.1s, color 0.1s',
  }

  return (
    <div style={{
      height: 32,
      display: 'flex',
      alignItems: 'center',
      background: '#0E0E11',
      borderBottom: '1px solid #1a1a1a',
      WebkitAppRegion: 'drag' as any,
      userSelect: 'none',
      flexShrink: 0,
    }}>
      {/* App title */}
      <div style={{ flex: 1, paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#555', letterSpacing: '0.02em' }}>
        <BrandMark size={16} />
        <span>MultiChat</span>
      </div>

      {/* Windows controls */}
      <WinBtn
        style={btnBase}
        hoverBg="#2a2a2a"
        onClick={() => api.winMinimize()}
        title="Minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
      </WinBtn>

      <WinBtn
        style={btnBase}
        hoverBg="#2a2a2a"
        onClick={() => api.winMaximize()}
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="2" y="0" width="8" height="8" />
            <rect x="0" y="2" width="8" height="8" fill="#0E0E11" />
            <rect x="0" y="2" width="8" height="8" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0" y="0" width="10" height="10" />
          </svg>
        )}
      </WinBtn>

      <WinBtn
        style={btnBase}
        hoverBg="#c42b1c"
        hoverColor="#fff"
        onClick={() => api.winClose()}
        title="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </WinBtn>
    </div>
  )
}

function WinBtn({ children, style, hoverBg, hoverColor, onClick, title }: {
  children: React.ReactNode
  style: React.CSSProperties
  hoverBg: string
  hoverColor?: string
  onClick: () => void
  title: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      style={{
        ...style,
        background: hovered ? hoverBg : 'transparent',
        color: hovered && hoverColor ? hoverColor : '#888',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}

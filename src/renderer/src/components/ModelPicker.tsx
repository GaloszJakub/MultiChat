import React, { useState, useRef, useEffect } from 'react'
import type { ModelOption } from '../lib/services'

interface Props {
  models: ModelOption[]
  selected: string
  color: string
  onChange: (value: string) => void
}

export function ModelPicker({ models, selected, color, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10, padding: '3px 7px', borderRadius: 5,
          border: '1px solid #252525', background: open ? '#1a1a1a' : 'transparent',
          color: '#666', cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 0.1s',
        }}
      >
        {selected}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="1,2.5 4,5.5 7,2.5"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: '#111', border: '1px solid #252525', borderRadius: 8,
          padding: 4, zIndex: 100, minWidth: 120,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          {models.map(m => (
            <button
              key={m.value}
              onClick={() => { onChange(m.value); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', textAlign: 'left', padding: '5px 8px',
                background: 'transparent', border: 'none', borderRadius: 5,
                color: m.value === selected ? '#ccc' : '#666',
                fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: m.value === selected ? 600 : 400,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              {m.value === selected
                ? <svg width="7" height="7" viewBox="0 0 7 7" fill={color}><circle cx="3.5" cy="3.5" r="3.5"/></svg>
                : <span style={{ width: 7, display: 'inline-block' }}/>
              }
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

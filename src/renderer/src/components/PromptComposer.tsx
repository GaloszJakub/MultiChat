import React, { useRef, useEffect } from 'react'
import { ServiceLogo } from './ServiceLogo'
import type { ServiceId } from '../../../main/services/types'
import type { Status } from './StatusBadge'
import { SERVICES } from '../lib/services'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  enabledIds: Set<ServiceId>
  onToggle: (id: ServiceId) => void
  isSending: boolean
  statuses: Record<ServiceId, Status>
  summaryModelId: ServiceId | null
  onSelectSummaryModel: (id: ServiceId) => void
  onSummarize: () => void
  hasResponsesToSummarize: boolean
  broadcastMode?: 'parallel' | 'sequential'
  onSetBroadcastMode?: (mode: 'parallel' | 'sequential') => void
}

export function PromptComposer({ value, onChange, onSend, enabledIds, onToggle, isSending, statuses, summaryModelId, onSelectSummaryModel, onSummarize, hasResponsesToSummarize, broadcastMode = 'parallel', onSetBroadcastMode }: Props) {
  const enabledServices = SERVICES.filter(s => enabledIds.has(s.id))
  const taRef = useRef<HTMLTextAreaElement>(null)

  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 84) + 'px'
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSend()
    }
  }

  const charCount = value.length
  const activeCount = enabledIds.size
  const readyCount = SERVICES.filter(
    (s) => enabledIds.has(s.id) && statuses[s.id] !== 'loggedout'
  ).length

  return (
    <div
      style={{
        padding: '14px 20px 16px',
        display: 'grid',
        gridTemplateColumns: '1fr 220px',
        gap: 20,
        alignItems: 'start',
        borderBottom: '1px solid var(--hairline)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.015), transparent)',
      }}
    >

      {/* Prompt zone */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Chips */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {SERVICES.map((s) => {
            const on = enabledIds.has(s.id)
            return (
              <button
                key={s.id}
                data-on={on}
                onClick={() => onToggle(s.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px 4px 6px',
                  borderRadius: 999,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: 'var(--text-soft)',
                  opacity: on ? 1 : 0.45,
                  transition: 'all 0.15s',
                  userSelect: 'none',
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ServiceLogo id={s.id} size={12} color={on ? s.color : 'var(--text-dim)'} />
                </span>
                {s.label}
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    marginLeft: 2,
                    background: on ? s.color : 'var(--text-dim)',
                    boxShadow: on ? `0 0 6px ${s.color}` : undefined,
                    display: 'block',
                  }}
                />
              </button>
            )
          })}
          <span style={{ width: 1, height: 18, background: 'var(--hairline)', margin: '0 4px' }} />
          <button
            style={{ padding: '4px 9px', borderRadius: 999, color: 'var(--text-muted)', fontSize: 11.5 }}
            onClick={() => {
              const all = SERVICES.every((s) => enabledIds.has(s.id))
              if (all) SERVICES.forEach((s) => onToggle(s.id))
              else SERVICES.forEach((s) => { if (!enabledIds.has(s.id)) onToggle(s.id) })
            }}
          >
            {SERVICES.every((s) => enabledIds.has(s.id)) ? 'None' : 'All'}
          </button>
        </div>

        {/* Textarea */}
        <div
          style={{
            position: 'relative',
            borderRadius: 12,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))',
            border: '1px solid var(--border)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.02) inset, 0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask all models…"
            rows={2}
            style={{
              width: '100%',
              background: 'transparent',
              border: 0,
              outline: 0,
              resize: 'none',
              padding: '11px 14px',
              color: 'var(--text)',
              fontSize: 14,
              lineHeight: 1.5,
              minHeight: 44,
              maxHeight: 84,
              fontFamily: 'inherit',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 12px 8px 12px',
              color: 'var(--text-dim)',
              fontSize: 10.5,
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                display: 'inline-flex',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 2,
                gap: 2,
              }}>
                <button
                  type="button"
                  onClick={() => onSetBroadcastMode?.('parallel')}
                  style={{
                    fontSize: 10.5,
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: 0,
                    background: broadcastMode === 'parallel' ? 'var(--surface)' : 'transparent',
                    color: broadcastMode === 'parallel' ? 'var(--text)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    transition: 'all 0.1s ease',
                  }}
                >
                  Parallel
                </button>
                <button
                  type="button"
                  onClick={() => onSetBroadcastMode?.('sequential')}
                  style={{
                    fontSize: 10.5,
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: 0,
                    background: broadcastMode === 'sequential' ? 'var(--surface)' : 'transparent',
                    color: broadcastMode === 'sequential' ? 'var(--text)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    transition: 'all 0.1s ease',
                  }}
                >
                  Sequential
                </button>
              </div>
              <span>·</span>
              <span style={{ color: readyCount === 0 ? 'var(--warn)' : 'var(--text-dim)' }}>
                {readyCount === 0
                  ? 'Sign in below ↓'
                  : `${readyCount} of ${SERVICES.length} ready`}
              </span>
            </div>
            <div>
              <kbd style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
              }}>⌘</kbd>{' '}
              <kbd style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
              }}>↵</kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Send button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, paddingTop: 24 }}>
        <button
          onClick={onSend}
          disabled={isSending || !value.trim() || activeCount === 0}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 14px',
            height: 38,
            borderRadius: 10,
            background: isSending ? 'var(--surface-3)' : 'linear-gradient(180deg, #f4f4f6, #d6d6dc)',
            color: isSending ? 'var(--text-muted)' : '#0E0E11',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '-0.005em',
            boxShadow: '0 1px 0 rgba(255,255,255,0.4) inset, 0 -1px 0 rgba(0,0,0,0.08) inset, 0 4px 14px rgba(0,0,0,0.3)',
            transition: 'transform 0.1s, box-shadow 0.15s',
            opacity: (!value.trim() || activeCount === 0) ? 0.5 : 1,
            cursor: (!value.trim() || activeCount === 0 || isSending) ? 'not-allowed' : 'pointer',
          }}
        >
          <span>{isSending ? 'Sending…' : broadcastMode === 'sequential' ? 'Send sequentially' : 'Send to all'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {charCount} / 4 000 chars
        </div>

        {/* Summarize Action */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div ref={dropdownRef} style={{ position: 'relative', width: 100 }}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  fontSize: 11,
                  padding: '4px 6px 4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-soft)',
                  cursor: 'pointer',
                  outline: 'none',
                  fontFamily: 'inherit',
                  height: 28,
                  width: 100,
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 68 }}>
                  {SERVICES.find(s => s.id === (summaryModelId ?? enabledServices[0]?.id))?.label ?? 'Select'}
                </span>
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  style={{
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {dropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 4px)',
                    left: 0,
                    width: 140,
                    background: '#16161B',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                    zIndex: 1000,
                    padding: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {(enabledServices.length > 0 ? enabledServices : SERVICES).map(s => {
                    const active = s.id === (summaryModelId ?? enabledServices[0]?.id)
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          onSelectSummaryModel(s.id)
                          setDropdownOpen(false)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          color: active ? 'var(--text)' : 'var(--text-soft)',
                          fontSize: 11.5,
                          fontWeight: active ? 600 : 500,
                          textAlign: 'left',
                          cursor: 'pointer',
                          width: '100%',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                        }}
                        onMouseLeave={(e) => {
                          if (!active) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: s.color,
                            display: 'block',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <button
              onClick={onSummarize}
              disabled={!hasResponsesToSummarize || isSending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '0 10px',
                height: 28,
                borderRadius: 6,
                background: (!hasResponsesToSummarize || isSending) ? 'var(--surface-3)' : 'linear-gradient(180deg, #4D6BFE, #3b50df)',
                color: (!hasResponsesToSummarize || isSending) ? 'var(--text-muted)' : '#ffffff',
                fontWeight: 600,
                fontSize: 11,
                border: 'none',
                boxShadow: (!hasResponsesToSummarize || isSending) ? undefined : '0 4px 12px rgba(77,107,254,0.15)',
                transition: 'all 0.15s',
                opacity: (!hasResponsesToSummarize || isSending) ? 0.5 : 1,
                cursor: (!hasResponsesToSummarize || isSending) ? 'not-allowed' : 'pointer',
                width: 100,
              }}
            >
              <span>Summarize</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


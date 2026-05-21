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
  summaryEnabled: boolean
  summaryModelId: ServiceId | null
  onToggleSummary: () => void
  onSelectSummaryModel: (id: ServiceId) => void
}

export function PromptComposer({ value, onChange, onSend, enabledIds, onToggle, isSending, statuses, summaryEnabled, summaryModelId, onToggleSummary, onSelectSummaryModel }: Props) {
  const enabledServices = SERVICES.filter(s => enabledIds.has(s.id))
  const taRef = useRef<HTMLTextAreaElement>(null)

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
        gridTemplateColumns: '220px 1fr 140px',
        gap: 20,
        alignItems: 'start',
        borderBottom: '1px solid var(--hairline)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.015), transparent)',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8 }}>
        <BrandMark />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>MultiMind</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Ask everyone at once</div>
        </div>
      </div>

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
              <span>Broadcast mode</span>
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
          <span>{isSending ? 'Sending…' : 'Send to all'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {charCount} / 4 000 chars
        </div>

        {/* Summary toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 11, color: summaryEnabled ? 'var(--text-soft)' : 'var(--text-dim)' }}>Summarize</span>
            <div
              onClick={onToggleSummary}
              style={{
                width: 28, height: 16, borderRadius: 8, position: 'relative', cursor: 'pointer',
                background: summaryEnabled ? '#4D6BFE' : 'var(--surface-3)',
                border: '1px solid var(--border)',
                transition: 'background 0.15s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: summaryEnabled ? 13 : 2,
                width: 10, height: 10, borderRadius: '50%',
                background: summaryEnabled ? '#fff' : 'var(--text-dim)',
                transition: 'left 0.15s',
              }} />
            </div>
          </label>
          {summaryEnabled && enabledServices.length > 0 && (
            <select
              value={summaryModelId ?? enabledServices[0]?.id ?? ''}
              onChange={e => onSelectSummaryModel(e.target.value as ServiceId)}
              style={{
                fontSize: 10.5, padding: '3px 6px', borderRadius: 5,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text-soft)', cursor: 'pointer', outline: 'none',
                fontFamily: 'inherit',
              }}
            >
              {enabledServices.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  )
}

function BrandMark() {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        background: 'conic-gradient(from 200deg at 50% 50%, #10A37F 0deg, #4285F4 90deg, #D97757 180deg, #E7E7E7 270deg, #10A37F 360deg)',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 6,
          borderRadius: 4,
          background: 'var(--bg)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 11,
          borderRadius: 2,
          background: 'linear-gradient(135deg, #fff, #aaa)',
          zIndex: 1,
        }}
      />
    </div>
  )
}

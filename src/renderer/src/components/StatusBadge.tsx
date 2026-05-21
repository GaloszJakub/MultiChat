import React from 'react'

export type Status = 'idle' | 'sending' | 'sent' | 'error' | 'loggedout' | 'waiting'

interface Props {
  status: Status
}

const LABELS: Record<Status, string> = {
  idle: 'Idle',
  sending: 'Thinking…',
  sent: 'Responded',
  error: 'Error',
  loggedout: 'Signed out',
  waiting: 'Queued…',
}

const DOT_COLORS: Record<Status, string> = {
  idle: 'var(--text-dim)',
  sending: 'var(--warn)',
  sent: 'var(--ok)',
  error: 'var(--err)',
  loggedout: 'var(--text-dim)',
  waiting: 'var(--text-muted)',
}

export function StatusBadge({ status }: Props) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px 3px 7px',
        borderRadius: 999,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        fontSize: 10.5,
        color: 'var(--text-muted)',
        fontWeight: 500,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: DOT_COLORS[status],
          animation: status === 'sending' ? 'pulse 1.2s ease-in-out infinite' : undefined,
          display: 'block',
        }}
      />
      {LABELS[status]}
    </span>
  )
}

import React from 'react'
import type { ServiceId } from '../../../main/services/types'
import { SERVICES } from '../lib/services'

export interface PipelineStep {
  serviceId: ServiceId
  promptTemplate: string
}

export interface PipelineState {
  isActive: boolean
  steps: PipelineStep[]
  currentStepIndex: number
  originalPrompt: string
  responses: Record<ServiceId, string>
  isPaused: boolean
  editedPrompt: string
}

interface Props {
  state: PipelineState
  onStopPipeline: () => void
}

export function PipelineControlPanel({
  state,
  onStopPipeline
}: Props) {
  if (!state.isActive) return null

  return (
    <div
      style={{
        position: 'relative',
        background: 'rgba(18, 18, 24, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '10px 16px',
        margin: '12px 14px 2px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.40)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 50
      }}
    >
      {/* Step Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            background: 'rgba(77, 107, 254, 0.15)',
            border: '1px solid rgba(77, 107, 254, 0.25)',
            color: '#4D6BFE',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          Pipeline Active
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)' }}>
          Step {state.currentStepIndex + 1} of {state.steps.length}
        </span>
      </div>

      {/* Steps Track List */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
        {state.steps.map((step, idx) => {
          const service = SERVICES.find(s => s.id === step.serviceId)
          const isCompleted = idx < state.currentStepIndex
          const isCurrent = idx === state.currentStepIndex
          const isWaiting = idx > state.currentStepIndex
          
          let badgeBg = 'rgba(255,255,255,0.03)'
          let badgeBorder = 'rgba(255,255,255,0.06)'
          let badgeColor = 'var(--text-muted)'
          
          if (isCompleted) {
            badgeBg = 'rgba(16, 163, 127, 0.08)'
            badgeBorder = 'rgba(16, 163, 127, 0.2)'
            badgeColor = '#10A37F'
          } else if (isCurrent) {
            badgeBg = 'rgba(77, 107, 254, 0.1)'
            badgeBorder = 'rgba(77, 107, 254, 0.25)'
            badgeColor = '#4D6BFE'
          }

          return (
            <div
              key={idx}
              title={`${service?.label || step.serviceId}: ${isCompleted ? 'Done' : isCurrent ? 'Running' : 'Waiting'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                background: badgeBg,
                border: `1px solid ${badgeBorder}`,
                fontSize: 10,
                fontWeight: 600,
                color: badgeColor,
                transition: 'all 0.2s',
                opacity: isWaiting ? 0.45 : 1
              }}
            >
              <span>{service?.label || step.serviceId}</span>
              {isCompleted && <span>✓</span>}
              {isCurrent && (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#4D6BFE',
                    display: 'inline-block',
                    animation: 'pulse 1s infinite alternate'
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Stop / Cancel button */}
      <button
        onClick={onStopPipeline}
        title="Cancel execution and abort sequence"
        style={{
          padding: '5px 12px',
          borderRadius: 6,
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'rgba(239, 68, 68, 0.8)',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
      >
        Cancel
      </button>
    </div>
  )
}

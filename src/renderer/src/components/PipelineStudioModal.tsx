import React, { useState, useEffect, useRef } from 'react'
import type { ServiceId } from '../../../main/services/types'
import { SERVICES } from '../lib/services'

const TextareaAutoGrow = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  
  useEffect(() => {
    const ta = ref.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      style={{
        width: '100%',
        minHeight: 60,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        fontSize: 12,
        fontFamily: 'inherit',
        resize: 'vertical',
        outline: 'none',
        lineHeight: 1.5,
        cursor: 'text',
        overflowY: 'hidden'
      }}
    />
  )
}

interface ServiceSelectorProps {
  value: ServiceId
  onChange: (val: ServiceId) => void
}

const ServiceSelector = ({ value, onChange }: ServiceSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedService = SERVICES.find(s => s.id === value) || SERVICES[0]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 12px 5px 10px',
          borderRadius: 8,
          background: 'rgba(255, 255, 255, 0.04)',
          border: isOpen ? '1px solid #4D6BFE' : '1px solid var(--border)',
          color: 'var(--text)',
          fontSize: 11.5,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'all 0.15s',
          outline: 'none',
          userSelect: 'none',
          minWidth: 120,
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: selectedService.color,
              boxShadow: `0 0 6px ${selectedService.color}`
            }}
          />
          <span>{selectedService.label}</span>
        </div>
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--text-muted)'
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 140,
            background: 'rgba(22, 22, 27, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {SERVICES.map(s => {
            const active = s.id === value
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange(s.id)
                  setIsOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: active ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-soft)',
                  fontSize: 11.5,
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: s.color,
                    boxShadow: active ? `0 0 6px ${s.color}` : undefined
                  }}
                />
                <span>{s.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export interface PipelineStep {
  serviceId: ServiceId
  promptTemplate: string
}

export interface PipelinePreset {
  id: string
  name: string
  description: string
  steps: PipelineStep[]
}

export const PRESETS: PipelinePreset[] = [
  {
    id: 'standard',
    name: 'Standard Chain',
    description: 'ChatGPT drafts, Gemini reviews, Claude synthesizes the final output.',
    steps: [
      { serviceId: 'chatgpt', promptTemplate: '{{input}}' },
      { serviceId: 'gemini', promptTemplate: 'Original question:\n"{{input}}"\n\nPrevious response:\n{{previous}}\n---\nReview and provide your own response, highlighting any corrections or additions.' },
      { serviceId: 'claude', promptTemplate: 'Original question:\n"{{input}}"\n\nPrevious responses:\n{{all_previous}}\n---\nSynthesize the above responses and provide a final definitive answer.' },
    ]
  },
  {
    id: 'critic',
    name: 'Critic & Refiner',
    description: 'Claude drafts, ChatGPT criticizes, Gemini writes the final polished text.',
    steps: [
      { serviceId: 'claude', promptTemplate: '{{input}}' },
      { serviceId: 'chatgpt', promptTemplate: 'Read the following draft and act as a harsh critic. Point out flaws, logical gaps, and areas for improvement:\n\n{{previous}}' },
      { serviceId: 'gemini', promptTemplate: 'Original task:\n"{{input}}"\n\nDraft:\n{{claude}}\n\nCriticism:\n{{chatgpt}}\n\n---\nRewrite and polish the draft, resolving all the criticisms raised.' },
    ]
  },
  {
    id: 'expand',
    name: 'Outline & Write',
    description: 'Gemini creates a detailed outline, Claude writes full text, ChatGPT proofreads.',
    steps: [
      { serviceId: 'gemini', promptTemplate: 'Create a comprehensive outline for the following topic:\n\n{{input}}' },
      { serviceId: 'claude', promptTemplate: 'Write a full, detailed article/response based on this outline:\n\n{{previous}}\n\nOriginal topic: "{{input}}"' },
      { serviceId: 'chatgpt', promptTemplate: 'Proofread the following text for grammar, flow, and professional tone:\n\n{{previous}}' },
    ]
  }
]

interface Props {
  isOpen: boolean
  onClose: () => void
  steps: PipelineStep[]
  selectedPresetId: string
  onSave: (newSteps: PipelineStep[], presetId: string) => void
}

export function PipelineStudioModal({
  isOpen,
  onClose,
  steps: initialSteps,
  selectedPresetId: initialPresetId,
  onSave
}: Props) {
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState('standard')

  useEffect(() => {
    if (isOpen) {
      setSteps(JSON.parse(JSON.stringify(initialSteps)))
      setSelectedPresetId(initialPresetId || 'standard')
    }
  }, [isOpen, initialSteps, initialPresetId])

  if (!isOpen) return null

  const handleSave = () => {
    if (steps.length === 0) return
    onSave(steps, selectedPresetId)
    onClose()
  }

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0]
    
    // Preserve currently assigned models where step counts align
    const defaultSteps = JSON.parse(JSON.stringify(preset.steps)) as PipelineStep[]
    steps.forEach((s, idx) => {
      if (defaultSteps[idx]) {
        defaultSteps[idx].serviceId = s.serviceId
      }
    })
    setSteps(defaultSteps)
  }

  const handleAddStep = () => {
    const defaultService = SERVICES[0]?.id || 'chatgpt'
    const newStep: PipelineStep = {
      serviceId: defaultService,
      promptTemplate: steps.length === 0 ? '{{input}}' : 'Original question:\n"{{input}}"\n\nPrevious response:\n{{previous}}\n---\nReview and expand on this.'
    }
    setSteps([...steps, newStep])
    setSelectedPresetId('custom')
  }

  const handleRemoveStep = (index: number) => {
    const newSteps = [...steps]
    newSteps.splice(index, 1)
    setSteps(newSteps)
    setSelectedPresetId('custom')
  }

  const handleStepChange = (index: number, updates: Partial<PipelineStep>) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], ...updates }
    setSteps(newSteps)
    
    // If template is changed, it becomes a custom pipeline configuration
    if (updates.promptTemplate !== undefined) {
      setSelectedPresetId('custom')
    }
  }

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === steps.length - 1) return

    const targetIdx = direction === 'up' ? index - 1 : index + 1
    const newSteps = [...steps]
    const temp = newSteps[index]
    newSteps[index] = newSteps[targetIdx]
    newSteps[targetIdx] = temp

    setSteps(newSteps)
    setSelectedPresetId('custom')
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          height: '85vh',
          background: 'rgba(15, 15, 20, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          overflow: 'hidden',
          animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              Configure Sequential Chain
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
              Select a preset template, swap active models per task step, or edit templates directly.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 0,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Split Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', overflow: 'hidden' }}>
          
          {/* Left Sidebar (Presets) */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              overflowY: 'auto'
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
              Preset Templates
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PRESETS.map(preset => {
                const active = selectedPresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 10,
                      border: active ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255,255,255,0.03)',
                      background: active ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text-soft)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                    onMouseEnter={e => {
                      if (!active) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'
                    }}
                    onMouseLeave={e => {
                      if (!active) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-soft)' }}>
                      {preset.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
                      {preset.description}
                    </span>
                  </button>
                )
              })}

              {selectedPresetId === 'custom' && (
                <div
                  style={{
                    textAlign: 'left',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px dashed #4D6BFE',
                    background: 'rgba(77, 107, 254, 0.04)',
                    color: '#4D6BFE',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    Custom Config Active
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.3 }}>
                    You modified steps or templates. Click any preset above to reset.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Editor Panel */}
          <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Steps List */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Chain Steps
                </span>
                <button
                  type="button"
                  onClick={handleAddStep}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '4px 12px',
                    color: 'var(--text)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  + Add Step
                </button>
              </div>

              {steps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)', fontSize: 12, border: '1px dashed rgba(255, 255, 255, 0.08)', borderRadius: 10 }}>
                  No steps defined. Click "+ Add Step" to build your custom sequence.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {steps.map((step, stepIdx) => {
                    return (
                      <div
                        key={stepIdx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: 10,
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        {/* Step Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: 'rgba(255, 255, 255, 0.08)',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--text-soft)'
                            }}
                          >
                            {stepIdx + 1}
                          </div>

                          {/* Model Select Box */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Execute with:</span>
                            <ServiceSelector
                              value={step.serviceId}
                              onChange={val => handleStepChange(stepIdx, { serviceId: val })}
                            />
                          </div>

                          {/* Step reordering & deletion */}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(stepIdx, 'up')}
                              disabled={stepIdx === 0}
                              style={{
                                background: 'none',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: 5,
                                width: 24,
                                height: 24,
                                color: stepIdx === 0 ? '#444' : 'var(--text-muted)',
                                cursor: stepIdx === 0 ? 'not-allowed' : 'pointer',
                                fontSize: 10
                              }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(stepIdx, 'down')}
                              disabled={stepIdx === steps.length - 1}
                              style={{
                                background: 'none',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: 5,
                                width: 24,
                                height: 24,
                                color: stepIdx === steps.length - 1 ? '#444' : 'var(--text-muted)',
                                cursor: stepIdx === steps.length - 1 ? 'not-allowed' : 'pointer',
                                fontSize: 10
                              }}
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(stepIdx)}
                              style={{
                                background: 'none',
                                border: '1px solid rgba(239, 68, 68, 0.15)',
                                borderRadius: 5,
                                width: 24,
                                height: 24,
                                color: 'rgba(239, 68, 68, 0.7)',
                                cursor: 'pointer',
                                fontSize: 10
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Template editing */}
                        <div>
                          <div style={{ marginBottom: 4 }}>
                            <label style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Prompt Template
                            </label>
                          </div>
                          <TextareaAutoGrow
                            value={step.promptTemplate}
                            onChange={val => handleStepChange(stepIdx, { promptTemplate: val })}
                            placeholder="Write prompt template here..."
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-soft)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={steps.length === 0}
            style={{
              padding: '8px 22px',
              borderRadius: 8,
              background: '#4D6BFE',
              border: 0,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: steps.length === 0 ? 'not-allowed' : 'pointer',
              opacity: steps.length === 0 ? 0.5 : 1
            }}
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  )
}

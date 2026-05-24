import React, { useRef, useEffect } from 'react'
import { ServiceLogo } from './ServiceLogo'
import type { ServiceId } from '../../../main/services/types'
import type { Status } from './StatusBadge'
import { SERVICES } from '../lib/services'
import { PipelinePreset } from './PipelineStudioModal'

interface Attachment {
  name: string
  size: number
  content: string
  type: string
}

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
  serviceOrder?: ServiceId[]
  onUpdateServiceOrder?: (newOrder: ServiceId[]) => void
  onOpenPipelineStudio?: () => void
}

export function PromptComposer({
  value,
  onChange,
  onSend,
  enabledIds,
  onToggle,
  isSending,
  statuses,
  summaryModelId,
  onSelectSummaryModel,
  onSummarize,
  hasResponsesToSummarize,
  broadcastMode = 'parallel',
  onSetBroadcastMode,
  onUpdateServiceOrder,
  onOpenPipelineStudio,
  serviceOrder = SERVICES.map(s => s.id)
}: Props) {
  const enabledServices = serviceOrder
    .filter(id => enabledIds.has(id))
    .map(id => SERVICES.find(s => s.id === id)!)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const handleSetPosition = (id: ServiceId, targetIndex: number) => {
    if (!onUpdateServiceOrder) return
    const activeOrder = serviceOrder.filter(x => enabledIds.has(x))
    const index = activeOrder.indexOf(id)
    if (index === -1 || targetIndex < 0 || targetIndex >= activeOrder.length) return

    const newActiveOrder = [...activeOrder]
    newActiveOrder.splice(index, 1)
    newActiveOrder.splice(targetIndex, 0, id)

    const newOrder: ServiceId[] = []
    let activePtr = 0
    for (const x of serviceOrder) {
      if (enabledIds.has(x)) {
        newOrder.push(newActiveOrder[activePtr++])
      } else {
        newOrder.push(x)
      }
    }
    onUpdateServiceOrder(newOrder)
  }

  const [activeDragId, setActiveDragId] = React.useState<ServiceId | null>(null)
  const draggedIdRef = useRef<ServiceId | null>(null)



  const handleDragStart = (e: React.DragEvent, id: ServiceId) => {
    draggedIdRef.current = id
    setActiveDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragEnter = (e: React.DragEvent, targetId: ServiceId) => {
    e.preventDefault()
    const draggedId = draggedIdRef.current
    if (!draggedId || draggedId === targetId) return
    if (!enabledIds.has(targetId)) return

    const activeOrder = serviceOrder.filter(x => enabledIds.has(x))
    const draggedIdx = activeOrder.indexOf(draggedId)
    const targetIdx = activeOrder.indexOf(targetId)
    if (draggedIdx === -1 || targetIdx === -1) return

    const newActiveOrder = [...activeOrder]
    newActiveOrder.splice(draggedIdx, 1)
    newActiveOrder.splice(targetIdx, 0, draggedId)

    const newOrder: ServiceId[] = []
    let activePtr = 0
    for (const x of serviceOrder) {
      if (enabledIds.has(x)) {
        newOrder.push(newActiveOrder[activePtr++])
      } else {
        newOrder.push(x)
      }
    }
    onUpdateServiceOrder?.(newOrder)
  }

  const handleDragEnd = () => {
    draggedIdRef.current = null
    setActiveDragId(null)
  }

  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [openPositionDropdownId, setOpenPositionDropdownId] = React.useState<ServiceId | null>(null)

  const [attachments, setAttachments] = React.useState<Attachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFiles = (files: FileList) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        setAttachments(prev => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            content: text || '',
            type: file.type || file.name.split('.').pop() || 'text/plain'
          }
        ])
      }
      reader.readAsText(file)
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    processFiles(e.target.files)
  }

  const handleContainerDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      processFiles(e.dataTransfer.files)
    }
  }

  const handleSendClick = () => {
    if (attachments.length > 0) {
      let finalValue = value.trim()
      attachments.forEach(file => {
        finalValue = `[Attached File: ${file.name}]\n\`\`\`\n${file.content}\n\`\`\`\n\n${finalValue}`
      })
      onChange(finalValue)
      setTimeout(() => {
        onSend()
        setAttachments([])
      }, 50)
    } else {
      onSend()
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false)
      }
      if (!target.closest('[data-position-selector]')) {
        setOpenPositionDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const [historyIndex, setHistoryIndex] = React.useState(-1)
  const historyCache = useRef<string[]>([])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 300) + 'px'
  }, [value])

  useEffect(() => {
    // @ts-ignore
    window.api.historyGet(50).then(rows => {
      historyCache.current = rows.map(r => r.text)
    })
  }, [])

  useEffect(() => {
    if (value === '') {
      // @ts-ignore
      window.api.historyGet(50).then(rows => {
        historyCache.current = rows.map(r => r.text)
        setHistoryIndex(-1)
      })
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSendClick()
    }
    if (e.key === 'ArrowUp' && e.ctrlKey) {
      const next = Math.min(historyIndex + 1, historyCache.current.length - 1)
      setHistoryIndex(next)
      if (historyCache.current[next] !== undefined) {
        onChange(historyCache.current[next])
      }
      e.preventDefault()
    }
    if (e.key === 'ArrowDown' && e.ctrlKey) {
      const next = Math.max(historyIndex - 1, -1)
      setHistoryIndex(next)
      onChange(next === -1 ? '' : historyCache.current[next])
      e.preventDefault()
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
          {serviceOrder.map(id => SERVICES.find(s => s.id === id)!).map((s) => {
            const on = enabledIds.has(s.id)
            const activeIndex = enabledServices.findIndex(x => x.id === s.id)
            return (
              <button
                key={s.id}
                data-on={on}
                onClick={() => onToggle(s.id)}
                draggable={broadcastMode === 'sequential' && on}
                onDragStart={(e) => handleDragStart(e, s.id)}
                onDragOver={(e) => {
                  if (broadcastMode === 'sequential' && on) {
                    e.preventDefault()
                  }
                }}
                onDragEnter={(e) => handleDragEnter(e, s.id)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: (broadcastMode === 'sequential' && on) ? '4px 10px 4px 5px' : '4px 10px 4px 6px',
                  borderRadius: 999,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: 'var(--text-soft)',
                  opacity: activeDragId === s.id ? 0.25 : (on ? 1 : 0.45),
                  transition: 'all 0.15s, opacity 0.1s',
                  userSelect: 'none',
                  cursor: (broadcastMode === 'sequential' && on) ? (activeDragId === s.id ? 'grabbing' : 'grab') : 'pointer',
                }}
              >
                {broadcastMode === 'sequential' && on && (
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      data-position-selector={s.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenPositionDropdownId(openPositionDropdownId === s.id ? null : s.id)
                      }}
                      style={{
                        fontSize: 11,
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 6,
                        padding: '2.5px 18px 2.5px 8px',
                        color: 'var(--text)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none',
                        fontFamily: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginRight: 4,
                        position: 'relative',
                        height: 20,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                      }}
                    >
                      <span>{activeIndex + 1}</span>
                      <svg
                        width="7"
                        height="7"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(255,255,255,0.6)"
                        strokeWidth="4"
                        style={{
                          position: 'absolute',
                          right: 6,
                          top: 'calc(50% - 3.5px)',
                          transform: openPositionDropdownId === s.id ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                        }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {openPositionDropdownId === s.id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          width: 60,
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
                        onClick={e => e.stopPropagation()}
                      >
                        {enabledServices.map((_, idx) => {
                          const active = idx === activeIndex
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSetPosition(s.id, idx)
                                setOpenPositionDropdownId(null)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 6px',
                                borderRadius: 6,
                                border: 'none',
                                background: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                color: active ? 'var(--text)' : 'var(--text-soft)',
                                fontSize: 11,
                                fontWeight: active ? 600 : 500,
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
                              {idx + 1}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
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

        {/* File Attachments */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0 6px' }}>
            {attachments.map((file, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 11,
                  color: 'var(--text-soft)',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span style={{ fontWeight: 500 }}>{file.name}</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    marginLeft: 2,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--warn)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <div
          onDragOver={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={handleContainerDrop}
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
              maxHeight: 300,
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
              {broadcastMode === 'sequential' && (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={onOpenPipelineStudio}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10.5,
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  >
                    <span>Configure Chain</span>
                  </button>
                </>
              )}
              <span>·</span>
              <span style={{ color: readyCount === 0 ? 'var(--warn)' : 'var(--text-dim)' }}>
                {readyCount === 0
                  ? 'Sign in below ↓'
                  : `${readyCount} of ${SERVICES.length} ready`}
              </span>
              <span>·</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  fontSize: 10.5,
                  padding: '3.5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-soft)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 600,
                  transition: 'all 0.1s ease',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-2)'}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Add File</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Send button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, paddingTop: 24 }}>
        <button
          onClick={handleSendClick}
          disabled={isSending || (!value.trim() && attachments.length === 0) || activeCount === 0}
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
            opacity: (!value.trim() && attachments.length === 0 || activeCount === 0) ? 0.5 : 1,
            cursor: ((!value.trim() && attachments.length === 0) || activeCount === 0 || isSending) ? 'not-allowed' : 'pointer',
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


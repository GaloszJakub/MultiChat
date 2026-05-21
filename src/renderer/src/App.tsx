import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { TitleBar } from './components/TitleBar'
import { PromptComposer } from './components/PromptComposer'
import { SkillsSidebar } from './components/SkillsSidebar'
import { ResponseCard } from './components/ResponseCard'
import { TabBar } from './components/TabBar'
import { SettingsPanel } from './components/SettingsPanel'
import { SERVICES, SERVICE_MODELS } from './lib/services'
import { ModelPicker } from './components/ModelPicker'
import { api } from './lib/ipc'
import type { ServiceId } from '../../main/services/types'
import type { Status } from './components/StatusBadge'

export type Message = { role: 'user' | 'assistant'; text: string }

const CARD_SERVICES = new Set<ServiceId>(['claude', 'gemini'])

type StatusMap = Record<ServiceId, Status>

const INITIAL_STATUSES: StatusMap = {
  chatgpt: 'loggedout',
  claude: 'loggedout',
  gemini: 'loggedout',
  grok: 'loggedout',
  kimi: 'loggedout',
  deepseek: 'loggedout',
}

const emptyConversations = (): Record<ServiceId, Message[]> => ({
  chatgpt: [], claude: [], gemini: [], grok: [], kimi: [], deepseek: [],
})

const DEFAULT_ENABLED: ServiceId[] = ['claude', 'gemini']

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [enabledIds, setEnabledIds] = useState<Set<ServiceId>>(new Set(DEFAULT_ENABLED))
  const [activeId, setActiveId] = useState<ServiceId>(DEFAULT_ENABLED[0])
  const [statuses, setStatuses] = useState<StatusMap>(INITIAL_STATUSES)
  const [broadcastMode, setBroadcastMode] = useState<'parallel' | 'sequential'>('parallel')
  const [serialActiveId, setSerialActiveId] = useState<ServiceId | null>(null)
  const [conversations, setConversations] = useState<Record<ServiceId, Message[]>>(emptyConversations)
  const [selectedSkill, setSelectedSkill] = useState<{ name: string; file: string } | null>(null)
  const [selectedModels, setSelectedModels] = useState<Partial<Record<ServiceId, string>>>(() =>
    Object.fromEntries(
      Object.entries(SERVICE_MODELS).map(([id, models]) => [id, models![0].value])
    )
  )
  const [skillContent, setSkillContent] = useState<string>('')
  const [topHeight, setTopHeight] = useState(220)
  const [showSettings, setShowSettings] = useState(false)
  const [nativeServices, setNativeServices] = useState<Set<ServiceId>>(new Set([...CARD_SERVICES]))
  const [summaryModelId, setSummaryModelId] = useState<ServiceId | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [latestResponses, setLatestResponses] = useState<Record<ServiceId, string>>(() => ({
    chatgpt: '', claude: '', gemini: '', grok: '', kimi: '', deepseek: '',
  }))

  const activePaneRef = useRef<HTMLDivElement>(null)
  const lastBoundsKey = useRef('')
  const dragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // When enabled services change, ensure activeId is still valid
  useEffect(() => {
    if (!enabledIds.has(activeId)) {
      const first = SERVICES.find(s => enabledIds.has(s.id))
      if (first) setActiveId(first.id)
    }
  }, [enabledIds, activeId])

  const isCard = useCallback((id: ServiceId) =>
    CARD_SERVICES.has(id) && !nativeServices.has(id),
  [nativeServices])

  const reportBounds = useCallback(() => {
    if (showSettings || isCard(activeId) || modalOpen) {
      const key = '[]'
      if (key === lastBoundsKey.current) return
      lastBoundsKey.current = key
      api.setViewBounds([])
      return
    }
    const el = activePaneRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    const bounds = [{ id: activeId, x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }]
    const key = JSON.stringify(bounds)
    if (key === lastBoundsKey.current) return
    lastBoundsKey.current = key
    api.setViewBounds(bounds)
  }, [activeId, isCard, showSettings, modalOpen])

  useLayoutEffect(() => { reportBounds() })

  useEffect(() => {
    const ro = new ResizeObserver(reportBounds)
    if (activePaneRef.current) ro.observe(activePaneRef.current)
    window.addEventListener('resize', reportBounds)
    return () => { ro.disconnect(); window.removeEventListener('resize', reportBounds) }
  }, [reportBounds])

  const handleCardSend = useCallback(async (id: ServiceId, text: string) => {
    setConversations(prev => ({
      ...prev,
      [id]: [...prev[id], { role: 'user', text }, { role: 'assistant', text: '' }],
    }))
    setStatuses(prev => ({ ...prev, [id]: 'sending' }))
    try {
      const results = await api.broadcast(text, [id])
      setStatuses(prev => ({ ...prev, [id]: results[0]?.ok ? 'sent' : 'error' }))
    } catch {
      setStatuses(prev => ({ ...prev, [id]: 'error' }))
    }
  }, [])

  const handleCardSendRef = useRef(handleCardSend)
  handleCardSendRef.current = handleCardSend

  const enabledIdsRef = useRef(enabledIds)
  useEffect(() => {
    enabledIdsRef.current = enabledIds
  }, [enabledIds])

  useEffect(() => {
    const unsub = api.onServiceResponse(({ id, text, done }) => {
      console.log(`[App:onServiceResponse] id: ${id}, done: ${done}, textLength: ${text.length}`)
      if (text.length > 0) {
        setLatestResponses(prev => ({ ...prev, [id]: text }))
      }
      if (CARD_SERVICES.has(id)) {
        setConversations(prev => {
          const msgs = prev[id]
          if (!msgs.length) return prev
          const lastIdx = msgs.length - 1
          if (msgs[lastIdx].role !== 'assistant') return prev
          const next = [...msgs]
          next[lastIdx] = { role: 'assistant', text }
          return { ...prev, [id]: next }
        })
      }
      if (done && text.length > 0) {
        setStatuses(prev => prev[id] === 'sending' || prev[id] === 'sent' ? { ...prev, [id]: 'idle' } : prev)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = api.onSerialProgress(({ currentId, index, total, done }) => {
      if (done) {
        setSerialActiveId(null)
        setIsSending(false)
        return
      }
      setSerialActiveId(currentId)
      setStatuses(prev => {
        const next = { ...prev }
        const order = SERVICES.filter(s => enabledIdsRef.current.has(s.id)).map(s => s.id)
        order.forEach((id, idx) => {
          if (idx > index) {
            next[id] = 'waiting'
          } else if (id === currentId) {
            next[id] = 'sending'
          }
        })
        return next
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = api.onServiceStatus(({ id, loggedIn }) => {
      setStatuses(prev => {
        const cur = prev[id]
        if (cur === 'sending' || cur === 'sent' || cur === 'waiting') return prev
        const next = loggedIn ? 'idle' : 'loggedout'
        if (cur === next) return prev
        return { ...prev, [id]: next }
      })
    })
    return unsub
  }, [])

  const handleToggle = useCallback((id: ServiceId) => {
    setEnabledIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || isSending || enabledIds.size === 0) return
    const ids = SERVICES.filter(s => enabledIds.has(s.id)).map(s => s.id)
    const finalPrompt = skillContent ? `${skillContent}\n\n---\n\n${prompt.trim()}` : prompt.trim()
    setIsSending(true)

    setLatestResponses(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[id] = '' })
      return next
    })

    setConversations(prev => {
      const next = { ...prev }
      ids.filter(id => CARD_SERVICES.has(id)).forEach(id => {
        next[id] = [...prev[id], { role: 'user', text: finalPrompt }, { role: 'assistant', text: '' }]
      })
      return next
    })

    if (broadcastMode === 'sequential') {
      setStatuses(prev => {
        const next = { ...prev }
        ids.forEach((id, idx) => {
          next[id] = idx === 0 ? 'sending' : 'waiting'
        })
        return next
      })
      try {
        const results = await api.broadcastSequential(finalPrompt, ids)
        setStatuses(prev => {
          const next = { ...prev }
          results.forEach(r => {
            next[r.id] = r.ok ? 'sent' : 'error'
          })
          return next
        })
      } catch {
        setStatuses(prev => {
          const next = { ...prev }
          ids.forEach(id => { next[id] = 'error' })
          return next
        })
      } finally {
        setIsSending(false)
        setPrompt('')
        setSerialActiveId(null)
      }
    } else {
      setStatuses(prev => {
        const next = { ...prev }
        ids.forEach(id => { next[id] = 'sending' })
        return next
      })
      try {
        const results = await api.broadcast(finalPrompt, ids)
        setStatuses(prev => {
          const next = { ...prev }
          results.forEach(r => { next[r.id] = r.ok ? 'sent' : 'error' })
          return next
        })
      } catch {
        setStatuses(prev => {
          const next = { ...prev }
          ids.forEach(id => { next[id] = 'error' })
          return next
        })
      } finally {
        setIsSending(false)
        setPrompt('')
      }
    }
  }, [prompt, isSending, enabledIds, skillContent, broadcastMode])

  const handleSummarize = useCallback(async () => {
    const targetModelId = summaryModelId ?? [...enabledIds][0]
    if (!targetModelId) return

    const parts = SERVICES
      .filter(s => enabledIds.has(s.id) && s.id !== targetModelId)
      .map(s => {
        const text = latestResponses[s.id] || ''
        if (!text.trim()) return null
        return `**${s.label}:**\n${text}`
      })
      .filter(Boolean)
      .join('\n\n---\n\n')

    if (!parts) return

    const originalPromptMsg = SERVICES
      .filter(s => enabledIds.has(s.id))
      .map(s => {
        const msgs = conversations[s.id] || []
        const lastUser = [...msgs].reverse().find(m => m.role === 'user')
        return lastUser?.text
      })
      .find(Boolean) || "the previous question"

    const summaryPrompt =
      `You are synthesizing responses from multiple AI models to this question:\n\n"${originalPromptMsg}"\n\n` +
      `Here are their responses:\n\n${parts}\n\n---\n\n` +
      `Provide a comprehensive synthesis: highlight key agreements, interesting differences, and unique insights from each model.`

    setEnabledIds(prev => {
      const next = new Set(prev)
      next.add(targetModelId)
      return next
    })
    setActiveId(targetModelId)

    handleCardSend(targetModelId, summaryPrompt)
  }, [enabledIds, conversations, latestResponses, summaryModelId, handleCardSend])

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    dragStartY.current = e.clientY
    dragStartH.current = topHeight
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const containerH = containerRef.current?.clientHeight ?? window.innerHeight
      const newH = Math.max(120, Math.min(containerH - 160, dragStartH.current + (ev.clientY - dragStartY.current)))
      setTopHeight(newH)
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleSkillSelect = useCallback(async (skill: { name: string; file: string } | null) => {
    setSelectedSkill(skill)
    if (skill) {
      const content = await api.skillsRead(skill.file)
      setSkillContent(content)
    } else {
      setSkillContent('')
    }
  }, [])

  const enabledServices = SERVICES.filter(s => enabledIds.has(s.id))
  const activeService = SERVICES.find(s => s.id === activeId)
  const activeIsCard = isCard(activeId)
  const activeModels = SERVICE_MODELS[activeId]

  const handleNewChat = useCallback((id: ServiceId) => {
    setConversations(prev => ({ ...prev, [id]: [] }))
    setLatestResponses(prev => ({ ...prev, [id]: '' }))
    api.newChat(id)
  }, [])

  const handleToggleNative = (id: ServiceId) => {
    setNativeServices(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // reset bounds key so reportBounds fires
    lastBoundsKey.current = ''
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0E0E11', overflow: 'hidden' }}>
      <TitleBar />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
        <SkillsSidebar selectedSkill={selectedSkill} onSelect={handleSkillSelect} onModalToggle={setModalOpen} />

        <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Composer */}
          <div style={{ height: topHeight, flexShrink: 0, overflow: 'hidden' }}>
            <PromptComposer
              value={prompt}
              onChange={setPrompt}
              onSend={handleSend}
              enabledIds={enabledIds}
              onToggle={handleToggle}
              isSending={isSending}
              statuses={statuses}
              summaryModelId={summaryModelId}
              onSelectSummaryModel={id => setSummaryModelId(id)}
              onSummarize={handleSummarize}
              hasResponsesToSummarize={Object.values(latestResponses).some(text => text.trim().length > 0)}
              broadcastMode={broadcastMode}
              onSetBroadcastMode={setBroadcastMode}
            />
          </div>

          {/* Drag handle */}
          <div onMouseDown={onDragStart} style={{ height: 8, flexShrink: 0, cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}>
            <div style={{ width: 48, height: 3, borderRadius: 2, background: '#2a2a2a' }} />
          </div>

          {/* Tab bar */}
          <TabBar
            services={enabledServices}
            activeId={activeId}
            statuses={statuses}
            onSelect={id => { setActiveId(id); setShowSettings(false) }}
            onLogin={id => api.cdpLogin(id)}
            onDevTools={id => api.openDevTools(id)}
            onNewChat={handleNewChat}
            showSettings={showSettings}
            onToggleSettings={() => setShowSettings(v => !v)}
          />

          {/* Model picker row (only for active service that has models, only in card mode) */}
          {activeModels && activeIsCard && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid #141414', flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Model</span>
              <ModelPicker
                models={activeModels}
                selected={selectedModels[activeId] ?? activeModels[0].value}
                color={activeService?.color ?? '#666'}
                onChange={v => {
                  setSelectedModels(prev => ({ ...prev, [activeId]: v }))
                  api.setModel(activeId, v)
                }}
              />
            </div>
          )}

          {/* Content area */}
          <div
            ref={activePaneRef}
            style={{ flex: 1, minHeight: 0, padding: (showSettings || !activeIsCard) ? '0' : '10px 12px 12px', display: 'flex', flexDirection: 'column' }}
          >
            {showSettings ? (
              <SettingsPanel
                nativeServices={nativeServices}
                onToggleNative={handleToggleNative}
              />
            ) : activeIsCard && activeService ? (
              <ResponseCard
                service={activeService}
                status={statuses[activeId]}
                messages={conversations[activeId]}
                enabled={enabledIds.has(activeId)}
                onToggle={() => handleToggle(activeId)}
                onLogin={() => api.cdpLogin(activeId)}
                onDevTools={() => api.openDevTools(activeId)}
                onSend={text => handleCardSend(activeId, text)}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: 0, border: 'none', background: '#0a0a0a' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

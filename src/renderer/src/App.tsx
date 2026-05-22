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

const CARD_SERVICES = new Set<ServiceId>(['claude', 'gemini', 'chatgpt', 'grok', 'kimi', 'deepseek'])

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
  const [nativeServices, setNativeServices] = useState<Set<ServiceId>>(new Set())
  const [geminiThinking, setGeminiThinking] = useState<'standard' | 'extended'>('standard')
  const [summaryModelId, setSummaryModelId] = useState<ServiceId | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [latestResponses, setLatestResponses] = useState<Record<ServiceId, string>>(() => ({
    chatgpt: '', claude: '', gemini: '', grok: '', kimi: '', deepseek: '',
  }))
  const [responseTimes, setResponseTimes] = useState<Partial<Record<ServiceId, number>>>({})
  const [apiKeysActive, setApiKeysActive] = useState<Partial<Record<ServiceId, boolean>>>({})
  const [serviceOrder, setServiceOrder] = useState<ServiceId[]>(() => {
    const saved = localStorage.getItem('multichat:service_order')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ServiceId[]
        const valid = parsed.filter(id => SERVICES.some(s => s.id === id))
        const missing = SERVICES.map(s => s.id).filter(id => !valid.includes(id))
        return [...valid, ...missing]
      } catch (e) {
        // ignore
      }
    }
    return SERVICES.map(s => s.id)
  })

  const serviceOrderRef = useRef(serviceOrder)
  useEffect(() => {
    serviceOrderRef.current = serviceOrder
    localStorage.setItem('multichat:service_order', JSON.stringify(serviceOrder))
  }, [serviceOrder])

  const apiKeysActiveRef = useRef(apiKeysActive)
  useEffect(() => {
    apiKeysActiveRef.current = apiKeysActive
  }, [apiKeysActive])

  useEffect(() => {
    const checkKeys = async () => {
      const results = await Promise.all(
        SERVICES.map(s => api.apiKeyGet(s.id))
      )
      const keysActive: Partial<Record<ServiceId, boolean>> = {}
      SERVICES.forEach((s, idx) => {
        keysActive[s.id] = results[idx]
      })
      setApiKeysActive(keysActive)
    }
    checkKeys()
  }, [showSettings])

  const sendTimeRef = useRef<number>(0)

  const activePaneRef = useRef<HTMLDivElement>(null)
  const lastBoundsKey = useRef('')
  const dragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // When enabled services change, ensure activeId is still valid
  useEffect(() => {
    if (!enabledIds.has(activeId)) {
      const first = serviceOrder.find(id => enabledIds.has(id))
      if (first) setActiveId(first)
    }
  }, [enabledIds, activeId, serviceOrder])

  // Sync selected model to webview whenever activeId, selectedModels, nativeServices, apiKeysActive, or geminiThinking changes
  useEffect(() => {
    if (activeId) {
      const model = selectedModels[activeId]
      if (model && !apiKeysActive[activeId]) {
        api.setModel(activeId, model, activeId === 'gemini' ? geminiThinking : undefined)
      }
    }
  }, [activeId, selectedModels, nativeServices, apiKeysActive, geminiThinking])


  const isCard = useCallback((id: ServiceId) => {
    if (apiKeysActive[id]) return true
    return CARD_SERVICES.has(id) && !nativeServices.has(id)
  }, [nativeServices, apiKeysActive])

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
    sendTimeRef.current = Date.now()
    setResponseTimes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    const isDirect = apiKeysActive[id]

    setConversations(prev => {
      const currentMessages = prev[id] || []
      const nextMsgs = [...currentMessages, { role: 'user', text }, { role: 'assistant', text: '' }]
      
      if (isDirect) {
        const formattedMessages = nextMsgs.slice(0, -1).map(m => ({ role: m.role, content: m.text }))
        api.apiStream(id, formattedMessages, selectedModels[id], id === 'gemini' ? geminiThinking : undefined)
      }
      
      return {
        ...prev,
        [id]: nextMsgs
      }
    })

    setStatuses(prev => ({ ...prev, [id]: 'sending' }))

    if (isDirect) return

    try {
      const results = await api.broadcast(text, [id])
      setStatuses(prev => ({ ...prev, [id]: results[0]?.ok ? 'sent' : 'error' }))
    } catch {
      setStatuses(prev => ({ ...prev, [id]: 'error' }))
    }
  }, [apiKeysActive, selectedModels, geminiThinking])

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
      if (CARD_SERVICES.has(id) || apiKeysActiveRef.current[id]) {
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
      if (done) {
        setResponseTimes(prev => {
          if (prev[id]) return prev
          return { ...prev, [id]: Math.round((Date.now() - sendTimeRef.current) / 100) / 10 }
        })
        if (text.length > 0) {
          setStatuses(prev => prev[id] === 'sending' || prev[id] === 'sent' ? { ...prev, [id]: 'idle' } : prev)
        }
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
        const order = serviceOrderRef.current.filter(id => enabledIdsRef.current.has(id))
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
      if (next.has(id)) {
        if (next.size <= 1) return prev
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || isSending || enabledIds.size === 0) return
    const ids = serviceOrder.filter(id => enabledIds.has(id))
    const finalPrompt = skillContent ? `${skillContent}\n\n---\n\n${prompt.trim()}` : prompt.trim()
    setIsSending(true)

    // Save prompt to SQLite history
    api.historySave(prompt.trim())

    sendTimeRef.current = Date.now()
    setResponseTimes({})

    setLatestResponses(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[id] = '' })
      return next
    })

    setConversations(prev => {
      const next = { ...prev }
      ids.filter(id => CARD_SERVICES.has(id) || apiKeysActive[id]).forEach(id => {
        next[id] = [...prev[id], { role: 'user', text: finalPrompt }, { role: 'assistant', text: '' }]
      })
      return next
    })

    const directIds = ids.filter(id => apiKeysActive[id])
    const webviewIds = ids.filter(id => !apiKeysActive[id])

    // Trigger direct API streams in parallel immediately
    directIds.forEach(id => {
      const currentMessages = conversations[id] || []
      const formattedMessages = [
        ...currentMessages.map(m => ({ role: m.role, content: m.text })),
        { role: 'user', content: finalPrompt }
      ]
      api.apiStream(id, formattedMessages, selectedModels[id], id === 'gemini' ? geminiThinking : undefined)
    })

    // Set statuses for direct APIs to sending
    setStatuses(prev => {
      const next = { ...prev }
      directIds.forEach(id => { next[id] = 'sending' })
      return next
    })

    if (webviewIds.length > 0) {
      if (broadcastMode === 'sequential') {
        setStatuses(prev => {
          const next = { ...prev }
          webviewIds.forEach((id, idx) => {
            next[id] = idx === 0 ? 'sending' : 'waiting'
          })
          return next
        })
        try {
          const results = await api.broadcastSequential(finalPrompt, webviewIds)
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
            webviewIds.forEach(id => { next[id] = 'error' })
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
          webviewIds.forEach(id => { next[id] = 'sending' })
          return next
        })
        try {
          const results = await api.broadcast(finalPrompt, webviewIds)
          setStatuses(prev => {
            const next = { ...prev }
            results.forEach(r => { next[r.id] = r.ok ? 'sent' : 'error' })
            return next
          })
        } catch {
          setStatuses(prev => {
            const next = { ...prev }
            webviewIds.forEach(id => { next[id] = 'error' })
            return next
          })
        } finally {
          setIsSending(false)
          setPrompt('')
        }
      }
    } else {
      setIsSending(false)
      setPrompt('')
    }
  }, [prompt, isSending, enabledIds, skillContent, broadcastMode, apiKeysActive, selectedModels, conversations, geminiThinking])

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

  const enabledServices = serviceOrder.filter(id => enabledIds.has(id)).map(id => SERVICES.find(s => s.id === id)!)
  const activeService = SERVICES.find(s => s.id === activeId)
  const activeIsCard = isCard(activeId)
  const activeModels = SERVICE_MODELS[activeId]

  const handleNewChat = useCallback((id: ServiceId) => {
    setConversations(prev => ({ ...prev, [id]: [] }))
    setLatestResponses(prev => ({ ...prev, [id]: '' }))
    api.newChat(id)
  }, [])

  const handleExport = useCallback(async (id: ServiceId) => {
    const service = SERVICES.find(s => s.id === id)
    const msgs = conversations[id]
    if (!msgs.length || !service) return
    const md = `# Conversation with ${service.label}\n_${new Date().toLocaleString()}_\n\n` +
      msgs.map(m => `**${m.role === 'user' ? 'You' : service.label}:**\n\n${m.text}`).join('\n\n---\n\n')
    await api.exportConversation(service.label, md)
  }, [conversations])

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return

      // Ctrl+1-6: switch to service N
      const num = parseInt(e.key)
      if (num >= 1 && num <= 6) {
        const service = SERVICES[num - 1]
        if (service && enabledIds.has(service.id)) {
          setActiveId(service.id)
          setShowSettings(false)
          e.preventDefault()
        }
        return
      }

      // Ctrl+N: new chat
      if (e.key === 'n' && !e.shiftKey) {
        handleNewChat(activeId)
        e.preventDefault()
        return
      }

      // Ctrl+L: focus prompt textarea
      if (e.key === 'l') {
        document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Ask"]')?.focus()
        e.preventDefault()
        return
      }

      // Ctrl+Shift+D: devtools
      if (e.key === 'D' && e.shiftKey) {
        api.openDevTools(activeId)
        e.preventDefault()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeId, enabledIds, handleNewChat])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0E0E11', overflow: 'hidden' }}>
      <TitleBar />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
        <SkillsSidebar
          selectedSkill={selectedSkill}
          onSelect={handleSkillSelect}
          onModalToggle={setModalOpen}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings(v => !v)}
        />

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
              serviceOrder={serviceOrder}
              onUpdateServiceOrder={setServiceOrder}
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
            responseTimes={responseTimes}
            onSelect={id => { setActiveId(id); setShowSettings(false) }}
            onLogin={id => api.cdpLogin(id)}
            onDevTools={id => api.openDevTools(id)}
            onNewChat={handleNewChat}
            onExport={handleExport}
            canExport={isCard(activeId) && conversations[activeId]?.length > 0}
            isCard={isCard(activeId)}
            isApiKeyActive={!!apiKeysActive[activeId]}
            onToggleViewMode={handleToggleNative}
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

              {activeId === 'gemini' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                  <span style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Thinking</span>
                  <div style={{ display: 'flex', background: '#111', border: '1px solid #222', borderRadius: 5, padding: 2 }}>
                    {(['standard', 'extended'] as const).map(mode => {
                      const active = geminiThinking === mode
                      return (
                        <button
                          key={mode}
                          onClick={() => setGeminiThinking(mode)}
                          style={{
                            fontSize: 9,
                            padding: '2px 8px',
                            borderRadius: 4,
                            border: 'none',
                            background: active ? activeService?.color + '22' : 'transparent',
                            color: active ? activeService?.color : '#555',
                            fontWeight: active ? 600 : 400,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s',
                          }}
                        >
                          {mode.toUpperCase()}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
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
                onClose={() => setShowSettings(false)}
                onApiKeyChange={(id, hasKey) => {
                  setApiKeysActive(prev => ({ ...prev, [id]: hasKey }))
                }}
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

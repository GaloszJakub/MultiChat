import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { TitleBar } from './components/TitleBar'
import { PromptComposer } from './components/PromptComposer'
import { SkillsSidebar } from './components/SkillsSidebar'
import { ResponseCard } from './components/ResponseCard'
import { TabBar } from './components/TabBar'
import { SettingsPanel } from './components/SettingsPanel'
import { SERVICES, SERVICE_MODELS } from './lib/services'
import { resolveTemplate as resolveTemplateUtil } from './lib/chain'
import { ModelPicker } from './components/ModelPicker'
import { api } from './lib/ipc'
import type { ServiceId } from '../../main/services/types'
import type { Status } from './components/StatusBadge'
import { PipelineStudioModal, PipelineStep } from './components/PipelineStudioModal'
import { PipelineControlPanel, PipelineState } from './components/PipelineControlPanel'

export type Message = { role: 'user' | 'assistant'; text: string }

const DEFAULT_CHAIN: PipelineStep[] = [
  { serviceId: 'chatgpt', promptTemplate: '{{input}}' },
  { serviceId: 'gemini', promptTemplate: 'Original question:\n"{{input}}"\n\nPrevious response:\n{{previous}}\n---\nReview and provide your own response, highlighting any corrections or additions.' },
  { serviceId: 'claude', promptTemplate: 'Original question:\n"{{input}}"\n\nPrevious responses:\n{{all_previous}}\n---\nSynthesize the above responses and provide a final definitive answer.' },
]

const INITIAL_PIPELINE_STATE: PipelineState = {
  isActive: false,
  steps: [],
  currentStepIndex: 0,
  originalPrompt: '',
  responses: { chatgpt: '', claude: '', gemini: '', grok: '', kimi: '', deepseek: '' },
  isPaused: false,
  editedPrompt: '',
}

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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
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
  const [showSettings, setShowSettings] = useState(false)
  const [nativeServices, setNativeServices] = useState<Set<ServiceId>>(() => new Set(SERVICES.map(s => s.id)))
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

  const [pipelineState, setPipelineState] = useState<PipelineState>(INITIAL_PIPELINE_STATE)
  const [activeChain, setActiveChain] = useState<PipelineStep[]>(() => {
    const saved = localStorage.getItem('multichat:active_chain')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // ignore
      }
    }
    return DEFAULT_CHAIN
  })

  const [isPipelineStudioOpen, setIsPipelineStudioOpen] = useState<boolean>(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    const saved = localStorage.getItem('multichat:active_chain_preset_id')
    if (saved) {
      return saved
    }
    return 'standard'
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

  const activeConversationIdRef = useRef<string | null>(null)
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  const conversationsRef = useRef(conversations)
  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const enabledIdsRef = useRef(enabledIds)
  useEffect(() => {
    enabledIdsRef.current = enabledIds
  }, [enabledIds])

  const activeIdRef = useRef(activeId)
  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const selectedModelsRef = useRef(selectedModels)
  useEffect(() => {
    selectedModelsRef.current = selectedModels
  }, [selectedModels])

  const broadcastModeRef = useRef(broadcastMode)
  useEffect(() => {
    broadcastModeRef.current = broadcastMode
  }, [broadcastMode])

  const pendingWebviewUrlsRef = useRef<Record<string, string>>({})

  // Deferred loading of pending webview URLs when a tab becomes active/visible
  useEffect(() => {
    if (activeId) {
      const pendingUrl = pendingWebviewUrlsRef.current[activeId]
      if (pendingUrl) {
        api.viewsLoadUrl(activeId, pendingUrl)
        delete pendingWebviewUrlsRef.current[activeId]
      }
    }
  }, [activeId])

  const saveCurrentConversation = useCallback(async (convId: string, customConversations?: Record<ServiceId, Message[]>) => {
    const currentConvs = customConversations || conversationsRef.current
    
    // Find first user message for title
    let title = 'New Conversation'
    for (const serviceId of Object.keys(currentConvs)) {
      const msgs = currentConvs[serviceId]
      const userMsg = msgs.find(m => m.role === 'user')
      if (userMsg && userMsg.text.trim()) {
        title = userMsg.text.trim().substring(0, 50)
        break
      }
    }

    const sqlMessages: any[] = []
    Object.entries(currentConvs).forEach(([serviceId, msgs]) => {
      msgs.forEach(m => {
        sqlMessages.push({
          service_id: serviceId,
          role: m.role,
          text: m.text,
          created_at: Date.now()
        })
      })
    })

    // Capture the current webview URLs
    let webviewUrls: Record<string, string> = {}
    try {
      webviewUrls = await api.viewsGetUrls()
    } catch (e) {
      console.error('Error fetching webview URLs during save:', e)
    }

    const metadata = JSON.stringify({
      enabledIds: Array.from(enabledIdsRef.current),
      activeId: activeIdRef.current,
      selectedModels: selectedModelsRef.current,
      broadcastMode: broadcastModeRef.current,
      webviewUrls
    })

    await api.conversationSave(convId, title, metadata, sqlMessages)
    // Dispatch custom event to tell the sidebar to refresh its list
    window.dispatchEvent(new CustomEvent('multichat:conversations-updated'))
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    const conv = await api.conversationGet(id)
    if (!conv) return

    setActiveConversationId(id)
    activeConversationIdRef.current = id
    
    let meta: any = {}
    try {
      meta = JSON.parse(conv.metadata)
      if (meta.enabledIds) setEnabledIds(new Set(meta.enabledIds))
      if (meta.activeId) setActiveId(meta.activeId)
      if (meta.selectedModels) setSelectedModels(meta.selectedModels)
      if (meta.broadcastMode) setBroadcastMode(meta.broadcastMode)
    } catch (e) {
      console.error('Error parsing conversation metadata:', e)
    }

    // Restore webview URLs if they exist (deferred loading to prevent background throttling issues)
    if (meta.webviewUrls) {
      pendingWebviewUrlsRef.current = { ...meta.webviewUrls }
      const currentActiveId = meta.activeId || activeIdRef.current || activeId
      const activeUrl = meta.webviewUrls[currentActiveId]
      if (activeUrl) {
        api.viewsLoadUrl(currentActiveId, activeUrl)
        delete pendingWebviewUrlsRef.current[currentActiveId]
      }
    }

    const nextConversations = emptyConversations()
    conv.messages.forEach((m: any) => {
      const serviceId = m.service_id as ServiceId
      if (nextConversations[serviceId]) {
        nextConversations[serviceId].push({
          role: m.role as 'user' | 'assistant',
          text: m.text
        })
      }
    })

    setConversations(nextConversations)

    const latest: Record<ServiceId, string> = {
      chatgpt: '', claude: '', gemini: '', grok: '', kimi: '', deepseek: '',
    }
    Object.entries(nextConversations).forEach(([serviceId, msgs]) => {
      const assistantMsgs = msgs.filter(m => m.role === 'assistant')
      if (assistantMsgs.length > 0) {
        latest[serviceId as ServiceId] = assistantMsgs[assistantMsgs.length - 1].text
      }
    })
    setLatestResponses(latest)
    setStatuses(INITIAL_STATUSES)
    setResponseTimes({})
  }, [])

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
    if (showSettings || isCard(activeId) || modalOpen || isPipelineStudioOpen) {
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
  }, [activeId, isCard, showSettings, modalOpen, isPipelineStudioOpen])

  useLayoutEffect(() => { reportBounds() })

  useEffect(() => {
    const ro = new ResizeObserver(reportBounds)
    if (activePaneRef.current) ro.observe(activePaneRef.current)
    window.addEventListener('resize', reportBounds)
    return () => { ro.disconnect(); window.removeEventListener('resize', reportBounds) }
  }, [reportBounds])

  const resolveTemplate = useCallback((
    template: string,
    originalInput: string,
    responses: Record<ServiceId, string>,
    previousResponse: string
  ): string => {
    return resolveTemplateUtil(template, originalInput, responses, previousResponse)
  }, [])

  const runPipelineStep = useCallback(async (stepIndex: number, promptText: string) => {
    const step = activeChain[stepIndex]
    if (!step) return
    const id = step.serviceId

    setPipelineState(prev => ({
      ...prev,
      currentStepIndex: stepIndex,
      isPaused: false,
      editedPrompt: promptText
    }))

    setStatuses(prev => {
      const next = { ...prev }
      activeChain.forEach((s, idx) => {
        if (idx === stepIndex) {
          next[s.serviceId] = 'sending'
        } else if (idx > stepIndex) {
          next[s.serviceId] = 'waiting'
        }
      })
      return next
    })

    setIsSending(true)
    sendTimeRef.current = Date.now()
    setResponseTimes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    // Append user message to React conversation state (so it displays properly in card mode)
    const isDirect = apiKeysActive[id]
    setConversations(prev => {
      const currentMessages = prev[id] || []
      const nextMsgs = [...currentMessages, { role: 'user', text: promptText }, { role: 'assistant', text: '' }]

      if (isDirect) {
        const formattedMessages = nextMsgs.slice(0, -1).map(m => ({ role: m.role, content: m.text }))
        api.apiStream(id, formattedMessages, selectedModels[id], id === 'gemini' ? geminiThinking : undefined)
      }

      return {
        ...prev,
        [id]: nextMsgs
      }
    })

    if (isDirect) return

    try {
      await api.broadcast(promptText, [id])
    } catch (e) {
      setStatuses(prev => ({ ...prev, [id]: 'error' }))
    }
  }, [activeChain, apiKeysActive, selectedModels, geminiThinking])

  const startPipeline = useCallback(async (originalPrompt: string) => {
    if (activeChain.length === 0) return

    const firstStep = activeChain[0]
    const initialResponses: Record<ServiceId, string> = {
      chatgpt: '', claude: '', gemini: '', grok: '', kimi: '', deepseek: ''
    }

    setStatuses(prev => {
      const next = { ...prev }
      activeChain.forEach((s, idx) => {
        next[s.serviceId] = idx === 0 ? 'sending' : 'waiting'
      })
      return next
    })

    const resolvedPrompt = resolveTemplate(firstStep.promptTemplate, originalPrompt, initialResponses, '')

    const newState: PipelineState = {
      isActive: true,
      steps: activeChain,
      currentStepIndex: 0,
      originalPrompt,
      responses: initialResponses,
      isPaused: false,
      editedPrompt: resolvedPrompt,
    }

    setPipelineState(newState)
    await runPipelineStep(0, resolvedPrompt)
  }, [activeChain, resolveTemplate, runPipelineStep])

  const handleCancelPipeline = useCallback(() => {
    setPipelineState(INITIAL_PIPELINE_STATE)
    setIsSending(false)
    setStatuses(prev => {
      const next = { ...prev }
      SERVICES.forEach(s => {
        if (next[s.id] === 'sending' || next[s.id] === 'waiting') {
          next[s.id] = 'idle'
        }
      })
      return next
    })
  }, [])

  // Refs for stale closures prevention
  const pipelineStateRef = useRef(pipelineState)
  useEffect(() => {
    pipelineStateRef.current = pipelineState
  }, [pipelineState])

  const resolveTemplateRef = useRef(resolveTemplate)
  useEffect(() => {
    resolveTemplateRef.current = resolveTemplate
  }, [resolveTemplate])

  const runPipelineStepRef = useRef(runPipelineStep)
  useEffect(() => {
    runPipelineStepRef.current = runPipelineStep
  }, [runPipelineStep])

  const handleCardSend = useCallback(async (id: ServiceId, text: string) => {
    sendTimeRef.current = Date.now()
    setResponseTimes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    const isDirect = apiKeysActive[id]

    let convId = activeConversationIdRef.current
    if (!convId) {
      convId = 'conv_' + Date.now()
      setActiveConversationId(convId)
      activeConversationIdRef.current = convId
    }

    const nextConversations = { ...conversationsRef.current }
    const currentMessages = conversationsRef.current[id] || []
    const nextMsgs = [...currentMessages, { role: 'user', text }, { role: 'assistant', text: '' }]
    nextConversations[id] = nextMsgs
    setConversations(nextConversations)

    pendingWebviewUrlsRef.current = {}
    saveCurrentConversation(convId, nextConversations)

    if (isDirect) {
      const formattedMessages = nextMsgs.slice(0, -1).map(m => ({ role: m.role, content: m.text }))
      api.apiStream(id, formattedMessages, selectedModels[id], id === 'gemini' ? geminiThinking : undefined)
    }

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

        const currentConvId = activeConversationIdRef.current
        if (currentConvId) {
          setTimeout(() => {
            if (activeConversationIdRef.current === currentConvId) {
              saveCurrentConversation(currentConvId)
            }
          }, 100)
        }

        // Pipeline progression
        const pipe = pipelineStateRef.current
        if (pipe.isActive) {
          const currentStep = pipe.steps[pipe.currentStepIndex]
          if (currentStep && currentStep.serviceId === id) {
            const updatedResponses = { ...pipe.responses, [id]: text }

            const nextIdx = pipe.currentStepIndex + 1
            if (nextIdx >= pipe.steps.length) {
              setPipelineState(prev => ({
                ...prev,
                responses: updatedResponses,
                isActive: false
              }))
              setIsSending(false)
            } else {
              const nextStep = pipe.steps[nextIdx]
              const nextResolved = resolveTemplateRef.current(nextStep.promptTemplate, pipe.originalPrompt, updatedResponses, text)

              setPipelineState(prev => ({
                ...prev,
                responses: updatedResponses,
                currentStepIndex: nextIdx,
                isPaused: false,
                editedPrompt: nextResolved
              }))

              setStatuses(prev => {
                const next = { ...prev }
                next[id] = 'idle'
                next[nextStep.serviceId] = 'sending'
                return next
              })

              setActiveId(nextStep.serviceId)
              setShowSettings(false)

              setTimeout(() => {
                runPipelineStepRef.current(nextIdx, nextResolved)
              }, 1200)
            }
          }
        }
      }
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
    // Save prompt to SQLite history
    api.historySave(prompt.trim())

    let convId = activeConversationIdRef.current
    if (!convId) {
      convId = 'conv_' + Date.now()
      setActiveConversationId(convId)
      activeConversationIdRef.current = convId
    }

    if (broadcastMode === 'sequential') {
      startPipeline(finalPrompt)
      setPrompt('')
      return
    }

    setIsSending(true)

    sendTimeRef.current = Date.now()
    setResponseTimes({})

    setLatestResponses(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[id] = '' })
      return next
    })

    const nextConversations = { ...conversationsRef.current }
    ids.filter(id => CARD_SERVICES.has(id) || apiKeysActive[id]).forEach(id => {
      nextConversations[id] = [...(conversationsRef.current[id] || []), { role: 'user', text: finalPrompt }, { role: 'assistant', text: '' }]
    })
    setConversations(nextConversations)

    pendingWebviewUrlsRef.current = {}
    saveCurrentConversation(convId, nextConversations)

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
    setActiveConversationId(null)
    setConversations(emptyConversations())
    setLatestResponses({
      chatgpt: '', claude: '', gemini: '', grok: '', kimi: '', deepseek: '',
    })
    setResponseTimes({})
    setStatuses(INITIAL_STATUSES)
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
      <TitleBar selectedSkill={selectedSkill} />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
        <SkillsSidebar
          selectedSkill={selectedSkill}
          onSelect={handleSkillSelect}
          onModalToggle={setModalOpen}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings(v => !v)}
          activeConversationId={activeConversationId}
          onSelectConversation={loadConversation}
        />

        <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Composer */}
          <div style={{ flexShrink: 0, overflow: 'hidden' }}>
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
              onOpenPipelineStudio={() => setIsPipelineStudioOpen(true)}
            />
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

          {/* Pipeline Control Panel */}
          {pipelineState.isActive && (
            <PipelineControlPanel
              state={pipelineState}
              onStopPipeline={handleCancelPipeline}
            />
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
      <PipelineStudioModal
        isOpen={isPipelineStudioOpen}
        onClose={() => setIsPipelineStudioOpen(false)}
        steps={activeChain}
        selectedPresetId={selectedPresetId}
        onSave={(newSteps, presetId) => {
          setActiveChain(newSteps)
          setSelectedPresetId(presetId)
          localStorage.setItem('multichat:active_chain', JSON.stringify(newSteps))
          localStorage.setItem('multichat:active_chain_preset_id', presetId)
        }}
      />
    </div>
  )
}

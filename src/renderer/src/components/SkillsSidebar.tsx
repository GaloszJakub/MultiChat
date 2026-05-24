import React, { useEffect, useState, useRef } from 'react'
import { api } from '../lib/ipc'
import { SERVICES } from '../lib/services'
import { ServiceLogo } from './ServiceLogo'

interface Skill {
  name: string
  file: string
}

interface Props {
  selectedSkill: Skill | null
  onSelect: (skill: Skill | null) => void
  onModalToggle?: (open: boolean) => void
  showSettings?: boolean
  onToggleSettings?: () => void
  activeConversationId?: string | null
  onSelectConversation?: (id: string) => void
}

export function SkillsSidebar({ selectedSkill, onSelect, onModalToggle, showSettings, onToggleSettings, activeConversationId, onSelectConversation }: Props) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [hoveredFile, setHoveredFile] = useState<string | null>(null)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'skills' | 'history'>('skills')

  // History states
  const [conversations, setConversations] = useState<{ id: string; title: string; created_at: number; updated_at: number; metadata: string }[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredConv, setHoveredConv] = useState<string | null>(null)
  const [convDeleteConfirmOpen, setConvDeleteConfirmOpen] = useState(false)
  const [convToDelete, setConvToDelete] = useState<{ id: string; title: string } | null>(null)

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [skillName, setSkillName] = useState('')
  const [skillContent, setSkillContent] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Delete confirm states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [skillToDelete, setSkillToDelete] = useState<Skill | null>(null)

  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(modalOpen || deleteConfirmOpen || convDeleteConfirmOpen)
    }
  }, [modalOpen, deleteConfirmOpen, convDeleteConfirmOpen, onModalToggle])

  const reload = () => api.skillsList().then(setSkills)
  const reloadConversations = () => api.conversationList(50).then(setConversations)

  useEffect(() => {
    reload()
    reloadConversations()
  }, [])

  useEffect(() => {
    const handler = () => {
      reloadConversations()
    }
    window.addEventListener('multichat:conversations-updated', handler)
    return () => window.removeEventListener('multichat:conversations-updated', handler)
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      reloadConversations()
    }
  }, [activeTab])

  const handleSelect = async (skill: Skill) => {
    if (selectedSkill?.file === skill.file) {
      onSelect(null)
      return
    }
    onSelect(skill)
  }

  const openCreateModal = () => {
    setModalMode('create')
    setEditingSkill(null)
    setSkillName('')
    setSkillContent('')
    setModalOpen(true)
  }

  const openEditModal = async (skill: Skill) => {
    setModalMode('edit')
    setEditingSkill(skill)
    setSkillName(skill.name)
    const content = await api.skillsRead(skill.file)
    setSkillContent(content)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!skillName.trim() || !skillContent.trim() || saving) return
    setSaving(true)
    try {
      if (modalMode === 'edit' && editingSkill) {
        const safeOldName = editingSkill.name.trim().replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()
        const safeNewName = skillName.trim().replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()
        
        if (safeOldName !== safeNewName) {
          await api.skillsDelete(editingSkill.file)
        }
        
        await api.skillsCreate(skillName.trim(), skillContent.trim())
        
        if (selectedSkill?.file === editingSkill.file) {
          const newFile = `${safeNewName}.md`
          onSelect({ name: skillName.trim(), file: newFile })
        }
      } else {
        await api.skillsCreate(skillName.trim(), skillContent.trim())
      }
      
      await reload()
      setModalOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = (skill: Skill) => {
    setSkillToDelete(skill)
    setDeleteConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!skillToDelete) return
    try {
      await api.skillsDelete(skillToDelete.file)
      if (selectedSkill?.file === skillToDelete.file) {
        onSelect(null)
      }
      await reload()
      setDeleteConfirmOpen(false)
      setSkillToDelete(null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setModalOpen(false)
      setDeleteConfirmOpen(false)
      setConvDeleteConfirmOpen(false)
    }
  }

  const confirmConvDelete = (conv: { id: string; title: string }) => {
    setConvToDelete(conv)
    setConvDeleteConfirmOpen(true)
  }

  const handleConvDelete = async () => {
    if (!convToDelete) return
    try {
      await api.conversationDelete(convToDelete.id)
      await reloadConversations()
      setConvDeleteConfirmOpen(false)
      setConvToDelete(null)
    } catch (e) {
      console.error(e)
    }
  }

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const filteredConversations = conversations.filter(conv => {
    return conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--hairline)',
        background: 'var(--bg-2)',
        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.015), transparent)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Segment Tabs */}
      <div style={{
        display: 'flex',
        padding: '6px 8px',
        borderBottom: '1px solid var(--hairline)',
        background: 'rgba(0,0,0,0.15)',
        gap: 4,
        flexShrink: 0
      }}>
        {(['skills', 'history'] as const).map(tab => {
          const active = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '6px 8px',
                border: 'none',
                borderRadius: 6,
                background: active ? 'var(--surface-3)' : 'transparent',
                color: active ? '#fff' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {tab === 'skills' ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span>Skills</span>
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>History</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'skills' ? (
        <>
          {/* Header */}
          <div style={{
            padding: '10px 16px 8px',
            borderBottom: '1px solid var(--hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              userSelect: 'none'
            }}>
              Skills
            </span>
            <button
              onClick={() => api.skillsOpenDir()}
              title="Open skills folder"
              style={{
                fontSize: 10.5,
                color: 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface-3)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Folder
            </button>
          </div>

          {/* Skill list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {skills.length === 0 && (
              <div style={{ padding: '16px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, userSelect: 'none' }}>
                No skills yet.<br />Click the button below to create one.
              </div>
            )}
            {skills.map(skill => {
              const active = selectedSkill?.file === skill.file
              return (
                <div
                  key={skill.file}
                  onMouseEnter={() => setHoveredFile(skill.file)}
                  onMouseLeave={() => setHoveredFile(null)}
                  onClick={() => handleSelect(skill)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 12px 8px 14px',
                    background: active 
                      ? 'linear-gradient(90deg, rgba(77, 107, 254, 0.1), rgba(77, 107, 254, 0.01))' 
                      : hoveredFile === skill.file 
                        ? 'rgba(255, 255, 255, 0.03)' 
                        : 'transparent',
                    borderLeft: '2px solid transparent',
                    borderLeftColor: active ? '#4D6BFE' : 'transparent',
                    boxShadow: active ? '0 0 10px rgba(77, 107, 254, 0.05) inset' : undefined,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span
                    style={{
                      color: active ? '#a0b0ff' : hoveredFile === skill.file ? 'var(--text)' : 'var(--text-soft)',
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 500,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      transition: 'color 0.15s',
                      userSelect: 'none',
                    }}
                  >
                    {skill.name}
                  </span>
                  
                  {/* Action buttons (Edit/Delete) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      opacity: (hoveredFile === skill.file || active) ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditModal(skill)
                      }}
                      title="Edit skill"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 4,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'var(--surface-3)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        confirmDelete(skill)
                      }}
                      title="Delete skill"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: 'rgba(239, 68, 68, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 4,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <>
          {/* Search History */}
          <div style={{ padding: '8px 12px 6px', flexShrink: 0 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 24px 5px 8px',
                  background: '#080808',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', right: 8, color: 'var(--text-muted)' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          </div>

          {/* History List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
            {filteredConversations.length === 0 && (
              <div style={{ padding: '16px 12px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, userSelect: 'none', textAlign: 'center' }}>
                {searchQuery ? 'No matching sessions' : 'No history yet'}
              </div>
            )}
            {filteredConversations.map(conv => {
              const active = activeConversationId === conv.id
              let enabledServiceIds: string[] = []
              try {
                const meta = JSON.parse(conv.metadata)
                enabledServiceIds = meta.enabledIds || []
              } catch {}

              return (
                <div
                  key={conv.id}
                  onMouseEnter={() => setHoveredConv(conv.id)}
                  onMouseLeave={() => setHoveredConv(null)}
                  onClick={() => onSelectConversation?.(conv.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px 12px',
                    background: active 
                      ? 'linear-gradient(90deg, rgba(77, 107, 254, 0.1), rgba(77, 107, 254, 0.01))' 
                      : hoveredConv === conv.id 
                        ? 'rgba(255, 255, 255, 0.03)' 
                        : 'transparent',
                    borderLeft: '2px solid transparent',
                    borderLeftColor: active ? '#4D6BFE' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    borderBottom: '1px solid rgba(255,255,255,0.01)',
                  }}
                >
                  {/* Title */}
                  <span
                    style={{
                      color: active ? '#a0b0ff' : hoveredConv === conv.id ? 'var(--text)' : 'var(--text-soft)',
                      fontSize: 12,
                      fontWeight: active ? 600 : 500,
                      width: '85%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.25,
                      marginBottom: 5,
                    }}
                  >
                    {conv.title}
                  </span>

                  {/* Subtitle (icons and relative time) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    {/* Bot icons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {enabledServiceIds.map((id: string) => {
                        const service = SERVICES.find(s => s.id === id)
                        if (!service) return null
                        return (
                          <div
                            key={id}
                            title={service.label}
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              background: active ? service.color + '30' : 'rgba(255,255,255,0.05)',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <ServiceLogo id={id as any} size={7} color={service.color} />
                          </div>
                        )
                      })}
                    </div>

                    {/* Time */}
                    <span style={{ fontSize: 9.5, color: 'var(--text-dim)', userSelect: 'none' }}>
                      {formatTime(conv.updated_at || conv.created_at)}
                    </span>
                  </div>

                  {/* Hover trash button */}
                  {(hoveredConv === conv.id) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        confirmConvDelete({ id: conv.id, title: conv.title })
                      }}
                      title="Delete chat session"
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 5,
                        color: 'rgba(239, 68, 68, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 4,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239, 68, 68, 0.7)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Bottom buttons */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--hairline)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {activeTab === 'skills' ? (
          <button
            onClick={openCreateModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              padding: '8px 0',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--text-soft)',
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.borderColor = '#4D6BFE'
              e.currentTarget.style.background = 'rgba(77, 107, 254, 0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-soft)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
              <line x1="6" y1="2" x2="6" y2="10"/><line x1="2" y1="6" x2="10" y2="6"/>
            </svg>
            New Skill
          </button>
        ) : (
          <button
            onClick={async () => {
              if (conversations.length === 0) return
              if (window.confirm('Wyczyścić całą historię czatów? Tej operacji nie można cofnąć.')) {
                await api.conversationClearAll()
                reloadConversations()
              }
            }}
            disabled={conversations.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              padding: '8px 0',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: conversations.length === 0 ? 'not-allowed' : 'pointer',
              color: conversations.length === 0 ? 'var(--text-dim)' : 'rgba(239, 68, 68, 0.8)',
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.15s ease',
              opacity: conversations.length === 0 ? 0.5 : 1,
            }}
            onMouseEnter={e => {
              if (conversations.length === 0) return
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.borderColor = '#ef4444'
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'
            }}
            onMouseLeave={e => {
              if (conversations.length === 0) return
              e.currentTarget.style.color = 'rgba(239, 68, 68, 0.8)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'var(--surface)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Clear History
          </button>
        )}
        <button
          onClick={onToggleSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            padding: '8px 0',
            background: showSettings ? 'rgba(255,255,255,0.04)' : 'transparent',
            border: showSettings ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
            borderRadius: 8,
            cursor: 'pointer',
            color: showSettings ? 'var(--text)' : 'var(--text-muted)',
            fontSize: 11.5,
            fontWeight: 600,
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--text)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = showSettings ? 'var(--text)' : 'var(--text-muted)'
            e.currentTarget.style.background = showSettings ? 'rgba(255,255,255,0.04)' : 'transparent'
            e.currentTarget.style.borderColor = showSettings ? 'rgba(255,255,255,0.1)' : 'transparent'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="2.5"/>
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/>
          </svg>
          Settings
        </button>
      </div>

      {/* Skill Form Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: 460,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02) inset',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                {modalMode === 'edit' ? 'Edit Skill' : 'Create New Skill'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#666'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Skill Title
              </label>
              <input
                value={skillName}
                onChange={e => setSkillName(e.target.value)}
                placeholder="e.g. Code Expert, Shorten..."
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: 'var(--text)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#4D6BFE'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(77, 107, 254, 0.15)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Prompt Content
              </label>
              <textarea
                value={skillContent}
                onChange={e => setSkillContent(e.target.value)}
                placeholder="Instructions for the AI..."
                rows={8}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: 'var(--text)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'none',
                  lineHeight: 1.5,
                  transition: 'all 0.15s ease',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#4D6BFE'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(77, 107, 254, 0.15)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!skillName.trim() || !skillContent.trim() || saving}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: (!skillName.trim() || !skillContent.trim() || saving) ? 'var(--surface-3)' : 'linear-gradient(180deg, #4D6BFE, #3b50df)',
                  color: (!skillName.trim() || !skillContent.trim() || saving) ? 'var(--text-dim)' : '#fff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: (!skillName.trim() || !skillContent.trim() || saving) ? 'not-allowed' : 'pointer',
                  boxShadow: (!skillName.trim() || !skillContent.trim() || saving) ? undefined : '0 4px 12px rgba(77, 107, 254, 0.2)',
                  transition: 'all 0.15s',
                }}
              >
                {saving ? 'Saving...' : modalMode === 'edit' ? 'Save Changes' : 'Create Skill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: 360,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02) inset',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              textAlign: 'center',
            }}
          >
            <div style={{ color: '#ef4444', display: 'flex', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                Delete Skill
              </h3>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong style={{ color: '#fff' }}>{skillToDelete?.name}</strong>? This action cannot be undone.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(180deg, #ef4444, #dc2626)',
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
                  transition: 'all 0.15s',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Conversation Confirmation Modal */}
      {convDeleteConfirmOpen && convToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: 360,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02) inset',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              textAlign: 'center',
            }}
          >
            <div style={{ color: '#ef4444', display: 'flex', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                Delete Chat Session
              </h3>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Are you sure you want to delete <strong style={{ color: '#fff' }}>{convToDelete.title}</strong>? This action cannot be undone.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setConvDeleteConfirmOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConvDelete}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(180deg, #ef4444, #dc2626)',
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
                  transition: 'all 0.15s',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



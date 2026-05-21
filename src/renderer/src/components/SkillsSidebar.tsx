import React, { useEffect, useState, useRef } from 'react'
import { api } from '../lib/ipc'

interface Skill {
  name: string
  file: string
}

interface Props {
  selectedSkill: Skill | null
  onSelect: (skill: Skill | null) => void
}

export function SkillsSidebar({ selectedSkill, onSelect }: Props) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [preview, setPreview] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const reload = () => api.skillsList().then(setSkills)

  useEffect(() => { reload() }, [])

  useEffect(() => {
    if (creating) setTimeout(() => nameRef.current?.focus(), 50)
  }, [creating])

  const handleSelect = async (skill: Skill) => {
    if (selectedSkill?.file === skill.file) {
      onSelect(null)
      setPreview('')
      return
    }
    const content = await api.skillsRead(skill.file)
    setPreview(content)
    onSelect(skill)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim() || saving) return
    setSaving(true)
    try {
      await api.skillsCreate(newName.trim(), newContent.trim())
      await reload()
      setCreating(false)
      setNewName('')
      setNewContent('')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setCreating(false); setNewName(''); setNewContent('') }
  }

  return (
    <div style={{
      width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid #1a1a1a', background: '#0a0a0a', overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px 8px', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Skills</span>
        <button
          onClick={() => api.skillsOpenDir()}
          title="Open skills folder"
          style={{ fontSize: 10, color: '#444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
        >↗ folder</button>
      </div>

      {/* Skill list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {skills.length === 0 && !creating && (
          <div style={{ padding: '12px', fontSize: 11, color: '#444', lineHeight: 1.5 }}>
            No skills yet.<br />Click + to create one.
          </div>
        )}
        {skills.map(skill => {
          const active = selectedSkill?.file === skill.file
          return (
            <button
              key={skill.file}
              onClick={() => handleSelect(skill)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 12px',
                background: active ? '#1a1a2e' : 'transparent',
                border: 'none', borderLeft: `2px solid ${active ? '#4D6BFE' : 'transparent'}`,
                color: active ? '#a0b0ff' : '#666',
                fontSize: 12, cursor: 'pointer',
                fontWeight: active ? 600 : 400,
                transition: 'all 0.1s',
              }}
            >
              {skill.name}
            </button>
          )
        })}
      </div>

      {/* Preview */}
      {preview && !creating && (
        <div style={{
          borderTop: '1px solid #1a1a1a', padding: '10px 12px',
          fontSize: 10.5, color: '#555', lineHeight: 1.55,
          maxHeight: 140, overflowY: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', flexShrink: 0,
        }}>
          {preview.slice(0, 300)}{preview.length > 300 ? '…' : ''}
        </div>
      )}

      {/* Active indicator */}
      {selectedSkill && !creating && (
        <div style={{
          borderTop: '1px solid #1a2040', padding: '8px 12px',
          background: '#0d0d20', fontSize: 10, color: '#4D6BFE', flexShrink: 0,
        }}>
          ✦ Active: {selectedSkill.name}
        </div>
      )}

      {/* Create button */}
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '10px 12px', borderTop: '1px solid #1a1a1a',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#444', fontSize: 11, fontFamily: 'inherit', flexShrink: 0,
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#777' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#444' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none">
            <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
          </svg>
          New skill
        </button>
      )}

      {/* Create form overlay */}
      {creating && (
        <div
          onKeyDown={handleKeyDown}
          style={{
            position: 'absolute', inset: 0,
            background: '#0a0a0a', display: 'flex', flexDirection: 'column',
            padding: 12, gap: 8, zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Skill</span>
            <button
              onClick={() => { setCreating(false); setNewName(''); setNewContent('') }}
              style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
            >×</button>
          </div>

          <input
            ref={nameRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Title…"
            style={{
              background: '#111', border: '1px solid #252525', borderRadius: 6,
              padding: '6px 8px', color: '#ccc', fontSize: 12,
              fontFamily: 'inherit', outline: 'none', flexShrink: 0,
            }}
          />

          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Prompt content…"
            rows={6}
            style={{
              flex: 1, background: '#111', border: '1px solid #252525', borderRadius: 6,
              padding: '6px 8px', color: '#ccc', fontSize: 12,
              fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5,
            }}
          />

          <button
            onClick={handleCreate}
            disabled={!newName.trim() || !newContent.trim() || saving}
            style={{
              padding: '7px 0', borderRadius: 6, border: 'none',
              background: newName.trim() && newContent.trim() ? '#4D6BFE' : '#1a1a1a',
              color: newName.trim() && newContent.trim() ? '#fff' : '#444',
              fontSize: 12, fontWeight: 600, cursor: newName.trim() && newContent.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', transition: 'background 0.15s', flexShrink: 0,
            }}
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      )}
    </div>
  )
}

import React from 'react'
import { SERVICES } from '../lib/services'
import { ServiceLogo } from './ServiceLogo'
import type { ServiceId } from '../../../main/services/types'

const CARD_CAPABLE = new Set<ServiceId>(['claude', 'gemini', 'chatgpt', 'grok', 'kimi', 'deepseek'])
const API_SUPPORTED = new Set<ServiceId>(['claude', 'chatgpt', 'gemini', 'grok', 'kimi', 'deepseek'])

interface Props {
  nativeServices: Set<ServiceId>
  onToggleNative: (id: ServiceId) => void
  onClose?: () => void
  onApiKeyChange?: (id: ServiceId, hasKey: boolean) => void
}

export function SettingsPanel({ nativeServices, onToggleNative, onClose, onApiKeyChange }: Props) {
  const [hasKeys, setHasKeys] = React.useState<Record<string, boolean>>({})
  const [apiToggled, setApiToggled] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    SERVICES.forEach(s => {
      // @ts-ignore
      window.api.apiKeyGet(s.id).then(has => {
        setHasKeys(prev => ({ ...prev, [s.id]: has }))
        setApiToggled(prev => ({ ...prev, [s.id]: has }))
      })
    })
  }, [])

  const handleToggleApi = async (id: ServiceId, checked: boolean) => {
    setApiToggled(prev => ({ ...prev, [id]: checked }))
    if (checked) {
      // Force custom card mode by toggling native to false if currently in native mode
      if (nativeServices.has(id)) {
        onToggleNative(id)
      }
    } else {
      // If turning off API mode, delete the stored API key and update status
      // @ts-ignore
      await window.api.apiKeyDelete(id)
      setHasKeys(prev => ({ ...prev, [id]: false }))
      if (onApiKeyChange) {
        onApiKeyChange(id, false)
      }
    }
  }

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '24px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 28,
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#ccc' }}>Settings</h2>
          <p style={{ margin: 0, fontSize: 12, color: '#444' }}>Configure view modes and direct API credentials for each service.</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            title="Close Settings"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#555',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#222' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Services Configuration */}
      <section>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Services View & API Configuration
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SERVICES.map(s => {
            const capable = CARD_CAPABLE.has(s.id)
            const supportsApi = API_SUPPORTED.has(s.id)
            const isNative = nativeServices.has(s.id)
            const isApiActive = supportsApi && apiToggled[s.id]
            const useCard = capable && (!isNative || isApiActive)

            return (
              <div key={s.id} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 8,
                background: '#0d0d0d',
                border: '1px solid #191919',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Service Logo & Label */}
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: s.color + '18', border: `1px solid ${s.color}33`,
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    <ServiceLogo id={s.id} size={13} color={s.color} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#bbb', flex: 1 }}>{s.label}</span>

                  {/* Mode Buttons */}
                  {capable ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <ModeButton
                        label="Card"
                        active={useCard}
                        color={s.color}
                        disabled={isApiActive}
                        onClick={() => isNative && onToggleNative(s.id)}
                      />
                      <ModeButton
                        label="Native"
                        active={isNative && !isApiActive}
                        color={s.color}
                        disabled={isApiActive}
                        onClick={() => !isNative && onToggleNative(s.id)}
                      />
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: isApiActive ? '#444' : '#333' }}>
                      {isApiActive ? 'Card (API)' : 'Native only'}
                    </span>
                  )}

                  {/* API Mode Toggle */}
                  {supportsApi && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginLeft: 12,
                      borderLeft: '1px solid #222',
                      paddingLeft: 12
                    }}>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: isApiActive ? s.color : '#444',
                        transition: 'color 0.15s'
                      }}>API</span>
                      <ToggleSwitch
                        checked={apiToggled[s.id]}
                        color={s.color}
                        onChange={(checked) => handleToggleApi(s.id, checked)}
                      />
                    </div>
                  )}
                </div>

                {/* API Key input block (shows when API is toggled ON) */}
                {supportsApi && apiToggled[s.id] && (
                  <div style={{
                    marginTop: 2,
                    paddingTop: 10,
                    borderTop: '1px solid #161616',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <ApiKeyInputBlock
                      s={s}
                      hasKey={hasKeys[s.id]}
                      onKeyChanged={(id, has) => {
                        setHasKeys(prev => ({ ...prev, [id]: has }))
                        if (onApiKeyChange) {
                          onApiKeyChange(id, has)
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 11, color: '#3a3a3a', lineHeight: 1.5 }}>
          <strong style={{ color: '#444' }}>Card</strong> — custom, clean scraped response views.<br />
          <strong style={{ color: '#444' }}>Native</strong> — standard interactive web view, bypasses API/Scraping.<br />
          <strong style={{ color: '#444' }}>API</strong> — ultra-fast direct communication. Activates custom response cards and unlocks key credential fields.
        </p>
      </section>
    </div>
  )
}

function ModeButton({ label, active, color, disabled, onClick }: { label: string; active: boolean; color: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 12px',
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
        border: active ? `1px solid ${color}55` : '1px solid #252525',
        background: active ? color + '20' : 'transparent',
        color: active ? color : '#444',
        cursor: (active || disabled) ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.35 : 1,
        transition: 'all 0.1s',
      }}
    >{label}</button>
  )
}

function ToggleSwitch({ checked, color, onChange }: { checked: boolean; color: string; onChange: (checked: boolean) => void }) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <div
      onClick={() => onChange(!checked)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 30,
        height: 16,
        borderRadius: 999,
        background: checked ? color : '#222',
        border: `1px solid ${checked ? color : hovered ? '#333' : '#222'}`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: checked ? '#fff' : '#555',
          position: 'absolute',
          left: checked ? 15 : 2,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: checked ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
        }}
      />
    </div>
  )
}

interface ApiKeyInputBlockProps {
  s: typeof SERVICES[number]
  hasKey: boolean
  onKeyChanged: (id: ServiceId, has: boolean) => void
}

function ApiKeyInputBlock({ s, hasKey, onKeyChanged }: ApiKeyInputBlockProps) {
  const [inputValue, setInputValue] = React.useState('')
  const [editing, setEditing] = React.useState(false)

  const handleSave = async () => {
    if (!inputValue.trim()) return
    // @ts-ignore
    await window.api.apiKeySet(s.id, inputValue.trim())
    onKeyChanged(s.id, true)
    setInputValue('')
    setEditing(false)
  }

  const handleDelete = async () => {
    // @ts-ignore
    await window.api.apiKeyDelete(s.id)
    onKeyChanged(s.id, false)
    setInputValue('')
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>API Key</span>
        {hasKey ? (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#00cc66', background: '#00cc6615', padding: '1px 6px', borderRadius: 3 }}>
            Active & Encrypted
          </span>
        ) : (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#666', background: '#25252515', padding: '1px 6px', borderRadius: 3 }}>
            Key Required
          </span>
        )}
      </div>

      {hasKey && !editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#333', letterSpacing: '0.15em', flex: 1 }}>••••••••••••••••••••••••</span>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 10.5, fontWeight: 600,
              border: '1px solid #222', background: 'transparent', color: '#777',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#444' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#777'; e.currentTarget.style.borderColor = '#222' }}
          >
            Change
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 10.5, fontWeight: 600,
              border: '1px solid #c0392b44', background: '#c0392b15', color: '#e74c3c',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#c0392b25' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#c0392b15' }}
          >
            Delete
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="password"
            placeholder={`Enter direct API key for ${s.label}...`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{
              flex: 1, background: '#121212', border: '1px solid #222',
              borderRadius: 5, padding: '6px 10px', fontSize: 11.5, color: '#ccc',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={handleSave}
            disabled={!inputValue.trim()}
            style={{
              padding: '6px 14px', borderRadius: 5, fontSize: 11, fontWeight: 600,
              border: inputValue.trim() ? `1px solid ${s.color}55` : '1px solid #222',
              background: inputValue.trim() ? s.color + '20' : 'transparent',
              color: inputValue.trim() ? s.color : '#444',
              cursor: inputValue.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (inputValue.trim()) e.currentTarget.style.background = s.color + '30'
            }}
            onMouseLeave={e => {
              if (inputValue.trim()) e.currentTarget.style.background = s.color + '20'
            }}
          >
            Save
          </button>
          {editing && (
            <button
              onClick={() => { setEditing(false); setInputValue(''); }}
              style={{
                padding: '6px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                border: '1px solid #222', background: 'transparent', color: '#666',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}

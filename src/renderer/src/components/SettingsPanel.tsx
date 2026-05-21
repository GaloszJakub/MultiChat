import React from 'react'
import { SERVICES } from '../lib/services'
import { ServiceLogo } from './ServiceLogo'
import type { ServiceId } from '../../../main/services/types'

const CARD_CAPABLE = new Set<ServiceId>(['claude', 'gemini'])

interface Props {
  nativeServices: Set<ServiceId>
  onToggleNative: (id: ServiceId) => void
}

export function SettingsPanel({ nativeServices, onToggleNative }: Props) {
  const [hasKeys, setHasKeys] = React.useState<Record<string, boolean>>({
    claude: false,
    chatgpt: false
  })

  React.useEffect(() => {
    // @ts-ignore
    window.api.apiKeyGet('claude').then(has => setHasKeys(prev => ({ ...prev, claude: has })))
    // @ts-ignore
    window.api.apiKeyGet('chatgpt').then(has => setHasKeys(prev => ({ ...prev, chatgpt: has })))
  }, [])

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: '24px 28px',
      display: 'flex', flexDirection: 'column', gap: 28,
    }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#ccc' }}>Settings</h2>
        <p style={{ margin: 0, fontSize: 12, color: '#444' }}>Configure how each service is displayed and credentials.</p>
      </div>

      {/* View mode per service */}
      <section>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          View Mode
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SERVICES.map(s => {
            const capable = CARD_CAPABLE.has(s.id)
            const isNative = nativeServices.has(s.id)
            const useCard = capable && !isNative
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 8,
                background: '#0d0d0d', border: '1px solid #191919',
                opacity: capable ? 1 : 0.4,
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: s.color + '18', border: `1px solid ${s.color}33`,
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <ServiceLogo id={s.id} size={13} color={s.color} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#bbb', flex: 1 }}>{s.label}</span>

                {capable ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <ModeButton
                      label="Card"
                      active={useCard}
                      color={s.color}
                      onClick={() => isNative && onToggleNative(s.id)}
                    />
                    <ModeButton
                      label="Native"
                      active={isNative}
                      color={s.color}
                      onClick={() => !isNative && onToggleNative(s.id)}
                    />
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: '#333' }}>Native only</span>
                )}
              </div>
            )
          })}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#3a3a3a', lineHeight: 1.5 }}>
          <strong style={{ color: '#444' }}>Card</strong> — scraped text shown in custom chat UI.<br />
          <strong style={{ color: '#444' }}>Native</strong> — real browser view, no scraping.
        </p>
      </section>

      {/* API Keys (Direct Mode) */}
      <section style={{ borderTop: '1px solid #191919', paddingTop: 20 }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          API Keys (Direct Mode)
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 11, color: '#444', lineHeight: 1.5 }}>
          Provide API keys to enable Direct API mode. If a key is saved, the service will communicate directly via API, bypassing browser automation for ultra-fast responses.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SERVICES.filter(s => s.id === 'claude' || s.id === 'chatgpt').map(s => (
            <ApiKeyRow
              key={s.id}
              s={s}
              hasKey={hasKeys[s.id]}
              onKeyChanged={(id, has) => setHasKeys(prev => ({ ...prev, [id]: has }))}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function ModeButton({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
        border: active ? `1px solid ${color}55` : '1px solid #252525',
        background: active ? color + '20' : 'transparent',
        color: active ? color : '#444',
        cursor: active ? 'default' : 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.1s',
      }}
    >{label}</button>
  )
}

interface ApiKeyRowProps {
  s: typeof SERVICES[number]
  hasKey: boolean
  onKeyChanged: (id: string, has: boolean) => void
}

function ApiKeyRow({ s, hasKey, onKeyChanged }: ApiKeyRowProps) {
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
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '14px', borderRadius: 8,
      background: '#0d0d0d', border: '1px solid #191919',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: s.color + '18', border: `1px solid ${s.color}33`,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <ServiceLogo id={s.id} size={11} color={s.color} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#bbb' }}>{s.label}</span>
        </div>
        {hasKey ? (
          <span style={{ fontSize: 10, fontWeight: 600, color: '#00cc66', background: '#00cc6615', padding: '2px 8px', borderRadius: 4 }}>
            Active
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 600, color: '#555', background: '#25252515', padding: '2px 8px', borderRadius: 4 }}>
            Inactive
          </span>
        )}
      </div>

      {hasKey && !editing ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: '#555', alignSelf: 'center', flex: 1 }}>••••••••••••••••</span>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
              border: '1px solid #252525', background: 'transparent', color: '#888',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Change
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
              border: '1px solid #c0392b44', background: '#c0392b15', color: '#e74c3c',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Delete
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            type="password"
            placeholder={`Enter ${s.label} API Key...`}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{
              flex: 1, background: '#141414', border: '1px solid #222',
              borderRadius: 5, padding: '5px 10px', fontSize: 12, color: '#ccc',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={handleSave}
            disabled={!inputValue.trim()}
            style={{
              padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
              border: inputValue.trim() ? `1px solid ${s.color}55` : '1px solid #222',
              background: inputValue.trim() ? s.color + '20' : 'transparent',
              color: inputValue.trim() ? s.color : '#444',
              cursor: inputValue.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}
          >
            Save
          </button>
          {editing && (
            <button
              onClick={() => { setEditing(false); setInputValue(''); }}
              style={{
                padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600,
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


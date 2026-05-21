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
  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      padding: '24px 28px',
      display: 'flex', flexDirection: 'column', gap: 28,
    }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#ccc' }}>Settings</h2>
        <p style={{ margin: 0, fontSize: 12, color: '#444' }}>Configure how each service is displayed.</p>
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

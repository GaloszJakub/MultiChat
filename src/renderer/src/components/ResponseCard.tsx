import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Status } from './StatusBadge'
import type { ServiceConfig } from '../lib/services'
import type { Message } from '../App'

interface Props {
  service: ServiceConfig
  status: Status
  messages: Message[]
  enabled: boolean
  onToggle: () => void
  onLogin: () => void
  onDevTools: () => void
  onSend: (text: string) => void
}

export function ResponseCard({ service, status, messages, enabled, onToggle, onLogin, onDevTools, onSend }: Props) {
  const isLoggedOut = status === 'loggedout'
  const [input, setInput] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  const submit = () => {
    const text = input.trim()
    if (!text || isLoggedOut) return
    onSend(text)
    setInput('')
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0,
      borderRadius: 10, border: '1px solid #1e1e1e',
      background: '#0a0a0a', overflow: 'hidden',
    }}>
      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {isLoggedOut ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
            <span style={{ color: '#333', fontSize: 13 }}>Not logged in</span>
            <button
              onClick={onLogin}
              style={{
                fontSize: 12, padding: '6px 16px', borderRadius: 6,
                border: `1px solid ${service.color}44`, background: service.color + '15',
                color: service.color, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
              }}
            >Login to {service.label}</button>
          </div>
        ) : messages.length === 0 ? (
          <span style={{ color: '#2a2a2a', fontSize: 13, margin: 'auto' }}>Send a prompt to start</span>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: msg.role === 'user' ? '#444' : service.color + 'bb',
              }}>
                {msg.role === 'user' ? 'You' : service.label}
              </span>
              <div style={{
                fontSize: 13, lineHeight: 1.7,
                color: msg.role === 'user' ? '#888' : '#d0d0d0',
                wordBreak: 'break-word',
              }}>
                {msg.text ? (
                  <ReactMarkdown
                    components={{
                      code({ inline, className, children }) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                            {children}
                          </code>
                        )
                      },
                      p: ({ children }) => <p style={{ margin: '0 0 8px', lineHeight: 1.7 }}>{children}</p>,
                      h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 700, margin: '12px 0 6px' }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: 14, fontWeight: 700, margin: '10px 0 4px' }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 600, margin: '8px 0 4px' }}>{children}</h3>,
                      ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '4px 0' }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '4px 0' }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                      blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #333', paddingLeft: 12, margin: '8px 0', color: '#888' }}>{children}</blockquote>,
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                ) : (
                  msg.role === 'assistant' && (
                    <span style={{ color: '#333' }}>
                      {status === 'sending' ? 'Sending…' : 'Waiting for response…'}
                    </span>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      {!isLoggedOut && (
        <div style={{
          borderTop: '1px solid #161616', padding: '10px 12px',
          display: 'flex', gap: 8, alignItems: 'flex-end',
          flexShrink: 0, background: '#060606',
        }}>
          <textarea
            ref={taRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Reply to ${service.label}… (Ctrl+Enter)`}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', color: '#ccc', fontSize: 13, lineHeight: 1.5,
              fontFamily: 'inherit', padding: '3px 0', minHeight: 22, maxHeight: 120,
            }}
          />
          <button
            onClick={submit}
            disabled={!input.trim()}
            style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              background: input.trim() ? service.color : '#181818',
              border: 'none', cursor: input.trim() ? 'pointer' : 'default',
              display: 'grid', placeItems: 'center', transition: 'background 0.15s',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none"
              stroke={input.trim() ? '#fff' : '#333'} strokeWidth="1.5" strokeLinecap="round">
              <line x1="5" y1="9" x2="5" y2="1"/><polyline points="2,4 5,1 8,4"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

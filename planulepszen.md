# Plan: 6 ulepszeń CV

## 1. Markdown rendering w ResponseCard

### Co
Scraped text wyświetlany jako rendered Markdown — nagłówki, bold, code blocks z syntax highlighting.

### Paczki
```
npm install react-markdown react-syntax-highlighter
npm install @types/react-syntax-highlighter
```

### Zmiany
| Plik | Zmiana |
|------|--------|
| `src/renderer/src/components/ResponseCard.tsx` | Zastąpić `<div style={{whiteSpace:'pre-wrap'}}>` komponentem `<ReactMarkdown>` z `SyntaxHighlighter` dla bloków kodu |

### Szczegóły
```tsx
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// W miejscu renderowania msg.text:
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
```

---

## 2. Response timing

### Co
Mierzyć ms od submit do `done: true` per serwis. Pokazać `3.2s` pod zakładką w TabBar.

### Zmiany
| Plik | Zmiana |
|------|--------|
| `src/renderer/src/App.tsx` | Dodać `responseTimes: Record<ServiceId, number>` state. Na handleSend: zapisać `sendTime = Date.now()`. W `onServiceResponse`: gdy `done === true` → `responseTimes[id] = Date.now() - sendTime`. Wyczyścić przy nowym sendzie. |
| `src/renderer/src/components/TabBar.tsx` | Przyjąć prop `responseTimes: Partial<Record<ServiceId, number>>`. Pod nazwą serwisu pokazać `{time}s` małą czcionką gdy time > 0. |

### Szczegóły App.tsx
```typescript
const [responseTimes, setResponseTimes] = useState<Partial<Record<ServiceId, number>>>({})
const sendTimeRef = useRef<number>(0)

// W handleSend przed api.broadcast:
sendTimeRef.current = Date.now()
setResponseTimes({})

// W onServiceResponse gdy done:
if (done) {
  setResponseTimes(prev => ({ ...prev, [id]: Math.round((Date.now() - sendTimeRef.current) / 100) / 10 }))
}
```

### Szczegóły TabBar
```tsx
// Pod nazwą serwisu:
{responseTimes?.[s.id] && (
  <span style={{ fontSize: 9, color: '#444', marginTop: 1 }}>{responseTimes[s.id]}s</span>
)}
```

---

## 3. Prompt history (SQLite)

### Co
Zapisywać każdy prompt + timestamp w SQLite. Ctrl+↑/↓ w textarea przegląda historię.

### Paczki
`better-sqlite3` już zainstalowany (używany w cookie-import). Sprawdzić czy jest — jeśli nie:
```
npm install better-sqlite3 @types/better-sqlite3
```

### Nowe pliki
`src/main/history.ts` — obsługa bazy danych

```typescript
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

const DB_PATH = join(app.getPath('userData'), 'history.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.exec(`CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`)
  }
  return db
}

export function savePrompt(text: string): void {
  getDb().prepare('INSERT INTO prompts (text, created_at) VALUES (?, ?)').run(text, Date.now())
}

export function getHistory(limit = 100): { id: number; text: string; created_at: number }[] {
  return getDb().prepare('SELECT * FROM prompts ORDER BY created_at DESC LIMIT ?').all(limit) as any[]
}

export function clearHistory(): void {
  getDb().prepare('DELETE FROM prompts').run()
}
```

### IPC kanały (channels.ts)
```typescript
HISTORY_SAVE: 'history:save',
HISTORY_GET: 'history:get',
HISTORY_CLEAR: 'history:clear',
```

### Handler (handlers.ts)
```typescript
import { savePrompt, getHistory, clearHistory } from '../history'

ipcMain.handle(IPC.HISTORY_SAVE, (_e, text: string) => savePrompt(text))
ipcMain.handle(IPC.HISTORY_GET, (_e, limit?: number) => getHistory(limit))
ipcMain.handle(IPC.HISTORY_CLEAR, () => clearHistory())
```

### Preload (index.ts)
```typescript
historySave: (text: string) => ipcRenderer.invoke(IPC.HISTORY_SAVE, text),
historyGet: (limit?: number): Promise<{id: number; text: string; created_at: number}[]> => ipcRenderer.invoke(IPC.HISTORY_GET, limit),
historyClear: () => ipcRenderer.invoke(IPC.HISTORY_CLEAR),
```

### Renderer (App.tsx)
```typescript
// W handleSend po wysłaniu:
api.historySave(finalPrompt)

// W PromptComposer — Ctrl+↑/↓:
const [historyIndex, setHistoryIndex] = useState(-1)
const historyCache = useRef<string[]>([])

// ładowanie historii przy mount:
useEffect(() => {
  api.historyGet(50).then(rows => { historyCache.current = rows.map(r => r.text) })
}, [])

// W handleKeyDown:
if (e.key === 'ArrowUp' && e.ctrlKey) {
  const next = Math.min(historyIndex + 1, historyCache.current.length - 1)
  setHistoryIndex(next)
  onChange(historyCache.current[next] ?? '')
  e.preventDefault()
}
if (e.key === 'ArrowDown' && e.ctrlKey) {
  const next = Math.max(historyIndex - 1, -1)
  setHistoryIndex(next)
  onChange(next === -1 ? '' : historyCache.current[next])
  e.preventDefault()
}
```

---

## 4. Export rozmowy

### Co
Przycisk Export w TabBar (lub ResponseCard) → pobiera rozmowę jako plik `.md`.

### Zmiany
| Plik | Zmiana |
|------|--------|
| `src/renderer/src/App.tsx` | Funkcja `handleExport(id)` — buduje Markdown string z `conversations[id]`, wywołuje `api.exportConversation` |
| `src/main/ipc/channels.ts` | Dodać `EXPORT_CONVERSATION: 'export:conversation'` |
| `src/main/ipc/handlers.ts` | Handler: `dialog.showSaveDialog` → `fs.writeFileSync` |
| `src/preload/index.ts` | Expose `exportConversation` |
| `src/renderer/src/components/TabBar.tsx` | Dodać ikonkę export (↓) obok new chat button |

### Handler (main)
```typescript
import { dialog } from 'electron'
import { writeFileSync } from 'fs'

ipcMain.handle(IPC.EXPORT_CONVERSATION, async (_e, serviceLabel: string, markdown: string) => {
  const result = await dialog.showSaveDialog({
    title: 'Export conversation',
    defaultPath: `${serviceLabel}-${new Date().toISOString().slice(0,10)}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled || !result.filePath) return { ok: false }
  writeFileSync(result.filePath, markdown, 'utf-8')
  return { ok: true }
})
```

### Budowanie Markdown (App.tsx)
```typescript
const handleExport = async (id: ServiceId) => {
  const service = SERVICES.find(s => s.id === id)
  const msgs = conversations[id]
  if (!msgs.length || !service) return
  const md = `# Conversation with ${service.label}\n_${new Date().toLocaleString()}_\n\n` +
    msgs.map(m => `**${m.role === 'user' ? 'You' : service.label}:**\n\n${m.text}`).join('\n\n---\n\n')
  await api.exportConversation(service.label, md)
}
```

---

## 5. Keyboard shortcuts

### Co
Globalne skróty w oknie Electron:
- `Ctrl+1` … `Ctrl+6` — przełącz zakładkę na serwis N
- `Ctrl+N` — new chat aktywnego serwisu
- `Ctrl+L` — focus textarea promptu
- `Ctrl+Enter` — send (już działa w textarea, dodać globalnie)
- `Ctrl+Shift+D` — open DevTools aktywnego serwisu

### Zmiany
| Plik | Zmiana |
|------|--------|
| `src/renderer/src/App.tsx` | `useEffect` z `window.addEventListener('keydown', handler)` |

### Kod (App.tsx)
```typescript
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
```

### Tooltip w TabBar
Dodać `title="Ctrl+1"` itp. do przycisków zakładek.

---

## 6. Direct API mode

### Co
Jeśli user poda klucz API → wysyłaj przez HTTP zamiast browser automation. Streaming SSE. Działa bez logowania, bez BrowserView.

### Wspierane serwisy na start
- **Claude** — Anthropic API (`/v1/messages` + streaming)
- **ChatGPT** — OpenAI API (`/v1/chat/completions` + streaming)

### Nowe pliki
`src/main/api-adapters/claude-api.ts`
`src/main/api-adapters/openai-api.ts`
`src/main/api-store.ts` — przechowywanie kluczy (encrypted w Electron safeStorage)

### Przechowywanie kluczy
```typescript
// api-store.ts
import { safeStorage, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const KEYS_PATH = join(app.getPath('userData'), 'api-keys.enc')

export function saveApiKey(serviceId: string, key: string): void {
  const existing = loadAllKeys()
  existing[serviceId] = key
  const encrypted = safeStorage.encryptString(JSON.stringify(existing))
  writeFileSync(KEYS_PATH, encrypted)
}

export function getApiKey(serviceId: string): string | null {
  const all = loadAllKeys()
  return all[serviceId] ?? null
}

function loadAllKeys(): Record<string, string> {
  if (!existsSync(KEYS_PATH)) return {}
  try {
    const encrypted = readFileSync(KEYS_PATH)
    return JSON.parse(safeStorage.decryptString(encrypted))
  } catch {
    return {}
  }
}
```

### Claude API adapter
```typescript
// api-adapters/claude-api.ts
export async function* streamClaude(apiKey: string, messages: {role: string; content: string}[], model = 'claude-sonnet-4-6'): AsyncGenerator<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      messages,
    }),
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta = json.delta?.text
        if (delta) yield delta
      } catch {}
    }
  }
}
```

### IPC kanały (channels.ts)
```typescript
API_KEY_SET: 'apiKey:set',
API_KEY_GET: 'apiKey:get',
API_KEY_DELETE: 'apiKey:delete',
API_STREAM: 'api:stream',       // invoke: starts stream, pushes SERVICE_RESPONSE events
```

### Handler (handlers.ts)
```typescript
ipcMain.handle(IPC.API_KEY_SET, (_e, id: ServiceId, key: string) => saveApiKey(id, key))
ipcMain.handle(IPC.API_KEY_GET, (_e, id: ServiceId) => !!getApiKey(id)) // zwróć bool nie klucz
ipcMain.handle(IPC.API_KEY_DELETE, (_e, id: ServiceId) => saveApiKey(id, ''))

ipcMain.handle(IPC.API_STREAM, async (_e, id: ServiceId, messages: any[]) => {
  const key = getApiKey(id)
  if (!key) return { ok: false, error: 'no api key' }
  const win = BrowserWindow.fromWebContents(_e.sender)
  if (!win) return { ok: false }

  let fullText = ''
  const stream = id === 'claude' ? streamClaude(key, messages) : streamOpenAI(key, messages)

  for await (const chunk of stream) {
    fullText += chunk
    win.webContents.send(IPC.SERVICE_RESPONSE, { id, text: fullText, done: false })
  }
  win.webContents.send(IPC.SERVICE_RESPONSE, { id, text: fullText, done: true })
  return { ok: true }
})
```

### SettingsPanel — wpisywanie kluczy
W `SettingsPanel.tsx` dodać sekcję "API Keys":
- Input `type="password"` per serwis (Claude, ChatGPT na start)
- `onBlur` → `api.apiKeySet(id, value)`
- Przy załadowaniu: `api.apiKeyGet(id)` → jeśli true → show `••••••••` placeholder

### App.tsx — wybór trybu
```typescript
const [apiMode, setApiMode] = useState<Partial<Record<ServiceId, boolean>>>({})

// W handleSend: jeśli apiMode[id] === true → api.apiStream zamiast submitPrompt
// api.broadcast filtruje tylko serwisy bez api mode
// apiStream services odpytywane osobno
```

### Weryfikacja
1. Otwórz Settings → wpisz klucz Anthropic
2. Wyślij prompt → Claude odpowiada przez API (szybciej niż BrowserView)
3. Zrestartuj app → klucz nadal zapisany (safeStorage)
4. BrowserView Claude nieaktywny gdy API mode włączony

---

## Kolejność implementacji

| # | Feature | Czas | Trudność |
|---|---------|------|----------|
| 1 | Markdown rendering | 2h | Łatwe |
| 2 | Response timing | 1h | Łatwe |
| 5 | Keyboard shortcuts | 1h | Łatwe |
| 4 | Export rozmowy | 2h | Łatwe |
| 3 | Prompt history SQLite | 3h | Średnie |
| 6 | Direct API mode | 1-2 dni | Trudne |

Zacząć od 1, 2, 5 (małe, widoczne na demo). Potem 4, 3. API mode osobna sesja.

# Plan: Tryb Sekwencyjny (Sequential / Chain Mode)

## Cel
Zamiast wysyłać prompt do wszystkich serwisów jednocześnie (parallel broadcast), w trybie sekwencyjnym każdy serwis dostaje prompt + odpowiedzi poprzednich serwisów jako kontekst. Modele "komentują" nawzajem swoje odpowiedzi.

---

## Warianty trybu

### Wariant A — Chain (łańcuch)
1. Użytkownik wysyła prompt
2. Prompt idzie do Serwisu 1 → czekaj na `done: true`
3. Prompt + odpowiedź S1 idą do Serwisu 2 → czekaj
4. Prompt + S1 + S2 → Serwis 3 → czekaj
5. itd.

Każdy kolejny model widzi co powiedział poprzedni.

### Wariant B — Review (recenzja)
1. Broadcast równoległy (jak teraz) — wszyscy dostają oryginalny prompt
2. Po zebraniu wszystkich odpowiedzi: automatycznie wysyła do wybranego "sędziego" (np. Claude) zbiorczą recenzję
3. Podobne do istniejącego Summarize, ale automatyczne i wbudowane w flow

**Rekomendacja: Wariant A** — bardziej unikalny, Summarize już częściowo pokrywa B.

---

## UX / Interfejs

### PromptComposer — nowy toggle
- Obok przycisku Send: mały toggle `⇄ Parallel` / `⇒ Sequential`
- W trybie Sequential: pojawia się drag-and-drop lista kolejności serwisów
- Alternatywnie: stała kolejność = kolejność zakładek w TabBar (brak drag&drop na start)

### Wizualizacja postępu
- TabBar: aktywny serwis (w trakcie generowania) pulsuje/podświetla się
- Kolejne serwisy mają status `waiting` (nowy status)
- Po zakończeniu każdego: status → `done`, następny zaczyna

### Nowy status badge
Dodać `waiting` do `Status` type w `StatusBadge.tsx`:
- Kolor: szary/niebieski, ikonka zegara

---

## Architektura

### Nowe typy (types.ts)
```typescript
type BroadcastMode = 'parallel' | 'sequential'

interface SequentialResult {
  id: ServiceId
  text: string
  ok: boolean
  error?: string
}
```

### IPC — nowy kanał (channels.ts)
```typescript
BROADCAST_SEQUENTIAL: 'broadcast:sequential'
```

### Nowy handler (handlers.ts)
```typescript
ipcMain.handle(IPC.BROADCAST_SEQUENTIAL, async (_e, text: string, orderedIds: ServiceId[]) => {
  const results: SequentialResult[] = []
  let contextBlock = ''

  for (const id of orderedIds) {
    const adapter = adapterMap.get(id)
    const view = viewManager.getView(id)
    if (!adapter || !view) {
      results.push({ id, ok: false, error: 'not found', text: '' })
      continue
    }

    // Buduj prompt z kontekstem poprzednich odpowiedzi
    const fullPrompt = contextBlock
      ? `${text}\n\n---\n\nPrevious model responses:\n${contextBlock}`
      : text

    // Wyślij prompt
    await adapter.submitPrompt(view, fullPrompt)

    // Czekaj na odpowiedź (polling aż done: true lub timeout)
    const response = await waitForResponse(win, viewManager, id, initialText)

    results.push({ id, ok: true, text: response })

    // Dodaj do kontekstu dla następnego
    contextBlock += `\n**${adapter.label}:**\n${response}\n`

    // Push status do renderera: ten serwis done, następny pending
    win.webContents.send(IPC.SERVICE_STATUS, { id, loggedIn: true }) // odśwież
  }

  return results
})
```

### Helper: waitForResponse
Wydzielić z `startResponsePoller` do funkcji `async waitForResponse(win, viewManager, id, initialText): Promise<string>`.
Zwraca tekst gdy `done: true` lub po 120s timeout.

### App.tsx — tryb broadcast
```typescript
const [broadcastMode, setBroadcastMode] = useState<'parallel' | 'sequential'>('parallel')
const [sequentialOrder, setSequentialOrder] = useState<ServiceId[]>([])

const handleSend = async () => {
  if (broadcastMode === 'sequential') {
    const order = sequentialOrder.length > 0 ? sequentialOrder : [...enabledIds]
    await api.broadcastSequential(finalPrompt, order)
  } else {
    await api.broadcast(finalPrompt, [...enabledIds])
  }
}
```

### Preload (index.ts)
```typescript
broadcastSequential: (text: string, orderedIds: ServiceId[]): Promise<SequentialResult[]> =>
  ipcRenderer.invoke(IPC.BROADCAST_SEQUENTIAL, text, orderedIds),
```

---

## Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| `src/main/ipc/channels.ts` | Dodaj `BROADCAST_SEQUENTIAL` |
| `src/main/ipc/handlers.ts` | Dodaj handler, wydziel `waitForResponse` z pollera |
| `src/main/services/types.ts` | Dodaj `SequentialResult`, `BroadcastMode` |
| `src/preload/index.ts` | Expose `broadcastSequential` |
| `src/renderer/src/lib/ipc.ts` | Typ dla `broadcastSequential` |
| `src/renderer/src/App.tsx` | Stan `broadcastMode`, `sequentialOrder`, logika `handleSend` |
| `src/renderer/src/components/PromptComposer.tsx` | Toggle Parallel/Sequential + opcjonalna lista kolejności |
| `src/renderer/src/components/StatusBadge.tsx` | Dodaj status `waiting` |
| `src/renderer/src/components/TabBar.tsx` | Obsługa statusu `waiting` (animacja) |

---

## Fazy implementacji

### Faza 1 — Backend (main process)
1. Dodaj kanał `BROADCAST_SEQUENTIAL`
2. Wydziel `waitForResponse` helper (Promise zamiast interval)
3. Zaimplementuj handler sekwencyjny z budowaniem kontekstu
4. Testy przez DevTools konsoli

### Faza 2 — Frontend minimal
1. Dodaj `broadcastMode` toggle w PromptComposer (prosty button)
2. Podłącz `api.broadcastSequential` w `handleSend`
3. Dodaj status `waiting` do StatusBadge
4. Animacja pulsowania na aktywnej zakładce

### Faza 3 — UX polish
1. Drag-and-drop kolejności serwisów (opcjonalne)
2. Progress indicator (np. "2/4 models done")
3. Możliwość przerwania sekwencji w połowie

---

## Ryzyka

| Ryzyko | Mitygacja |
|--------|-----------|
| `waitForResponse` blokuje wątek node | Użyć Promise + setInterval wewnątrz, resolve gdy done |
| Kontekst rośnie wykładniczo przy wielu modelach | Limit: ostatnie 2 odpowiedzi w kontekście, nie wszystkie |
| Timeout jednego modelu blokuje resztę | Per-model timeout 120s, na timeout → skip + kontynuuj |
| Prompt z kontekstem za długi dla modelu | Truncate do ~4000 znaków na odpowiedź w bloku kontekstu |

---

## Weryfikacja
1. Włącz tryb Sequential, wybierz 3 serwisy
2. Wyślij prompt "What is recursion?"
3. Obserwuj: S1 zaczyna → po done S2 zaczyna z kontekstem → S3 ostatni
4. S3 powinien widzieć odpowiedzi S1 i S2 w swoim oknie (jeśli native: w pasku wprowadzania)
5. Wyłącz Sequential → wróć do Parallel → broadcast działa jak wcześniej

# MultiChat

MultiChat to zaawansowany, premium klient desktopowy zbudowany w oparciu o **Electron**, **React**, **Vite** oraz **TypeScript**. Aplikacja pozwala na jednoczesną i sekwencyjną komunikację z wiodącymi modelami językowymi AI (ChatGPT, Claude, Gemini, Grok, Kimi, DeepSeek) w jednym spójnym i nowoczesnym interfejsie.

---

## Główne Funkcje

### 1. Równoległe Nadawanie (Parallel Mode)
* Wysyłaj jedno zapytanie do wielu wybranych modeli jednocześnie.
* Porównuj odpowiedzi w czasie rzeczywistym w czytelnym układzie kolumnowym lub kartach.
* Pełna obsługa szybkiego streamowania odpowiedzi (Direct API) oraz standardowych widoków webowych.

### 2. Sekwencyjne Łańcuchy Modeli (Sequential Chaining)
* Konfiguruj zaawansowane scenariusze wieloetapowego przetwarzania (tzw. pipeline).
* Wyjście (odpowiedź) jednego modelu staje się automatycznie wejściem (kontekstem) dla kolejnego modelu w łańcuchu.
* Automatyczne przekazywanie danych z zachowaniem eleganckiego opóźnienia i wizualnego postępu na dedykowanym, smukłym pasku kontrolnym na dole ekranu.

### 3. Pipeline Studio
* Wbudowany, dwukolumnowy graficzny konfigurator łańcuchów modeli:
  - **Gotowe szablony (Preset Templates)**: Szybkie wczytywanie domyślnych konfiguracji (np. *Standard Chain*, *Critic & Refiner*, *Outline & Write*) jednym kliknięciem.
  - **Edytor szablonów promptów**: Pełna edytowalność promptów na każdym etapie potoku za pomocą automatycznie rozszerzających się pól tekstowych (`TextareaAutoGrow`).
  - **ServiceSelector**: Luksusowe, autorskie menu rozwijane z sygnalizacją świetlną LED w kolorach poszczególnych marek AI do szybkiego przypisywania modeli do zadań.
  - **Zarządzanie krokami**: Możliwość dodawania (+ Add Step), usuwania (✕) oraz rearanżacji (▲/▼) kolejności wykonywania kroków.

### 4. Bezpieczne omijanie zabezpieczeń botów (CDP Login)
* Integracja z **CDP (Chrome DevTools Protocol)**.
* Logowanie do usług takich jak ChatGPT czy Gemini odbywa się za pośrednictwem zewnętrznej, kontrolowanej instancji przeglądarki Google Chrome.
* MultiChat automatycznie pobiera ciasteczka sesyjne po pomyślnym zalogowaniu, omijając restrykcyjne blokady Cloudflare w natywnych WebViews.

### 5. Narzędzia i Wydajność
* **Lokalna historia SQLite**: Automatyczne zapisywanie wszystkich promptów do wbudowanej bazy danych SQLite z możliwością przeszukiwania skrótami klawiszowymi.
* **Eksport danych**: Możliwość eksportowania całej konwersacji z wybranego panelu do pliku tekstowego lub Markdown.
* **Response Timings**: Dokładny pomiar i wizualizacja czasu odpowiedzi każdego z modeli AI.

---

## Architektura i Stack Technologiczny

* **Środowisko uruchomieniowe**: Electron (proces główny & proces renderowania)
* **Kompilator i Bundler**: Electron-Vite
* **Biblioteka UI**: React (z hookami stanu, efektami i zaawansowanymi komponentami)
* **Język programowania**: TypeScript (pełne, ścisłe typowanie)
* **Baza danych**: SQLite (poprzez `better-sqlite3`)
* **Stylizacja**: Vanilla CSS & TailwindCSS (premium ciemna estetyka, szklane rozmycia `backdropFilter`, płynne mikro-animacje)

---

## Uruchomienie i Budowanie

### Wymagania:
* [Node.js](https://nodejs.org/) (wersja 18 lub nowsza)
* NPM lub Yarn

### 1. Instalacja zależności:
```bash
npm install
```

### 2. Uruchomienie w trybie developerskim (Live Reload):
```bash
npm run dev
```

### 3. Zbudowanie gotowych plików wykonywalnych (.exe):
Generuje instalator oraz wersję przenośną w katalogu `dist/` za pomocą `electron-builder`:
```bash
npm run package
```
Po zakończeniu procesu w folderze `dist/` znajdziesz:
* `MultiChat Setup [wersja].exe` – instalator Windows
* `MultiChat [wersja].exe` – w pełni przenośna wersja aplikacji (Portable)

# MultiChat

MultiChat to aplikacja desktopowa (Electron + React + TypeScript), która pozwala rozmawiać z wieloma modelami AI (ChatGPT, Claude, Gemini, Grok, Kimi, DeepSeek) w jednym miejscu. Aplikacja działa bezpośrednio przez zalogowanie się na konta webowe i nie wymaga posiadania płatnych kluczy API.

## Co potrafi aplikacja

* **Brak konieczności konfiguracji API**: Działa bezpośrednio na bazie Twoich standardowych kont przeglądarkowych – nie musisz generować ani płacić za klucze API.
* **Wysyłanie równoległe (Parallel Mode)**: Możesz wysłać jeden prompt do kilku modeli jednocześnie i porównać odpowiedzi obok siebie (w kolumnach lub zakładkach).
* **Łączenie modeli w łańcuchy (Sequential Chaining)**: Pozwala stworzyć potok (pipeline), w którym odpowiedź z jednego modelu automatycznie staje się wejściem dla kolejnego (np. jeden model pisze konspekt, drugi go rozwija).
* **Pipeline Studio**: Prosty edytor wizualny do układania kroków, zmieniania kolejności, dodawania nowych etapów i edycji promptów szablonowych.
* **Omijanie blokad (CDP Login)**: Logowanie do usług typu ChatGPT czy Gemini przez sterowaną przeglądarkę Chrome, co pozwala na pobranie ciasteczek sesyjnych i obejście Cloudflare w aplikacji.
* **Historia i Szablony (Skills)**: Zapisywanie własnych promptów systemowych (umiejętności) i lokalna baza danych SQLite przechowująca historię wszystkich rozmów z możliwością wyszukiwania.
* **Statystyki i eksport**: Pomiar czasu odpowiedzi modeli oraz eksport rozmów do plików Markdown (.md) lub tekstowych (.txt).

## Obsługiwane modele

| Usługa | Przykładowe modele |
| :--- | :--- |
| ChatGPT | GPT-4o, GPT-4o mini, o1, o3-mini |
| Claude | Sonnet 4.6, Opus 4.7, Haiku 4.5 |
| Gemini | 3.5 Flash, 3.1 Pro, 3.1 Flash-Lite |
| Grok | Grok 3, Grok 2 |
| Kimi | moonshot-v1-8k, moonshot-v1-32k |
| DeepSeek | DeepSeek R1, DeepSeek V3 |

## Jak to uruchomić

### Wymagania
* Zainstalowany Node.js (wersja 18 lub nowsza)
* Zainstalowana przeglądarka Google Chrome (potrzebna do logowania CDP)

### Instalacja i uruchomienie dev
```bash
# Pobierz zależności
npm install

# Uruchom aplikację w trybie developerskim
npm run dev
```

### Budowanie wersji produkcyjnej (.exe)
```bash
# Buduje wersję instalacyjną i portable w folderze dist/
npm run package
```

## Gdzie są zapisywane dane
Wszystkie dane (historia rozmów, ciasteczka sesyjne, konfiguracje potoków) są zapisywane wyłącznie lokalnie na Twoim komputerze w bazie SQLite. Aplikacja nie wysyła żadnych Twoich danych ani loginów na zewnętrzne serwery pośredniczące.

# Kalkulator Limitu Pracy Tymczasowej 18/36

Progresywna aplikacja webowa (PWA) do liczenia limitu pracy tymczasowej na rzecz jednego
pracodawcy użytkownika.

## Podstawa prawna

**Art. 20 ustawy z dnia 9 lipca 2003 r. o zatrudnianiu pracowników tymczasowych**
(t.j. Dz. U. 2025 poz. 236):

- ta sama osoba może wykonywać pracę tymczasową na rzecz **jednego pracodawcy użytkownika**
  maksymalnie **18 miesięcy w każdym ruchomym oknie 36 kolejnych miesięcy**,
- limit jest wspólny dla wszystkich agencji pracy tymczasowej i wszystkich form zatrudnienia
  (umowa o pracę + umowy cywilnoprawne),
- miesiąc kalendarzowy, w którym praca była wykonywana choćby jeden dzień, liczy się
  jako pełny miesiąc,
- wyjątek: **zastępstwo nieobecnego pracownika** — do 36 miesięcy w sposób ciągły
  (art. 20 ust. 5), kolejne skierowanie najwcześniej po 36 miesiącach (art. 20 ust. 6).

## Jak liczy kalkulator

Aplikacja pokazuje wyniki w dwóch ujęciach:

**1. Podsumowanie okresowe (limit dniowy, domyślny widok)**

- okresy pracy grupowane są w **okresy 36-miesięczne** liczone od pierwszego dnia pracy
  w danym cyklu (np. 16.08.2023 – 15.08.2026),
- w każdym okresie sumowane są dni umów i porównywane z limitem **540 dni**
  (możliwa zmiana na 548),
- dla każdego okresu pokazywane jest: wykorzystane dni, pozostałe dni oraz data,
  do której można przedłużyć umowę,
- na końcu sumaryczne „Łącznie wykorzystanych dni".

**2. Analiza wg przepisów (art. 20 — sekcja rozwijana)**

- limit **18 miesięcy w każdym ruchomym oknie 36 kolejnych miesięcy** — miesiącami
  kalendarzowymi (miesiąc z choć 1 dniem pracy = pełny miesiąc),
- limit wspólny dla wszystkich agencji i form zatrudnienia (umowa o pracę + umowy
  cywilnoprawne),
- pokazywane: stan bieżącego okna, najgorsze okno w historii, najwcześniejszy dopuszczalny
  powrót, tryb zastępstwa (art. 20 ust. 5–6).

## Funkcje

- dowolna liczba osób i okresów, walidacja dat inline,
- obsługa nakładających się okresów (bez dublowania miesięcy),
- tryb zastępstwa nieobecnego pracownika,
- zapis danych w `localStorage` (dane przetrwają odświeżenie strony),
- praca offline (service worker + cache CDN),
- instalacja jako aplikacja (PWA, przycisk pojawia się gdy przeglądarka wspiera `beforeinstallprompt`).

## Struktura

| Plik | Opis |
| --- | --- |
| `limitscalculator.html` | interfejs aplikacji |
| `logic.js` | logika obliczeń (funkcje czyste, bez DOM) |
| `service-worker.js` | cache offline (network-first dla HTML, cache-first dla zasobów) |
| `manifest.json` | manifest PWA |
| `icon-192.png`, `icon-512.png` | ikony aplikacji |
| `tests/logic.test.js` | testy jednostkowe logiki |

## Uruchomienie

Statyczne pliki — wystarczy serwer HTTP (np. GitHub Pages). Do pełnej funkcjonalności PWA
(service worker) wymagane jest HTTPS lub `localhost`.

## Testy

```
node tests/logic.test.js
```

> Uwaga: kalkulator ma charakter pomocniczy i nie stanowi porady prawnej.

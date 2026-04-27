# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dollar Bill** is a Chrome extension (Manifest V3) that automatically detects prices on any webpage and displays converted amounts inline next to the original. It fetches exchange rates from official central bank APIs (NBRB, ECB, NBP, NBU, CBR, CNB, TCMB, BOC, BCB, BOE) plus Frankfurter as a fallback.

## Architecture

This is a vanilla JS Chrome extension with no build step, no bundler, no npm, and no package.json. Files are loaded directly by the browser.

### Core files

- **`manifest.json`** — Manifest V3 config. Content scripts run on `<all_urls>`.
- **`lib/rates.js`** — The shared utility module (`RatesUtil` IIFE). Contains the currency database (150+ currencies), rate source definitions, rate fetching/caching logic, pattern compilation, settings management with migration (currently v7), and conversion math. Loaded by background, content, popup, and options.
- **`background.js`** — Service worker. Manages rate refresh via `chrome.alarms` (every 30 min). Handles messages: `getRates`, `updateRates`, `getSettings`, `getFetchStatus`, `getLoadedRates`.
- **`content.js`** — Content script injected into all pages. Uses `TreeWalker` to scan text nodes, regex-matches currency patterns, replaces matches with original text + conversion pills (`<span class="db-pill">`). Uses `MutationObserver` with 300ms debounce for dynamic content.
- **`popup/popup.html|js|css`** — Extension popup with enable/disable toggle, rate source selector, conversion pair chips, quick converter, and theme switcher.
- **`options/options.html|js|css`** — Full settings page: enabled toggle, rate sources, custom rates, conversion pairs, currency library editor, site filtering (all/whitelist), theme, number/time format, live preview. Opens via `chrome.runtime.openOptionsPage()`.
- **`styles/injected.css`** — Styles for `.db-pill` conversion badges and `#dollarbill-picker` currency picker bar injected into pages.

### Data flow

1. **Rates**: Central bank APIs → `fetchAndCacheRates()` → `chrome.storage.local` → cached as merged cross-rate table `{ USD: { EUR: 0.92, ... } }` with conflict tracking
2. **Settings**: `chrome.storage.local` under `dollarbill-settings` key. Schema versioned (`_settingsVersion: 7`) with migration chain (`migrateSettingsV1toV2` through `migrateSettingsV5toV6`).
3. **Content script**: Loads `lib/rates.js` + `content.js` at `document_idle`. Sends `getSettings`/`getRates` messages to background. Compiles regex patterns from currency identifiers. Ambiguous currencies (shared identifiers like `$`) resolved via domain TLD mapping or user picker bar.

### Key patterns in `lib/rates.js`

- `RATE_SOURCES` object maps source IDs (`nbrb`, `ecb`, etc.) to `{ name, convention, fetchBaseRates }`. Convention is `direct` (1 base = X foreign) or `indirect` (1 foreign = X base).
- `buildMergedRateTable()` merges rates from multiple sources and detects conflicts (same pair, different rates from different sources).
- `buildPatternsFromIdentifiers()` generates regex patterns from currency identifiers for text matching.
- Settings migrations run sequentially in `getSettings()` — always read settings through this function.

## Development

Load the extension directly in Chrome via `chrome://extensions` → "Load unpacked" → point to this directory. No build or compilation needed. Changes to content scripts require reloading the extension; changes to the options/popup pages just need a page refresh.

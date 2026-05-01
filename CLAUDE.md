# CLAUDE.md

## Project Overview

**Dollar Bill** is a Chrome extension (Manifest V3) that automatically detects prices on any webpage and displays converted amounts inline next to the original. It fetches exchange rates from official central bank APIs (NBRB, ECB, NBP, NBU, CBR, CNB, TCMB, BOC, BCB, BOE, HKMA, NBK) plus Frankfurter as a fallback.

## Architecture

This is a vanilla JS Chrome extension with no build step, no bundler, no npm, and no package.json. Files are loaded directly by the browser. All modules are IIFEs exposing globals.

### Directory Structure

```
dollar-bill-ext/
├── manifest.json
├── background.js               (service worker)
├── content.js                   (slim entry — calls content/ modules)
├── lib/
│   └── bignumber.js            (BigNumber.js v9.1.2 — arbitrary-precision decimal arithmetic)
├── locales/
│   └── en.json                  (flat key-value English strings for i18n)
├── core/
│   ├── currencies.js            (Currencies IIFE — 150+ currency database)
│   ├── math.js                  (MathOps IIFE — BigNumber-backed string-safe arithmetic, all rate values are strings)
│   ├── rate-sources.js          (RateSources IIFE — API definitions + fetch)
│   ├── migrations.js            (Migrations IIFE — v1→v3 migration chain)
│   ├── settings.js              (Settings IIFE — schema + persistence)
│   ├── i18n.js                  (I18n IIFE — locale loading, t(), applyToPage())
│   ├── patterns.js              (Patterns IIFE — regex compilation)
│   ├── rate-tables.js           (RateTables IIFE — rate table building, merge, convert)
│   ├── number-formatter.js      (NumberFormatter IIFE — display formatting for string rate values)
│   ├── format-utils.js          (FormatUtils IIFE — escapeHtml, timestamps, numbers)
│   ├── rate-fetch.js            (RateFetch IIFE — cache, storage, fetch orchestration)
│   └── rates.js                 (RatesUtil IIFE — facade re-exporting all core modules)
├── content/
│   ├── scanner.js               (Scanner IIFE — TreeWalker, text node iteration)
│   ├── converter.js             (ContentConverter IIFE — pill creation, regex matching)
│   ├── picker-bar.js            (PickerBar IIFE — ambiguous currency picker)
│   └── observer.js              (ContentObserver IIFE — MutationObserver + debounce)
├── ui/
│   ├── ui-common.js             (UICommon IIFE — theme, currency list, source picker close)
│   ├── source-picker.js         (SourcePicker IIFE — conflict dropdown factory)
│   ├── currency-picker.js       (CurrencyPicker IIFE — from/to picker binding)
│   ├── pair-chips.js            (PairChips IIFE — chip rendering for popup/options)
│   ├── theme-handler.js         (ThemeHandler IIFE — segmented/selector rendering)
│   └── fetch-status.js          (FetchStatusUI IIFE — popup/options status display)
├── options/
│   ├── options.html|css         (settings page)
│   ├── options.js               (init, save, orchestration)
│   ├── currency-library.js      (CurrencyLibrary IIFE — tile grid, editor)
│   ├── custom-rates.js          (CustomRates IIFE — rate grid)
│   ├── loaded-rates.js          (LoadedRates IIFE — loaded rates viewer)
│   ├── site-filter.js           (SiteFilter IIFE — whitelist + domain overrides)
│   └── preview.js               (Preview IIFE — live preview panel)
├── popup/
│   ├── popup.html|css           (extension popup)
│   ├── popup.js                 (init, toggle, source dropdown, conflict banner)
│   ├── rate-cards.js            (RateCards IIFE — rate card rendering)
│   └── converter.js             (PopupConverter IIFE — quick converter widget)
└── styles/
    ├── tokens.css               (design tokens — CSS custom properties)
    ├── components.css           (shared component styles)
    └── injected.css             (pill + picker styles for injected pages)
```

### Data flow

1. **Rates**: Central bank APIs → `RateFetch.fetchAndCacheRates()` → `chrome.storage.local` → cached as merged rate table with conflict tracking
2. **Settings**: `chrome.storage.local` under `dollarbill_settings` key. Schema versioned (`_settingsVersion: 3`) with migration chain in `core/migrations.js`.
3. **Content script**: Loads core modules, then content modules, then `content.js`. Sends `getSettings`/`getRates` messages to background. Compiles regex patterns from currency identifiers. Ambiguous currencies resolved via domain TLD mapping or picker bar.

### Key patterns

- `RATE_SOURCES` object (in `core/rate-sources.js`) maps source IDs to `{ name, fetchBaseRates }`.
- `RateTables.buildMergedRateTable()` merges rates from multiple sources and detects conflicts. It builds the **full** rate table from all enabled sources — not filtered by `conversionPairs`.
- `conversionPairs` controls what the content script detects/converts on pages, but does **not** gate the stored rate table.
- `Patterns.buildPatternsFromIdentifiers()` generates regex patterns from currency identifiers.
- `RatesUtil` (in `core/rates.js`) is a **facade** — it re-exports everything from `Patterns`, `RateTables`, `FormatUtils`, and `RateFetch` as a single backward-compatible global. All existing callers use `RatesUtil.convert()`, `RatesUtil.getSettings()`, etc.
- Settings migrations run sequentially via `Migrations.migrate()` called from `Settings.getSettings()`.
- **i18n**: `I18n.init(locale?)` loads locale JSON from `locales/`. `I18n.t(key, params?)` looks up strings with `{{param}}` interpolation. `I18n.applyToPage()` scans `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` attributes. Adding a language = add entry to `LOCALE_REGISTRY` in `core/i18n.js` + create `locales/<code>.json`. Settings field `language` (null = auto/system).

## Module Load Order

The IIFE modules have hard dependencies and must load in this order:

### manifest.json content_scripts
```
lib/bignumber.js → core/currencies.js → core/math.js → core/rate-sources.js → core/migrations.js →
core/settings.js → core/i18n.js → core/patterns.js → core/rate-tables.js →
core/number-formatter.js → core/format-utils.js → core/rate-fetch.js → core/rates.js →
content/scanner.js → content/converter.js → content/picker-bar.js →
content/observer.js → content.js
```

### background.js importScripts
Same as above minus content/ modules (but still includes lib/bignumber.js first).

### popup.html scripts
lib/bignumber.js → Core 12 files → ui/ 6 files → popup/rate-cards.js → popup/converter.js → popup/popup.js

### options.html scripts
lib/bignumber.js → Core 12 files → ui/ 6 files → options/ 5 feature files → options/options.js

## Development

Load the extension directly in Chrome via `chrome://extensions` → "Load unpacked" → point to this directory. No build or compilation needed. Changes to content scripts require reloading the extension; changes to the options/popup pages just need a page refresh.

### Debugging

- **Content script changes**: Must reload the extension on `chrome://extensions`, then refresh the target page.
- **Background script changes**: Must reload the extension. Check service worker logs via "Inspect views: service worker" on `chrome://extensions`.
- **Rate fetching**: Use background console to inspect `fetchAndCacheRates()` results.
- **Storage inspection**: `chrome.storage.local` is viewable via DevTools → Application → Storage → Chrome Extension Storage.

### Gotchas

- IIFEs expose globals. Do not add `import`/`export` — there is no module bundler.
- Settings must always be read via `Settings.getSettings()` to run migrations. Never read `chrome.storage.local` directly for settings.
- `styles/injected.css` uses hardcoded values intentionally — it loads into arbitrary pages and must remain isolated from the design tokens.
- New modules should be their own IIFE globals. The `RatesUtil` facade in `core/rates.js` provides backward compatibility — new code can import directly from sub-modules (e.g., `RateTables.convert()`) or use `RatesUtil.convert()`.
- **All stored rate `amount`/`rate` values are strings.** Use `MathOps` (`core/math.js`) for all arithmetic on rate values. `MathOps` uses `BigNumber` (from `lib/bignumber.js`) internally for arbitrary-precision decimal arithmetic (8 dp, ROUND_HALF_UP). Use `NumberFormatter` (`core/number-formatter.js`) for display formatting. **Never use `parseFloat` anywhere in the codebase** — use `BigNumber` directly or via `MathOps`/`NumberFormatter` to avoid IEEE 754 precision errors. User input parsing: `MathOps.parseNumber(s)` (string→string), `MathOps.fromNumber(n)` (number→string), `MathOps.toNumber(s)` (string→number boundary). `convert()` returns a number via `MathOps.toNumber()` at the boundary.

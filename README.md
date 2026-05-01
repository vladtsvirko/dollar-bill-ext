# Dollar Bill

A Chrome extension that automatically detects prices on any webpage and displays converted amounts inline next to the original. Uses official exchange rates from central bank APIs.

![Dollar Bill](icons/icon128.png)

## Features

- **Inline price conversion** — prices like `$49.99` or `€120` are automatically detected and annotated with your chosen currency
- **12 exchange rate sources** — official central bank APIs from Belarus, EU, Poland, Ukraine, Russia, Czech Republic, Turkey, Canada, Brazil, UK, Hong Kong, and Kazakhstan, plus Frankfurter as a fallback
- **150+ currencies supported** — built-in currency database with symbols, identifiers, and domain mappings
- **Multi-source merging** — enable multiple rate sources simultaneously; conflicting rates are flagged with a picker
- **Quick converter** — built-in calculator in the popup for one-off conversions
- **Custom/manual rates** — set your own exchange rates for any currency pair
- **Site filtering** — blocklist or allowlist mode to control which sites get scanned
- **Domain currency overrides** — tell the extension which currency ambiguous prices use on specific domains (e.g. `$` = CAD on amazon.ca)
- **Number format picker** — choose how converted prices are displayed (decimal separators, grouping) by locale
- **Light/dark/system theme**
- **Multilingual UI** — English, Polski, Беларуская, Русский

## Installation

### From source (development)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the project folder
5. The extension icon appears in your toolbar

That's it — no build step, no dependencies to install.

## How It Works

1. **Scanning** — a content script walks the page text using a `TreeWalker`, matching price patterns against currency identifiers from your settings
2. **Conversion** — matched prices are converted using cached exchange rates and displayed as inline pills next to the original text
3. **Rate fetching** — the background service worker fetches rates from your selected central bank API(s), caches them in `chrome.storage.local`, and refreshes on a schedule
4. **Ambiguous currencies** — if a symbol like `$` could mean USD, CAD, AUD, etc., the extension uses domain TLD hints or shows a picker bar for you to choose

## Configuration

Right-click the extension icon and choose **Options** (or click the gear icon in the popup) to open the settings page.

### Popup

- **Enable/disable** — toggle conversion for the current site or globally
- **Rate source selector** — switch between exchange rate providers
- **Quick Convert** — type an amount and convert between any two currencies
- **Conversion pairs** — manage which currency pairs to detect on pages

### Settings Page (Options)

| Section | What it does |
|---|---|
| **Enabled** | Master toggle for price conversion |
| **Appearance** | Light, dark, or system theme |
| **Time format** | 12h, 24h, or auto |
| **Number format** | Locale-based number formatting for converted prices |
| **Language** | UI language (auto follows browser) |
| **Site Filtering** | Blocklist or allowlist mode to control which sites are scanned |
| **Exchange Rate Source** | Pick one or more central bank APIs; see fetch status and loaded rates |
| **Manual Rates** | Add custom exchange rates for specific pairs |
| **Conversion Pairs** | Define which currencies to detect and which to convert into |
| **Domain Currency Overrides** | Map ambiguous currency symbols to a specific currency per domain |
| **Currency Library** | View, edit, or add currencies with custom symbols and identifiers |
| **Live Preview** | See how converted prices will look as you change settings |

## Supported Rate Sources

| Source | Base Currency | Provider |
|---|---|---|
| National Bank of Belarus | BYN | NBRB API |
| European Central Bank | EUR | ECB daily feed |
| National Bank of Poland | PLN | NBP API |
| National Bank of Ukraine | UAH | NBU API |
| Bank of Russia | RUB | CBR XML feed |
| Czech National Bank | CZK | CNB XML feed |
| Central Bank of Turkey | TRY | TCMB XML feed |
| Bank of Canada | CAD | BOC Valet API |
| Central Bank of Brazil | BRL | BCB PTAX API |
| Bank of England | GBP | via Frankfurter |
| Hong Kong Monetary Authority | HKD | HKMA API |
| National Bank of Kazakhstan | KZT | NBK RSS feed |

All rate sources are free and require no API keys.

## Languages

The extension UI is available in:

- English
- Polski (Polish)
- Беларуская (Belarusian)
- Русский (Russian)

Language is auto-detected from your browser settings, or you can pick one manually in the Options page.

## Project Structure

```
dollar-bill-ext/
├── manifest.json              Extension manifest (Manifest V3)
├── background.js              Service worker (rate fetching, messaging)
├── content.js                 Content script entry point
├── lib/bignumber.js           BigNumber.js — arbitrary-precision math
├── core/                      Core modules (rates, settings, patterns, i18n...)
├── content/                   Content script modules (scanner, converter, observer)
├── ui/                        Shared UI components (theme, pickers, chips)
├── popup/                     Extension popup (HTML, CSS, JS)
├── options/                   Settings page (HTML, CSS, JS)
├── styles/                    Design tokens, shared styles, injected pill styles
├── locales/                   Translation JSON files
└── icons/                     Extension icons (16, 48, 128px)
```

The project uses vanilla JavaScript with IIFE modules — no bundler, no npm, no build step.

## Development

### Prerequisites

- Google Chrome (or Chromium-based browser)

### Making changes

1. Edit the source files
2. Go to `chrome://extensions` and click the reload icon on the Dollar Bill card
3. Refresh any target page to see content script changes

### Debugging

- **Content script**: Reload the extension, then refresh the target page. Use DevTools on the page.
- **Background script**: Click "Inspect views: service worker" on the extension card in `chrome://extensions`.
- **Storage**: DevTools → Application → Storage → Chrome Extension Storage.
- **Rates**: Run `fetchAndCacheRates()` in the background console to test rate fetching.

### Adding a new language

1. Add an entry to `LOCALE_REGISTRY` in `core/i18n.js`
2. Create `locales/<code>.json` with translated strings (copy `locales/en.json` as a template)
3. The language will appear automatically in the settings page language picker

### Adding a new rate source

1. Add a new entry to `RATE_SOURCES` in `core/rate-sources.js` with a `fetchBaseRates` async function
2. Add the API hostname to `host_permissions` in `manifest.json`
3. The source will appear in the rate source picker in settings

## Privacy

Dollar Bill does not collect, store, or transmit any personal data. Exchange rates are fetched directly from central bank APIs. All settings and cached rates are stored locally in your browser. No analytics, no tracking, no third-party services beyond the rate APIs.

## License

This project is open source. See the license file for details.

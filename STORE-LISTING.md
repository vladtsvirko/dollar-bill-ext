# Chrome Web Store Listing - Dollar Bill

## Short Description (132 chars max)

Automatically convert prices on any webpage between your chosen currencies using official central bank exchange rates.

## Detailed Description

**Dollar Bill** instantly converts prices shown on any webpage into currencies you choose. See a price in Belarusian rubles and want to know what it costs in US dollars? Dollar Bill handles it inline — no copying, no switching tabs, no calculators.

The extension scans visible text on the pages you visit, detects price amounts and currency symbols, and displays the converted value right next to the original price. You configure which currencies to detect and which to convert into; everything else is automatic.

Exchange rates are fetched from official central bank sources — the National Bank of Belarus, European Central Bank, National Bank of Poland, National Bank of Ukraine, Bank of Russia, Czech National Bank, Central Bank of Turkey, Bank of Canada, Central Bank of Brazil, Bank of England, Hong Kong Monetary Authority, and the National Bank of Kazakhstan — so you get reliable, up-to-date rates with no middleman. Rates are cached locally and refreshed periodically in the background.

**Features:**
- Inline price conversion on any website
- Rates from 12 central banks: NBRB (Belarus), ECB (EU), NBP (Poland), NBU (Ukraine), CBR (Russia), CNB (Czechia), TCMB (Turkey), BOC (Canada), BCB (Brazil), BOE (UK), HKMA (Hong Kong), NBK (Kazakhstan)
- Fully configurable conversion pairs (e.g. BYN → USD, EUR → GBP)
- Custom rate overrides for specific currency pairs
- Built-in currency library with support for adding your own currencies
- Dark, light, and system theme support
- Site whitelist mode to restrict scanning to specific domains
- Domain-level currency overrides for sites with ambiguous pricing
- Live preview of converted price formatting in settings
- Available in English, Polish, Belarusian, and Russian

**Why does this extension need access to all websites?**
Dollar Bill needs to read visible page text on any site to detect and convert prices. It does not read form inputs, passwords, or hidden elements. You can restrict scanning to specific sites using the Site Filtering option in settings.

**Your privacy:** No personal data is collected. No tracking, analytics, or advertising. All settings are stored locally on your device. The only network requests are to public central bank APIs to fetch exchange rates. See the Privacy Policy for full details.

## Category

**Productivity**

## Keywords (suggested, up to 5)

currency converter, price converter, exchange rates, BYN, EUR

## Screenshots

Capture 1280x800 or 640x400 screenshots. Recommended shots:

1. **Inline conversion on a real shopping page** — shows prices with converted amounts appearing next to originals. This is the hero shot.
2. **Options page — Conversion Pairs section** — shows the pair configuration UI with currency chips.
3. **Options page — Exchange Rate Source** — shows NBRB/ECB source selection and loaded rates.
4. **Options page — Live Preview** — shows the preview panel with a converted price.
5. **Popup** — shows the extension popup (if it displays rate info or quick toggle).

Tip: Use a light-themed shopping or marketplace site for the hero shot so the green conversion pills are clearly visible against the page content.

## Additional Notes for Submission

- The `<all_urls>` content script match is required because the extension must scan page text for price patterns on any site the user visits. Users can opt into whitelist-only mode via settings.
- No remote code is loaded. All logic runs from bundled extension files.
- The extension does not use `eval()`, `innerHTML` for user input, or any dynamic code execution.

# Rate Fetching Pipeline

## Overview

The Dollar Bill extension converts prices inline on web pages using exchange rates from 12 central bank APIs. This document traces the full pipeline: fetch triggers, per-source API calls, normalization, merge into a unified rate table, conflict detection, caching, and conversion.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TRIGGERS                                     │
│  chrome.runtime.onInstalled  │  alarm (30 min)  │  updateRates msg  │
└──────────────┬───────────────┴─────────┬────────┴──────────┬────────┘
               │                         │                   │
               └─────────────┬───────────┘                   │
                             ▼                               │
                   background.updateRates()                  │
                             │                               │
                             ▼                               │
              RateFetch.fetchAndCacheRates(sourceIds)
                             │
              ┌──────────────┼──────────────────┐
              │  Promise.allSettled()           │
              │  ┌──────────┐ ┌──────────┐      │
              │  │ source 1 │ │ source N │ ...  │
              │  │ fetch()  │ │ fetch()  │      │
              │  └────┬─────┘ └────┬─────┘      │
              │       │            │             │
              └───────┼────────────┼─────────────┘
                      ▼            ▼
              ┌──────────────────────────────┐
              │   sourceRatesMap              │   (normalized per source)
              │   loadedRatesMap              │   (raw + metadata per source)
              │   sourceErrors                │   (error messages per source)
              └──────────────┬───────────────┘
                             ▼
              RateTables.buildMergedRateTable()
              ┌──────────────────────────────┐
              │  Per source: buildRateTable() │  (base→currency, currency→base)
              │  Merge: Object.assign nested  │  (source-tagged entries)
              └──────────────┬───────────────┘
                             ▼
              ┌──────────────────────────────────────────────┐
              │  chrome.storage.local                        │
              │  ├─ dollarbill_rates_v2   (merged table)     │
              │  ├─ dollarbill_loaded_rates  (per-source)    │
              │  └─ dollarbill_fetch_status  (status + meta) │
              └──────────────────────────────────────────────┘
                             │
                             ▼  (content script requests via messaging)
              RateTables.getEffectiveRates()
              ┌──────────────────────────────────────────┐
              │  Merge API rates + custom rates           │
              │  Resolve via resolveActiveEntry()         │
              │  User selection > source > inv            │
              │  (custom has source type, wins by order)  │
              └──────────────┬───────────────────────────┘
                             ▼
              RateTables.convert(amount, from, to, rates, selections)
              └──► converted amount (number)
```


## Settings That Drive Fetching

Settings are stored under the `dollarbill_settings` key in `chrome.storage.local` and loaded via `Settings.getSettings()` (which also runs migrations). The fields relevant to the rate pipeline are:

| Field | Type | Default | Description |
|---|---|---|---|
| `rateSources` | `string[]` | `['ecb']` | Which source IDs to fetch from. Can include multiple (e.g. `['ecb', 'nbrb']`). |
| `conversionPairs` | `{from, to}[]` | `[{'USD','EUR'},{'EUR','USD'}]` | Currency pairs to detect and convert on pages. Does NOT gate the stored rate table — all currencies from enabled sources are always stored. |
| `rateSourceSelections` | `{from, to, source}[]` | `[]` | User-chosen source overrides for pairs with conflicts. |
| `customRates` | `object` | `{}` | Manual rates keyed as `"FROM:TO": {rate, amount}`. Merged separately into the effective rate table. |

Source and target currencies are derived from `conversionPairs`. They control what the content script detects/converts on pages, but do **not** filter the stored rate table:

```js
// rate-tables.js
getSourceCurrencies(settings) → [...new Set(pairs.map(p => p.from))]
getTargetCurrencies(settings) → [...new Set(pairs.map(p => p.to))]
```


## Fetch Triggers

There are three triggers that call `updateRates()` in `background.js`:

### 1. Extension Install / Update
```js
chrome.runtime.onInstalled.addListener(async () => {
  await updateRates();
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
});
```

### 2. Periodic Alarm (every 30 minutes)
```js
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dollarbill-update-rates') updateRates();
});
```

### 3. Manual Refresh (via message)
The popup/options page sends `{ type: 'updateRates' }`, which triggers a full refresh and returns fresh rates, fetch status, and loaded rates.

All three paths converge on `updateRates()`, which:
1. Reads settings via `RatesUtil.getSettings()`
2. Calls `RatesUtil.fetchAndCacheRates(settings.rateSources)`
3. Saves fetch status (`lastFetchTime`, `lastSuccessTime`, `lastError`, `consecutiveFailures`)


## Per-Source Fetch Details

Each source is defined in `RATE_SOURCES` (`core/rate-sources.js`) as `{ name, fetchBaseRates }`. Every `fetchBaseRates()` returns a normalized shape:

```js
{
  base: 'XXX',                    // 3-letter base currency code
  rates: {
    CODE: { rate: "1.23", amount: "1" },  // strings from MathOps (fetchBaseRates output)
    BASE: { rate: "1", amount: "1" },     // base currency identity entry
  },
  rateDate?: string               // optional — when the rate was published
}
```

The semantic meaning of `{ rate: R, amount: A }` is: **A units of CODE = R units of BASE**. So `rate / amount` gives the per-unit exchange rate from CODE to BASE.

### Summary Table

| ID | Name | API URL | Format | Base | Special Logic |
|---|---|---|---|---|---|
| `nbrb` | National Bank of Belarus | `api.nbrb.by/exrates/rates?periodicity=0` | JSON | BYN | Uses `Cur_OfficialRate` / `Cur_Scale` |
| `ecb` | European Central Bank | `ecb.europa.eu/.../eurofxref-daily.xml` | XML | EUR | Regex-parsed XML; rates inverted via `MathOps.inv()` |
| `nbp` | National Bank of Poland | `api.nbp.pl/api/exchangerates/tables/A/` | JSON | PLN | Array response; uses `item.mid` |
| `nbu` | National Bank of Ukraine | `bank.gov.ua/.../exchange?json&date=YYYYMMDD` | JSON | UAH | Today's date injected into URL |
| `cbr` | Bank of Russia | `cbr.ru/scripts/XML_daily_eng.asp` | XML | RUB | Regex-parsed XML; comma→dot conversion |
| `cnb` | Czech National Bank | `cnb.cz/.../denni_kurz.xml` | XML | CZK | Regex-parsed XML; comma→dot conversion |
| `tcmb` | Central Bank of Turkey | `tcmb.gov.tr/kurlar/today.xml` | XML | TRY | Regex-parsed XML; uses `ForexBuying` |
| `boc` | Bank of Canada | `bankofcanada.ca/valet/observations/{series}/json` | JSON | CAD | 5-day lookback; latest observation used; FX-prefixed series names |
| `bcb` | Central Bank of Brazil | `olinda.bcb.gov.br/.../CotacaoDolarDia` | JSON | BRL | Up to 5-day retry for weekends/holidays; only USD rate |
| `boe` | Bank of England | `api.frankfurter.app/latest?from=GBP` | JSON | GBP | Uses Frankfurter proxy; rates inverted via `MathOps.inv()` |
| `hkma` | HK Monetary Authority | `api.hkma.gov.hk/.../er-eeri-daily` | JSON | HKD | Field→code mapping (e.g. `usd`→`USD`); paginated (1 record) |
| `nbk` | National Bank of Kazakhstan | `nationalbank.kz/rss/get_rates.cfm?fdate=DD.MM.YYYY` | RSS/XML | KZT | Regex-parsed RSS; today's date injected; uses `<quant>` for amount |

### NBRB (National Bank of Belarus)

- **URL**: `https://api.nbrb.by/exrates/rates?periodicity=0`
- **Response format**: JSON array
- **Raw response shape**:
  ```json
  [
    { "Cur_Abbreviation": "USD", "Cur_OfficialRate": 3.2720, "Cur_Scale": 1 },
    { "Cur_Abbreviation": "EUR", "Cur_OfficialRate": 3.5635, "Cur_Scale": 1 }
  ]
  ```
- **Normalization**: `rate = MathOps.fromNumber(item.Cur_OfficialRate)`, `amount = MathOps.parseInt(item.Cur_Scale)`
- **Base**: `BYN`

### ECB (European Central Bank)

- **URL**: `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`
- **Response format**: XML
- **Raw response shape**: XML with `<Cube currency='USD' rate='1.0866'/>` elements
- **Normalization**: Regex `currency='([A-Z]{3})'\s+rate='([\d.]+)'` extracts code and rate. Rates are **inverted** via `MathOps.inv()` because ECB quotes "1 EUR = X foreign", but the normalized format expects "A foreign = R EUR". Amount is always `"1"`.
- **Base**: `EUR`

### NBP (National Bank of Poland)

- **URL**: `https://api.nbp.pl/api/exchangerates/tables/A/`
- **Response format**: JSON array
- **Raw response shape**:
  ```json
  [{ "rates": [{ "code": "USD", "mid": 3.9460 }, ...] }]
  ```
- **Normalization**: `rate = MathOps.fromNumber(item.mid)`, `amount = "1"`
- **Base**: `PLN`

### NBU (National Bank of Ukraine)

- **URL**: `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json&date=YYYYMMDD`
- **Response format**: JSON array
- **Raw response shape**:
  ```json
  [{ "cc": "USD", "rate": 41.5 }, ...]
  ```
- **Normalization**: Today's date is formatted as `YYYYMMDD` and appended to the URL. `rate = MathOps.fromNumber(item.rate)`, `amount = "1"`
- **Base**: `UAH`

### CBR (Bank of Russia)

- **URL**: `https://www.cbr.ru/scripts/XML_daily_eng.asp`
- **Response format**: XML
- **Raw response shape**: XML with `<CharCode>USD</CharCode><Nominal>1</Nominal><Value>92,4500</Value>`
- **Normalization**: Regex extracts `CharCode`, `Nominal`, `Value`. Comma is replaced with dot. `rate = MathOps.fromNumber(parseFloat(value))`, `amount = MathOps.parseInt(nominal)`
- **Base**: `RUB`

### CNB (Czech National Bank)

- **URL**: `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.xml`
- **Response format**: XML
- **Raw response shape**: XML with `<radek kod="USD" mnozstvi="1" kurz="23,020"/>`
- **Normalization**: Regex extracts `kod`, `mnozstvi`, `kurz`. Comma→dot. `rate = MathOps.fromNumber(parseFloat(rate))`, `amount = MathOps.parseInt(amount)`
- **Base**: `CZK`

### TCMB (Central Bank of Turkey)

- **URL**: `https://www.tcmb.gov.tr/kurlar/today.xml`
- **Response format**: XML
- **Raw response shape**: XML with `<Currency CurrencyCode="USD"><Unit>1</Unit><ForexBuying>32.1500</ForexBuying></Currency>`
- **Normalization**: Regex extracts `CurrencyCode`, `Unit`, `ForexBuying`. Comma→dot. `rate = MathOps.fromNumber(parseFloat(buying))`, `amount = MathOps.parseInt(unit)`
- **Base**: `TRY`

### BOC (Bank of Canada)

- **URL**: `https://www.bankofcanada.ca/valet/observations/{series}/json?start_date={5-days-ago}`
- **Response format**: JSON
- **Raw response shape**:
  ```json
  {
    "observations": [
      { "d": "2026-04-25", "FXUSDCAD": { "v": "1.3826" }, "FXEURCAD": { "v": "1.5603" } },
      ...
    ]
  }
  ```
- **Normalization**: Looks back 5 days. Uses the **last** observation. Series names follow the pattern `FX{CODE}CAD`. Regex `^FX([A-Z]{3})CAD$` extracts the currency code. `rate = MathOps.fromNumber(parseFloat(val.v))`, `amount = "1"`
- **Base**: `CAD`

### BCB (Central Bank of Brazil)

- **URL**: `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao='MM-DD-YYYY')?$top=100&$format=json`
- **Response format**: JSON
- **Raw response shape**:
  ```json
  { "value": [{ "cotacaoCompra": 5.7820, "dataHoraCotacao": "2026-04-30 13:00:00" }] }
  ```
- **Normalization**: Retries up to 5 previous days to handle weekends/holidays. Only returns USD→BRL. `rate = MathOps.fromNumber(cotacao.cotacaoCompra)`, `amount = "1"`. Includes `rateDate` from `dataHoraCotacao`.
- **Base**: `BRL`

### BOE (Bank of England)

- **URL**: `https://api.frankfurter.app/latest?from=GBP`
- **Response format**: JSON (via Frankfurter proxy)
- **Raw response shape**:
  ```json
  { "rates": { "USD": 1.2953, "EUR": 1.1934 } }
  ```
- **Normalization**: Frankfurter returns "1 GBP = X foreign" (indirect format). Rates are **inverted** via `MathOps.inv()` to match the "A foreign = R GBP" convention. `amount = "1"`.
- **Base**: `GBP`

### HKMA (Hong Kong Monetary Authority)

- **URL**: `https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily?offset=0&pagesize=1`
- **Response format**: JSON
- **Raw response shape**:
  ```json
  { "result": { "records": [{ "usd": 7.810, "gbp": 10.12, ... }] } }
  ```
- **Normalization**: Static field map converts lowercase fields to currency codes (e.g. `usd`→`USD`). `rate = MathOps.fromNumber(parseFloat(val))`, `amount = "1"`
- **Base**: `HKD`
- **Field map**: `usd→USD, gbp→GBP, jpy→JPY, cad→CAD, aud→AUD, sgd→SGD, twd→TWD, chf→CHF, cny→CNY, krw→KRW, thb→THB, myr→MYR, eur→EUR, php→PHP, inr→INR, idr→IDR, zar→ZAR`

### NBK (National Bank of Kazakhstan)

- **URL**: `https://nationalbank.kz/rss/get_rates.cfm?fdate=DD.MM.YYYY`
- **Response format**: RSS/XML
- **Raw response shape**: XML with `<item><title>USD</title><description>456.78</description><quant>1</quant></item>`
- **Normalization**: Today's date formatted as `DD.MM.YYYY` in URL. Regex extracts code, rate, quant. `rate = MathOps.fromNumber(parseFloat(rate))`, `amount = MathOps.parseInt(quant)`
- **Base**: `KZT`


## Concurrent Fetch Orchestration

`RateFetch.fetchAndCacheRates(sourceIds)` in `core/rate-fetch.js` orchestrates fetching:

```js
const results = await Promise.allSettled(
  sourceIds.map(async (id) => {
    const source = RATE_SOURCES[id];
    const baseRates = await source.fetchBaseRates();
    return { id, baseRates };
  })
);
```

**Error isolation**: `Promise.allSettled()` ensures one source failure does not block others. Each rejected promise carries `err.sourceId` for identification.

Three maps are built from the settled results:

### `sourceRatesMap`
Only contains successfully fetched sources. Used as input to the merge algorithm.
```js
{
  "ecb": { base: "EUR", rates: { EUR: {rate:"1",amount:"1"}, USD: {rate:"0.92",amount:"1"}, ... } },
  "nbrb": { base: "BYN", rates: { BYN: {rate:"1",amount:"1"}, USD: {rate:"3.27",amount:"1"}, ... } },
}
```

### `loadedRatesMap`
Contains **all** sources (success and failure). Stored for UI display.
```js
{
  "ecb": { source: "ecb", base: "EUR", rates: {...}, timestamp: 1746019200000 },
  "nbrb": { source: "nbrb", base: "BYN", rates: {...}, timestamp: 1746019200000 },
  "boc":  { source: "boc", error: "BOC API error: 503", timestamp: 1746019200000 },  // failed source
}
```
Successful entries may include `rateDate` if the source provides it. Failed entries have `error` instead of `rates`/`base`.

### `sourceErrors`
Simple key-value map of error messages for failed sources.
```js
{ "boc": "BOC API error: 503" }
```


## Merge Algorithm

The merge is a two-phase process in `core/rate-tables.js`.

### Phase 1: `buildRateTable()` — per source

Converts a single source's normalized rates into a bidirectional conversion table. Derives all currencies from `Object.keys(baseRates.rates)` — not filtered by conversion pairs. Given `{ base: 'EUR', rates: { USD: { rate: "0.92", amount: "1" } } }`:

```
For currency C with { rate: R, amount: A }  (R and A are strings from MathOps):
  - Meaning: A units of C = R units of BASE
  - C → BASE:  { [sourceId]: { amount: A,   rate: R,              type: 'source' } }
  - BASE → C:  { [sourceId]: { amount: MathOps.fromNumber(1),  rate: MathOps.div(A, R),  type: 'source_inversed' } }
```

All stored `amount`/`rate` values are strings — both `source` and `source_inversed` entries.

Example output for `sourceId = 'ecb'`:
```js
{
  USD: {
    EUR: { ecb: { amount: "1", rate: "0.92", type: "source" } }
  },
  EUR: {
    USD: { ecb: { amount: "1", rate: "1.087", type: "source_inversed" } }
  }
}
```

The `type` field distinguishes direct API quotes (`source`) from computed inverses (`source_inversed`). This matters for resolution priority.

### Phase 2: `buildMergedRateTable()` — combining all sources

Iterates all per-source tables and merges them via `Object.assign` at the source-tagged level. Currency set is derived entirely from the per-source rate tables — not filtered by `conversionPairs`.

```js
// For each [from][to][sourceId] across all sources:
Object.assign(merged[from][to], sourceMap);
```

This means multiple sources can contribute to the same `[from][to]` pair, each under their own source ID key.

**Result structure** (all values are strings):
```js
{
  USD: {
    EUR: {
      ecb:  { amount: "1", rate: "0.92", type: "source" },
      nbrb: { amount: "1", rate: "0.89", type: "source_inversed" },
    }
  },
  EUR: {
    USD: {
      ecb:  { amount: "1", rate: "1.087", type: "source_inversed" },
      nbrb: { amount: "1", rate: "1.124", type: "source" },
    }
  },
  // ...all other pairs from all sources
}
```


## Final Cached Data Structures

Three keys are written to `chrome.storage.local` after each fetch:

### `dollarbill_rates_v2` (merged rate table)

```js
{
  // Currency pairs: from → to → sourceId → entry
  // ALL amount/rate values are strings
  USD: {
    EUR: {
      ecb: { amount: "1", rate: "0.92", type: "source" },
      nbrb: { amount: "1", rate: "0.89", type: "source_inversed" },
    }
  },
  EUR: { ... },
  BYN: { ... },

  // Metadata keys (prefixed with _ or named explicitly)
  timestamp: 1746019200000,         // Date.now() when cached
  _usedSources: ["ecb", "nbrb"],    // Sources that returned successfully
  _sourceErrors: {                   // Sources that failed
    // "boc": "BOC API error: 503"
  },
}
```

### `dollarbill_loaded_rates` (per-source raw data)

```js
{
  ecb: {
    source: "ecb",
    base: "EUR",
    rates: {
      EUR: { rate: "1", amount: "1" },
      USD: { rate: "0.92", amount: "1" },
      // ...all currencies from this source
    },
    timestamp: 1746019200000,
  },
  nbrb: { source: "nbrb", base: "BYN", rates: {...}, timestamp: 1746019200000 },
  boc: { source: "boc", error: "BOC API error: 503", timestamp: 1746019200000 },
}
```

### `dollarbill_fetch_status` (fetch health)

```js
{
  lastFetchTime: 1746019200000,       // timestamp of last attempt (success or fail)
  lastSuccessTime: 1746019200000,     // timestamp of last successful fetch
  lastError: null,                     // error message string or null
  consecutiveFailures: 0,             // count of consecutive failures
}
```

Cache validity is checked via `RateTables.isCacheValid(rates, ttlMs)` — default TTL is 30 minutes.


## Conflict Detection

A **conflict** occurs when two or more API sources (excluding custom rates) provide a rate for the same `{from, to}` pair.

### `getConflicts(cachedRates)`

Scans the merged rate table and returns pairs with multiple API sources:

```js
{
  "USD:EUR": {
    ecb:  { amount: "1", rate: "0.92", type: "source" },
    nbrb: { amount: "1", rate: "0.89", type: "source_inversed" },
  }
}
```

Key details:
- Custom rates (`sourceId === 'custom'`) are **excluded** from conflict detection
- The pair key format is `"FROM:TO"` (e.g. `"USD:EUR"`)
- A pair needs **2+ API sources** to be considered a conflict

### `getEffectiveConflicts(settings, cachedRates)`

First merges API rates + custom rates into effective rates via `getEffectiveRates()`, then runs `getConflicts()` on the result.

### User selection override

When a conflict exists, the user can choose a preferred source via `rateSourceSelections`:

```js
settings.rateSourceSelections = [
  { from: "USD", to: "EUR", source: "ecb" }
]
```

The selection is stored in settings and consulted during resolution. `isConflictResolved()` checks whether a selection exists for a conflicting pair. `setSelection()` adds or updates a selection.


## Conversion

### `convert(amount, fromCurrency, toCurrency, rates, selections)`

The main conversion function. Tries direct path first (`from→to`), then reverse path (`to→from`):

```js
function convert(amount, from, to, rates, selections) {
  const direct = resolveAndCompute(amount, from, to, rates, selections);
  if (direct !== null) return direct;
  const reverse = resolveAndComputeInverse(amount, from, to, rates, selections);
  return reverse;
}
```

### `resolveAndCompute(amount, from, to, rates, selections)`

Looks up `rates[from][to]`, resolves the active entry, then computes using MathOps:
```js
result = MathOps.toNumber(MathOps.mul(String(amount), MathOps.div(entry.rate, entry.amount)))
```

### `resolveAndComputeInverse(amount, from, to, rates, selections)`

Looks up the reverse path `rates[to][from]`, resolves the active entry, then computes using MathOps:
```js
result = MathOps.toNumber(MathOps.div(String(amount), MathOps.div(entry.rate, entry.amount)))
```

### `resolveActiveEntry(from, to, sourceMap, selections, usedSources)`

The priority chain for choosing which source entry to use:

1. **User selection**: If `rateSourceSelections` contains a match for `{from, to}` (or `{to, from}`) and that source exists in `sourceMap`, use it.
2. **Auto-select by type preference**: Iterate `usedSources` in order. `source` type (priority 1) is preferred over `source_inversed` (priority 2). Among entries with equal priority, the first one in iteration order wins. Custom rates get `type: 'source'` and are prepended to `_usedSources` by `getEffectiveRates()`, so they effectively win among equal-priority entries.

Returns `{ amount, rate, type, source }` or `null`.

### `getEffectiveRates(settings, cachedApiRates)`

Before conversion can happen, API rates must be combined with custom rates:

1. Deep-clone the cached API rates (skipping meta keys)
2. Normalize custom rates from `settings.customRates` (format: `"FROM:TO": {rate, amount}`) into the same source-tagged structure under the `"custom"` source ID
3. Merge custom entries into the cloned table via `Object.assign`
4. Add `"custom"` to `_usedSources` if any custom rates exist

This produces the final effective rate table that `convert()` operates on.


## Helper Utilities

### `MathOps` (`core/math.js`)

`MathOps` provides string-safe arithmetic. All stored `amount`/`rate` values are strings — both direct entries (from `MathOps.fromNumber` / `MathOps.parseInt`) and inverse entries (from `MathOps.div`). Use `MathOps` for all arithmetic on rate values, and `NumberFormatter` for display formatting.

| Function | Signature | Description |
|---|---|---|
| `fromNumber(n)` | `number → string` | Converts a number to string. Returns `"0"` for NaN/null/Infinity. |
| `parseInt(s)` | `string → string` | Parses an integer (base 10). Returns `"0"` for NaN. |
| `inv(val)` | `string/number → string` | Returns `1/val` as string. Returns `"0"` for zero input. |
| `toNumber(s)` | `string → number` | Converts string to number via `parseFloat`. |
| `add/sub/mul/div` | `(a, b) → string` | Basic arithmetic returning strings. |
| `round(val, dp)` | `(val, dp) → string` | Rounds to `dp` decimal places. |
| `gt/gte/lt/eq` | `(a, b) → boolean` | Comparisons. |
| `isValid/isPositive/isZero` | `val → boolean` | Validation checks. |

### Storage Key Constants (`core/rate-fetch.js`)

| Constant | Value | Purpose |
|---|---|---|
| `CACHE_KEY` | `"dollarbill_rates_v2"` | Merged rate table |
| `LOADED_RATES_KEY` | `"dollarbill_loaded_rates"` | Per-source raw data |
| `FETCH_STATUS_KEY` | `"dollarbill_fetch_status"` | Fetch health metadata |

### Rate Type Constants (`core/rate-tables.js`)

| Constant | Value | Meaning |
|---|---|---|
| `RATE_TYPE.SOURCE` | `"source"` | Direct quote from the API |
| `RATE_TYPE.SOURCE_INVERSED` | `"source_inversed"` | Computed inverse (base→currency from a currency→base quote) |
| `CUSTOM_SOURCE` | `"custom"` | Source ID for user-defined manual rates |

### Type Preference

```js
const TYPE_PREFERENCE = { source: 1, source_inversed: 2 };
```

Lower number = higher priority. When auto-selecting (no user choice), `source` entries are preferred over `source_inversed` entries because they represent direct API quotes rather than computed inverses.

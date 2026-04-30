# Rate Pipeline

How Dollar Bill fetches exchange rates from central bank APIs, merges them into a unified rate table, and performs conversions.

## Overview

The pipeline: **central bank APIs** -> `fetchBaseRates()` per source -> **raw rate objects** (all string values) -> `buildRateTable()` per source -> **bidirectional pair maps** -> `buildMergedRateTable()` -> **merged table** -> `chrome.storage.local` -> `getEffectiveRates()` (+ custom rates) -> `convert()` -> number output.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKGROUND SCRIPT                           │
│                                                                    │
│  chrome.alarms (every 30 min) / onInstalled                        │
│       │                                                            │
│       ▼                                                            │
│  updateRates()                                                     │
│       │                                                            │
│       ▼                                                            │
│  RateFetch.fetchAndCacheRates(sourceIds)                           │
│       │                                                            │
│       ├──── Promise.allSettled ────┐                               │
│       │                            │                               │
│       ▼                            ▼                               │
│  RATE_SOURCES[id].fetchBaseRates()  ×N sources                     │
│       │                            │                               │
│       ▼                            ▼                               │
│  { base, rates: {CCY: {rate, amount}} }                            │
│       │                                                            │
│       ▼                                                            │
│  RateTables.buildMergedRateTable(sourceRatesMap)                   │
│       │                                                            │
│       ├── buildRateTable() per source                              │
│       │     Derives: c→base (type: source)                        │
│       │             base→c (type: source_inversed)                 │
│       │                                                            │
│       └── Merge into single table via Object.assign                │
│                │                                                   │
│                ▼                                                   │
│  chrome.storage.local.set({                                        │
│    dollarbill_rates_v2:    merged table + metadata,                │
│    dollarbill_loaded_rates: per-source raw data,                   │
│  })                                                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     CONSUMER (content / popup / options)            │
│                                                                    │
│  chrome.runtime.sendMessage({ type: 'getRates' })                  │
│       │                                                            │
│       ▼                                                            │
│  RateTables.getEffectiveRates(settings, cachedApiRates)            │
│       │                                                            │
│       ├── deepClone cached API rates                               │
│       └── merge in custom rates from settings                      │
│                │                                                   │
│                ▼                                                   │
│  RateTables.convert(amount, from, to, effectiveRates, selections)  │
│       │                                                            │
│       ├── resolveActiveEntry() → pick best source                  │
│       │     Priority: user selection > type pref > source order    │
│       ├── MathOps arithmetic (all string)                          │
│       └── MathOps.toNumber() → number output                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Types

### RateEntry

The atomic unit. Every rate value in the system is stored as this object.

```js
{
  rate: string,    // exchange rate, e.g. "3.2718"
  amount: string,  // unit size, e.g. "1" or "100"
  type: string     // "source" | "source_inversed" | (custom uses "source")
}
```

**Convention**: `rate / amount` is the per-unit conversion factor — how many units of `to` currency you get per 1 unit of `from`. The conversion formula is always `inputAmount * (rate / amount)`.

### SourceRawRates

What each `fetchBaseRates()` returns.

```js
{
  base: string,       // e.g. "EUR", "BYN"
  rates: {
    [currencyCode]: {
      rate: string,    // e.g. "3.2718"
      amount: string   // e.g. "1" or "100"
    }
  },
  rateDate?: string   // optional date from API
}
```

### RateTable (single source)

Output of `buildRateTable()`. A bidirectional map of currency pairs.

```js
{
  [fromCurrency]: {
    [toCurrency]: {
      [sourceId]: RateEntry
    }
  }
}
```

### MergedRateTable

The final stored structure. Multiple sources layered into one table, plus metadata.

```js
{
  // Currency pair data
  [fromCurrency]: {
    [toCurrency]: {
      [sourceId1]: RateEntry,
      [sourceId2]: RateEntry,
      // ... more sources if they provide this pair
    }
  },

  // Metadata keys (skipped by iteration via META_KEYS set)
  timestamp: number,           // Date.now() at fetch time
  _usedSources: string[],      // e.g. ["ecb", "nbrb"]
  _sourceErrors: {
    [sourceId]: string         // error message for failed sources
  }
}
```

### LoadedRates

Per-source raw data, stored separately for the "loaded rates" viewer in options.

```js
{
  [sourceId]: {
    source: string,            // source ID
    base: string,              // base currency
    rates: {                   // raw rate objects from fetchBaseRates()
      [currencyCode]: { rate: string, amount: string }
    },
    timestamp: number,
    rateDate?: string,
    error?: string             // if the fetch failed
  }
}
```

---

## Step 1: Source Definitions

**File**: `core/rate-sources.js`

Each source is an entry in `RATE_SOURCES`:

```js
{
  name: string,                     // display name
  fetchBaseRates: async () => SourceRawRates
}
```

### All Sources

| ID     | Name                          | Base | API Format | Notes |
|--------|-------------------------------|------|------------|-------|
| `nbrb` | National Bank of Belarus      | BYN  | JSON       | Uses `Cur_Scale` (amount) and `Cur_OfficialRate` (rate). Some currencies use amount=100. |
| `ecb`  | European Central Bank         | EUR  | XML        | ECB quotes foreign currency per 1 EUR (e.g. 1 EUR = 1.085 USD); inverted via `MathOps.inv()` to match our convention. amount always "1". |
| `nbp`  | National Bank of Poland       | PLN  | JSON       | `mid` rate, amount always "1". |
| `nbu`  | National Bank of Ukraine      | UAH  | JSON       | Requires today's date in `YYYYMMDD` format. amount always "1". |
| `cbr`  | Bank of Russia                | RUB  | XML        | Parses `CharCode`, `Nominal`, `Value`. Some currencies use nominal > 1. |
| `cnb`  | Czech National Bank           | CZK  | XML        | Parses `kod`, `mnozstvi`, `kurz` from XML attributes. |
| `tcmb` | Central Bank of Turkey        | TRY  | XML        | Uses `ForexBuying` rate and `Unit` for amount. |
| `boc`  | Bank of Canada                | CAD  | JSON       | Fetches last 5 days, uses latest observation. Named series like `FXUSDCAD`. |
| `bcb`  | Central Bank of Brazil        | BRL  | JSON       | Only provides USD/BRL. Tries up to 5 previous days for weekends/holidays. |
| `boe`  | Bank of England               | GBP  | JSON       | Uses Frankfurter API as proxy. Rates are inverted via `MathOps.inv()`. |
| `hkma` | Hong Kong Monetary Authority  | HKD  | JSON       | Field map converts lowercase API fields to ISO codes. |
| `nbk`  | National Bank of Kazakhstan   | KZT  | XML        | Parses `title`, `description`, `quant` from RSS XML. |

### How raw API values become strings

All sources convert API numbers to strings using `MathOps`:

- `MathOps.fromNumber(n)` — float to string (`3.2718` -> `"3.2718"`)
- `MathOps.parseInt(s)` — integer to string (`100` -> `"100"`)
- `MathOps.inv(val)` — reciprocal as string (`"1.085"` -> `"0.9217"`)

The base currency always gets the identity rate: `{ rate: "1", amount: "1" }`.

---

## Step 2: Fetch Orchestration

**File**: `core/rate-fetch.js`
**Triggered by**: `background.js` via `updateRates()` on install and every 30 minutes.

### `fetchAndCacheRates(sourceIds)`

**Input**: `sourceIds` — string or array of source IDs (e.g. `["nbrb", "ecb"]`). Defaults from `settings.rateSources`.

**Flow**:

1. Normalize to array. If empty, store empty rates and return.
2. Call all sources concurrently via `Promise.allSettled()`.
3. Separate results into:
   - `sourceRatesMap` — successful `{ [id]: SourceRawRates }`
   - `loadedRatesMap` — per-source raw data (with deep-copied rates)
   - `sourceErrors` — `{ [id]: errorMessage }` for failures
4. Call `RateTables.buildMergedRateTable(sourceRatesMap)` to merge.
5. Attach metadata: `timestamp`, `_usedSources`, `_sourceErrors`.
6. Write to `chrome.storage.local`:
   - Key `dollarbill_rates_v2` — the merged table
   - Key `dollarbill_loaded_rates` — per-source raw data
7. Return the merged rates.

### Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `dollarbill_rates_v2` | `MergedRateTable` | The merged rate table used for conversions |
| `dollarbill_loaded_rates` | `LoadedRates` | Per-source raw data for the options page viewer |
| `dollarbill_fetch_status` | `{ lastFetchTime, lastSuccessTime, lastError, consecutiveFailures }` | Fetch health tracking |
| `dollarbill_settings` | Settings object | User config (source selections, custom rates, etc.) |

---

## Step 3: Rate Table Building

**File**: `core/rate-tables.js` — `buildRateTable(baseRates, sourceId)`

Transforms one source's raw rates into a bidirectional pair map.

### Input

`baseRates` — a `SourceRawRates` object, e.g. from NBRB:
```js
{
  base: "BYN",
  rates: {
    BYN: { rate: "1", amount: "1" },
    USD: { rate: "3.2718", amount: "1" },
    RUB: { rate: "3.56", amount: "100" }   // 100 RUB = 3.56 BYN
  }
}
```

### Derivation

For each currency `c` with `{ rate: X, amount: A }` (meaning A units of `c` = X units of base):

| Direction | RateEntry | Meaning |
|-----------|-----------|---------|
| `c → base` | `{ amount: A, rate: X, type: "source" }` | A units of `c` = X units of base |
| `base → c` | `{ amount: "1", rate: A/X, type: "source_inversed" }` | 1 unit of base = A/X units of `c` |

The inverse is computed as `MathOps.div(cData.amount, cData.rate)`.

### Output

```js
{
  BYN: { RUB: { nbrb: { amount: "1", rate: "28.09...", type: "source_inversed" } } },
  RUB: { BYN: { nbrb: { amount: "100", rate: "3.56", type: "source" } } },
  USD: { BYN: { nbrb: { amount: "1", rate: "3.2718", type: "source" } } },
  BYN: { USD: { nbrb: { amount: "1", rate: "0.3057...", type: "source_inversed" } } },
  // ... all other currencies from the source
}
```

---

## Step 4: Merging Multiple Sources

**File**: `core/rate-tables.js` — `buildMergedRateTable(sourceRatesMap)`

### Merge Strategy

1. Build a `RateTable` per source using `buildRateTable()`.
2. Walk each per-source table and `Object.assign()` the source entries into the merged table.

This means if NBRB says USD→BYN and ECB says USD→BYN, the merged entry becomes:
```js
{
  USD: {
    BYN: {
      nbrb: { amount: "1", rate: "3.2718", type: "source_inversed" },
      ecb:  { amount: "1", rate: "3.2650", type: "source" }
    }
  }
}
```

Multiple sources providing the same pair create a **conflict** (different rates for the same conversion).

### Conflict Detection — `getConflicts(cachedRates)`

Scans the merged table for pairs where more than one non-custom source provides a rate. Returns:
```js
{
  "USD:BYN": {
    nbrb: { amount: "1", rate: "3.2718", type: "source_inversed" },
    ecb:  { amount: "1", rate: "3.2650", type: "source" }
  }
}
```

Custom rates (`sourceId === "custom"`) are excluded from conflict detection.

### Resolution — `resolveActiveEntry(from, to, sourceMap, selections, usedSources)`

When a pair has multiple sources, picks one:

1. **User selection** — if the user chose a source for this pair in settings, use it.
2. **Type preference** — `source` (priority 1) > `source_inversed` (priority 2). Direct rates are preferred over computed inverses.
3. **Source order** — first source in `_usedSources` wins as tiebreaker.

Returns the selected `RateEntry` with an added `source` field:
```js
{ amount: "1", rate: "3.2650", type: "source", source: "ecb" }
```

---

## Step 5: Custom Rates

**File**: `core/rate-tables.js` — `getCustomRates(settings)` + `getEffectiveRates()`

Custom rates are stored in settings as:
```js
settings.customRates = {
  "USD:BYN": { amount: 1, rate: 3.3 },    // current format
  "EUR:USD": 1.05,                          // legacy format (treated as amount=1)
}
```

`getCustomRates()` normalizes these into the same `RateEntry` format with `sourceId = "custom"` and `type = "source"`.

`getEffectiveRates(settings, cachedApiRates)` produces the final working table:

1. Deep-clone the cached API rates (if valid per 30-min TTL).
2. Merge custom rates on top via `Object.assign`.
3. Add `"custom"` to `_usedSources` if any custom rates exist.

Custom rates always win for their specific pair because `getEffectiveRates()` prepends `"custom"` to `_usedSources` (line 235: `[CUSTOM_SOURCE, ...base._usedSources]`). In `resolveActiveEntry()`, when type preference ties (both `"source"`), the source-order tiebreaker picks the first entry in `_usedSources` — which is `"custom"`.

---

## Step 6: Conversion

**File**: `core/rate-tables.js` — `convert(amount, fromCurrency, toCurrency, rates, selections)`

**Input**: `amount` (string or number), currency codes, the effective rate table, user selections.
**Output**: `number` (via `MathOps.toNumber()` at the boundary).

### Flow

1. **Direct lookup** (`resolveAndCompute`):
   - Look up `rates[from][to]`
   - `resolveActiveEntry()` picks the best source
   - Compute: `amount × (rate / amount)` — i.e. scale the input by the per-unit rate
   - All arithmetic via `MathOps` (string in, string out)
   - Return `MathOps.toNumber(result)` as a number

2. **Inverse fallback** (`resolveAndComputeInverse`):
   - If direct lookup returns `null`, try `rates[to][from]`
   - Resolve the active entry for the reverse pair
   - Compute: `amount / (rate / amount)` — divide input by the per-unit reverse rate
   - Return `MathOps.toNumber(result)` as a number

If both return `null`, conversion is not possible (currencies not connected through any source).

### Formula

Given a `RateEntry` with `{ rate: X, amount: A }` for the pair from→to:
- **Direct**: `result = inputAmount × (X / A)`
- **Inverse**: `result = inputAmount / (X / A)`

---

## Step 7: String Arithmetic

**File**: `core/math.js`

All rate/amount values in storage and internal computation are **strings**. This avoids floating-point representation issues in JSON serialization and makes the boundary between numeric computation and stored values explicit.

### MathOps API

All functions accept string or number inputs. Arithmetic functions return strings.

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `add(a, b)` | string, string → string | `a + b` | |
| `sub(a, b)` | string, string → string | `a - b` | |
| `mul(a, b)` | string, string → string | `a × b` | |
| `div(a, b)` | string, string → string | `a / b` | Returns `"0"` on div-by-zero |
| `round(val, dp)` | string, number → string | rounded to dp decimals | |
| `inv(val)` | string → string | `1 / val` | Returns `"0"` for zero input |
| `fromNumber(n)` | number → string | string representation | Returns `"0"` for NaN/Infinity |
| `toNumber(s)` | string → number | parsed float | Boundary function — used at convert() output |
| `parseInt(s)` | string → string | integer as string | Returns `"0"` for NaN |
| `gt/gte/lt/eq` | string, string → boolean | comparison | |
| `isValid(val)` | any → boolean | not NaN, not Infinity | |
| `isPositive(val)` | any → boolean | > 0 | |
| `isZero(val)` | any → boolean | === 0 | |

---

## Background Script Triggers

**File**: `background.js`

| Event | Action |
|-------|--------|
| `chrome.runtime.onInstalled` | Fetch rates immediately, set 30-min alarm |
| `chrome.alarms.onAlarm` (every 30 min) | `updateRates()` — fetch all enabled sources |
| Message `getRates` | Return cached rates from storage |
| Message `updateRates` | Fetch + return rates, status, and loaded rates |
| Message `getSettings` | Return settings (runs migrations) |
| Message `getFetchStatus` | Return fetch health status |
| Message `getLoadedRates` | Return per-source raw data |

### Cache TTL

`RateTables.isCacheValid()` uses a 30-minute TTL (`30 * 60 * 1000` ms). `getEffectiveRates()` checks this before using cached data — expired caches produce an empty base table.

---

## Module Dependency Graph

```
core/math.js              (no deps — foundational)
      │
      ├──────────────────────┐
      ▼                      ▼
core/rate-sources.js    core/rate-tables.js
(depends on MathOps)    (depends on MathOps)
      │                      │
      └──────────┬───────────┘
                 ▼
         core/rate-fetch.js    (depends on RateSources, RateTables, Settings)
                 │
                 ▼
         core/rates.js         (facade — re-exports RateSources, RateTables, RateFetch, FormatUtils, Patterns)
```

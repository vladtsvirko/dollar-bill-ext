# Rate Source Extraction — Deep Dive

This document traces how each of the 12 rate sources extracts exchange rate data, and how the rate pipeline converts it into usable rates.

## Pipeline Overview

1. `fetchBaseRates()` → raw API → `{ base, rates }` where `rates[code] = { rate, amount }` (inverted to direct format at extraction if needed)
2. `buildRateTable()` → per-unit rate computation, divides `rate / amount` during calculation
3. `buildMergedRateTable()` → merge multiple sources, detect conflicts
4. `getEffectiveRates()` → apply user overrides + custom rates

### Rate Format

Each rate entry is `{ rate: Number, amount: Number }`. All sources normalize to **direct format** during extraction: `rates[code]` means "A code = rate base" (where A = amount). Sources that return indirect rates (ECB, BOE via Frankfurter) invert at extraction. The `amount` is the denomination (e.g. 100 for JPY in NBRB). Per-unit computation happens during conversion.

Sources that don't use denominations always set `amount: 1`.

### Conversion Formulas

- **Direct path** (`from → to` exists): `amount * (entry.rate / entry.amount)`
- **Reverse path** (`to → from` exists): `amount / (entry.rate / entry.amount)`

### Rate Types

After `buildRateTable()`, each entry is tagged with a type:
- `source` — direct pair from the source (rate as provided)
- `source_inversed` — inverse of a direct source pair

When multiple sources provide the same pair, auto-selection prefers: `source > source_inversed`.

### Cross-Source Validation Baseline

All sources should produce roughly the same USD→EUR rate (~0.85 in late April 2026). Used to validate each source independently.

---

## Source 1: NBRB (National Bank of Belarus)

**API**: `https://api.nbrb.by/exrates/rates?periodicity=0`

**Raw response** (example):
```json
[
  {"Cur_Abbreviation":"USD","Cur_Scale":1,"Cur_OfficialRate":3.1770},
  {"Cur_Abbreviation":"EUR","Cur_Scale":1,"Cur_OfficialRate":3.4651},
  {"Cur_Abbreviation":"GBP","Cur_Scale":1,"Cur_OfficialRate":4.1094},
  {"Cur_Abbreviation":"JPY","Cur_Scale":100,"Cur_OfficialRate":2.1556},
  {"Cur_Abbreviation":"PLN","Cur_Scale":10,"Cur_OfficialRate":8.2529},
  {"Cur_Abbreviation":"RUB","Cur_Scale":100,"Cur_OfficialRate":3.5985}
]
```

**Extraction code** (`rate-sources.js`):
```js
rates[item.Cur_Abbreviation] = { rate: item.Cur_OfficialRate, amount: item.Cur_Scale };
```

**Extraction trace**:
- USD: `{ rate: 3.1770, amount: 1 }` → stored as-is
- EUR: `{ rate: 3.4651, amount: 1 }` → stored as-is
- JPY: `{ rate: 2.1556, amount: 100 }` → no pre-division
- PLN: `{ rate: 8.2529, amount: 10 }` → no pre-division

`Cur_Scale` is stored as `amount` — the per-unit division happens during conversion.

**Cross-rate trace** (USD→EUR):
```
(3.1770/1) / (3.4651/1) = 0.9169 → 1 USD ≈ 0.917 EUR
```

---

## Source 2: ECB (European Central Bank)

**API**: `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`

**Raw format** (XML):
```xml
<Cube time='2026-04-24'>
  <Cube currency='USD' rate='1.1360'/>
  <Cube currency='JPY' rate='162.25'/>
  <Cube currency='GBP' rate='0.8448'/>
  <Cube currency='CHF' rate='0.9210'/>
</Cube>
```

**Extraction code** (`rate-sources.js`):
```js
const re = /currency='([A-Z]{3})'\s+rate='([\d.]+)'/g;
let match;
while ((match = re.exec(text)) !== null) {
  const val = parseFloat(match[2]);
  rates[match[1]] = { rate: val !== 0 ? 1 / val : 0, amount: 1 };
}
```

ECB returns indirect rates (1 EUR = X foreign). The extraction inverts to direct format (1 foreign = X EUR).

**Extraction trace**:
- `rates[USD] = { rate: 0.8803, amount: 1 }` → 1 USD = 0.8803 EUR (inverted from 1.1360)
- `rates[JPY] = { rate: 0.00616, amount: 1 }` → 1 JPY = 0.00616 EUR (inverted from 162.25)
- `rates[GBP] = { rate: 1.1837, amount: 1 }` → 1 GBP = 1.1837 EUR (inverted from 0.8448)

**Cross-rate trace** (USD→JPY):
```
(0.8803/1) / (0.00616/1) = 142.90 → 1 USD ≈ 142.90 JPY
```

---

## Source 3: NBP (National Bank of Poland)

**API**: `https://api.nbp.pl/api/exchangerates/tables/A/`

**Raw response** (Table A, typical):
```
USD: mid=3.6356
EUR: mid=4.2537
GBP: mid=4.9076
JPY: mid=0.022761
CHF: mid=4.6041
CZK: mid=0.1745
SEK: mid=0.3922
```

**Extraction code** (`rate-sources.js`):
```js
for (const item of data[0].rates) {
  rates[item.code] = { rate: item.mid, amount: 1 };
}
```

**Extraction trace**:
- `rates[USD] = { rate: 3.6356, amount: 1 }` → 1 USD = 3.6356 PLN
- `rates[EUR] = { rate: 4.2537, amount: 1 }` → 1 EUR = 4.2537 PLN
- `rates[JPY] = { rate: 0.022761, amount: 1 }` → 1 JPY = 0.022761 PLN (already per 1 JPY, not per 100)

**Cross-rate trace** (USD→EUR):
```
(3.6356/1) / (4.2537/1) = 0.8547 → 1 USD ≈ 0.855 EUR
```

---

## Source 4: NBU (National Bank of Ukraine)

**API**: `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json&date=YYYYMMDD`

**Raw response** (example):
```json
[
  {"cc":"USD","rate":44.0735},
  {"cc":"EUR","rate":51.4999},
  {"cc":"GBP","rate":59.3582},
  {"cc":"JPY","rate":0.27586},
  {"cc":"PLN","rate":12.1218},
  {"cc":"CHF","rate":55.7399}
]
```

**Extraction code** (`rate-sources.js`):
```js
for (const item of data) {
  rates[item.cc] = { rate: item.rate, amount: 1 };
}
```

**Extraction trace**:
- `rates[USD] = { rate: 44.0735, amount: 1 }` → 1 USD = 44.0735 UAH
- `rates[EUR] = { rate: 51.4999, amount: 1 }` → 1 EUR = 51.4999 UAH

**Cross-rate trace** (USD→EUR):
```
(44.0735/1) / (51.4999/1) = 0.8558 → 1 USD ≈ 0.856 EUR
```

---

## Source 5: CBR (Bank of Russia)

**API**: `https://www.cbr.ru/scripts/XML_daily_eng.asp`

**Raw response** (XML, parsed from text):
```
CharCode: USD, Nominal: 1, Value: 79,9589
CharCode: EUR, Nominal: 1, Value: 92,6816
CharCode: JPY, Nominal: 100, Value: 52,4321
CharCode: TRY, Nominal: 10, Value: 19,1486
CharCode: KRW, Nominal: 1000, Value: 56,0054
```

**Extraction code** (`rate-sources.js`):
```js
const re = /<CharCode>([A-Z]{3})<\/CharCode>\s*<Nominal>(\d+)<\/Nominal>\s*<Name>[^<]*<\/Name>\s*<Value>([\d.,]+)<\/Value>/g;
rates[code] = { rate: parseFloat(value.replace(',', '.')), amount: parseInt(nominal, 10) };
```

**Extraction trace**:
- USD: `{ rate: 79.9589, amount: 1 }` → stored as-is
- EUR: `{ rate: 92.6816, amount: 1 }` → stored as-is
- JPY: `{ rate: 52.4321, amount: 100 }` → no pre-division
- TRY: `{ rate: 19.1486, amount: 10 }` → no pre-division
- KRW: `{ rate: 56.0054, amount: 1000 }` → no pre-division

Comma-to-dot conversion handles Russian decimal format. `Nominal` stored as `amount` — per-unit division deferred to cross-rate computation.

**Cross-rate trace** (USD→EUR):
```
(79.9589/1) / (92.6816/1) = 0.8627 → 1 USD ≈ 0.863 EUR
```

---

## Source 6: CNB (Czech National Bank)

**API**: `https://www.cnb.cz/cs/.../denni_kurz.xml`

**Raw format** (XML):
```xml
<radek kod="USD" mnozstvi="1" kurz="22,850"/>
<radek kod="EUR" mnozstvi="1" kurz="24,660"/>
<radek kod="JPY" mnozstvi="100" kurz="15,270"/>
```

**Extraction code** (`rate-sources.js`):
```js
const re = /<radek\s[^>]*kod="([A-Z]{3})"[^>]*mnozstvi="(\d+)"[^>]*kurz="([\d.,]+)"/g;
rates[code] = { rate: parseFloat(rate.replace(',', '.')), amount: parseInt(amount, 10) };
```

**Extraction trace** (typical values):
- USD: `{ rate: 22.850, amount: 1 }` → stored as-is
- EUR: `{ rate: 24.660, amount: 1 }` → stored as-is
- JPY: `{ rate: 15.270, amount: 100 }` → no pre-division

`mnozstvi` (amount) stored as `amount`. `kurz` (rate) uses comma decimals.

**Cross-rate trace** (USD→EUR, typical):
```
(22.850/1) / (24.660/1) = 0.9266 → 1 USD ≈ 0.927 EUR
```

---

## Source 7: TCMB (Central Bank of Turkey)

**API**: `https://www.tcmb.gov.tr/kurlar/today.xml`

**Raw format** (XML):
```xml
<Currency CurrencyCode="USD">
  <Unit>1</Unit>
  <ForexBuying>38.4521</ForexBuying>
</Currency>
<Currency CurrencyCode="EUR">
  <Unit>1</Unit>
  <ForexBuying>44.1230</ForexBuying>
</Currency>
```

**Extraction code** (`rate-sources.js`):
```js
const re = /<Currency\s[^>]*CurrencyCode="([A-Z]{3})"[^>]*>[\s\S]*?<Unit>(\d+)<\/Unit>[\s\S]*?<ForexBuying>([\d.,]+)<\/ForexBuying>/g;
rates[code] = { rate: parseFloat(buying.replace(',', '.')), amount: parseInt(unit, 10) };
```

**Extraction trace** (typical values):
- USD: `{ rate: 38.4521, amount: 1 }` → 1 USD = 38.45 TRY
- EUR: `{ rate: 44.1230, amount: 1 }` → 1 EUR = 44.12 TRY

**Note**: Uses `ForexBuying` (bid rate), not `ForexSelling` (ask) or a mid-rate. This is a design choice — bid is typically slightly lower, giving marginally conservative conversions.

**Cross-rate trace** (USD→EUR, typical):
```
(38.4521/1) / (44.1230/1) = 0.8716 → 1 USD ≈ 0.872 EUR
```

---

## Source 8: BOC (Bank of Canada)

**API**: `https://www.bankofcanada.ca/valet/observations/{FX_PAIRS}/json?start_date=...`

**Raw response** (latest observation):
```json
{
  "observations": [
    {"d":"2026-04-28","FXUSDCAD":{"v":"1.3678"},"FXEURCAD":{"v":"1.6009"},
     "FXGBPCAD":{"v":"1.8471"},"FXJPYCAD":{"v":"0.008570"},
     "FXCHFCAD":{"v":"1.7320"},"FXAUDCAD":{"v":"0.9813"},
     "FXBRLCAD":{"v":"0.2742"},"FXCNYCAD":{"v":"0.2000"},
     "FXHKDCAD":{"v":"0.1745"},"FXTRYCAD":{"v":"0.03040"},
     "FXKRWCAD":{"v":"0.000928"},"FXSGDCAD":{"v":"1.0712"}}
  ]
}
```

**Extraction code** (`rate-sources.js`):
```js
for (const [key, val] of Object.entries(latest)) {
  if (key === 'd') continue;
  const match = key.match(/^FX([A-Z]{3})CAD$/);
  if (match && val && val.v) {
    rates[match[1]] = { rate: parseFloat(val.v), amount: 1 };
  }
}
```

**Extraction trace**:
- `FXUSDCAD` → `rates[USD] = { rate: 1.3678, amount: 1 }` → 1 USD = 1.3678 CAD
- `FXEURCAD` → `rates[EUR] = { rate: 1.6009, amount: 1 }` → 1 EUR = 1.6009 CAD
- `FXJPYCAD` → `rates[JPY] = { rate: 0.008570, amount: 1 }` → 1 JPY = 0.008570 CAD

Series naming `FX{FROM}CAD` means "1 FROM in CAD" — direct format.

**Series list** (23 pairs): FXUSDCAD, FXEURCAD, FXJPYCAD, FXCHFCAD, FXGBPCAD, FXAUDCAD, FXBRLCAD, FXCNYCAD, FXHKDCAD, FXINRCAD, FXIDRCAD, FXMXNCAD, FXNZDCAD, FXNOKCAD, FXPENCAD, FXRUBCAD, FXSARCAD, FXSGDCAD, FXZARCAD, FXKRWCAD, FXSEKCAD, FXTWDCAD, FXTRYCAD

**Cross-rate trace** (USD→EUR):
```
(1.3678/1) / (1.6009/1) = 0.8544 → 1 USD ≈ 0.854 EUR
```

---

## Source 9: BCB (Central Bank of Brazil)

**API**: `https://olinda.bcb.gov.br/.../CotacaoDolarDia(dataCotacao='MM-DD-YYYY')`

**Raw response** (when data available):
```json
{"value": [{"cotacaoCompra": 5.7320, "dataHoraCotacao": "2026-04-28 13:05:00.000"}]}
```

The code tries up to 5 previous days until it finds data (Brazilian holidays can cause empty responses).

**Extraction code** (`rate-sources.js`):
```js
const cotacao = data.value[0];
rates.USD = { rate: cotacao.cotacaoCompra, amount: 1 };
return { base: 'BRL', rates, rateDate: cotacao.dataHoraCotacao };
```

**Extraction trace**:
- `rates.USD = { rate: 5.732, amount: 1 }` → 1 USD = 5.732 BRL

Uses `cotacaoCompra` (purchase/bid rate) — slightly lower than mid-rate, same approach as TCMB.

**Limitation**: Only provides USD↔BRL. All other currency pairs are unavailable from this source. This is an API limitation, not a code bug.

---

## Source 10: BOE (Bank of England)

**API**: `https://api.frankfurter.app/latest?from=GBP`
(BOE retired their IADB API — using Frankfurter as replacement)

**Raw response**:
```json
{
  "amount": 1.0,
  "base": "GBP",
  "date": "2026-04-24",
  "rates": {
    "AUD": 1.8885, "CAD": 1.8459, "CHF": 1.0598, "CNY": 9.224,
    "EUR": 1.152, "HKD": 10.5714, "INR": 127.17, "JPY": 215.1,
    "KRW": 1992.91, "SGD": 1.7222, "USD": 1.3493, "ZAR": 22.346
  }
}
```

**Meaning**: Frankfurter returns indirect rates (1 GBP = X foreign). The extraction inverts to direct format (1 foreign = X GBP).

**Extraction code** (`rate-sources.js`):
```js
const rates = { GBP: { rate: 1, amount: 1 } };
for (const [code, val] of Object.entries(data.rates)) {
  rates[code] = { rate: val !== 0 ? 1 / val : 0, amount: 1 };
}
return { base: 'GBP', rates };
```

**Extraction trace**:
- `rates[USD] = { rate: 0.7412, amount: 1 }` → 1 USD = 0.7412 GBP (inverted from 1.3493)
- `rates[EUR] = { rate: 0.8681, amount: 1 }` → 1 EUR = 0.8681 GBP (inverted from 1.152)

**Cross-rate trace** (USD→EUR):
```
(0.7412/1) / (0.8681/1) = 0.8539 → 1 USD ≈ 0.854 EUR
```

---

## Source 11: HKMA (Hong Kong Monetary Authority)

**API**: `https://api.hkma.gov.hk/.../er-eeri-daily?offset=0&pagesize=1`

**Raw response**:
```json
{
  "result": {
    "records": [{
      "end_of_day": "2026-03-31",
      "usd": 7.839, "gbp": 10.35, "eur": 8.995, "jpy": 0.049065,
      "cad": 5.625, "aud": 5.371, "sgd": 6.0765, "twd": 0.255,
      "chf": 9.804, "cny": 1.1343, "krw": 0.005129, "thb": 0.2386,
      "myr": 1.762, "php": 0.1382, "inr": 0.0924, "idr": 0.000481,
      "zar": 0.4193
    }]
  }
}
```

**Meaning**: "HKD per 1 foreign unit" — direct format. Validation:
- USD=7.839 → 1 USD = 7.839 HKD (HKD pegged at ~7.8)
- JPY=0.049065 → per 1 JPY (not per 100) → 1 USD = 7.839/0.049 = ~159.8 JPY
- KRW=0.005129 → per 1 KRW (not per 1000) → 1 USD = 7.839/0.005129 = ~1528 KRW

**Extraction code** (`rate-sources.js`):
```js
const fieldMap = {
  usd: 'USD', gbp: 'GBP', jpy: 'JPY', cad: 'CAD', aud: 'AUD',
  sgd: 'SGD', twd: 'TWD', chf: 'CHF', cny: 'CNY', krw: 'KRW',
  thb: 'THB', myr: 'MYR', eur: 'EUR', php: 'PHP', inr: 'INR',
  idr: 'IDR', zar: 'ZAR',
};
for (const [field, code] of Object.entries(fieldMap)) {
  const val = latest[field];
  if (val != null) rates[code] = { rate: parseFloat(val), amount: 1 };
}
```

**Cross-rate trace** (USD→EUR):
```
(7.839/1) / (8.995/1) = 0.8714 → 1 USD ≈ 0.871 EUR
```

**Note**: EERI dataset updates monthly — rates can be up to ~30 days stale. This is an inherent limitation of the HKMA EERI endpoint, not a code bug.

---

## Source 12: NBK (National Bank of Kazakhstan)

**API**: `https://nationalbank.kz/rss/get_rates.cfm?fdate=DD.MM.YYYY`

**Raw response** (XML/RSS):
```xml
<item>
  <fullname>US Dollar</fullname>
  <title>USD</title>
  <description>457.21</description>
  <quant>1</quant>
</item>
<item>
  <title>KRW</title>
  <description>31.01</description>
  <quant>100</quant>
</item>
```

**Extraction code** (`rate-sources.js`):
```js
const re = /<item>\s*<fullname>[^<]*<\/fullname>\s*<title>([A-Z]{3})<\/title>\s*<description>([\d.]+)<\/description>\s*<quant>(\d+)<\/quant>/g;
rates[code] = { rate: parseFloat(rate), amount: parseInt(quant, 10) };
```

**Extraction trace**:
- USD: `{ rate: 457.21, amount: 1 }` → stored as-is
- EUR: `{ rate: 534.62, amount: 1 }` → stored as-is
- KRW: `{ rate: 31.01, amount: 100 }` → no pre-division
- HUF: `{ rate: 14.65, amount: 10 }` → no pre-division

`quant` stored as `amount` — per-unit division deferred to cross-rate computation.

**Cross-rate trace** (USD→EUR):
```
(457.21/1) / (534.62/1) = 0.8552 → 1 USD ≈ 0.855 EUR
```

---

## Cross-Source Consistency Check

All live-fetched sources produce consistent USD→EUR rates:

| Source | USD→EUR | Date |
|---|---|---|
| NBP | 0.8547 | 2026-04-29 |
| NBU | 0.8558 | 2026-04-29 |
| CBR | 0.8627 | live |
| BOC | 0.8544 | 2026-04-28 |
| NBK | 0.8552 | 2026-04-29 |
| BOE | 0.8538 | 2026-04-24 |
| HKMA | 0.8714 | 2026-03-31 |

All within expected range (~0.85). Minor variations are normal between central bank reporting times and methodologies.

---

## Observations

1. **BCB limited to USD**: The Brazilian Central Bank API only provides USD↔BRL rates. All other currency pairs are unavailable from this source.
2. **TCMB uses bid rate**: Uses `ForexBuying` (bid) rather than mid or ask. This gives marginally conservative conversions.
3. **BCB also uses bid rate**: Uses `cotacaoCompra` (purchase/bid) for the same reason.
4. **HKMA monthly staleness**: The EERI dataset updates monthly, so rates can be up to ~30 days stale.
5. **Denomination handling**: NBRB (`Cur_Scale` → `amount`), CBR (`Nominal` → `amount`), CNB (`mnozstvi` → `amount`), NBK (`quant` → `amount`) all store the raw rate and denomination separately. Per-unit normalization is deferred to conversion via `rate / amount`, not done at extraction time.
6. **Rate type system**: `buildRateTable()` tags each entry as `source` or `source_inversed`. When multiple sources provide the same currency pair, auto-selection prefers `source` over `source_inversed` (via `TYPE_PREFERENCE`). User selections override auto-selection.
7. **HKMA expanded coverage**: The `fieldMap` includes 17 currencies (USD, GBP, JPY, CAD, AUD, SGD, TWD, CHF, CNY, KRW, THB, MYR, EUR, PHP, INR, IDR, ZAR).

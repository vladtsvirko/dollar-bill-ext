const RatesUtil = (() => {
  const DEFAULT_CURRENCIES = {
    BYN: {
      name: 'Belarusian Ruble',
      symbol: 'Br',
      patterns: [
        '(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)\\s*(?:BYN|бел\\.?\\s*руб\\.?|Br|р\\.?\\s*бел)',
        '(?:BYN|бел\\.?\\s*руб\\.?|Br)\\s*(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)',
      ],
      tld: 'by',
    },
    RUB: {
      name: 'Russian Ruble',
      symbol: '₽',
      patterns: [
        '(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)\\s*(?:RUB|₽)',
        '(?:RUB|₽)\\s*(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)',
      ],
      tld: 'ru',
    },
    USD: {
      name: 'US Dollar',
      symbol: '$',
      patterns: [
        '(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)\\s*(?:USD|\\$)',
        '(?:USD|\\$)\\s*(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)',
      ],
      tld: null,
    },
    EUR: {
      name: 'Euro',
      symbol: '€',
      patterns: [
        '(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)\\s*(?:EUR|€)',
        '(?:EUR|€)\\s*(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)',
      ],
      tld: null,
    },
  };

  const DEFAULT_SETTINGS = {
    enabled: true,
    currencies: JSON.parse(JSON.stringify(DEFAULT_CURRENCIES)),
    sourceCurrencies: ['BYN', 'RUB'],
    targetCurrencies: ['USD', 'EUR'],
    ambiguousPatterns: [
      '(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)\\s*руб\\.',
      '(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)\\s*р\\.',
      'руб\\.\\s*(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)',
      'р\\.\\s*(\\d[\\d\\s]*(?:[.,]\\d{1,2})?)',
    ],
    rateSource: 'nbrb',
    customRates: {},
    domainCurrencyMap: {},
    siteMode: 'all',
    whitelist: [],
  };

  const RATE_SOURCES = {
    nbrb: {
      name: 'National Bank of Belarus',
      convention: 'direct',
      fetchBaseRates: async (codes) => {
        const resp = await fetch('https://api.nbrb.by/exrates/rates?periodicity=0');
        if (!resp.ok) throw new Error(`NBRB API error: ${resp.status}`);
        const data = await resp.json();
        const rates = { BYN: 1 };
        for (const item of data) {
          if (codes.includes(item.Cur_Abbreviation)) {
            rates[item.Cur_Abbreviation] = item.Cur_OfficialRate / item.Cur_Scale;
          }
        }
        return { base: 'BYN', rates };
      },
    },
    ecb: {
      name: 'European Central Bank',
      convention: 'indirect',
      fetchBaseRates: async (codes) => {
        const resp = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
        if (!resp.ok) throw new Error(`ECB API error: ${resp.status}`);
        const text = await resp.text();
        const parseXmlRate = (currency) => {
          const match = text.match(new RegExp(`currency='${currency}'\\s+rate='([\\d.]+)'`));
          return match ? parseFloat(match[1]) : null;
        };
        const rates = { EUR: 1 };
        for (const code of codes) {
          if (code === 'EUR') continue;
          const r = parseXmlRate(code);
          if (r != null) {
            // ECB gives "1 EUR = X foreign", so baseRates[code] = r means 1 EUR = r * code
            rates[code] = r;
          }
        }
        return { base: 'EUR', rates };
      },
    },
  };

  const CACHE_KEY = 'dollarbill_rates';
  const SETTINGS_KEY = 'dollarbill_settings';

  function buildRateTable(baseRates, sources, targets) {
    const { base, rates } = baseRates;
    const result = {};
    const all = [...new Set([...sources, ...targets])];
    // Ensure base currency is always in the matrix for cross-rate computation
    if (!all.includes(base)) all.push(base);

    for (const from of all) {
      result[from] = {};
      for (const to of all) {
        if (from === to) continue;
        const fromInBase = rates[from];
        const toInBase = rates[to];
        if (fromInBase == null || toInBase == null) continue;
        // crossRate: how many `to` units per 1 `from`
        // rates[X] = "how many base units per 1 X" for NBRB (base=BYN)
        // For ECB (base=EUR): rates[X] = "1 EUR = X foreign units"
        // crossRate(from, to) = rates[from] / rates[to] works for NBRB
        // For ECB: rates[USD] = 1.09 means 1 EUR = 1.09 USD
        //   crossRate(EUR, USD) = rates[EUR]/rates[USD] = 1/1.09 — wrong, should be 1.09
        // So for ECB we need: crossRate = rates[to] / rates[from]
        if (baseRates.convention === 'indirect') {
          // rates[X] = "1 base = X foreign" — invert
          result[from][to] = toInBase / fromInBase;
        } else {
          // rates[X] = "how many base units per 1 X" (direct, e.g. NBRB)
          result[from][to] = fromInBase / toInBase;
        }
      }
    }
    return result;
  }

  function getCustomRates(settings) {
    const c = settings.customRates || {};
    const result = {};
    const sources = settings.sourceCurrencies || [];
    const targets = settings.targetCurrencies || [];
    const all = [...new Set([...sources, ...targets])];

    for (const from of all) {
      result[from] = {};
    }
    for (const [key, val] of Object.entries(c)) {
      if (val == null) continue;
      const parts = key.split(':');
      if (parts.length !== 2) continue;
      const [from, to] = parts;
      if (!result[from]) result[from] = {};
      result[from][to] = val;
    }
    return result;
  }

  async function getSettings() {
    // Migrate from sync to local if needed
    let localResult = await chrome.storage.local.get(SETTINGS_KEY);
    if (!localResult[SETTINGS_KEY]) {
      const syncResult = await chrome.storage.sync.get(SETTINGS_KEY);
      if (syncResult[SETTINGS_KEY]) {
        await chrome.storage.local.set({ [SETTINGS_KEY]: syncResult[SETTINGS_KEY] });
        await chrome.storage.sync.remove(SETTINGS_KEY);
        localResult = { [SETTINGS_KEY]: syncResult[SETTINGS_KEY] };
      }
    }

    const stored = localResult[SETTINGS_KEY] || {};
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    // Deep-merge currencies so new defaults appear for existing users
    if (stored.currencies) {
      merged.currencies = { ...DEFAULT_SETTINGS.currencies, ...stored.currencies };
    }
    return merged;
  }

  async function saveSettings(settings) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }

  async function getCachedRates() {
    const result = await chrome.storage.local.get(CACHE_KEY);
    return result[CACHE_KEY] || null;
  }

  async function cacheRates(rates) {
    await chrome.storage.local.set({ [CACHE_KEY]: rates });
  }

  async function fetchAndCacheRates(sourceId, settings) {
    const source = RATE_SOURCES[sourceId];
    if (!source) throw new Error(`Unknown rate source: ${sourceId}`);

    const allCodes = [...new Set([
      ...(settings.sourceCurrencies || []),
      ...(settings.targetCurrencies || []),
    ])];
    // Add BYN for NBRB (it's always the base), EUR for ECB
    if (sourceId === 'nbrb' && !allCodes.includes('BYN')) allCodes.push('BYN');
    if (sourceId === 'ecb' && !allCodes.includes('EUR')) allCodes.push('EUR');

    const baseRates = await source.fetchBaseRates(allCodes);
    baseRates.convention = source.convention;
    const rates = buildRateTable(baseRates, settings.sourceCurrencies || [], settings.targetCurrencies || []);
    rates.timestamp = Date.now();
    await cacheRates(rates);
    return rates;
  }

  function convert(amount, fromCurrency, toCurrency, rates) {
    const fromRates = rates[fromCurrency];
    if (!fromRates) return null;
    const rate = fromRates[toCurrency];
    if (rate == null) return null;
    return amount * rate;
  }

  function isCacheValid(rates, ttlMs = 30 * 60 * 1000) {
    if (!rates || !rates.timestamp) return false;
    return Date.now() - rates.timestamp < ttlMs;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return {
    DEFAULT_SETTINGS,
    DEFAULT_CURRENCIES,
    RATE_SOURCES,
    getSettings,
    saveSettings,
    getCachedRates,
    cacheRates,
    fetchAndCacheRates,
    getCustomRates,
    buildRateTable,
    convert,
    isCacheValid,
    escapeHtml,
  };
})();

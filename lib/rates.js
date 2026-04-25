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

    // Initialize result entries
    for (const c of all) {
      result[c] = {};
    }

    // Visit each pair once, store only in the direction where rate >= 1
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const from = all[i];
        const to = all[j];
        const fromInBase = rates[from];
        const toInBase = rates[to];
        if (fromInBase == null || toInBase == null) continue;

        let crossRate;
        if (baseRates.convention === 'indirect') {
          crossRate = toInBase / fromInBase; // "from → to"
        } else {
          crossRate = fromInBase / toInBase; // "from → to"
        }

        if (crossRate >= 1) {
          result[from][to] = crossRate;
        } else {
          result[to][from] = 1 / crossRate;
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
      let [from, to] = parts;
      let rate = val;
      // Normalize: always store in the direction where rate >= 1
      if (rate > 0 && rate < 1) {
        [from, to] = [to, from];
        rate = 1 / rate;
      }
      if (!result[from]) result[from] = {};
      result[from][to] = rate;
    }
    return result;
  }

  /**
   * Returns { base, quote, rate } where rate >= 1.
   * Looks up stored direction and returns the normalized display form.
   */
  function formatRateForDisplay(from, to, rates) {
    const direct = rates[from] && rates[from][to];
    if (direct != null && direct >= 1) {
      return { base: from, quote: to, rate: direct };
    }
    const reverse = rates[to] && rates[to][from];
    if (reverse != null) {
      return { base: to, quote: from, rate: reverse };
    }
    // Edge: direct exists but < 1 (shouldn't happen after normalization, but just in case)
    if (direct != null) {
      return { base: to, quote: from, rate: 1 / direct };
    }
    return null;
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
    // Try direct lookup
    const direct = rates[fromCurrency] && rates[fromCurrency][toCurrency];
    if (direct != null) return amount * direct;
    // Try reverse: rates[to][from] gives "1 to = rate from", so amount / rate
    const reverse = rates[toCurrency] && rates[toCurrency][fromCurrency];
    if (reverse != null) return amount / reverse;
    return null;
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
    formatRateForDisplay,
  };
})();

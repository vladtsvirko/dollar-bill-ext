const RatesUtil = (() => {
  const DEFAULT_CURRENCIES = {
    BYN: {
      name: 'Belarusian Ruble',
      symbol: 'BYN',
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
    conversionPairs: [
      { from: 'BYN', to: 'USD' },
      { from: 'BYN', to: 'EUR' },
      { from: 'RUB', to: 'USD' },
      { from: 'RUB', to: 'EUR' },
    ],
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
    theme: null, // null = auto-detect, 'light' | 'dark' = manual
    timeFormat: null, // null = auto-detect, '12h' | '24h' = manual override
    _settingsVersion: 3,
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
            rates[code] = r;
          }
        }
        return { base: 'EUR', rates };
      },
    },
  };

  const CACHE_KEY = 'dollarbill_rates';
  const SETTINGS_KEY = 'dollarbill_settings';
  const FETCH_STATUS_KEY = 'dollarbill_fetch_status';

  // ---- Derived helpers ----

  function getSourceCurrencies(settings) {
    return [...new Set((settings.conversionPairs || []).map(p => p.from))];
  }

  function getTargetCurrencies(settings) {
    return [...new Set((settings.conversionPairs || []).map(p => p.to))];
  }

  function getTargetCurrenciesForSource(settings, sourceCode) {
    return [...new Set(
      (settings.conversionPairs || [])
        .filter(p => p.from === sourceCode)
        .map(p => p.to)
    )];
  }

  function buildConversionMap(settings) {
    const map = {};
    for (const pair of settings.conversionPairs || []) {
      if (!map[pair.from]) map[pair.from] = [];
      if (!map[pair.from].includes(pair.to)) {
        map[pair.from].push(pair.to);
      }
    }
    return map;
  }

  // ---- Rate table construction ----

  function buildRateTable(baseRates, sources, targets) {
    const { base, rates } = baseRates;
    const result = {};
    const all = [...new Set([...sources, ...targets])];
    if (!all.includes(base)) all.push(base);

    for (const c of all) {
      result[c] = {};
    }

    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const from = all[i];
        const to = all[j];
        const fromInBase = rates[from];
        const toInBase = rates[to];
        if (fromInBase == null || toInBase == null) continue;

        let crossRate;
        if (baseRates.convention === 'indirect') {
          crossRate = toInBase / fromInBase;
        } else {
          crossRate = fromInBase / toInBase;
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
    const sources = getSourceCurrencies(settings);
    const targets = getTargetCurrencies(settings);
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
      if (rate > 0 && rate < 1) {
        [from, to] = [to, from];
        rate = 1 / rate;
      }
      if (!result[from]) result[from] = {};
      result[from][to] = rate;
    }
    return result;
  }

  function deepCloneRateTable(table) {
    const clone = {};
    for (const [from, toMap] of Object.entries(table)) {
      if (from === 'timestamp') continue;
      clone[from] = { ...toMap };
    }
    return clone;
  }

  function getEffectiveRates(settings, cachedApiRates) {
    const base = (cachedApiRates && isCacheValid(cachedApiRates))
      ? deepCloneRateTable(cachedApiRates)
      : {};

    const customNormalized = getCustomRates(settings);
    for (const [from, toMap] of Object.entries(customNormalized)) {
      if (!base[from]) base[from] = {};
      for (const [to, rate] of Object.entries(toMap)) {
        base[from][to] = rate;
      }
    }

    return base;
  }

  function formatRateForDisplay(from, to, rates) {
    const direct = rates[from] && rates[from][to];
    if (direct != null && direct >= 1) {
      return { base: from, quote: to, rate: direct };
    }
    const reverse = rates[to] && rates[to][from];
    if (reverse != null) {
      return { base: to, quote: from, rate: reverse };
    }
    if (direct != null) {
      return { base: to, quote: from, rate: 1 / direct };
    }
    return null;
  }

  // ---- Migration ----

  function migrateSettingsV1toV2(stored) {
    if (stored._settingsVersion >= 2) return stored;
    if (!stored.sourceCurrencies && !stored.targetCurrencies) return stored;

    const pairs = [];
    const sources = stored.sourceCurrencies || [];
    const targets = stored.targetCurrencies || [];
    for (const from of sources) {
      for (const to of targets) {
        if (from !== to) {
          pairs.push({ from, to });
        }
      }
    }

    stored.conversionPairs = pairs;
    if (stored.rateSource === 'custom') {
      stored.rateSource = 'nbrb';
    }
    stored._settingsVersion = 2;
    delete stored.sourceCurrencies;
    delete stored.targetCurrencies;
    return stored;
  }

  function migrateSettingsV2toV3(stored) {
    if (stored._settingsVersion >= 3) return stored;
    stored._settingsVersion = 3;
    return stored;
  }

  // ---- Settings persistence ----

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

    let stored = localResult[SETTINGS_KEY] || {};

    // Migrate v1 → v2
    if (stored._settingsVersion == null || stored._settingsVersion < 2) {
      stored = migrateSettingsV1toV2(stored);
      await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
    }

    // Migrate v2 → v3
    if (stored._settingsVersion < 3) {
      stored = migrateSettingsV2toV3(stored);
      await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
    }

    const merged = { ...DEFAULT_SETTINGS, ...stored };
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

    const sources = getSourceCurrencies(settings);
    const targets = getTargetCurrencies(settings);
    const allCodes = [...new Set([...sources, ...targets])];
    if (sourceId === 'nbrb' && !allCodes.includes('BYN')) allCodes.push('BYN');
    if (sourceId === 'ecb' && !allCodes.includes('EUR')) allCodes.push('EUR');

    const baseRates = await source.fetchBaseRates(allCodes);
    baseRates.convention = source.convention;
    const rates = buildRateTable(baseRates, sources, targets);
    rates.timestamp = Date.now();
    await cacheRates(rates);
    return rates;
  }

  function convert(amount, fromCurrency, toCurrency, rates) {
    const direct = rates[fromCurrency] && rates[fromCurrency][toCurrency];
    if (direct != null) return amount * direct;
    const reverse = rates[toCurrency] && rates[toCurrency][fromCurrency];
    if (reverse != null) return amount / reverse;
    return null;
  }

  function isCacheValid(rates, ttlMs = 30 * 60 * 1000) {
    if (!rates || !rates.timestamp) return false;
    return Date.now() - rates.timestamp < ttlMs;
  }

  async function getFetchStatus() {
    const result = await chrome.storage.local.get(FETCH_STATUS_KEY);
    return result[FETCH_STATUS_KEY] || {
      lastFetchTime: null,
      lastSuccessTime: null,
      lastError: null,
      consecutiveFailures: 0,
    };
  }

  async function saveFetchStatus(status) {
    await chrome.storage.local.set({ [FETCH_STATUS_KEY]: status });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- Time formatting ----

  let _detectedHourCycle = null;

  function detectHourCycle() {
    if (!_detectedHourCycle) {
      const resolved = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
        .resolvedOptions().hourCycle;
      _detectedHourCycle = (resolved === 'h23' || resolved === 'h24') ? 'h23' : 'h12';
    }
    return _detectedHourCycle;
  }

  function formatTimestamp(timestamp, timeFormat, fallback) {
    if (!timestamp) return fallback || '';
    const d = new Date(timestamp);
    const hour12 = timeFormat === '24h' ? false
      : timeFormat === '12h' ? true
      : detectHourCycle() === 'h12';
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12,
    });
  }

  function getFetchState(fetchStatus, rates) {
    if (fetchStatus && fetchStatus.lastError) return 'error';
    if (!rates || !rates.timestamp || !isCacheValid(rates)) return 'stale';
    if (!fetchStatus || !fetchStatus.lastFetchTime) return 'stale';
    return 'ok';
  }

  function formatCacheAge(rates) {
    if (!rates || !rates.timestamp) return '';
    const ageMin = Math.round((Date.now() - rates.timestamp) / 60000);
    return ageMin < 1 ? '< 1 min' : ageMin + ' min';
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
    getEffectiveRates,
    buildRateTable,
    convert,
    isCacheValid,
    getFetchStatus,
    saveFetchStatus,
    escapeHtml,
    formatTimestamp,
    getFetchState,
    formatCacheAge,
    formatRateForDisplay,
    getSourceCurrencies,
    getTargetCurrencies,
    getTargetCurrenciesForSource,
    buildConversionMap,
  };
})();

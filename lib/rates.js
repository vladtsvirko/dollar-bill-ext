const RatesUtil = (() => {
  // Re-import from extracted modules
  const DEFAULT_CURRENCIES = Currencies.DEFAULT_CURRENCIES;
  const POPULAR_CURRENCIES = Currencies.POPULAR_CURRENCIES;
  const RATE_SOURCES = RateSources.RATE_SOURCES;
  const getSourceDisplayName = RateSources.getSourceDisplayName;
  const DEFAULT_SETTINGS = Settings.DEFAULT_SETTINGS;
  const SETTINGS_KEY = Settings.SETTINGS_KEY;

  const CACHE_KEY = 'dollarbill_rates';
  const FETCH_STATUS_KEY = 'dollarbill_fetch_status';
  const LOADED_RATES_KEY = 'dollarbill_loaded_rates';

  const META_KEYS = new Set(['timestamp', '_conflicts', '_usedSources', '_sourceErrors']);

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

  // ---- Identifier pattern compilation ----

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function identifierToRegexBody(id) {
    const parts = id.trim().split(/\s+/);
    return parts.map(p => {
      let escaped = escapeRegex(p);
      escaped = escaped.replace(/\\\./g, '\\.?'); // optional dots
      return escaped;
    }).join('\\s+');
  }

  // Single-char currency symbols excluded by lookbehind to prevent double-matching
  const CURRENCY_SYMBOLS = '$€₽¥₩£₱฿₫₹₴₺₼₸₭₮₾₵₡₲₦₪؋៛ƒ';

  function buildPatternsFromIdentifiers(identifiers) {
    const patterns = [];
    for (const id of identifiers) {
      if (!id.trim()) continue;
      const regexBody = identifierToRegexBody(id);
      // Prevent matching inside words across all scripts (e.g. "раз" should not match "р")
      const notAfterLetterOrCur = `(?<![\\p{L}${CURRENCY_SYMBOLS}])`;
      const notBeforeLetter = `(?![\\p{L}])`;
      const amount = `(?<![.,\\d])(\\d[\\d\\s]*(?:[.,]\\d{1,4})?)`;
      const body = `(?:${regexBody})`;
      patterns.push(`${amount}\\s*${notAfterLetterOrCur}${body}${notBeforeLetter}`);
      patterns.push(`${notAfterLetterOrCur}${body}\\s*${amount}${notBeforeLetter}`);
    }
    return patterns;
  }

  function buildIdentifierOwnerMap(currencies) {
    const map = {}; // norm -> [{ code, originalId }]
    for (const [code, cur] of Object.entries(currencies || {})) {
      for (const id of (cur.identifiers || [])) {
        const norm = id.trim().toLowerCase();
        if (!map[norm]) map[norm] = [];
        if (!map[norm].some(e => e.code === code)) {
          map[norm].push({ code, originalId: id });
        }
      }
    }
    return map;
  }

  function detectIdentifierConflicts(currencies) {
    const ownerMap = buildIdentifierOwnerMap(currencies);
    const conflicts = [];
    for (const [id, entries] of Object.entries(ownerMap)) {
      if (entries.length > 1) {
        conflicts.push({ identifier: id, currencies: entries.map(e => e.code) });
      }
    }
    return conflicts;
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

  // ---- Multi-source merge ----

  function buildMergedRateTable(sourceRatesMap, orderedSourceIds, sourceCurrencies, targetCurrencies) {
    const all = [...new Set([...sourceCurrencies, ...targetCurrencies])];

    // Build individual rate tables per source
    const rateTables = {};
    for (const sourceId of Object.keys(sourceRatesMap)) {
      const baseRates = sourceRatesMap[sourceId];
      if (!all.includes(baseRates.base)) all.push(baseRates.base);
      rateTables[sourceId] = buildRateTable(baseRates, sourceCurrencies, targetCurrencies);
    }

    const merged = {};
    for (const c of all) merged[c] = {};

    // Collect all pair rates across sources
    const pairSources = {}; // "FROM:TO" -> { sourceId: rate }
    for (const [sourceId, table] of Object.entries(rateTables)) {
      for (const [from, toMap] of Object.entries(table)) {
        for (const [to, rate] of Object.entries(toMap)) {
          const key = `${from}:${to}`;
          if (!pairSources[key]) pairSources[key] = {};
          pairSources[key][sourceId] = rate;
        }
      }
    }

    // Merge and detect conflicts
    const conflicts = {};
    const activeSourceIds = orderedSourceIds.filter(id => rateTables[id]);

    for (const [pairKey, sourcesMap] of Object.entries(pairSources)) {
      const [from, to] = pairKey.split(':');
      const providingSources = Object.keys(sourcesMap);

      if (providingSources.length === 1) {
        merged[from][to] = sourcesMap[providingSources[0]];
      } else {
        const rates = Object.values(sourcesMap);
        const allSame = rates.every(r => Math.abs(r - rates[0]) < 1e-10);

        if (allSame) {
          merged[from][to] = rates[0];
        } else {
          const defaultSource = activeSourceIds.find(id => sourcesMap[id] !== undefined) || providingSources[0];
          merged[from][to] = sourcesMap[defaultSource];
          conflicts[pairKey] = { ...sourcesMap };
        }
      }
    }

    return { rates: merged, conflicts };
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
      if (META_KEYS.has(from)) continue;
      clone[from] = { ...toMap };
    }
    return clone;
  }

  function getEffectiveRates(settings, cachedApiRates) {
    const base = (cachedApiRates && isCacheValid(cachedApiRates))
      ? deepCloneRateTable(cachedApiRates)
      : {};

    // Apply rate source overrides for conflicting pairs
    if (cachedApiRates && cachedApiRates._conflicts) {
      const overrides = settings.rateSourceOverrides || {};
      for (const [pairKey, sourceRates] of Object.entries(cachedApiRates._conflicts)) {
        const overrideSource = overrides[pairKey];
        if (overrideSource && sourceRates[overrideSource] !== undefined) {
          const [from, to] = pairKey.split(':');
          if (!base[from]) base[from] = {};
          base[from][to] = sourceRates[overrideSource];
        }
      }
    }

    const customNormalized = getCustomRates(settings);
    for (const [from, toMap] of Object.entries(customNormalized)) {
      if (!base[from]) base[from] = {};
      for (const [to, rate] of Object.entries(toMap)) {
        base[from][to] = rate;
      }
    }

    return base;
  }

  function getConflicts(cachedRates) {
    return (cachedRates && cachedRates._conflicts) || {};
  }

  function getUsedSources(cachedRates) {
    return (cachedRates && cachedRates._usedSources) || [];
  }

  function isConflictResolved(pairKey, settings, cachedRates) {
    const conflicts = getConflicts(cachedRates);
    if (!conflicts[pairKey]) return true;
    const overrides = settings.rateSourceOverrides || {};
    const reverseKey = pairKey.includes(':') ? pairKey.split(':').reverse().join(':') : null;
    return overrides[pairKey] !== undefined || (reverseKey && overrides[reverseKey] !== undefined);
  }

  function getActiveSourceForPair(pairKey, reverseKey, settings, cachedRates) {
    const overrides = settings.rateSourceOverrides || {};
    return overrides[pairKey] || (reverseKey && overrides[reverseKey]) || getUsedSources(cachedRates)[0] || '';
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

  function getCurrencyRateAvailability(settings, cachedApiRates) {
    const effective = getEffectiveRates(settings, cachedApiRates);
    const codes = new Set();
    for (const from of Object.keys(effective)) {
      if (META_KEYS.has(from)) continue;
      codes.add(from);
      for (const to of Object.keys(effective[from])) {
        codes.add(to);
      }
    }
    return codes;
  }

  // ---- Caching ----

  async function getSettings() {
    return Settings.getSettings();
  }

  async function saveSettings(settings) {
    return Settings.saveSettings(settings);
  }

  async function getCachedRates() {
    const result = await chrome.storage.local.get(CACHE_KEY);
    return result[CACHE_KEY] || null;
  }

  async function cacheRates(rates) {
    await chrome.storage.local.set({ [CACHE_KEY]: rates });
  }

  async function getLoadedRates() {
    const result = await chrome.storage.local.get(LOADED_RATES_KEY);
    return result[LOADED_RATES_KEY] || null;
  }

  async function cacheLoadedRates(loadedRates) {
    await chrome.storage.local.set({ [LOADED_RATES_KEY]: loadedRates });
  }

  async function clearCachedRates() {
    await chrome.storage.local.remove([CACHE_KEY, LOADED_RATES_KEY]);
  }

  async function fetchAndCacheRates(sourceIds, settings) {
    if (typeof sourceIds === 'string') sourceIds = [sourceIds];
    if (!sourceIds || sourceIds.length === 0) {
      const emptyRates = { timestamp: Date.now(), _conflicts: {}, _usedSources: [] };
      await chrome.storage.local.set({ [CACHE_KEY]: emptyRates, [LOADED_RATES_KEY]: {} });
      return emptyRates;
    }

    // Fetch from all sources in parallel, tagging errors with source ID
    const results = await Promise.allSettled(
      sourceIds.map(async (id) => {
        try {
          const source = RATE_SOURCES[id];
          if (!source) throw new Error(`Unknown rate source: ${id}`);
          const baseRates = await source.fetchBaseRates();
          baseRates.convention = source.convention;
          return { id, baseRates };
        } catch (err) {
          err.sourceId = id;
          throw err;
        }
      })
    );

    const sourceRatesMap = {};
    const loadedRatesMap = {};
    const sourceErrors = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { id, baseRates } = result.value;
        sourceRatesMap[id] = baseRates;
        loadedRatesMap[id] = {
          source: id,
          base: baseRates.base,
          convention: baseRates.convention,
          rates: { ...baseRates.rates },
          timestamp: Date.now(),
        };
        if (baseRates.rateDate) {
          loadedRatesMap[id].rateDate = baseRates.rateDate;
        }
      } else {
        const id = result.reason?.sourceId || 'unknown';
        sourceErrors[id] = result.reason?.message || String(result.reason);
        loadedRatesMap[id] = {
          source: id,
          error: result.reason?.message || String(result.reason),
          timestamp: Date.now(),
        };
      }
    }

    const sourceCurrencies = getSourceCurrencies(settings);
    const targetCurrencies = getTargetCurrencies(settings);

    const { rates, conflicts } = buildMergedRateTable(
      sourceRatesMap, sourceIds, sourceCurrencies, targetCurrencies
    );
    rates.timestamp = Date.now();
    rates._conflicts = conflicts;
    rates._usedSources = Object.keys(sourceRatesMap);
    rates._sourceErrors = sourceErrors;

    await chrome.storage.local.set({
      [CACHE_KEY]: rates,
      [LOADED_RATES_KEY]: loadedRatesMap,
    });

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

  function formatNumber(value, decimals, numberFormat) {
    if (value == null || isNaN(value)) return '';
    const locale = numberFormat || undefined;
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  return {
    DEFAULT_SETTINGS,
    DEFAULT_CURRENCIES,
    POPULAR_CURRENCIES,
    RATE_SOURCES,
    getSourceDisplayName,
    getSettings,
    saveSettings,
    getCachedRates,
    cacheRates,
    getLoadedRates,
    cacheLoadedRates,
    clearCachedRates,
    fetchAndCacheRates,
    getCustomRates,
    getEffectiveRates,
    buildRateTable,
    buildMergedRateTable,
    convert,
    isCacheValid,
    getFetchStatus,
    saveFetchStatus,
    escapeHtml,
    formatTimestamp,
    getFetchState,
    formatCacheAge,
    formatNumber,
    formatRateForDisplay,
    getCurrencyRateAvailability,
    getSourceCurrencies,
    getTargetCurrencies,
    getTargetCurrenciesForSource,
    buildConversionMap,
    getConflicts,
    getUsedSources,
    isConflictResolved,
    getActiveSourceForPair,
    escapeRegex,
    buildPatternsFromIdentifiers,
    buildIdentifierOwnerMap,
    detectIdentifierConflicts,
  };
})();

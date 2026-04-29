const RateFetch = (() => {
  const CACHE_KEY = 'dollarbill_rates';
  const FETCH_STATUS_KEY = 'dollarbill_fetch_status';
  const LOADED_RATES_KEY = 'dollarbill_loaded_rates';

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
      const emptyRates = { timestamp: Date.now(), _usedSources: [], _sourceErrors: {} };
      await chrome.storage.local.set({ [CACHE_KEY]: emptyRates, [LOADED_RATES_KEY]: {} });
      return emptyRates;
    }

    const RATE_SOURCES = RateSources.RATE_SOURCES;

    const results = await Promise.allSettled(
      sourceIds.map(async (id) => {
        try {
          const source = RATE_SOURCES[id];
          if (!source) throw new Error(`Unknown rate source: ${id}`);
          const baseRates = await source.fetchBaseRates();
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
        // Store loaded rates with {rate, amount} objects
        const ratesCopy = {};
        for (const [code, val] of Object.entries(baseRates.rates)) {
          ratesCopy[code] = (typeof val === 'object' && val !== null) ? { ...val } : val;
        }
        loadedRatesMap[id] = {
          source: id,
          base: baseRates.base,
          rates: ratesCopy,
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

    const sourceCurrencies = RateTables.getSourceCurrencies(settings);
    const targetCurrencies = RateTables.getTargetCurrencies(settings);

    const { rates } = RateTables.buildMergedRateTable(
      sourceRatesMap, sourceIds, sourceCurrencies, targetCurrencies
    );
    rates.timestamp = Date.now();
    rates._usedSources = Object.keys(sourceRatesMap);
    rates._sourceErrors = sourceErrors;

    await chrome.storage.local.set({
      [CACHE_KEY]: rates,
      [LOADED_RATES_KEY]: loadedRatesMap,
    });

    return rates;
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

  return {
    getSettings,
    saveSettings,
    getCachedRates,
    cacheRates,
    getLoadedRates,
    cacheLoadedRates,
    clearCachedRates,
    fetchAndCacheRates,
    getFetchStatus,
    saveFetchStatus,
  };
})();

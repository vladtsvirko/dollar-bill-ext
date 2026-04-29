const RatesUtil = (() => {
  // Re-export from focused modules as a single backward-compatible interface
  const DEFAULT_CURRENCIES = Currencies.DEFAULT_CURRENCIES;
  const POPULAR_CURRENCIES = Currencies.POPULAR_CURRENCIES;
  const RATE_SOURCES = RateSources.RATE_SOURCES;
  const getSourceDisplayName = RateSources.getSourceDisplayName;
  const DEFAULT_SETTINGS = Settings.DEFAULT_SETTINGS;
  const SETTINGS_KEY = Settings.SETTINGS_KEY;

  return {
    DEFAULT_SETTINGS,
    DEFAULT_CURRENCIES,
    POPULAR_CURRENCIES,
    RATE_SOURCES,
    getSourceDisplayName,
    RATE_TYPE: RateTables.RATE_TYPE,
    CUSTOM_SOURCE: RateTables.CUSTOM_SOURCE,

    // From RateFetch
    getSettings: RateFetch.getSettings,
    saveSettings: RateFetch.saveSettings,
    getCachedRates: RateFetch.getCachedRates,
    cacheRates: RateFetch.cacheRates,
    getLoadedRates: RateFetch.getLoadedRates,
    cacheLoadedRates: RateFetch.cacheLoadedRates,
    clearCachedRates: RateFetch.clearCachedRates,
    fetchAndCacheRates: RateFetch.fetchAndCacheRates,
    getFetchStatus: RateFetch.getFetchStatus,
    saveFetchStatus: RateFetch.saveFetchStatus,

    // From RateTables
    getCustomRates: RateTables.getCustomRates,
    getEffectiveRates: RateTables.getEffectiveRates,
    buildRateTable: RateTables.buildRateTable,
    buildMergedRateTable: RateTables.buildMergedRateTable,
    convert: RateTables.convert,
    isCacheValid: RateTables.isCacheValid,
    isNewRateFormat: RateTables.isNewRateFormat,
    formatRateForDisplay: RateTables.formatRateForDisplay,
    getDisplayInfoMap: RateTables.getDisplayInfoMap,
    getCurrencyRateAvailability: RateTables.getCurrencyRateAvailability,
    getSourceCurrencies: RateTables.getSourceCurrencies,
    getTargetCurrencies: RateTables.getTargetCurrencies,
    getTargetCurrenciesForSource: RateTables.getTargetCurrenciesForSource,
    buildConversionMap: RateTables.buildConversionMap,
    getConflicts: RateTables.getConflicts,
    getEffectiveConflicts: RateTables.getEffectiveConflicts,
    getUsedSources: RateTables.getUsedSources,
    isConflictResolved: RateTables.isConflictResolved,
    getActiveSourceForPair: RateTables.getActiveSourceForPair,
    resolveActiveEntry: RateTables.resolveActiveEntry,
    findSelection: RateTables.findSelection,
    setSelection: RateTables.setSelection,

    // From FormatUtils
    escapeHtml: FormatUtils.escapeHtml,
    formatTimestamp: FormatUtils.formatTimestamp,
    getFetchState: FormatUtils.getFetchState,
    formatCacheAge: FormatUtils.formatCacheAge,
    formatNumber: FormatUtils.formatNumber,

    // From Patterns
    escapeRegex: Patterns.escapeRegex,
    buildPatternsFromIdentifiers: Patterns.buildPatternsFromIdentifiers,
    buildIdentifierOwnerMap: Patterns.buildIdentifierOwnerMap,
    detectIdentifierConflicts: Patterns.detectIdentifierConflicts,
  };
})();

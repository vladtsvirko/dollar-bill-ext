(() => {
  let compiledUnambiguous = [];
  let compiledAmbiguous = [];
  let compiledDomainMap = null;
  let currentSettings = null;
  let lastCompiledKey = null;

  function compilePatterns(settings) {
    currentSettings = settings;
    const sources = RatesUtil.getSourceCurrencies(settings);
    const key = JSON.stringify(sources) + JSON.stringify(settings.currencies);
    if (key === lastCompiledKey) return;
    lastCompiledKey = key;

    const currencies = settings.currencies || {};
    const identifierOwners = RatesUtil.buildIdentifierOwnerMap(currencies);

    compiledUnambiguous = [];
    for (const code of sources) {
      const cur = currencies[code];
      if (!cur || !cur.identifiers) continue;
      for (const id of cur.identifiers) {
        const norm = id.trim().toLowerCase();
        const owners = identifierOwners[norm];
        if (!owners || owners.length !== 1) continue;
        const patterns = RatesUtil.buildPatternsFromIdentifiers([id]);
        for (const pat of patterns) {
          try {
            compiledUnambiguous.push({ regex: new RegExp(pat, 'giu'), currency: code });
          } catch (e) {
            console.warn(`[DollarBill] Invalid pattern for ${code}: ${pat}`, e);
          }
        }
      }
    }

    compiledAmbiguous = [];
    for (const [norm, entries] of Object.entries(identifierOwners)) {
      if (entries.length <= 1) continue;
      const ownerCodes = entries.map(e => e.code);
      if (!ownerCodes.some(code => sources.includes(code))) continue;
      const patterns = RatesUtil.buildPatternsFromIdentifiers([entries[0].originalId]);
      for (const pat of patterns) {
        try {
          compiledAmbiguous.push({ regex: new RegExp(pat, 'giu'), currency: null, ownerCurrencies: ownerCodes });
        } catch (e) {
          console.warn(`[DollarBill] Invalid ambiguous pattern: ${pat}`, e);
        }
      }
    }

    compiledDomainMap = [];
    for (const [code, cur] of Object.entries(currencies)) {
      for (const domain of (cur.domains || [])) {
        compiledDomainMap.push({ domain: domain.toLowerCase(), code });
      }
    }
    compiledDomainMap.sort((a, b) => b.domain.length - a.domain.length);
  }

  function shouldProcessPage(settings) {
    if (!settings.enabled) return false;
    if (settings.siteMode === 'whitelist') {
      const host = location.hostname;
      return settings.whitelist.some((pattern) => {
        try {
          return host === pattern || host.endsWith('.' + pattern) || new RegExp(pattern).test(host);
        } catch {
          return host.includes(pattern);
        }
      });
    }
    return true;
  }

  function getRatesForConversion(settings, cachedRates) {
    return {
      rates: RatesUtil.getEffectiveRates(settings, cachedRates),
      conflicts: RatesUtil.getConflicts(cachedRates),
      usedSources: RatesUtil.getUsedSources(cachedRates),
      overrides: settings.rateSourceOverrides || {},
    };
  }

  async function runConversion() {
    const [settings, cachedRates] = await Promise.all([
      new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getSettings' }, resolve)),
      new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getRates' }, resolve)),
    ]);

    if (!shouldProcessPage(settings)) return;

    compilePatterns(settings);

    const ratesData = getRatesForConversion(settings, cachedRates);
    if (!ratesData || !ratesData.rates) return;

    const conversionMap = RatesUtil.buildConversionMap(settings);
    const ambiguousCurrency = PickerBar.resolveAmbiguousCurrency(settings, compiledDomainMap);
    Scanner.scanNode(document.body, ratesData, conversionMap, ambiguousCurrency, currentSettings, compiledUnambiguous, compiledAmbiguous);

    if (!ambiguousCurrency && Scanner.hasAmbiguousMatches(document.body, compiledAmbiguous)) {
      PickerBar.showCurrencyPicker(settings, compiledDomainMap, runConversion);
    }
  }

  // Initial scan
  runConversion();

  // Observe dynamic content changes
  ContentObserver.start((nodes) => {
    Promise.all([
      new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getSettings' }, resolve)),
      new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getRates' }, resolve)),
    ]).then(([settings, cachedRates]) => {
      if (!shouldProcessPage(settings)) return;
      compilePatterns(settings);
      const ratesData = getRatesForConversion(settings, cachedRates);
      if (!ratesData || !ratesData.rates) return;
      const conversionMap = RatesUtil.buildConversionMap(settings);
      const ambiguousCurrency = PickerBar.resolveAmbiguousCurrency(settings, compiledDomainMap);
      for (const node of nodes) {
        if (node.isConnected) {
          Scanner.scanNode(node, ratesData, conversionMap, ambiguousCurrency, currentSettings, compiledUnambiguous, compiledAmbiguous);
        }
      }
    });
  });
})();

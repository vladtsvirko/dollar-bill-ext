const RateTables = (() => {
  const META_KEYS = new Set(['timestamp', '_conflicts', '_usedSources', '_sourceErrors']);

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

  function buildMergedRateTable(sourceRatesMap, orderedSourceIds, sourceCurrencies, targetCurrencies) {
    const all = [...new Set([...sourceCurrencies, ...targetCurrencies])];

    const rateTables = {};
    for (const sourceId of Object.keys(sourceRatesMap)) {
      const baseRates = sourceRatesMap[sourceId];
      if (!all.includes(baseRates.base)) all.push(baseRates.base);
      rateTables[sourceId] = buildRateTable(baseRates, sourceCurrencies, targetCurrencies);
    }

    const merged = {};
    for (const c of all) merged[c] = {};

    const pairSources = {};
    for (const [sourceId, table] of Object.entries(rateTables)) {
      for (const [from, toMap] of Object.entries(table)) {
        for (const [to, rate] of Object.entries(toMap)) {
          const key = `${from}:${to}`;
          if (!pairSources[key]) pairSources[key] = {};
          pairSources[key][sourceId] = rate;
        }
      }
    }

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

  function isCacheValid(rates, ttlMs = 30 * 60 * 1000) {
    if (!rates || !rates.timestamp) return false;
    return Date.now() - rates.timestamp < ttlMs;
  }

  function getEffectiveRates(settings, cachedApiRates) {
    const base = (cachedApiRates && isCacheValid(cachedApiRates))
      ? deepCloneRateTable(cachedApiRates)
      : {};

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

  function convert(amount, fromCurrency, toCurrency, rates) {
    const direct = rates[fromCurrency] && rates[fromCurrency][toCurrency];
    if (direct != null) return amount * direct;
    const reverse = rates[toCurrency] && rates[toCurrency][fromCurrency];
    if (reverse != null) return amount / reverse;
    return null;
  }

  return {
    META_KEYS,
    getSourceCurrencies,
    getTargetCurrencies,
    getTargetCurrenciesForSource,
    buildConversionMap,
    buildRateTable,
    buildMergedRateTable,
    getCustomRates,
    deepCloneRateTable,
    isCacheValid,
    getEffectiveRates,
    getConflicts,
    getUsedSources,
    isConflictResolved,
    getActiveSourceForPair,
    formatRateForDisplay,
    getCurrencyRateAvailability,
    convert,
  };
})();

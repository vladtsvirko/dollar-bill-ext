const RateTables = (() => {
  const META_KEYS = new Set(['timestamp', '_usedSources', '_sourceErrors']);

  const RATE_TYPE = { PLAIN: 'plain', PLAIN_INVERSED: 'plain_inversed', CROSS: 'cross' };
  const CUSTOM_SOURCE = 'custom';

  // Type preference order for auto-selection: plain > plain_inversed > cross
  const TYPE_PREFERENCE = { plain: 1, plain_inversed: 2, cross: 3 };

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

  // --- Resolution helpers ---

  function findSelection(from, to, selections) {
    if (!selections) return null;
    return selections.find(s => (s.from === from && s.to === to) || (s.from === to && s.to === from)) || null;
  }

  function setSelection(settings, from, to, sourceId) {
    if (!settings.rateSourceSelections) settings.rateSourceSelections = [];
    const idx = settings.rateSourceSelections.findIndex(s => s.from === from && s.to === to);
    if (idx >= 0) {
      settings.rateSourceSelections[idx].source = sourceId;
    } else {
      settings.rateSourceSelections.push({ from, to, source: sourceId });
    }
  }

  function resolveActiveEntry(from, to, sourceMap, selections, usedSources) {
    if (!sourceMap || Object.keys(sourceMap).length === 0) return null;

    // 1. Check user selection
    const sel = findSelection(from, to, selections);
    if (sel && sourceMap[sel.source]) return { ...sourceMap[sel.source], source: sel.source };

    // 2. Auto-select by preference: custom > plain > plain_inversed > cross
    let best = null;
    let bestPriority = Infinity;

    const sourceOrder = usedSources || Object.keys(sourceMap);
    for (const sourceId of sourceOrder) {
      const entry = sourceMap[sourceId];
      if (!entry) continue;
      const priority = TYPE_PREFERENCE[entry.type] !== undefined ? TYPE_PREFERENCE[entry.type] : 99;
      if (priority < bestPriority) {
        bestPriority = priority;
        best = sourceId;
      }
    }

    if (best && sourceMap[best]) return { ...sourceMap[best], source: best };
    return null;
  }

  // --- Build rate table from a single source ---

  function buildRateTable(baseRates, sources, targets, sourceId) {
    const { base, rates, indirect } = baseRates;
    const result = {};
    const all = [...new Set([...sources, ...targets])];
    if (!all.includes(base)) all.push(base);

    for (const c of all) {
      result[c] = {};
    }

    // Pass 1: base pairs (currency ↔ base)
    for (const c of all) {
      if (c === base) continue;
      const cData = rates[c];
      if (cData == null) continue;

      if (indirect) {
        // Indirect source: rates[c]={rate:X,amount:A} means 1 base = X/A c
        // base→c: amount=1, rate=X (per 1 base)
        // c→base: inverse
        result[base][c] = { [sourceId]: { amount: 1, rate: cData.rate / cData.amount, type: RATE_TYPE.PLAIN } };
        result[c][base] = { [sourceId]: { amount: 1, rate: cData.amount / cData.rate, type: RATE_TYPE.PLAIN_INVERSED } };
      } else {
        // Direct source: rates[c]={rate:X,amount:A} means A c = X base
        // c→base: amount=A, rate=X
        // base→c: inverse
        result[c][base] = { [sourceId]: { amount: cData.amount, rate: cData.rate, type: RATE_TYPE.PLAIN } };
        result[base][c] = { [sourceId]: { amount: 1, rate: cData.amount / cData.rate, type: RATE_TYPE.PLAIN_INVERSED } };
      }
    }

    // Pass 2: cross-rates (non-base ↔ non-base)
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const c1 = all[i];
        const c2 = all[j];
        if (c1 === base || c2 === base) continue;
        if (!result[c1][base] || !result[base][c2]) continue;

        const c1ToBase = result[c1][base][sourceId];
        const baseToC2 = result[base][c2][sourceId];
        if (!c1ToBase || !baseToC2) continue;

        // c1→c2 = (c1→base per-unit) × (base→c2 per-unit)
        const crossRate = (c1ToBase.rate / c1ToBase.amount) * (baseToC2.rate / baseToC2.amount);
        result[c1][c2] = { [sourceId]: { amount: 1, rate: crossRate, type: RATE_TYPE.CROSS } };
        result[c2][c1] = { [sourceId]: { amount: 1, rate: 1 / crossRate, type: RATE_TYPE.CROSS } };
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
      rateTables[sourceId] = buildRateTable(baseRates, sourceCurrencies, targetCurrencies, sourceId);
    }

    const merged = {};
    for (const c of all) merged[c] = {};

    for (const [sourceId, table] of Object.entries(rateTables)) {
      for (const [from, toMap] of Object.entries(table)) {
        for (const [to, sourceMap] of Object.entries(toMap)) {
          if (!merged[from]) merged[from] = {};
          if (!merged[from][to]) merged[from][to] = {};
          Object.assign(merged[from][to], sourceMap);
        }
      }
    }

    return { rates: merged };
  }

  // --- Custom rates ---

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
      const [rawFrom, rawTo] = parts;

      let amount, rate;
      if (typeof val === 'number') {
        // Legacy format
        amount = 1;
        rate = val;
      } else {
        amount = val.amount || 1;
        rate = val.rate;
      }

      const from = rawFrom, to = rawTo;

      if (!result[from]) result[from] = {};
      result[from][to] = { [CUSTOM_SOURCE]: { amount, rate, type: RATE_TYPE.PLAIN } };
    }
    return result;
  }

  // --- Deep clone ---

  function deepCloneRateTable(table) {
    const clone = {};
    for (const [from, toMap] of Object.entries(table)) {
      if (META_KEYS.has(from)) continue;
      clone[from] = {};
      if (toMap && typeof toMap === 'object') {
        for (const [to, sourceMap] of Object.entries(toMap)) {
          if (sourceMap && typeof sourceMap === 'object') {
            clone[from][to] = {};
            for (const [sourceId, entry] of Object.entries(sourceMap)) {
              clone[from][to][sourceId] = { ...entry };
            }
          }
        }
      }
    }
    return clone;
  }

  // --- Cache validity ---

  function isCacheValid(rates, ttlMs = 30 * 60 * 1000) {
    if (!rates || !rates.timestamp) return false;
    return Date.now() - rates.timestamp < ttlMs;
  }

  function isNewRateFormat(rates) {
    if (!rates) return false;
    // Check first non-meta key for source-tagged structure
    for (const [from, toMap] of Object.entries(rates)) {
      if (META_KEYS.has(from)) continue;
      if (!toMap || typeof toMap !== 'object') continue;
      for (const [to, sourceMap] of Object.entries(toMap)) {
        if (!sourceMap || typeof sourceMap !== 'object') continue;
        for (const entry of Object.values(sourceMap)) {
          return entry && typeof entry === 'object' && 'amount' in entry && 'rate' in entry;
        }
      }
    }
    return false;
  }

  // --- Effective rates ---

  function getEffectiveRates(settings, cachedApiRates) {
    let base;
    if (cachedApiRates && isCacheValid(cachedApiRates)) {
      base = deepCloneRateTable(cachedApiRates);
    } else {
      base = {};
    }

    // Merge custom rates
    const customNormalized = getCustomRates(settings);
    for (const [from, toMap] of Object.entries(customNormalized)) {
      if (!base[from]) base[from] = {};
      for (const [to, customSourceMap] of Object.entries(toMap)) {
        if (!base[from][to]) base[from][to] = {};
        Object.assign(base[from][to], customSourceMap);
      }
    }

    // Update _usedSources to include custom source if any custom rates exist
    const hasCustom = Object.values(settings.customRates || {}).some(v => v != null);
    if (hasCustom && base._usedSources && !base._usedSources.includes(CUSTOM_SOURCE)) {
      base._usedSources = [CUSTOM_SOURCE, ...base._usedSources];
    }

    return base;
  }

  // --- Conflicts ---

  function getEffectiveConflicts(settings, cachedRates) {
    return getConflicts(getEffectiveRates(settings, cachedRates));
  }

  function getConflicts(cachedRates) {
    if (!cachedRates) return {};
    const conflicts = {};
    for (const [from, toMap] of Object.entries(cachedRates)) {
      if (META_KEYS.has(from)) continue;
      if (!toMap || typeof toMap !== 'object') continue;
      for (const [to, sourceMap] of Object.entries(toMap)) {
        if (!sourceMap || typeof sourceMap !== 'object') continue;
        const sources = Object.keys(sourceMap).filter(k => k !== CUSTOM_SOURCE);
        if (sources.length > 1) {
          const pairKey = `${from}:${to}`;
          const apiEntries = {};
          for (const sid of sources) {
            apiEntries[sid] = sourceMap[sid];
          }
          conflicts[pairKey] = apiEntries;
        }
      }
    }
    return conflicts;
  }

  function getUsedSources(cachedRates) {
    return (cachedRates && cachedRates._usedSources) || [];
  }

  function isConflictResolved(pairKey, settings, cachedRates) {
    // Accept pre-computed effective rates to avoid N+1 scans
    const rates = (cachedRates && cachedRates._usedSources) ? cachedRates : getEffectiveRates(settings, cachedRates);
    const [from, to] = pairKey.split(':');
    const sourceMap = rates[from] && rates[from][to];
    if (!sourceMap || typeof sourceMap !== 'object') return true;
    const apiSources = Object.keys(sourceMap).filter(k => k !== CUSTOM_SOURCE);
    if (apiSources.length <= 1) return true;
    const selections = settings.rateSourceSelections || [];
    return !!findSelection(from, to, selections);
  }

  function getActiveSourceForPair(pairKey, reverseKey, settings, cachedRates) {
    const selections = settings.rateSourceSelections || [];
    const usedSources = getUsedSources(cachedRates);

    const [from, to] = pairKey.split(':');
    const sel = findSelection(from, to, selections);
    if (sel) return sel.source;

    // Check reverse
    if (reverseKey) {
      const [rFrom, rTo] = reverseKey.split(':');
      const rSel = findSelection(rFrom, rTo, selections);
      if (rSel) return rSel.source;
    }

    // Auto-select: use resolveActiveEntry with type preference
    const sourceMap = (cachedRates && cachedRates[from] && cachedRates[from][to]) ||
                      (reverseKey && cachedRates && cachedRates[rFrom] && cachedRates[rFrom][rTo]);
    if (sourceMap) {
      const entry = resolveActiveEntry(from, to, sourceMap, null, usedSources);
      if (entry) return entry.source;
    }
    return usedSources[0] || '';
  }

  // --- Display helpers ---

  function getDisplayInfoMap(rates, selections) {
    const result = {};
    const usedSources = rates._usedSources || [];

    for (const [from, toMap] of Object.entries(rates)) {
      if (META_KEYS.has(from)) continue;
      if (!toMap || typeof toMap !== 'object') continue;
      for (const [to, sourceMap] of Object.entries(toMap)) {
        if (!sourceMap || typeof sourceMap !== 'object') continue;
        const entry = resolveActiveEntry(from, to, sourceMap, selections, usedSources);
        if (entry) {
          result[`${from}:${to}`] = {
            from,
            to,
            amount: entry.amount,
            rate: entry.rate,
            source: entry.source,
            type: entry.type,
          };
        }
      }
    }
    return result;
  }

  function formatRateForDisplay(from, to, rates) {
    // Works with both old flat and new source-tagged structure
    const direct = rates[from] && rates[from][to];

    if (direct != null && typeof direct === 'object') {
      // New source-tagged structure — resolve active entry
      const usedSources = rates._usedSources || [];
      const entry = resolveActiveEntry(from, to, direct, null, usedSources);
      if (entry) {
        const perUnit = entry.rate / entry.amount;
        if (perUnit >= 1) {
          return { base: from, quote: to, rate: perUnit, amount: entry.amount, source: entry.source, type: entry.type };
        }
        return { base: to, quote: from, rate: 1 / perUnit, amount: 1, source: entry.source, type: entry.type };
      }
      return null;
    }

    if (direct != null && typeof direct === 'number') {
      // Old flat format
      if (direct >= 1) return { base: from, quote: to, rate: direct };
      return { base: to, quote: from, rate: 1 / direct };
    }

    // Try reverse
    const reverse = rates[to] && rates[to][from];
    if (reverse != null && typeof reverse === 'object') {
      const usedSources = rates._usedSources || [];
      const entry = resolveActiveEntry(to, from, reverse, null, usedSources);
      if (entry) {
        return { base: to, quote: from, rate: entry.rate / entry.amount, amount: entry.amount, source: entry.source, type: entry.type };
      }
      return null;
    }

    if (reverse != null && typeof reverse === 'number') {
      return { base: to, quote: from, rate: reverse };
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

  // --- Convert ---

  function convert(amount, fromCurrency, toCurrency, rates, selections) {
    const direct = resolveAndCompute(amount, fromCurrency, toCurrency, rates, selections);
    if (direct !== null) return direct;
    const reverse = resolveAndComputeInverse(amount, fromCurrency, toCurrency, rates, selections);
    return reverse;
  }

  function resolveAndCompute(amount, from, to, rates, selections) {
    const sourceMap = rates[from] && rates[from][to];
    if (!sourceMap || typeof sourceMap !== 'object') return null;
    const entry = resolveActiveEntry(from, to, sourceMap, selections, rates._usedSources);
    if (!entry) return null;
    return amount * (entry.rate / entry.amount);
  }

  function resolveAndComputeInverse(amount, from, to, rates, selections) {
    const sourceMap = rates[to] && rates[to][from];
    if (!sourceMap || typeof sourceMap !== 'object') return null;
    const entry = resolveActiveEntry(to, from, sourceMap, selections, rates._usedSources);
    if (!entry) return null;
    return amount / (entry.rate / entry.amount);
  }

  return {
    RATE_TYPE,
    CUSTOM_SOURCE,
    TYPE_PREFERENCE,
    getSourceCurrencies,
    getTargetCurrencies,
    getTargetCurrenciesForSource,
    buildConversionMap,
    buildRateTable,
    buildMergedRateTable,
    getCustomRates,
    deepCloneRateTable,
    isCacheValid,
    isNewRateFormat,
    getEffectiveRates,
    getConflicts,
    getEffectiveConflicts,
    getUsedSources,
    isConflictResolved,
    getActiveSourceForPair,
    getDisplayInfoMap,
    resolveActiveEntry,
    findSelection,
    setSelection,
    formatRateForDisplay,
    getCurrencyRateAvailability,
    convert,
  };
})();

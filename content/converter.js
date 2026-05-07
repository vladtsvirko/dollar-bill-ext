const ContentConverter = (() => {
  const INJECTED_ATTR = 'data-dollarbill';
  const PILL_CLASS = 'db-pill';

  function parseAmount(str) {
    const s = str.replace(/\s/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    let normalized;
    if (lastComma > lastDot) {
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      normalized = s.replace(/,/g, '');
    } else {
      normalized = s.replace(',', '.');
    }
    const n = new BigNumber(normalized);
    return n.isNaN() || !n.isFinite() ? NaN : n.toNumber();
  }

  function detectPrecision(str) {
    const lastSep = Math.max(str.lastIndexOf('.'), str.lastIndexOf(','));
    if (lastSep === -1) return 0;
    return str.length - lastSep - 1;
  }

  function formatConverted(amount, code, decimals, currentSettings) {
    if (!currentSettings || !currentSettings.currencies) return '';
    const info = currentSettings.currencies[code];
    if (!info) return '';
    return `${info.symbol}${NumberFormatter.formatNumber(amount, decimals, currentSettings.numberFormat)}`;
  }

  // Run all compiled patterns against text, return deduplicated match list.
  function findMatches(text, compiledUnambiguous, compiledAmbiguous, ambiguousCurrency) {
    if (!text || text.length < 2) return [];
    const matches = [];
    const allPatterns = compiledUnambiguous;
    for (let pi = 0; pi < allPatterns.length + (ambiguousCurrency ? compiledAmbiguous.length : 0); pi++) {
      const pattern = pi < allPatterns.length ? allPatterns[pi] : compiledAmbiguous[pi - allPatterns.length];
      const currency = pattern.currency || ambiguousCurrency;
      if (!pattern.currency && pattern.ownerCurrencies && !pattern.ownerCurrencies.includes(currency)) continue;
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const amount = parseAmount(match[1]);
        if (isNaN(amount) || amount <= 0) continue;
        matches.push({
          index: match.index,
          length: match[0].length,
          amount,
          precision: detectPrecision(match[1]),
          currency,
        });
      }
      pattern.regex.lastIndex = 0;
    }
    return matches;
  }

  // Build a single pill element with tooltip for a match → target conversion.
  function buildPill(m, tc, ratesData, currentSettings) {
    const { rates, displayInfo, usedSources, selections, conflicts } = ratesData;
    const converted = RateTables.convert(m.amount, m.currency, tc, rates, selections);
    if (converted === null || converted <= 0) return null;

    const pairKey = `${m.currency}:${tc}`;
    const reversePairKey = `${tc}:${m.currency}`;
    const info = displayInfo[pairKey] || displayInfo[reversePairKey];

    const conflictData = conflicts[pairKey] || conflicts[reversePairKey];
    const hasConflict = !!conflictData;
    const sel = RateTables.findSelection(m.currency, tc, selections);
    const isResolved = hasConflict && !!sel;

    const pill = document.createElement('span');
    pill.className = PILL_CLASS + (hasConflict && !isResolved ? ' db-pill-conflict' : '');
    const dp = Math.max(m.precision, 2);

    pill.textContent = formatConverted(converted, tc, dp, currentSettings);

    const nf = currentSettings ? currentSettings.numberFormat : null;
    const curInfo = currentSettings.currencies[tc] || {};
    const symbol = curInfo ? curInfo.symbol : tc;
    let rateStr = '';
    if (info) {
      const sourceName = RateSources.getSourceDisplayName(info.source);
      rateStr = ` (${info.amount} ${info.from} = ${NumberFormatter.formatNumber(info.rate, 4, nf)} ${info.to} \u00B7 ${sourceName}, ${info.type})`;
    }

    if (hasConflict) {
      const activeSource = info ? info.source : (usedSources[0] || '');
      const sourceName = RateSources.getSourceDisplayName(activeSource);
      if (!isResolved) {
        rateStr += ' ' + I18n.t('converter.conflictUsing', { source: sourceName });
      } else {
        rateStr += ' ' + I18n.t('converter.source', { source: sourceName });
      }
    }

    pill.setAttribute('data-db-tooltip',
      `${NumberFormatter.formatNumber(m.amount, dp, nf)} ${m.currency} \u2192 ${symbol}${NumberFormatter.formatNumber(converted, dp, nf)} ${tc}${rateStr}`
    );

    return pill;
  }

  function processTextNode(textNode, ratesData, conversionMap, ambiguousCurrency, currentSettings, compiledUnambiguous, compiledAmbiguous) {
    const text = textNode.nodeValue;
    if (!text || text.length < 2) return false;

    const parent = textNode.parentElement;
    if (!parent || parent.hasAttribute(INJECTED_ATTR)) return false;

    const matches = findMatches(text, compiledUnambiguous, compiledAmbiguous, ambiguousCurrency);
    if (matches.length === 0) return false;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let hasConversion = false;

    for (const m of matches) {
      if (m.index < lastIndex) continue;

      if (m.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }

      const originalText = text.slice(m.index, m.index + m.length);
      fragment.appendChild(document.createTextNode(originalText));

      const targets = conversionMap[m.currency] || [];
      for (const tc of targets) {
        const pill = buildPill(m, tc, ratesData, currentSettings);
        if (pill) {
          hasConversion = true;
          fragment.appendChild(pill);
        }
      }

      lastIndex = m.index + m.length;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    if (hasConversion) {
      const container = document.createElement('span');
      container.setAttribute(INJECTED_ATTR, 'true');
      container.appendChild(fragment);
      parent.replaceChild(container, textNode);
    }

    return matches.length > 0;
  }

  // Create pill elements from a raw text string (no DOM modification).
  // Returns { pills: HTMLElement[], hasConversion: boolean }.
  function createPillsFromText(text, ratesData, conversionMap, ambiguousCurrency, currentSettings, compiledUnambiguous, compiledAmbiguous) {
    const matches = findMatches(text, compiledUnambiguous, compiledAmbiguous, ambiguousCurrency);
    if (matches.length === 0) return { pills: [], hasConversion: false };

    const pills = [];
    let hasConversion = false;
    let lastIndex = 0;

    for (const m of matches) {
      if (m.index < lastIndex) continue;
      const targets = conversionMap[m.currency] || [];
      for (const tc of targets) {
        const pill = buildPill(m, tc, ratesData, currentSettings);
        if (pill) {
          hasConversion = true;
          pills.push(pill);
        }
      }
      lastIndex = m.index + m.length;
    }

    return { pills, hasConversion };
  }

  return { parseAmount, detectPrecision, processTextNode, createPillsFromText };
})();

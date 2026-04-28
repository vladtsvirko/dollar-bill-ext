const ContentConverter = (() => {
  const INJECTED_ATTR = 'data-dollarbill';
  const PILL_CLASS = 'db-pill';

  function parseAmount(str) {
    const s = str.replace(/\s/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    if (lastDot > lastComma) {
      return parseFloat(s.replace(/,/g, ''));
    }
    return parseFloat(s.replace(',', '.'));
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
    return `${info.symbol}${FormatUtils.formatNumber(amount, decimals, currentSettings.numberFormat)}`;
  }

  function processTextNode(textNode, ratesData, conversionMap, ambiguousCurrency, currentSettings, compiledUnambiguous, compiledAmbiguous) {
    const { rates, conflicts, usedSources, overrides } = ratesData;
    const text = textNode.nodeValue;
    if (!text || text.length < 2) return;

    const parent = textNode.parentElement;
    if (!parent || parent.hasAttribute(INJECTED_ATTR)) return;

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

    if (matches.length === 0) return;

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
        const converted = RateTables.convert(m.amount, m.currency, tc, rates);
        if (converted !== null && converted > 0) {
          hasConversion = true;
          const pill = document.createElement('span');

          const dispInfo = RateTables.formatRateForDisplay(m.currency, tc, rates);
          const pairKey = dispInfo ? `${dispInfo.base}:${dispInfo.quote}` : null;
          const reverseKey = dispInfo ? `${dispInfo.quote}:${dispInfo.base}` : null;
          const conflictData = (pairKey && conflicts[pairKey]) || (reverseKey && conflicts[reverseKey]);
          const hasConflict = !!conflictData;
          const isResolved = hasConflict && (overrides[pairKey] !== undefined || overrides[reverseKey] !== undefined);

          pill.className = PILL_CLASS + (hasConflict && !isResolved ? ' db-pill-conflict' : '');
          const dp = Math.max(m.precision, 2);

          pill.textContent = formatConverted(converted, tc, dp, currentSettings);

          const curInfo = currentSettings.currencies[tc];
          const symbol = curInfo ? curInfo.symbol : tc;
          const nf = currentSettings.numberFormat;
          let rateStr = dispInfo
            ? ` (1 ${dispInfo.base} = ${FormatUtils.formatNumber(dispInfo.rate, 4, nf)} ${dispInfo.quote})`
            : '';

          if (hasConflict) {
            const activeSource = overrides[pairKey] || overrides[reverseKey] || usedSources[0] || '';
            const sourceName = RateSources.getSourceDisplayName(activeSource);
            if (!isResolved) {
              rateStr += ` [CONFLICT — using ${sourceName}]`;
            } else {
              rateStr += ` [Source: ${sourceName}]`;
            }
          }

          pill.setAttribute('data-db-tooltip',
            `${FormatUtils.formatNumber(m.amount, dp, nf)} ${m.currency} \u2192 ${symbol}${FormatUtils.formatNumber(converted, dp, nf)} ${tc}${rateStr}`
          );

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
  }

  return { parseAmount, detectPrecision, processTextNode };
})();

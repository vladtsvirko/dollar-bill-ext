(() => {
  const INJECTED_ATTR = 'data-dollarbill';
  const INJECTED_CLASS = 'dollarbill-converted';

  // Avoid scanning these elements
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'SVG', 'MATH']);

  let compiledUnambiguous = [];
  let compiledAmbiguous = [];
  let compiledDomainMap = null; // precomputed domain -> currency for O(1) lookup
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

    // Build unambiguous patterns from unique identifiers
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
            compiledUnambiguous.push({ regex: new RegExp(pat, 'gi'), currency: code });
          } catch (e) {
            console.warn(`[DollarBill] Invalid pattern for ${code}: ${pat}`, e);
          }
        }
      }
    }

    // Build ambiguous patterns from shared identifiers
    compiledAmbiguous = [];
    for (const [norm, entries] of Object.entries(identifierOwners)) {
      if (entries.length <= 1) continue;
      const patterns = RatesUtil.buildPatternsFromIdentifiers([entries[0].originalId]);
      for (const pat of patterns) {
        try {
          compiledAmbiguous.push({ regex: new RegExp(pat, 'gi'), currency: null });
        } catch (e) {
          console.warn(`[DollarBill] Invalid ambiguous pattern: ${pat}`, e);
        }
      }
    }

    // Precompute domain lookup map for O(1) resolveAmbiguousCurrency
    compiledDomainMap = [];
    for (const [code, cur] of Object.entries(currencies)) {
      for (const domain of (cur.domains || [])) {
        compiledDomainMap.push({ domain: domain.toLowerCase(), code });
      }
    }
    // Sort longest-first so first match wins (most specific)
    compiledDomainMap.sort((a, b) => b.domain.length - a.domain.length);
  }

  function resolveAmbiguousCurrency(settings) {
    const host = location.hostname;
    if (settings.domainCurrencyMap && settings.domainCurrencyMap[host]) {
      return settings.domainCurrencyMap[host];
    }
    // Use precomputed domain map
    for (const { domain, code } of compiledDomainMap) {
      if (domain.startsWith('.')) {
        if (host.endsWith(domain)) return code;
      } else {
        if (host === domain || host.endsWith('.' + domain)) return code;
      }
    }
    return null;
  }

  function hasAmbiguousMatches(node) {
    if (!node) return false;
    let found = false;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.parentElement || SKIP_TAGS.has(n.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.hasAttribute(INJECTED_ATTR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let current;
    while ((current = walker.nextNode()) && !found) {
      const text = current.nodeValue;
      for (const pattern of compiledAmbiguous) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(text)) {
          found = true;
          break;
        }
      }
    }
    return found;
  }

  function showCurrencyPicker(settings) {
    const existing = document.getElementById('dollarbill-picker');
    if (existing) return;

    const host = location.hostname;
    const sources = RatesUtil.getSourceCurrencies(settings);
    const currencies = settings.currencies || {};

    const bar = document.createElement('div');
    bar.id = 'dollarbill-picker';

    let buttonsHtml = sources.map((code) => {
      const cur = currencies[code];
      const label = cur ? `${code} (${cur.name})` : code;
      return `<button class="dbp-btn" data-currency="${RatesUtil.escapeHtml(code)}">${RatesUtil.escapeHtml(label)}</button>`;
    }).join('');

    bar.innerHTML = `
      <span class="dbp-label">Dollar Bill: ambiguous prices detected on <strong>${host}</strong></span>
      <span class="dbp-label">Choose base currency:</span>
      ${buttonsHtml}
      <button class="dbp-dismiss" title="Dismiss">&times;</button>
    `;

    bar.querySelector('.dbp-dismiss').addEventListener('click', () => bar.remove());

    bar.querySelectorAll('.dbp-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const currency = btn.dataset.currency;
        const current = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'getSettings' }, resolve);
        });
        if (!current.domainCurrencyMap) current.domainCurrencyMap = {};
        current.domainCurrencyMap[host] = currency;
        await RatesUtil.saveSettings(current);
        bar.remove();
        runConversion();
      });
    });

    document.body.appendChild(bar);
  }

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

  function formatConverted(amount, code) {
    if (!currentSettings || !currentSettings.currencies) return '';
    const info = currentSettings.currencies[code];
    if (!info) return '';
    return `${info.symbol}${amount.toFixed(2)}`;
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

  function processTextNode(textNode, ratesData, conversionMap, ambiguousCurrency) {
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
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const amount = parseAmount(match[1]);
        if (isNaN(amount) || amount <= 0) continue;
        matches.push({
          index: match.index,
          length: match[0].length,
          amount,
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

      // Text before the match
      if (m.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }

      // The original price text
      const originalText = text.slice(m.index, m.index + m.length);
      fragment.appendChild(document.createTextNode(originalText));

      // Create a pill for each target currency configured for this source
      const targets = conversionMap[m.currency] || [];
      for (const tc of targets) {
        const converted = RatesUtil.convert(m.amount, m.currency, tc, rates);
        if (converted !== null && converted > 0) {
          hasConversion = true;
          const pill = document.createElement('span');

          // Check for conflict on this pair
          const dispInfo = RatesUtil.formatRateForDisplay(m.currency, tc, rates);
          const pairKey = dispInfo ? `${dispInfo.base}:${dispInfo.quote}` : null;
          const reverseKey = dispInfo ? `${dispInfo.quote}:${dispInfo.base}` : null;
          const conflictData = (pairKey && conflicts[pairKey]) || (reverseKey && conflicts[reverseKey]);
          const hasConflict = !!conflictData;
          const isResolved = hasConflict && (overrides[pairKey] !== undefined || overrides[reverseKey] !== undefined);

          pill.className = 'db-pill' + (hasConflict && !isResolved ? ' db-pill-conflict' : '');
          pill.textContent = formatConverted(converted, tc);

          const curInfo = currentSettings.currencies[tc];
          const symbol = curInfo ? curInfo.symbol : tc;
          let rateStr = dispInfo
            ? ` (1 ${dispInfo.base} = ${dispInfo.rate.toFixed(4)} ${dispInfo.quote})`
            : '';

          if (hasConflict) {
            const activeSource = overrides[pairKey] || overrides[reverseKey] || usedSources[0] || '';
            const sourceName = RatesUtil.getSourceDisplayName(activeSource);
            if (!isResolved) {
              rateStr += ` [CONFLICT — using ${sourceName}]`;
            } else {
              rateStr += ` [Source: ${sourceName}]`;
            }
          }

          pill.setAttribute('data-db-tooltip',
            `${m.amount.toFixed(2)} ${m.currency} \u2192 ${symbol}${converted.toFixed(2)} ${tc}${rateStr}`
          );

          fragment.appendChild(pill);
        }
      }

      lastIndex = m.index + m.length;
    }

    // Remaining text after last match
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

  function scanNode(node, ratesData, conversionMap, ambiguousCurrency) {
    if (!node) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.parentElement || SKIP_TAGS.has(n.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.hasAttribute(INJECTED_ATTR)) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.classList.contains(INJECTED_CLASS)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes = [];
    let current;
    while ((current = walker.nextNode())) {
      textNodes.push(current);
    }
    for (const tn of textNodes) {
      processTextNode(tn, ratesData, conversionMap, ambiguousCurrency);
    }
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
    const ambiguousCurrency = resolveAmbiguousCurrency(settings);
    scanNode(document.body, ratesData, conversionMap, ambiguousCurrency);

    if (!ambiguousCurrency && hasAmbiguousMatches(document.body)) {
      showCurrencyPicker(settings);
    }
  }

  // Initial scan
  runConversion();

  // Observe dynamic content changes with debouncing
  let debounceTimer = null;
  const pendingNodes = new Set();

  function flushPendingNodes() {
    if (pendingNodes.size === 0) return;
    const nodes = [...pendingNodes];
    pendingNodes.clear();
    debounceTimer = null;

    Promise.all([
      new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getSettings' }, resolve)),
      new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getRates' }, resolve)),
    ]).then(([settings, cachedRates]) => {
      if (!shouldProcessPage(settings)) return;
      compilePatterns(settings);
      const ratesData = getRatesForConversion(settings, cachedRates);
      if (!ratesData || !ratesData.rates) return;
      const conversionMap = RatesUtil.buildConversionMap(settings);
      const ambiguousCurrency = resolveAmbiguousCurrency(settings);
      for (const node of nodes) {
        if (node.isConnected) {
          scanNode(node, ratesData, conversionMap, ambiguousCurrency);
        }
      }
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !SKIP_TAGS.has(node.tagName)) {
          pendingNodes.add(node);
        }
      }
    }
    if (pendingNodes.size > 0) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flushPendingNodes, 300);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();

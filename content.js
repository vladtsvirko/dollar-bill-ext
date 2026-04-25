(() => {
  const INJECTED_ATTR = 'data-dollarbill';
  const INJECTED_CLASS = 'dollarbill-converted';

  // Avoid scanning these elements
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'SVG', 'MATH']);

  let compiledUnambiguous = [];
  let compiledAmbiguous = [];
  let tldCurrencyMap = {};
  let currentSettings = null;
  let lastCompiledKey = null;

  function compilePatterns(settings) {
    currentSettings = settings;
    // Skip recompilation if settings haven't changed
    const key = JSON.stringify(settings.sourceCurrencies) +
                JSON.stringify(settings.currencies) +
                JSON.stringify(settings.ambiguousPatterns);
    if (key === lastCompiledKey) return;
    lastCompiledKey = key;

    const currencies = settings.currencies || {};
    const sources = settings.sourceCurrencies || [];

    // Build unambiguous patterns from currency definitions
    compiledUnambiguous = [];
    for (const code of sources) {
      const cur = currencies[code];
      if (!cur || !cur.patterns) continue;
      for (const pat of cur.patterns) {
        try {
          compiledUnambiguous.push({
            regex: new RegExp(pat, 'gi'),
            currency: code,
          });
        } catch (e) {
          console.warn(`[DollarBill] Invalid pattern for ${code}: ${pat}`, e);
        }
      }
    }

    // Build TLD map from currency definitions
    tldCurrencyMap = {};
    for (const [code, cur] of Object.entries(currencies)) {
      if (cur.tld) {
        tldCurrencyMap[cur.tld] = code;
      }
    }

    // Build ambiguous patterns
    compiledAmbiguous = [];
    for (const pat of settings.ambiguousPatterns || []) {
      try {
        compiledAmbiguous.push({ regex: new RegExp(pat, 'gi'), currency: null });
      } catch (e) {
        console.warn(`[DollarBill] Invalid ambiguous pattern: ${pat}`, e);
      }
    }
  }

  function resolveAmbiguousCurrency(settings) {
    const host = location.hostname;
    if (settings.domainCurrencyMap && settings.domainCurrencyMap[host]) {
      return settings.domainCurrencyMap[host];
    }
    const tld = host.split('.').pop().toLowerCase();
    return tldCurrencyMap[tld] || null;
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
    const sources = settings.sourceCurrencies || [];
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
    if (settings.rateSource === 'custom') {
      return RatesUtil.getCustomRates(settings);
    }
    if (cachedRates && RatesUtil.isCacheValid(cachedRates)) {
      return cachedRates;
    }
    return null;
  }

  function processTextNode(textNode, rates, targetCurrencies, ambiguousCurrency) {
    const text = textNode.nodeValue;
    if (!text || text.length < 2) return;

    const parent = textNode.parentElement;
    if (!parent || parent.hasAttribute(INJECTED_ATTR)) return;

    const matches = [];

    const allPatterns = [...compiledUnambiguous, ...(ambiguousCurrency ? compiledAmbiguous : [])];
    for (const pattern of allPatterns) {
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

    const parts = [];
    let lastIndex = 0;
    for (const m of matches) {
      if (m.index < lastIndex) continue;
      parts.push(text.slice(lastIndex, m.index + m.length));

      const conversions = [];
      for (const tc of targetCurrencies) {
        const converted = RatesUtil.convert(m.amount, m.currency, tc, rates);
        if (converted !== null && converted > 0) {
          conversions.push(formatConverted(converted, tc));
        }
      }

      if (conversions.length > 0) {
        parts.push(` (${conversions.join(' / ')})`);
      }
      lastIndex = m.index + m.length;
    }
    parts.push(text.slice(lastIndex));

    const newText = parts.join('');
    if (newText !== text) {
      const span = document.createElement('span');
      span.setAttribute(INJECTED_ATTR, 'true');
      span.textContent = newText;
      parent.replaceChild(span, textNode);
    }
  }

  function scanNode(node, rates, targetCurrencies, ambiguousCurrency) {
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
      processTextNode(tn, rates, targetCurrencies, ambiguousCurrency);
    }
  }

  async function runConversion() {
    const [settings, cachedRates] = await Promise.all([
      new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getSettings' }, resolve)),
      new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getRates' }, resolve)),
    ]);

    if (!shouldProcessPage(settings)) return;

    compilePatterns(settings);

    const rates = getRatesForConversion(settings, cachedRates);
    if (!rates) return;

    const ambiguousCurrency = resolveAmbiguousCurrency(settings);
    scanNode(document.body, rates, settings.targetCurrencies, ambiguousCurrency);

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
      const rates = getRatesForConversion(settings, cachedRates);
      if (!rates) return;
      const ambiguousCurrency = resolveAmbiguousCurrency(settings);
      for (const node of nodes) {
        if (node.isConnected) {
          scanNode(node, rates, settings.targetCurrencies, ambiguousCurrency);
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

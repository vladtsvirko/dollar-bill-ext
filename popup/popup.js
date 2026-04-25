const enabledEl = document.getElementById('enabled');
const rateCardsEl = document.getElementById('rateCards');
const sourceTrigger = document.getElementById('sourceTrigger');
const sourceNameEl = document.getElementById('sourceName');
const sourceTimeEl = document.getElementById('sourceTime');
const sourceReload = document.getElementById('sourceReload');
const sourceDropdown = document.getElementById('sourceDropdown');
const converterFrom = document.getElementById('converterFrom');
const converterTo = document.getElementById('converterTo');
const converterInput = document.getElementById('converterInput');
const converterResult = document.getElementById('converterResult');
const siteIndicator = document.getElementById('siteIndicator');
const settingsLink = document.getElementById('settingsLink');

let currentSettings = null;
let currentRates = null;

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getSourceDisplayName(sourceId) {
  if (sourceId === 'custom') return 'Custom';
  const source = RatesUtil.RATE_SOURCES[sourceId];
  return source ? source.name : sourceId;
}

// --- Source dropdown ---

function renderSourceDropdown(settings) {
  const currentSource = settings.rateSource || 'nbrb';
  sourceNameEl.textContent = getSourceDisplayName(currentSource);

  const options = [];
  for (const [id, src] of Object.entries(RatesUtil.RATE_SOURCES)) {
    options.push({ id, name: src.name });
  }
  options.push({ id: 'custom', name: 'Custom' });

  sourceDropdown.innerHTML = options.map(opt => `
    <div class="source-option${opt.id === currentSource ? ' active' : ''}" data-source="${opt.id}">
      <span class="source-option-radio"></span>
      <span>${RatesUtil.escapeHtml(opt.name)}</span>
    </div>
  `).join('');
}

function toggleDropdown(forceClose) {
  const isOpen = sourceDropdown.classList.contains('open');
  if (forceClose || isOpen) {
    sourceDropdown.classList.remove('open');
  } else {
    sourceDropdown.classList.add('open');
  }
}

sourceTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDropdown();
});

document.addEventListener('click', (e) => {
  if (!sourceDropdown.contains(e.target) && !sourceTrigger.contains(e.target)) {
    sourceDropdown.classList.remove('open');
  }
});

sourceDropdown.addEventListener('click', async (e) => {
  const option = e.target.closest('.source-option');
  if (!option) return;
  const sourceId = option.dataset.source;
  if (sourceId === currentSettings.rateSource) {
    toggleDropdown(true);
    return;
  }

  currentSettings.rateSource = sourceId;
  await RatesUtil.saveSettings(currentSettings);
  toggleDropdown(true);
  renderSourceDropdown(currentSettings);
  renderRateCards(currentRates, currentSettings);
  populateConverterSelects(currentSettings);

  // Trigger rate refresh for non-custom sources
  if (sourceId !== 'custom') {
    await refreshRates();
  } else {
    // For custom, rebuild rates from customRates
    currentRates = RatesUtil.getCustomRates(currentSettings);
    currentRates.timestamp = Date.now();
    renderRateCards(currentRates, currentSettings);
    renderSourceTimestamp(currentRates);
  }
});

// --- Reload button ---

async function refreshRates() {
  sourceReload.classList.add('loading');
  try {
    const rates = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'updateRates' }, resolve);
    });
    if (rates) {
      currentRates = rates;
      renderRateCards(currentRates, currentSettings);
      renderSourceTimestamp(currentRates);
      // Re-run converter if there's a value
      if (converterInput.value.trim()) {
        renderConverter(converterInput.value.trim(), currentRates, currentSettings);
      }
    }
  } finally {
    sourceReload.classList.remove('loading');
  }
}

sourceReload.addEventListener('click', refreshRates);

function renderSourceTimestamp(rates) {
  sourceTimeEl.textContent = formatTimestamp(rates && rates.timestamp);
}

// --- Rate cards ---

function renderRateCards(rates, settings) {
  if (!rates || !rates.timestamp) {
    rateCardsEl.innerHTML = '<div class="rate-card-skeleton">No rates available</div>';
    return;
  }

  const sources = settings.sourceCurrencies || [];
  const targets = settings.targetCurrencies || [];
  const currencies = settings.currencies || {};
  const isCustom = settings.rateSource === 'custom';

  const cards = [];
  const seen = new Set();
  for (const from of sources) {
    for (const to of targets) {
      if (from === to) continue;
      const pairKey = [from, to].sort().join(':');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const rateInfo = RatesUtil.formatRateForDisplay(from, to, rates);
      if (!rateInfo) continue;
      const baseCur = currencies[rateInfo.base] || {};
      const quoteCur = currencies[rateInfo.quote] || {};
      const baseSymbol = baseCur.symbol || rateInfo.base;
      const quoteSymbol = quoteCur.symbol || rateInfo.quote;

      if (isCustom) {
        const pairKeyCustom = `${rateInfo.base}:${rateInfo.quote}`;
        cards.push(`
          <div class="rate-card" data-pair="${pairKeyCustom}">
            <div class="rate-card-left">
              <div class="rate-card-flag">${RatesUtil.escapeHtml(baseSymbol)}</div>
              <div>
                <div class="rate-card-label">1 ${rateInfo.base} =</div>
              </div>
            </div>
            <input class="rate-card-value-input" type="text"
              value="${rateInfo.rate.toFixed(4)}"
              data-base="${rateInfo.base}" data-quote="${rateInfo.quote}">
          </div>
        `);
      } else {
        cards.push(`
          <div class="rate-card">
            <div class="rate-card-left">
              <div class="rate-card-flag">${RatesUtil.escapeHtml(baseSymbol)}</div>
              <div>
                <div class="rate-card-label">1 ${rateInfo.base} =</div>
              </div>
            </div>
            <div class="rate-card-value">${quoteSymbol}${rateInfo.rate.toFixed(4)} ${rateInfo.quote}</div>
          </div>
        `);
      }
    }
  }

  rateCardsEl.innerHTML = cards.length
    ? cards.join('')
    : '<div class="rate-card-skeleton">No rates available</div>';

  // Attach listeners for custom rate inputs
  if (isCustom) {
    rateCardsEl.querySelectorAll('.rate-card-value-input').forEach(input => {
      input.addEventListener('change', handleCustomRateChange);
    });
  }
}

async function handleCustomRateChange(e) {
  const input = e.target;
  const base = input.dataset.base;
  const quote = input.dataset.quote;
  const val = parseFloat(input.value);
  if (isNaN(val) || val <= 0) return;

  if (!currentSettings.customRates) currentSettings.customRates = {};
  currentSettings.customRates[`${base}:${quote}`] = val;
  await RatesUtil.saveSettings(currentSettings);

  // Rebuild custom rates
  currentRates = RatesUtil.getCustomRates(currentSettings);
  currentRates.timestamp = Date.now();
  renderSourceTimestamp(currentRates);

  // Re-run converter
  if (converterInput.value.trim()) {
    renderConverter(converterInput.value.trim(), currentRates, currentSettings);
  }
}

// --- Quick Convert with currency selectors ---

function populateConverterSelects(settings) {
  const currencies = settings.currencies || {};
  const allCodes = Object.keys(currencies);
  if (allCodes.length === 0) return;

  const prevFrom = converterFrom.value;
  const prevTo = converterTo.value;

  const makeOptions = (selected) => {
    return allCodes.map(code =>
      `<option value="${code}"${code === selected ? ' selected' : ''}>${code}</option>`
    ).join('');
  };

  const defaultFrom = settings.sourceCurrencies && settings.sourceCurrencies[0]
    ? settings.sourceCurrencies[0] : allCodes[0];
  const defaultTo = settings.targetCurrencies && settings.targetCurrencies[0]
    ? settings.targetCurrencies[0] : allCodes[allCodes.length > 1 ? 1 : 0];

  converterFrom.innerHTML = makeOptions(allCodes.includes(prevFrom) ? prevFrom : defaultFrom);
  converterTo.innerHTML = makeOptions(allCodes.includes(prevTo) ? prevTo : defaultTo);
}

function renderConverter(value, rates, settings) {
  if (!value || isNaN(value) || !rates || !settings) {
    converterResult.innerHTML = '';
    return;
  }

  const amount = parseFloat(value);
  if (isNaN(amount) || amount === 0) {
    converterResult.innerHTML = '';
    return;
  }

  const from = converterFrom.value;
  const to = converterTo.value;
  if (!from || !to || from === to) {
    converterResult.innerHTML = '';
    return;
  }

  const converted = RatesUtil.convert(amount, from, to, rates);
  if (converted === null) {
    converterResult.innerHTML = '';
    return;
  }

  const toInfo = (settings.currencies || {})[to] || {};
  const symbol = toInfo.symbol || to;

  converterResult.innerHTML = `
    <div class="converter-result-line">
      <span class="converter-result-symbol">${from} \u2192 ${to}</span>
      <span class="converter-result-value">${symbol}${converted.toFixed(2)}</span>
    </div>
  `;
}

converterFrom.addEventListener('change', () => {
  renderConverter(converterInput.value.trim(), currentRates, currentSettings);
});
converterTo.addEventListener('change', () => {
  renderConverter(converterInput.value.trim(), currentRates, currentSettings);
});

// --- Main load ---

async function loadPopup() {
  const [settings, rates] = await Promise.all([
    new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getSettings' }, resolve)),
    new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getRates' }, resolve)),
  ]);

  currentSettings = settings;
  currentRates = rates;

  enabledEl.checked = settings.enabled;
  renderSourceDropdown(settings);
  renderSourceTimestamp(rates);
  renderRateCards(rates, settings);
  populateConverterSelects(settings);

  // Site indicator
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      const host = url.hostname;
      const isActive = settings.enabled;
      siteIndicator.textContent = isActive ? `\u2713 ${host}` : `\u2717 ${host}`;
      siteIndicator.style.color = isActive ? 'var(--db-green)' : '#999';
    }
  } catch {
    siteIndicator.textContent = '';
  }

  converterInput.addEventListener('input', () => {
    renderConverter(converterInput.value.trim(), currentRates, currentSettings);
  });
}

enabledEl.addEventListener('change', async () => {
  const settings = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'getSettings' }, resolve);
  });
  settings.enabled = enabledEl.checked;
  await RatesUtil.saveSettings(settings);
  currentSettings = settings;
});

settingsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

loadPopup();

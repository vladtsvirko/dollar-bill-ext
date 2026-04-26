const enabledEl = document.getElementById('enabled');
const rateCardsEl = document.getElementById('rateCards');
const sourceTrigger = document.getElementById('sourceTrigger');
const sourceNameEl = document.getElementById('sourceName');
const sourceTimeEl = document.getElementById('sourceTime');
const sourceReload = document.getElementById('sourceReload');
const sourceDropdown = document.getElementById('sourceDropdown');
const sourceDot = document.getElementById('sourceDot');
const sourceTooltip = document.getElementById('sourceTooltip');
const converterFrom = document.getElementById('converterFrom');
const converterTo = document.getElementById('converterTo');
const converterInput = document.getElementById('converterInput');
const converterResult = document.getElementById('converterResult');
const siteIndicator = document.getElementById('siteIndicator');
const settingsLink = document.getElementById('settingsLink');
const themeSegmented = document.getElementById('themeSegmented');
const pairChipsEl = document.getElementById('pairChips');
const conflictBanner = document.getElementById('conflictBanner');
const conflictBannerText = document.getElementById('conflictBannerText');

let currentSettings = null;
let currentRates = null;
let currentConflicts = {};

// --- Theme ---

const RESET_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function detectSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getThemeSetting() {
  return currentSettings && currentSettings.theme ? currentSettings.theme : '';
}

function getEffectiveTheme() {
  const setting = getThemeSetting();
  return setting ? setting : detectSystemTheme();
}

function setTheme(themeSetting) {
  if (!currentSettings) return;
  currentSettings.theme = themeSetting || null;
  applyTheme(getEffectiveTheme());
  renderThemeSegmented();
  RatesUtil.saveSettings(currentSettings);
}

function renderThemeSegmented() {
  const active = getThemeSetting();
  themeSegmented.querySelectorAll('.theme-seg').forEach(btn => {
    const val = btn.dataset.themeValue;
    btn.classList.toggle('active', val === active);
  });
}

themeSegmented.addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-seg');
  if (!btn) return;
  setTheme(btn.dataset.themeValue);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!getThemeSetting()) {
    applyTheme(detectSystemTheme());
  }
});

// --- Fetch status ---

function renderFetchStatus(fetchStatus, rates) {
  const state = RatesUtil.getFetchState(fetchStatus, rates);
  sourceDot.className = 'source-dot source-dot-' + state;

  const lines = [];
  if (fetchStatus && fetchStatus.lastFetchTime) {
    lines.push('Last fetch: ' + RatesUtil.formatTimestamp(fetchStatus.lastFetchTime, currentSettings.timeFormat));
  }
  if (fetchStatus && fetchStatus.lastSuccessTime) {
    lines.push('Last success: ' + RatesUtil.formatTimestamp(fetchStatus.lastSuccessTime, currentSettings.timeFormat));
  }
  if (rates && rates.timestamp) {
    lines.push('Cache age: ' + RatesUtil.formatCacheAge(rates));
  }
  if (fetchStatus && fetchStatus.lastError) {
    lines.push('Error: ' + fetchStatus.lastError);
    if (fetchStatus.consecutiveFailures > 1) {
      lines.push('Failed ' + fetchStatus.consecutiveFailures + ' times in a row');
    }
  }
  if (lines.length === 0) {
    lines.push('No fetch data yet');
  }
  sourceTooltip.innerHTML = lines.map(l => RatesUtil.escapeHtml(l)).join('<br>');
}

sourceTrigger.addEventListener('mouseenter', () => {
  sourceTooltip.classList.add('show');
});
sourceTrigger.addEventListener('mouseleave', () => {
  sourceTooltip.classList.remove('show');
});

// --- Source dropdown (multi-select) ---

function renderSourceDropdown(settings) {
  const selectedSources = settings.rateSources || [];
  if (selectedSources.length === 0) {
    sourceNameEl.textContent = 'No source';
  } else if (selectedSources.length === 1) {
    sourceNameEl.textContent = RatesUtil.getSourceDisplayName(selectedSources[0]);
  } else {
    sourceNameEl.textContent = selectedSources.length + ' sources';
  }

  const options = [];
  for (const [id, src] of Object.entries(RatesUtil.RATE_SOURCES)) {
    options.push({ id, name: src.name });
  }

  sourceDropdown.innerHTML = options.map(opt => `
    <div class="source-option${selectedSources.includes(opt.id) ? ' active' : ''}" data-source="${opt.id}">
      <span class="source-option-check"></span>
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
  const sources = currentSettings.rateSources || [];
  const idx = sources.indexOf(sourceId);

  if (idx >= 0) {
    sources.splice(idx, 1);
  } else {
    sources.push(sourceId);
  }

  currentSettings.rateSources = sources;
  await RatesUtil.saveSettings(currentSettings);
  renderSourceDropdown(currentSettings);

  await refreshRates();
});

// --- Reload button ---

async function refreshRates() {
  sourceReload.classList.add('loading');
  try {
    const { rates, fetchStatus } = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'updateRates' }, resolve);
    });
    if (rates) {
      currentRates = rates;
      currentConflicts = RatesUtil.getConflicts(rates);
      renderConflictBanner();
      renderRateCards(currentRates, currentSettings);
      renderSourceTimestamp(currentRates);
      if (converterInput.value.trim()) {
        renderConverter(converterInput.value.trim(), currentRates, currentSettings);
      }
    }
    renderFetchStatus(fetchStatus, rates || currentRates);
  } finally {
    sourceReload.classList.remove('loading');
  }
}

sourceReload.addEventListener('click', refreshRates);

function renderSourceTimestamp(rates) {
  sourceTimeEl.textContent = RatesUtil.formatTimestamp(rates && rates.timestamp, currentSettings.timeFormat);
}

// --- Conflict banner ---

function renderConflictBanner() {
  const unresolvedCount = Object.keys(currentConflicts).filter(pairKey => {
    return !RatesUtil.isConflictResolved(pairKey, currentSettings, currentRates);
  }).length;

  if (unresolvedCount > 0) {
    conflictBanner.style.display = 'flex';
    conflictBannerText.textContent = unresolvedCount === 1
      ? '1 rate has conflicting values between sources'
      : unresolvedCount + ' rates have conflicting values between sources';
  } else {
    conflictBanner.style.display = 'none';
  }
}

// --- Rate cards ---

let effectiveRatesCache = null;
let effectiveRatesInput = null;

function getEffectiveRates(settings, cachedRates) {
  const key = cachedRates && cachedRates.timestamp;
  if (effectiveRatesCache && effectiveRatesInput === key) return effectiveRatesCache;
  effectiveRatesCache = RatesUtil.getEffectiveRates(settings, cachedRates);
  effectiveRatesInput = key;
  return effectiveRatesCache;
}

function invalidateEffectiveRates() {
  effectiveRatesCache = null;
  effectiveRatesInput = null;
}

function renderRateCards(cachedRates, settings) {
  const rates = getEffectiveRates(settings, cachedRates);

  const pairs = settings.conversionPairs || [];
  const currencies = settings.currencies || {};

  if (pairs.length === 0 || !rates || Object.keys(rates).length === 0) {
    rateCardsEl.innerHTML = '<div class="rate-card-skeleton">No rates available</div>';
    return;
  }

  const cards = [];
  const seen = new Set();
  for (const pair of pairs) {
    const pairKey = [pair.from, pair.to].sort().join(':');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const rateInfo = RatesUtil.formatRateForDisplay(pair.from, pair.to, rates);
    if (!rateInfo) continue;
    const baseCur = currencies[rateInfo.base] || {};
    const baseSymbol = baseCur.symbol || rateInfo.base;

    const customPairKey = `${rateInfo.base}:${rateInfo.quote}`;
    const reversePairKey = `${rateInfo.quote}:${rateInfo.base}`;
    const hasOverride = settings.customRates && (
      settings.customRates[customPairKey] != null ||
      settings.customRates[reversePairKey] != null
    );

    // Check for conflict on this pair
    const conflictData = currentConflicts[customPairKey] || currentConflicts[reversePairKey];
    const isConflict = !!conflictData;

    // Determine which source is currently used
    let sourceTag = '';
    if (isConflict) {
      const activeSource = RatesUtil.getActiveSourceForPair(customPairKey, reversePairKey, settings, cachedRates);
      sourceTag = `<span class="rate-source-picker" data-pair="${customPairKey}" title="Click to change source">${RatesUtil.escapeHtml(RatesUtil.getSourceDisplayName(activeSource))}</span>`;
    }

    cards.push(`
      <div class="rate-card${hasOverride ? ' rate-card-custom' : ''}${isConflict && !hasOverride ? ' rate-card-conflict' : ''}" data-pair="${customPairKey}">
        <div class="rate-card-left">
          <div class="rate-card-flag">${RatesUtil.escapeHtml(baseSymbol)}</div>
          <div class="rate-card-label">1 <code>${rateInfo.base}</code> =</div>
        </div>
        <div class="rate-card-right">
          ${sourceTag}
          <div class="rate-input-group">
            <input class="rate-card-value-input" type="text"
              value="${rateInfo.rate.toFixed(4)}"
              data-base="${rateInfo.base}" data-quote="${rateInfo.quote}">
            <span class="rate-input-code">${rateInfo.quote}</span>
          </div>
          ${hasOverride ? `<button class="rate-card-reset" title="Reset to fetched rate" data-base="${rateInfo.base}" data-quote="${rateInfo.quote}">${RESET_SVG}</button>` : ''}
        </div>
      </div>
    `);
  }

  rateCardsEl.innerHTML = cards.length
    ? cards.join('')
    : '<div class="rate-card-skeleton">No rates available</div>';

  rateCardsEl.querySelectorAll('.rate-card-value-input').forEach(input => {
    input.addEventListener('change', handleCustomRateChange);
  });

  rateCardsEl.querySelectorAll('.rate-card-reset').forEach(btn => {
    btn.addEventListener('click', handleCustomRateReset);
  });

  rateCardsEl.querySelectorAll('.rate-source-picker').forEach(el => {
    el.addEventListener('click', handleSourcePickerClick);
  });
}

async function handleSourcePickerClick(e) {
  const el = e.currentTarget;
  const customPairKey = el.dataset.pair;
  const conflictData = currentConflicts[customPairKey];
  if (!conflictData) return;

  const sourceIds = Object.keys(conflictData);
  const currentOverride = (currentSettings.rateSourceOverrides || {})[customPairKey];
  const usedSources = RatesUtil.getUsedSources(currentRates);

  // Cycle to next source
  const currentIdx = currentOverride
    ? sourceIds.indexOf(currentOverride)
    : sourceIds.indexOf(usedSources[0]);
  const nextIdx = (currentIdx + 1) % sourceIds.length;
  const nextSource = sourceIds[nextIdx];

  if (!currentSettings.rateSourceOverrides) currentSettings.rateSourceOverrides = {};
  currentSettings.rateSourceOverrides[customPairKey] = nextSource;
  await RatesUtil.saveSettings(currentSettings);

  invalidateEffectiveRates();
  renderRateCards(currentRates, currentSettings);
  renderConflictBanner();
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

  invalidateEffectiveRates();
  renderRateCards(currentRates, currentSettings);
  renderSourceTimestamp(currentRates);

  if (converterInput.value.trim()) {
    renderConverter(converterInput.value.trim(), currentRates, currentSettings);
  }
}

async function handleCustomRateReset(e) {
  const btn = e.currentTarget;
  const base = btn.dataset.base;
  const quote = btn.dataset.quote;

  if (!currentSettings.customRates) return;
  delete currentSettings.customRates[`${base}:${quote}`];
  await RatesUtil.saveSettings(currentSettings);

  invalidateEffectiveRates();
  renderRateCards(currentRates, currentSettings);
  renderSourceTimestamp(currentRates);

  if (converterInput.value.trim()) {
    renderConverter(converterInput.value.trim(), currentRates, currentSettings);
  }
}

// --- Conversion Pairs ---

function renderPairChips(settings) {
  const pairs = settings.conversionPairs || [];
  pairChipsEl.innerHTML = pairs.map((p, i) => `
    <span class="pair-chip">${p.from} <span class="pair-chip-arrow">&rarr;</span> ${p.to}
      <button class="pair-chip-remove" data-index="${i}" title="Remove pair">&times;</button>
    </span>
  `).join('') + '<button class="pair-chip-add" id="addPairPopup" title="Add conversion pair">+</button>';

  pairChipsEl.querySelectorAll('.pair-chip-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index);
      currentSettings.conversionPairs.splice(idx, 1);
      await RatesUtil.saveSettings(currentSettings);
      renderPairChips(currentSettings);
      renderRateCards(currentRates, currentSettings);
      populateConverterSelects(currentSettings);
    });
  });

  document.getElementById('addPairPopup').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// --- Quick Convert ---

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

  const firstPair = settings.conversionPairs && settings.conversionPairs[0];
  const defaultFrom = firstPair ? firstPair.from : allCodes[0];
  const defaultTo = firstPair ? firstPair.to : allCodes[allCodes.length > 1 ? 1 : 0];

  converterFrom.innerHTML = makeOptions(allCodes.includes(prevFrom) ? prevFrom : defaultFrom);
  converterTo.innerHTML = makeOptions(allCodes.includes(prevTo) ? prevTo : defaultTo);
}

function renderConverter(value, cachedRates, settings) {
  if (!value || isNaN(value) || !settings) {
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

  const rates = getEffectiveRates(settings, cachedRates);
  const converted = RatesUtil.convert(amount, from, to, rates);
  if (converted === null) {
    converterResult.innerHTML = '';
    return;
  }

  const toInfo = (settings.currencies || {})[to] || {};
  const symbol = toInfo.symbol || to;

  const nf = settings.numberFormat;
  converterResult.innerHTML = `
    <div class="converter-result-line">
      <span class="converter-result-symbol">${from} \u2192 ${to}</span>
      <span class="converter-result-value">${symbol}${RatesUtil.formatNumber(converted, 2, nf)}</span>
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
  const [settings, rates, fetchStatus] = await Promise.all([
    new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getSettings' }, resolve)),
    new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getRates' }, resolve)),
    new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getFetchStatus' }, resolve)),
  ]);

  currentSettings = settings;
  currentRates = rates;
  currentConflicts = RatesUtil.getConflicts(rates);

  enabledEl.checked = settings.enabled;

  applyTheme(getEffectiveTheme());
  renderThemeSegmented();
  renderSourceDropdown(settings);
  renderSourceTimestamp(rates);
  renderFetchStatus(fetchStatus, rates);
  renderConflictBanner();
  renderRateCards(rates, settings);
  renderPairChips(settings);
  populateConverterSelects(settings);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      const host = url.hostname;
      const isActive = settings.enabled;
      siteIndicator.textContent = isActive ? `\u2713 ${host}` : `\u2717 ${host}`;
      siteIndicator.style.color = isActive ? 'var(--accent)' : 'var(--text-tertiary)';
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

const rateSourceBoxes = document.querySelectorAll('input[name="rateSource"]');
const customRatesSection = document.getElementById('customRatesSection');
const customRatesGrid = document.getElementById('customRatesGrid');
const siteModeRadios = document.querySelectorAll('input[name="siteMode"]');
const whitelistSection = document.getElementById('whitelistSection');
const whitelistEl = document.getElementById('whitelist');
const ambiguousPatternsEl = document.getElementById('ambiguousPatterns');
const saveToast = document.getElementById('saveToast');
const optEnabled = document.getElementById('optEnabled');
const themeOptions = document.getElementById('themeOptions');
const timeOptions = document.getElementById('timeOptions');

// Reload & loaded rates
const reloadRatesBtn = document.getElementById('reloadRatesBtn');
const toggleLoadedRatesBtn = document.getElementById('toggleLoadedRates');
const loadedRatesContent = document.getElementById('loadedRatesContent');
const loadedRatesList = document.getElementById('loadedRatesList');
const loadedRatesToggleLabel = document.getElementById('loadedRatesToggleLabel');
const loadedRatesChevron = document.getElementById('loadedRatesChevron');
let loadedRatesExpanded = false;
let currentLoadedRates = null;

// Conversion pairs
const pairChips = document.getElementById('pairChips');
const addPairFrom = document.getElementById('addPairFrom');
const addPairTo = document.getElementById('addPairTo');
const addPairBtn = document.getElementById('addPairBtn');

// Currency library
const currencyLibrary = document.getElementById('currencyLibrary');
const addCurrencyBtn = document.getElementById('addCurrencyBtn');
const currencyEditor = document.getElementById('currencyEditor');
const editCode = document.getElementById('editCode');
const editName = document.getElementById('editName');
const editSymbol = document.getElementById('editSymbol');
const editTld = document.getElementById('editTld');
const editPatterns = document.getElementById('editPatterns');
const saveCurrencyBtn = document.getElementById('saveCurrencyBtn');
const cancelCurrencyBtn = document.getElementById('cancelCurrencyBtn');

// Quick site add
const addCurrentSiteBtn = document.getElementById('addCurrentSiteBtn');

let currentSettings = null;
let currentRates = null;
let currentFetchStatus = null;
let editingCurrency = null;
let autoSaveTimer = null;

// ---- Fetch Status ----

function renderFetchStatus(fetchStatus, rates) {
  const dot = document.getElementById('fetchStatusDot');
  const title = document.getElementById('fetchStatusTitle');
  const details = document.getElementById('fetchStatusDetails');

  const state = RatesUtil.getFetchState(fetchStatus, rates);

  if (state === 'error') {
    dot.className = 'fetch-status-dot fetch-status-dot-error';
    title.textContent = 'Fetch failed';
    title.className = 'fetch-status-title fetch-status-title-error';
  } else if (state === 'stale') {
    dot.className = 'fetch-status-dot fetch-status-dot-stale';
    title.textContent = (fetchStatus && fetchStatus.lastFetchTime) ? 'Rates are stale' : 'No fetch data';
    title.className = 'fetch-status-title';
  } else {
    dot.className = 'fetch-status-dot fetch-status-dot-ok';
    title.textContent = 'Up to date';
    title.className = 'fetch-status-title';
  }

  const rows = [];
  if (fetchStatus && fetchStatus.lastFetchTime) {
    rows.push(['Last fetch attempt', RatesUtil.formatTimestamp(fetchStatus.lastFetchTime, currentSettings.timeFormat, 'Never')]);
  }
  if (fetchStatus && fetchStatus.lastSuccessTime) {
    rows.push(['Last successful fetch', RatesUtil.formatTimestamp(fetchStatus.lastSuccessTime, currentSettings.timeFormat, 'Never')]);
  }
  if (rates && rates.timestamp) {
    rows.push(['Cache age', RatesUtil.formatCacheAge(rates)]);
    rows.push(['Cache timestamp', RatesUtil.formatTimestamp(rates.timestamp, currentSettings.timeFormat, 'Never')]);
  }
  const usedSources = RatesUtil.getUsedSources(rates);
  if (usedSources.length > 0) {
    rows.push(['Sources', usedSources.map(id => RatesUtil.getSourceDisplayName(id)).join(', ')]);
  }
  if (fetchStatus && fetchStatus.lastError) {
    rows.push(['Error', fetchStatus.lastError]);
    if (fetchStatus.consecutiveFailures > 1) {
      rows.push(['Consecutive failures', fetchStatus.consecutiveFailures]);
    }
  }

  details.innerHTML = rows.map(([label, value]) =>
    `<div class="fetch-status-row"><span class="fetch-status-label">${RatesUtil.escapeHtml(label)}</span><span class="fetch-status-value">${RatesUtil.escapeHtml(value)}</span></div>`
  ).join('');
}

// ---- Reload Rates ----

async function reloadRates() {
  reloadRatesBtn.classList.add('loading');
  reloadRatesBtn.disabled = true;
  try {
    const { rates, fetchStatus, loadedRates } = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'updateRates' }, resolve);
    });
    if (rates) currentRates = rates;
    if (fetchStatus) currentFetchStatus = fetchStatus;
    if (loadedRates) currentLoadedRates = loadedRates;
    renderFetchStatus(currentFetchStatus, currentRates);
    renderLoadedRates(currentLoadedRates);
  } finally {
    reloadRatesBtn.classList.remove('loading');
    reloadRatesBtn.disabled = false;
  }
}

reloadRatesBtn.addEventListener('click', reloadRates);

// ---- Loaded Rates ----

function renderLoadedRates(loadedRatesMap) {
  if (!loadedRatesMap || typeof loadedRatesMap !== 'object' || Object.keys(loadedRatesMap).length === 0) {
    loadedRatesList.innerHTML = '<p class="hint">No rates loaded yet.</p>';
    updateLoadedRatesToggleLabel(null);
    return;
  }

  let html = '';
  let totalCount = 0;

  for (const [sourceId, loadedRates] of Object.entries(loadedRatesMap)) {
    if (!loadedRates || !loadedRates.rates) continue;
    const base = loadedRates.base;
    const convention = loadedRates.convention;
    const entries = Object.entries(loadedRates.rates)
      .filter(([code]) => code !== base)
      .sort((a, b) => a[0].localeCompare(b[0]));

    totalCount += entries.length;
    const sourceName = RatesUtil.getSourceDisplayName(sourceId);
    const age = loadedRates.timestamp ? RatesUtil.formatCacheAge(loadedRates) : '';

    html += `<div class="loaded-rates-meta">${RatesUtil.escapeHtml(sourceName)} &middot; ${entries.length} currencies${age ? ' &middot; ' + RatesUtil.escapeHtml(age) + ' ago' : ''}</div>`;
    html += '<div class="loaded-rates-grid">';
    html += `<div class="loaded-rates-header"><span>Code</span><span>1 ${RatesUtil.escapeHtml(base)} =</span></div>`;
    for (const [code, rate] of entries) {
      const displayRate = convention === 'direct'
        ? (rate > 0 ? (1 / rate).toFixed(4) : '&mdash;')
        : (rate > 0 ? rate.toFixed(4) : '&mdash;');
      html += `<div class="loaded-rates-row"><span class="loaded-rates-code">${RatesUtil.escapeHtml(code)}</span><span class="loaded-rates-value">${displayRate}</span></div>`;
    }
    html += '</div>';
  }

  loadedRatesList.innerHTML = html || '<p class="hint">No rates loaded yet.</p>';
  updateLoadedRatesToggleLabel({ count: totalCount });
}

function updateLoadedRatesToggleLabel(info) {
  const count = info && info.count;
  if (count) {
    loadedRatesToggleLabel.textContent = loadedRatesExpanded
      ? `Hide loaded rates (${count})`
      : `Show loaded rates (${count})`;
  } else {
    loadedRatesToggleLabel.textContent = loadedRatesExpanded
      ? 'Hide loaded rates'
      : 'Show loaded rates';
  }
  loadedRatesChevron.style.transform = loadedRatesExpanded ? 'rotate(180deg)' : '';
}

toggleLoadedRatesBtn.addEventListener('click', () => {
  loadedRatesExpanded = !loadedRatesExpanded;
  loadedRatesContent.style.display = loadedRatesExpanded ? 'block' : 'none';
  updateLoadedRatesToggleLabel(currentLoadedRates && Object.keys(currentLoadedRates).length > 0
    ? { count: Object.values(currentLoadedRates).reduce((sum, lr) => sum + Object.keys(lr.rates || {}).length - 1, 0) }
    : null
  );
});

// ---- Theme ----

function detectSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getEffectiveTheme() {
  if (currentSettings && currentSettings.theme) return currentSettings.theme;
  return detectSystemTheme();
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function renderThemeSelector() {
  const savedTheme = currentSettings ? currentSettings.theme : null;
  const activeValue = savedTheme === null ? '' : savedTheme;
  themeOptions.querySelectorAll('.theme-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeValue === activeValue);
  });
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!currentSettings || !currentSettings.theme) {
    applyTheme(detectSystemTheme());
  }
});

themeOptions.addEventListener('click', async (e) => {
  const btn = e.target.closest('.theme-opt');
  if (!btn) return;
  const value = btn.dataset.themeValue;
  currentSettings.theme = value === '' ? null : value;
  applyTheme(getEffectiveTheme());
  renderThemeSelector();
  await RatesUtil.saveSettings(currentSettings);
  showSaveToast();
});

// ---- Time format selector ----

function renderTimeFormatSelector() {
  const saved = currentSettings ? currentSettings.timeFormat : null;
  const activeValue = saved === null ? '' : saved;
  timeOptions.querySelectorAll('.time-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.timeValue === activeValue);
  });
}

timeOptions.addEventListener('click', async (e) => {
  const btn = e.target.closest('.time-opt');
  if (!btn) return;
  const value = btn.dataset.timeValue;
  currentSettings.timeFormat = value === '' ? null : value;
  renderTimeFormatSelector();
  renderFetchStatus(currentFetchStatus, currentRates);
  await RatesUtil.saveSettings(currentSettings);
  showSaveToast();
});

// Listen for theme changes from popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.dollarbill_settings) {
    const newSettings = changes.dollarbill_settings.newValue;
    if (newSettings && currentSettings) {
      const oldTheme = currentSettings.theme;
      currentSettings.theme = newSettings.theme;
      if (oldTheme !== newSettings.theme) {
        applyTheme(getEffectiveTheme());
        renderThemeSelector();
      }
      const oldTimeFormat = currentSettings.timeFormat;
      currentSettings.timeFormat = newSettings.timeFormat;
      if (oldTimeFormat !== newSettings.timeFormat) {
        renderTimeFormatSelector();
      }
    }
  }
});

// ---- Enabled toggle ----

optEnabled.addEventListener('change', async () => {
  if (!currentSettings) return;
  currentSettings.enabled = optEnabled.checked;
  await RatesUtil.saveSettings(currentSettings);
  showSaveToast();
});

// ---- Auto-save ----

function showSaveToast() {
  saveToast.classList.add('show');
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveToast.classList.remove('show'), 1500);
}

async function autoSave() {
  if (!currentSettings) return;

  // Read custom rates from grid
  const customRates = {};
  customRatesGrid.querySelectorAll('input[data-pair]').forEach((input) => {
    const pair = input.dataset.pair;
    const val = input.value.trim();
    if (val) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) customRates[pair] = num;
    }
  });

  currentSettings.ambiguousPatterns = ambiguousPatternsEl.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  currentSettings.rateSources = getCheckboxValues(rateSourceBoxes);
  currentSettings.customRates = customRates;
  currentSettings.siteMode = getRadioValue(siteModeRadios) || 'all';
  currentSettings.whitelist = whitelistEl.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  await RatesUtil.saveSettings(currentSettings);
  showSaveToast();
}

// Debounced auto-save: saves 600ms after last change
let saveDebounce = null;
function scheduleAutoSave() {
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(autoSave, 600);
}

// ---- Checkbox/Radio helpers ----

function setRadioValue(radios, value) {
  for (const r of radios) r.checked = r.value === value;
}

function getRadioValue(radios) {
  for (const r of radios) if (r.checked) return r.value;
  return null;
}

function setCheckboxValues(boxes, values) {
  for (const b of boxes) b.checked = values.includes(b.value);
}

function getCheckboxValues(boxes) {
  const result = [];
  for (const b of boxes) if (b.checked) result.push(b.value);
  return result;
}

function updateVisibility() {
  whitelistSection.style.display = getRadioValue(siteModeRadios) === 'whitelist' ? 'block' : 'none';
  scheduleAutoSave();
}

for (const r of siteModeRadios) r.addEventListener('change', updateVisibility);
for (const b of rateSourceBoxes) b.addEventListener('change', async () => {
  await autoSave();
  await reloadRates();
});

// ---- Drag-to-reorder for pairs ----

function setupDragReorder() {
  let draggedEl = null;

  pairChips.addEventListener('dragstart', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    draggedEl = chip;
    chip.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  pairChips.addEventListener('dragend', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) chip.classList.remove('dragging');
    draggedEl = null;
    pairChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('drag-over'));
  });

  pairChips.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const chip = e.target.closest('.chip');
    if (chip && chip !== draggedEl) {
      pairChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('drag-over'));
      chip.classList.add('drag-over');
    }
  });

  pairChips.addEventListener('dragleave', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) chip.classList.remove('drag-over');
  });

  pairChips.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.chip');
    if (!target || !draggedEl || target === draggedEl) return;

    const fromIdx = parseInt(draggedEl.dataset.index);
    const toIdx = parseInt(target.dataset.index);
    if (isNaN(fromIdx) || isNaN(toIdx)) return;

    const pair = currentSettings.conversionPairs.splice(fromIdx, 1)[0];
    const adjustedToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
    currentSettings.conversionPairs.splice(adjustedToIdx, 0, pair);

    renderPairChips();
    scheduleAutoSave();
  });
}

setupDragReorder();

// ---- Pair chip rendering ----

function renderPairChips() {
  const pairs = currentSettings.conversionPairs || [];
  pairChips.innerHTML = pairs.map((p, i) => {
    const fromCur = currentSettings.currencies[p.from];
    const toCur = currentSettings.currencies[p.to];
    const fromLabel = fromCur ? `${p.from} (${fromCur.name})` : p.from;
    const toLabel = toCur ? `${p.to} (${toCur.name})` : p.to;
    return `<span class="chip" draggable="true" data-from="${p.from}" data-to="${p.to}" data-index="${i}">
      ${RatesUtil.escapeHtml(fromLabel)} &rarr; ${RatesUtil.escapeHtml(toLabel)}
      <button class="chip-remove" data-index="${i}" title="Remove">&times;</button>
    </span>`;
  }).join('');
  pairChips.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSettings.conversionPairs.splice(parseInt(btn.dataset.index), 1);
      renderPairChips();
      populatePairDropdowns();
      renderCustomRatesGrid();
      renderPreview();
      scheduleAutoSave();
    });
  });
}

function populatePairDropdowns() {
  const currencies = currentSettings.currencies;
  const makeOptions = () => {
    return '<option value="">Select...</option>' +
      Object.keys(currencies).sort().map(code =>
        `<option value="${code}">${code} - ${currencies[code].name}</option>`
      ).join('');
  };
  addPairFrom.innerHTML = makeOptions();
  addPairTo.innerHTML = makeOptions();
}

addPairBtn.addEventListener('click', () => {
  const from = addPairFrom.value;
  const to = addPairTo.value;
  if (!from || !to || from === to) return;
  const exists = currentSettings.conversionPairs.some(p => p.from === from && p.to === to);
  if (exists) return;
  currentSettings.conversionPairs.push({ from, to });
  renderPairChips();
  populatePairDropdowns();
  renderCustomRatesGrid();
  renderPreview();
  scheduleAutoSave();
});

// ---- Preview Panel ----

function renderPreview() {
  const previewContent = document.getElementById('previewContent');
  if (!previewContent || !currentSettings) return;

  const pairs = currentSettings.conversionPairs || [];
  const currencies = currentSettings.currencies;

  if (pairs.length === 0) {
    previewContent.innerHTML = '<span style="color:var(--text-tertiary)">Add conversion pairs to see a preview.</span>';
    return;
  }

  const sourceMap = RatesUtil.buildConversionMap(currentSettings);

  const sources = Object.keys(sourceMap).slice(0, 2);
  const examples = [];
  for (const srcCode of sources) {
    const amount = 100;
    let html = `<span class="preview-price">${amount} ${srcCode}</span>`;

    for (const tc of sourceMap[srcCode]) {
      const tcCur = currencies[tc] || {};
      const tcSymbol = tcCur.symbol || tc;
      const converted = (amount * (1 + Math.random() * 0.5)).toFixed(2);
      html += ` <span class="db-pill">${tcSymbol}${converted}</span>`;
    }
    examples.push(html);
  }

  previewContent.innerHTML = examples.join('<br>');
}

// ---- Currency Library ----

function renderCurrencyLibrary() {
  const currencies = currentSettings.currencies;
  let html = '';
  for (const [code, cur] of Object.entries(currencies).sort()) {
    html += `
      <div class="currency-card">
        <div class="currency-card-header">
          <strong>${code}</strong> ${cur.name} <span class="currency-symbol">${cur.symbol}</span>
          ${cur.tld ? `<span class="currency-tld">TLD: .${cur.tld}</span>` : ''}
        </div>
        <div class="currency-patterns">${(cur.patterns || []).map((p) => RatesUtil.escapeHtml(p)).join('<br>')}</div>
        <div class="currency-card-actions">
          <button class="btn btn-sm btn-link" data-edit="${code}">Edit</button>
          <button class="btn btn-sm btn-link btn-danger" data-delete="${code}">Delete</button>
        </div>
      </div>
    `;
  }
  currencyLibrary.innerHTML = html;

  currencyLibrary.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openCurrencyEditor(btn.dataset.edit));
  });
  currencyLibrary.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteCurrency(btn.dataset.delete));
  });
}

function openCurrencyEditor(code) {
  editingCurrency = code || null;
  if (code && currentSettings.currencies[code]) {
    const cur = currentSettings.currencies[code];
    editCode.value = code;
    editCode.disabled = true;
    editName.value = cur.name || '';
    editSymbol.value = cur.symbol || '';
    editTld.value = cur.tld || '';
    editPatterns.value = (cur.patterns || []).join('\n');
  } else {
    editCode.value = '';
    editCode.disabled = false;
    editName.value = '';
    editSymbol.value = '';
    editTld.value = '';
    editPatterns.value = '';
  }
  currencyEditor.style.display = 'block';
}

function deleteCurrency(code) {
  currentSettings.conversionPairs = currentSettings.conversionPairs.filter(p => p.from !== code && p.to !== code);
  delete currentSettings.currencies[code];
  renderPairChips();
  populatePairDropdowns();
  renderCurrencyLibrary();
  renderCustomRatesGrid();
  renderPreview();
  scheduleAutoSave();
}

addCurrencyBtn.addEventListener('click', () => openCurrencyEditor(null));

cancelCurrencyBtn.addEventListener('click', () => {
  currencyEditor.style.display = 'none';
  editingCurrency = null;
});

saveCurrencyBtn.addEventListener('click', () => {
  const code = editCode.value.trim().toUpperCase();
  if (!code) { alert('Currency code is required.'); return; }
  if (!/^[A-Z]{3}$/.test(code)) { alert('Currency code must be exactly 3 letters (e.g. USD, EUR).'); return; }
  if (code.includes(':')) { alert('Currency code cannot contain a colon.'); return; }
  if (!editingCurrency && currentSettings.currencies[code]) {
    alert('Currency already exists. Edit it instead.');
    return;
  }
  const patterns = editPatterns.value.split('\n').map((s) => s.trim()).filter(Boolean);
  for (const pat of patterns) {
    try {
      new RegExp(pat);
    } catch {
      alert(`Invalid regex pattern:\n${pat}\n\nPlease fix it before saving.`);
      return;
    }
  }
  currentSettings.currencies[code] = {
    name: editName.value.trim() || code,
    symbol: editSymbol.value.trim() || code,
    patterns,
    tld: editTld.value.trim() || null,
  };
  currencyEditor.style.display = 'none';
  editingCurrency = null;
  renderCurrencyLibrary();
  renderPairChips();
  populatePairDropdowns();
  renderCustomRatesGrid();
  renderPreview();
  scheduleAutoSave();
});

// ---- Custom Rates Grid ----

function renderCustomRatesGrid() {
  const pairs = currentSettings.conversionPairs || [];

  if (pairs.length === 0) {
    customRatesGrid.innerHTML = '<p class="hint">Add conversion pairs first.</p>';
    return;
  }

  const normalizedRates = RatesUtil.getCustomRates(currentSettings);
  const conflicts = RatesUtil.getConflicts(currentRates);
  const overrides = currentSettings.rateSourceOverrides || {};

  const seen = new Set();
  let html = '<div class="grid-inputs">';
  for (const pair of pairs) {
    const pairKey = [pair.from, pair.to].sort().join(':');
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const rateInfo = RatesUtil.formatRateForDisplay(pair.from, pair.to, normalizedRates);
    const displayFrom = rateInfo ? rateInfo.base : pair.from;
    const displayTo = rateInfo ? rateInfo.quote : pair.to;
    const val = rateInfo ? rateInfo.rate : '';

    const inputKey = `${displayFrom}:${displayTo}`;
    const reverseInputKey = `${displayTo}:${displayFrom}`;
    const conflictData = conflicts[inputKey] || conflicts[reverseInputKey];
    const conflictTag = conflictData
      ? ` <span style="color:#d4a017;font-size:11px" title="Conflicting rates: ${Object.entries(conflictData).map(([s, r]) => RatesUtil.getSourceDisplayName(s) + ': ' + r.toFixed(4)).join(', ')}">&#9888; ${RatesUtil.getSourceDisplayName(RatesUtil.getActiveSourceForPair(inputKey, reverseInputKey, currentSettings, currentRates))}</span>`
      : '';

    html += `<label>1 ${displayFrom} = <input type="number" step="0.0001" data-pair="${inputKey}" value="${val}" placeholder="${displayTo}"> ${displayTo}${conflictTag}</label>`;
  }
  html += '</div>';
  customRatesGrid.innerHTML = html;

  // Auto-save when custom rate inputs change
  customRatesGrid.querySelectorAll('input[data-pair]').forEach((input) => {
    input.addEventListener('input', scheduleAutoSave);
  });
}

// ---- Domain Overrides ----

function renderDomainOverrides(map) {
  const section = document.getElementById('domainOverridesSection');
  const list = document.getElementById('domainOverridesList');
  const entries = Object.entries(map || {});
  if (entries.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  list.innerHTML = entries.map(([domain, currency]) => `
    <div class="domain-row">
      <span class="domain-name">${RatesUtil.escapeHtml(domain)}</span>
      <span class="domain-cur">${RatesUtil.escapeHtml(currency)}</span>
      <button class="domain-remove" data-domain="${RatesUtil.escapeHtml(domain)}" title="Remove">&times;</button>
    </div>
  `).join('');

  list.querySelectorAll('.domain-remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.domain;
      delete currentSettings.domainCurrencyMap[domain];
      renderDomainOverrides(currentSettings.domainCurrencyMap);
      scheduleAutoSave();
    });
  });
}

// ---- Quick site add ----

addCurrentSiteBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.url) return;
    const url = new URL(tab.url);
    const domain = url.hostname;
    const lines = whitelistEl.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!lines.includes(domain)) {
      lines.push(domain);
      whitelistEl.value = lines.join('\n');
      scheduleAutoSave();
    }
  } catch {
    // Not in tab context (e.g. opened directly) — ignore
  }
});

// ---- Auto-save on text changes ----

ambiguousPatternsEl.addEventListener('input', scheduleAutoSave);
whitelistEl.addEventListener('input', scheduleAutoSave);

// ---- Load ----

async function loadSettings() {
  currentSettings = await RatesUtil.getSettings();

  [currentRates, currentFetchStatus, currentLoadedRates] = await Promise.all([
    RatesUtil.getCachedRates(),
    RatesUtil.getFetchStatus(),
    RatesUtil.getLoadedRates(),
  ]);

  // Apply theme
  applyTheme(getEffectiveTheme());
  renderThemeSelector();
  renderTimeFormatSelector();

  // Enabled toggle
  optEnabled.checked = currentSettings.enabled !== false;

  renderPairChips();
  populatePairDropdowns();
  renderCurrencyLibrary();

  ambiguousPatternsEl.value = (currentSettings.ambiguousPatterns || []).join('\n');

  setCheckboxValues(rateSourceBoxes, currentSettings.rateSources || []);
  renderCustomRatesGrid();
  renderFetchStatus(currentFetchStatus, currentRates);
  renderLoadedRates(currentLoadedRates);

  setRadioValue(siteModeRadios, currentSettings.siteMode);
  whitelistEl.value = (currentSettings.whitelist || []).join('\n');

  renderDomainOverrides(currentSettings.domainCurrencyMap);
  updateVisibility();
  renderPreview();
}

loadSettings();

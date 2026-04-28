// Generate rate source checkboxes dynamically from RATE_SOURCES
(function buildSourceList() {
  const list = document.getElementById('rateSourceList');
  if (!list || typeof RatesUtil === 'undefined') return;
  const sources = RatesUtil.RATE_SOURCES || {};
  list.innerHTML = Object.entries(sources).map(([id, src]) =>
    `<label class="toggle-option" data-label="${RatesUtil.escapeHtml(src.name)}">
      <input type="checkbox" name="rateSource" value="${id}">
      <span class="toggle-option-label">${RatesUtil.escapeHtml(src.name)}</span>
    </label>`
  ).join('');
})();

const rateSourceBoxes = document.querySelectorAll('input[name="rateSource"]');
const customRatesSection = document.getElementById('customRatesSection');
const customRatesGrid = document.getElementById('customRatesGrid');
const siteModeRadios = document.querySelectorAll('input[name="siteMode"]');
const whitelistSection = document.getElementById('whitelistSection');
const whitelistChips = document.getElementById('whitelistChips');
const whitelistInput = document.getElementById('whitelistInput');
const addWhitelistBtn = document.getElementById('addWhitelistBtn');
const saveToast = document.getElementById('saveToast');
const optEnabled = document.getElementById('optEnabled');
const themeOptions = document.getElementById('themeOptions');
const timeOptions = document.getElementById('timeOptions');
const numberOptions = document.getElementById('numberOptions');

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
const addPairBtn = document.getElementById('addPairBtn');
let optSelectedFrom = null;
let optSelectedTo = null;
let optPickerEventsInitialized = false;

// Currency library
const currencyLibrary = document.getElementById('currencyLibrary');
const addCurrencyBtn = document.getElementById('addCurrencyBtn');
const currencyEditor = document.getElementById('currencyEditor');
const editCode = document.getElementById('editCode');
const editName = document.getElementById('editName');
const editSymbol = document.getElementById('editSymbol');
const editDomains = document.getElementById('editDomains');
const editIdentifiers = document.getElementById('editIdentifiers');
const addIdentifierInput = document.getElementById('addIdentifierInput');
const addIdentifierBtn = document.getElementById('addIdentifierBtn');
const saveCurrencyBtn = document.getElementById('saveCurrencyBtn');
const cancelCurrencyBtn = document.getElementById('cancelCurrencyBtn');
let editingIdentifiers = [];

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
  const sourceErrors = currentLoadedRates
    ? Object.values(currentLoadedRates).filter(lr => lr && lr.error)
    : [];

  if (state === 'error') {
    dot.className = 'fetch-status-dot fetch-status-dot-error';
    title.textContent = 'Fetch failed';
    title.className = 'fetch-status-title fetch-status-title-error';
  } else if (sourceErrors.length > 0) {
    dot.className = 'fetch-status-dot fetch-status-dot-stale';
    title.textContent = `${sourceErrors.length} source${sourceErrors.length > 1 ? 's' : ''} failed`;
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
  // Show per-source errors from loaded rates
  if (currentLoadedRates) {
    for (const [sourceId, lr] of Object.entries(currentLoadedRates)) {
      if (lr && lr.error) {
        rows.push([RatesUtil.getSourceDisplayName(sourceId), lr.error]);
      }
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
    renderSourceErrors(currentLoadedRates);
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
    const sourceName = RatesUtil.getSourceDisplayName(sourceId);

    if (loadedRates && loadedRates.error) {
      html += `<div class="loaded-rates-meta loaded-rates-meta-error">${RatesUtil.escapeHtml(sourceName)} &middot; <span class="source-error-text">${RatesUtil.escapeHtml(loadedRates.error)}</span></div>`;
      continue;
    }

    if (!loadedRates || !loadedRates.rates) continue;
    const base = loadedRates.base;
    const convention = loadedRates.convention;
    const entries = Object.entries(loadedRates.rates)
      .filter(([code]) => code !== base)
      .sort((a, b) => a[0].localeCompare(b[0]));

    totalCount += entries.length;
    const age = loadedRates.timestamp ? RatesUtil.formatCacheAge(loadedRates) : '';
    const rateDateMeta = loadedRates.rateDate ? ` &middot; rates from ${RatesUtil.escapeHtml(formatRateDate(loadedRates.rateDate))}` : '';

    html += `<div class="loaded-rates-meta">${RatesUtil.escapeHtml(sourceName)} &middot; ${entries.length} currencies${rateDateMeta}${age ? ' &middot; fetched ' + RatesUtil.escapeHtml(age) + ' ago' : ''}</div>`;
    html += '<div class="loaded-rates-grid">';
    html += `<div class="loaded-rates-header"><span>Code</span><span>1 ${RatesUtil.escapeHtml(base)} =</span></div>`;
    const nf = currentSettings ? currentSettings.numberFormat : null;
    for (const [code, rate] of entries) {
      const displayRate = convention === 'direct'
        ? (rate > 0 ? RatesUtil.formatNumber(1 / rate, 4, nf) : '&mdash;')
        : (rate > 0 ? RatesUtil.formatNumber(rate, 4, nf) : '&mdash;');
      html += `<div class="loaded-rates-row"><span class="loaded-rates-code">${RatesUtil.escapeHtml(code)}</span><span class="loaded-rates-value">${displayRate}</span></div>`;
    }
    html += '</div>';
  }

  loadedRatesList.innerHTML = html || '<p class="hint">No rates loaded yet.</p>';
  updateLoadedRatesToggleLabel({ count: totalCount });
}

function formatRateDate(rateDate) {
  if (!rateDate) return '';
  const d = new Date(rateDate);
  if (isNaN(d.getTime())) return rateDate;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderSourceErrors(loadedRatesMap) {
  // Clear all existing error indicators
  document.querySelectorAll('.source-error-indicator').forEach(el => el.remove());

  if (!loadedRatesMap || typeof loadedRatesMap !== 'object') return;

  for (const [sourceId, loadedRates] of Object.entries(loadedRatesMap)) {
    if (!loadedRates || !loadedRates.error) continue;
    const checkbox = document.querySelector(`input[name="rateSource"][value="${CSS.escape(sourceId)}"]`);
    if (!checkbox) continue;
    const label = checkbox.closest('.toggle-option');
    if (!label) continue;
    const span = document.createElement('span');
    span.className = 'source-error-indicator';
    span.title = loadedRates.error;
    span.textContent = '!';
    label.appendChild(span);
  }
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
    ? { count: Object.values(currentLoadedRates).filter(lr => lr && lr.rates).reduce((sum, lr) => sum + Object.keys(lr.rates).length - 1, 0) }
    : null
  );
});

// ---- Theme ----

function renderThemeSelector() {
  const savedTheme = currentSettings ? currentSettings.theme : null;
  const activeValue = savedTheme === null ? '' : savedTheme;
  themeOptions.querySelectorAll('.theme-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeValue === activeValue);
  });
}

UICommon.watchSystemTheme(() => {
  if (!currentSettings || !currentSettings.theme) {
    UICommon.applyTheme(UICommon.detectSystemTheme());
  }
});

themeOptions.addEventListener('click', async (e) => {
  const btn = e.target.closest('.theme-opt');
  if (!btn) return;
  const value = btn.dataset.themeValue;
  currentSettings.theme = value === '' ? null : value;
  UICommon.applyTheme(UICommon.getEffectiveTheme(currentSettings));
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

// ---- Number format selector ----

function renderNumberFormatSelector() {
  const saved = currentSettings ? currentSettings.numberFormat : null;
  const activeValue = saved === null ? '' : saved;
  numberOptions.querySelectorAll('.time-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.numValue === activeValue);
  });
}

numberOptions.addEventListener('click', async (e) => {
  const btn = e.target.closest('.time-opt');
  if (!btn) return;
  const value = btn.dataset.numValue;
  currentSettings.numberFormat = value === '' ? null : value;
  renderNumberFormatSelector();
  renderPreview();
  renderLoadedRates(currentLoadedRates);
  await RatesUtil.saveSettings(currentSettings);
  showSaveToast();
});

// Listen for theme changes from popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[Settings.SETTINGS_KEY]) {
    const newSettings = changes[Settings.SETTINGS_KEY].newValue;
    if (newSettings && currentSettings) {
      const oldTheme = currentSettings.theme;
      currentSettings.theme = newSettings.theme;
      if (oldTheme !== newSettings.theme) {
        UICommon.applyTheme(UICommon.getEffectiveTheme(currentSettings));
        renderThemeSelector();
      }
      const oldTimeFormat = currentSettings.timeFormat;
      currentSettings.timeFormat = newSettings.timeFormat;
      if (oldTimeFormat !== newSettings.timeFormat) {
        renderTimeFormatSelector();
      }
      const oldNumberFormat = currentSettings.numberFormat;
      currentSettings.numberFormat = newSettings.numberFormat;
      if (oldNumberFormat !== newSettings.numberFormat) {
        renderNumberFormatSelector();
        renderPreview();
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

  currentSettings.rateSources = getCheckboxValues(rateSourceBoxes);
  currentSettings.customRates = customRates;
  currentSettings.siteMode = getRadioValue(siteModeRadios) || 'all';
  // whitelist is managed directly via renderWhitelistChips / removeWhitelistChip

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

// Rate source search
const rateSourceSearch = document.getElementById('rateSourceSearch');
const rateSourceList = document.getElementById('rateSourceList');
if (rateSourceSearch && rateSourceList) {
  rateSourceSearch.addEventListener('input', () => {
    const q = rateSourceSearch.value.toLowerCase().trim();
    rateSourceList.querySelectorAll('.toggle-option').forEach(opt => {
      const label = (opt.dataset.label || '').toLowerCase();
      opt.style.display = !q || label.includes(q) ? '' : 'none';
    });
  });
}

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
  optSelectedFrom = null;
  optSelectedTo = null;
  const fromTrigger = document.getElementById('optFromTrigger');
  const toTrigger = document.getElementById('optToTrigger');
  if (fromTrigger) {
    const textEl = fromTrigger.querySelector('.currency-picker-text');
    textEl.textContent = 'From...';
    textEl.classList.add('placeholder');
  }
  if (toTrigger) {
    const textEl = toTrigger.querySelector('.currency-picker-text');
    textEl.textContent = 'To...';
    textEl.classList.add('placeholder');
  }
  renderOptCurrencyList('from');
  renderOptCurrencyList('to');
}

function renderOptCurrencyList(which, filter) {
  const currencies = currentSettings.currencies || {};
  const listEl = document.getElementById(which === 'from' ? 'optFromList' : 'optToList');
  if (!listEl) return;
  const selected = which === 'from' ? optSelectedFrom : optSelectedTo;
  listEl.innerHTML = UICommon.renderCurrencyListHTML(currencies, selected, filter);
}

function initOptPickerEvents() {
  const fromTrigger = document.getElementById('optFromTrigger');
  const fromDropdown = document.getElementById('optFromDropdown');
  const fromSearch = document.getElementById('optFromSearch');
  const fromList = document.getElementById('optFromList');
  const toTrigger = document.getElementById('optToTrigger');
  const toDropdown = document.getElementById('optToDropdown');
  const toSearch = document.getElementById('optToSearch');
  const toList = document.getElementById('optToList');

  if (optPickerEventsInitialized) return;
  optPickerEventsInitialized = true;

  function closeDropdowns() {
    fromDropdown.classList.remove('open');
    fromTrigger.classList.remove('active');
    toDropdown.classList.remove('open');
    toTrigger.classList.remove('active');
  }

  fromTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = fromDropdown.classList.contains('open');
    closeDropdowns();
    if (!isOpen) {
      fromDropdown.classList.add('open');
      fromTrigger.classList.add('active');
      fromSearch.value = '';
      renderOptCurrencyList('from');
      fromSearch.focus();
    }
  });

  toTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = toDropdown.classList.contains('open');
    closeDropdowns();
    if (!isOpen) {
      toDropdown.classList.add('open');
      toTrigger.classList.add('active');
      toSearch.value = '';
      renderOptCurrencyList('to');
      toSearch.focus();
    }
  });

  fromSearch.addEventListener('input', () => renderOptCurrencyList('from', fromSearch.value));
  toSearch.addEventListener('input', () => renderOptCurrencyList('to', toSearch.value));

  fromList.addEventListener('click', (e) => {
    const item = e.target.closest('.currency-picker-item');
    if (!item || item.classList.contains('empty')) return;
    optSelectedFrom = item.dataset.code;
    const textEl = fromTrigger.querySelector('.currency-picker-text');
    textEl.textContent = optSelectedFrom;
    textEl.classList.remove('placeholder');
    closeDropdowns();
  });

  toList.addEventListener('click', (e) => {
    const item = e.target.closest('.currency-picker-item');
    if (!item || item.classList.contains('empty')) return;
    optSelectedTo = item.dataset.code;
    const textEl = toTrigger.querySelector('.currency-picker-text');
    textEl.textContent = optSelectedTo;
    textEl.classList.remove('placeholder');
    closeDropdowns();
  });

  document.addEventListener('click', (e) => {
    const fromPicker = document.getElementById('optFromPicker');
    const toPicker = document.getElementById('optToPicker');
    if (!fromPicker || !toPicker) return;
    if (!fromPicker.contains(e.target) && !toPicker.contains(e.target)) {
      closeDropdowns();
    }
  });
}

addPairBtn.addEventListener('click', () => {
  const errorEl = document.getElementById('addPairError');
  errorEl.textContent = '';
  errorEl.style.display = 'none';

  if (!optSelectedFrom || !optSelectedTo) {
    errorEl.textContent = 'Select both currencies';
    errorEl.style.display = 'block';
    return;
  }
  if (optSelectedFrom === optSelectedTo) {
    errorEl.textContent = 'From and To must differ';
    errorEl.style.display = 'block';
    return;
  }
  const pairs = currentSettings.conversionPairs || [];
  if (pairs.some(p =>
    (p.from === optSelectedFrom && p.to === optSelectedTo) ||
    (p.from === optSelectedTo && p.to === optSelectedFrom)
  )) {
    errorEl.textContent = 'Pair already exists';
    errorEl.style.display = 'block';
    return;
  }

  pairs.push({ from: optSelectedFrom, to: optSelectedTo });
  currentSettings.conversionPairs = pairs;
  populatePairDropdowns();
  renderPairChips();
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

    const nf = currentSettings ? currentSettings.numberFormat : null;
    for (const tc of sourceMap[srcCode]) {
      const tcCur = currencies[tc] || {};
      const tcSymbol = tcCur.symbol || tc;
      const converted = amount * (1 + Math.random() * 0.5);
      html += ` <span class="db-pill">${tcSymbol}${RatesUtil.formatNumber(converted, 2, nf)}</span>`;
    }
    examples.push(html);
  }

  previewContent.innerHTML = examples.join('<br>');
}

// ---- Currency Library ----

function renderCurrencyLibrary() {
  const currencies = currentSettings.currencies;

  // Build owner map once — derive both conflict info and id-to-codes mapping from it
  const ownerMap = RatesUtil.buildIdentifierOwnerMap(currencies);
  const idToCodes = {};
  const conflictIdentifiers = new Set();
  for (const [norm, ent] of Object.entries(ownerMap)) {
    idToCodes[norm] = ent.map(e => e.code);
    if (ent.length > 1) {
      conflictIdentifiers.add(norm);
    }
  }

  const entries = Object.entries(currencies).sort((a, b) => a[0].localeCompare(b[0]));

  // Build sets for categorization
  const usedCodes = new Set();
  for (const p of (currentSettings.conversionPairs || [])) {
    usedCodes.add(p.from);
    usedCodes.add(p.to);
  }
  const defaultCodes = new Set(Object.keys(RatesUtil.DEFAULT_CURRENCIES));

  // Single-pass categorization — each currency goes into its highest-priority group only
  const usedEntries = [];
  const customEntries = [];
  const popularEntries = [];
  const remainingEntries = [];

  for (const entry of entries) {
    const code = entry[0];
    if (usedCodes.has(code)) {
      usedEntries.push(entry);
    } else if (!defaultCodes.has(code)) {
      customEntries.push(entry);
    } else if (Currencies.POPULAR_CURRENCIES.includes(code)) {
      popularEntries.push(entry);
    } else {
      remainingEntries.push(entry);
    }
  }

  // Sort used in POPULAR_CURRENCIES order first, then alphabetical
  usedEntries.sort((a, b) => {
    const ai = RatesUtil.POPULAR_CURRENCIES.indexOf(a[0]);
    const bi = RatesUtil.POPULAR_CURRENCIES.indexOf(b[0]);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });
  customEntries.sort((a, b) => a[0].localeCompare(b[0]));
  popularEntries.sort((a, b) =>
    RatesUtil.POPULAR_CURRENCIES.indexOf(a[0]) - RatesUtil.POPULAR_CURRENCIES.indexOf(b[0])
  );

  function renderTile(code, cur) {
    const domainStr = (cur.domains || []).join(', ') || '';
    const idChips = (cur.identifiers || []).map(id => {
      const norm = id.trim().toLowerCase();
      const isShared = conflictIdentifiers.has(norm);
      const cls = isShared ? 'identifier-chip identifier-chip-shared' : 'identifier-chip';
      let title;
      if (isShared && idToCodes[norm]) {
        const others = idToCodes[norm].filter(c => c !== code);
        title = `Shared with ${others.join(', ')} \u2014 used by multiple currencies`;
      } else {
        title = `100 ${id}`;
      }
      return `<span class="${cls}" title="${RatesUtil.escapeHtml(title)}">${RatesUtil.escapeHtml(id)}</span>`;
    }).join('');
    const hasConflict = (cur.identifiers || []).some(id => conflictIdentifiers.has(id.trim().toLowerCase()));
    const conflictCls = hasConflict ? ' cur-tile-conflict' : '';

    return `
      <div class="cur-tile${conflictCls}" data-code="${code}" data-search="${code.toLowerCase()} ${(cur.name || '').toLowerCase()} ${(cur.symbol || '').toLowerCase()} ${(cur.identifiers || []).join(' ').toLowerCase()}">
        <div class="cur-tile-top">
          <span class="cur-tile-code">${code}</span>
          <span class="cur-tile-symbol">${RatesUtil.escapeHtml(cur.symbol || '')}</span>
          <div class="cur-tile-actions">
            <button class="cur-tile-btn" data-edit="${code}" title="Edit">&#9998;</button>
            <button class="cur-tile-btn cur-tile-btn-danger" data-delete="${code}" title="Delete">&times;</button>
          </div>
        </div>
        <div class="cur-tile-name">${RatesUtil.escapeHtml(cur.name || '')}</div>
        ${domainStr ? `<div class="cur-tile-domains">${RatesUtil.escapeHtml(domainStr)}</div>` : ''}
        <div class="cur-tile-detail">
          <div class="cur-tile-ids">${idChips || '<span class="no-identifiers">No identifiers</span>'}</div>
        </div>
      </div>
    `;
  }

  // 1. Search
  let html = '<div class="cur-lib-search-wrap">';
  html += '<input type="text" class="cur-lib-search" id="curLibSearch" placeholder="Search currencies...">';
  html += '</div>';

  // 2. Conflict legend + warnings (above grid)
  if (conflicts.length > 0) {
    // Split conflicts: related to active pairs vs. everything else
    const pairCurrencies = new Set();
    for (const p of (currentSettings.conversionPairs || [])) {
      pairCurrencies.add(p.from);
      pairCurrencies.add(p.to);
    }
    const activeConflicts = [];
    const otherConflicts = [];
    for (const c of conflicts) {
      if (c.currencies.some(code => pairCurrencies.has(code))) {
        activeConflicts.push(c);
      } else {
        otherConflicts.push(c);
      }
    }

    // Active pair conflicts — always visible
    const hasAnyConflicts = activeConflicts.length > 0 || otherConflicts.length > 0;
    if (hasAnyConflicts) {
      html += '<div class="conflict-warnings">';
      html += '<h3>Identifier Conflicts</h3>';
      for (const c of activeConflicts) {
        const domainInfo = c.currencies.map(code => {
          const cur = currencies[code];
          const domains = (cur.domains || []).join(', ') || 'no domains';
          return `<strong>${code}</strong> on ${RatesUtil.escapeHtml(domains)}`;
        }).join('; ');
        html += `<div class="conflict-item">
          <span class="conflict-identifier">"${RatesUtil.escapeHtml(c.identifier)}"</span> is shared by ${c.currencies.join(', ')}. Resolution: ${domainInfo}
        </div>`;
      }

      // Other conflicts — collapsible, inside the same block
      if (otherConflicts.length > 0) {
        html += '<details class="conflict-other-details">';
        html += `<summary class="conflict-other-summary">Other conflicting identifiers (${otherConflicts.length})</summary>`;
        for (const c of otherConflicts) {
          const domainInfo = c.currencies.map(code => {
            const cur = currencies[code];
            const domains = (cur.domains || []).join(', ') || 'no domains';
            return `<strong>${code}</strong> on ${RatesUtil.escapeHtml(domains)}`;
          }).join('; ');
          html += `<div class="conflict-item">
            <span class="conflict-identifier">"${RatesUtil.escapeHtml(c.identifier)}"</span> is shared by ${c.currencies.join(', ')}. Resolution: ${domainInfo}
          </div>`;
        }
        html += '</details>';
      }

      html += '</div>';
    }
  }

  // 3. Conflict legend (right above grid)
  if (conflicts.length > 0) {
    const count = conflictIdentifiers.size;
    html += `<div class="conflict-legend">${count} identifier${count !== 1 ? 's are' : ' is'} shared between currencies and highlighted</div>`;
  }

  // 4. Scrollable grid with categories
  html += '<div class="cur-lib-grid-wrap" id="curLibGridWrap">';
  html += '<div class="cur-lib-grid" id="curLibGrid">';

  // Used group (currencies in conversion pairs)
  if (usedEntries.length > 0) {
    html += '<div class="cur-lib-group-label cur-lib-group-used" data-group=" Used">Used</div>';
    html += '<div class="cur-lib-group-tiles">';
    for (const [code, cur] of usedEntries) {
      html += renderTile(code, cur);
    }
    html += '</div>';
  }

  // Custom group (user-added currencies)
  if (customEntries.length > 0) {
    html += '<div class="cur-lib-group-label cur-lib-group-custom" data-group=" Custom">Custom</div>';
    html += '<div class="cur-lib-group-tiles">';
    for (const [code, cur] of customEntries) {
      html += renderTile(code, cur);
    }
    html += '</div>';
  }

  // Popular group
  if (popularEntries.length > 0) {
    html += '<div class="cur-lib-group-label" data-group=" Popular">Popular</div>';
    html += '<div class="cur-lib-group-tiles">';
    for (const [code, cur] of popularEntries) {
      html += renderTile(code, cur);
    }
    html += '</div>';
  }

  // Alphabetical groups
  let currentLetter = '';
  let groupOpen = false;
  for (const [code, cur] of remainingEntries) {
    const letter = code[0];
    if (letter !== currentLetter) {
      if (groupOpen) html += '</div>';
      currentLetter = letter;
      groupOpen = true;
      html += `<div class="cur-lib-group-label" data-group="${letter}">${letter}</div>`;
      html += '<div class="cur-lib-group-tiles">';
    }
    html += renderTile(code, cur);
  }
  if (groupOpen) html += '</div>';

  html += '</div></div>';

  currencyLibrary.innerHTML = html;

  // Search filter — hide group labels when searching
  const searchInput = document.getElementById('curLibSearch');
  const gridWrap = document.getElementById('curLibGridWrap');
  const grid = document.getElementById('curLibGrid');
  if (searchInput && grid && gridWrap) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      grid.querySelectorAll('.cur-tile').forEach(tile => {
        const haystack = tile.dataset.search || '';
        tile.style.display = !q || haystack.includes(q) ? '' : 'none';
      });
      // Hide group labels when searching
      grid.querySelectorAll('.cur-lib-group-label').forEach(label => {
        label.style.display = q ? 'none' : '';
      });
    });
  }

  // Tile expand/collapse on click (not on buttons)
  grid.querySelectorAll('.cur-tile').forEach(tile => {
    tile.addEventListener('click', (e) => {
      if (e.target.closest('.cur-tile-btn')) return;
      tile.classList.toggle('cur-tile-expanded');
    });
  });

  currencyLibrary.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openCurrencyEditor(btn.dataset.edit));
  });
  currencyLibrary.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteCurrency(btn.dataset.delete));
  });
}

function renderEditorIdentifiers() {
  editIdentifiers.innerHTML = editingIdentifiers.map((id, i) => {
    const example = `100 ${id}`;
    return `<span class="identifier-chip" title="${RatesUtil.escapeHtml(example)}">
      ${RatesUtil.escapeHtml(id)}
      <button class="identifier-remove" data-idx="${i}" title="Remove">&times;</button>
    </span>`;
  }).join('');
  editIdentifiers.querySelectorAll('.identifier-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingIdentifiers.splice(parseInt(btn.dataset.idx), 1);
      renderEditorIdentifiers();
    });
  });
}

addIdentifierBtn.addEventListener('click', () => {
  const val = addIdentifierInput.value.trim();
  if (!val) return;
  editingIdentifiers.push(val);
  addIdentifierInput.value = '';
  renderEditorIdentifiers();
});

addIdentifierInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addIdentifierBtn.click();
  }
});

function openCurrencyEditor(code) {
  editingCurrency = code || null;
  if (code && currentSettings.currencies[code]) {
    const cur = currentSettings.currencies[code];
    editCode.value = code;
    editCode.disabled = true;
    editName.value = cur.name || '';
    editSymbol.value = cur.symbol || '';
    editDomains.value = (cur.domains || []).join(', ');
    editingIdentifiers = [...(cur.identifiers || [])];
  } else {
    editCode.value = '';
    editCode.disabled = false;
    editName.value = '';
    editSymbol.value = '';
    editDomains.value = '';
    editingIdentifiers = [];
  }
  renderEditorIdentifiers();
  currencyEditor.style.display = 'block';
  currencyEditor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  if (editingIdentifiers.length === 0) {
    alert('Add at least one identifier.');
    return;
  }
  // Validate identifiers compile to valid regex
  const patterns = RatesUtil.buildPatternsFromIdentifiers(editingIdentifiers);
  for (const pat of patterns) {
    try {
      new RegExp(pat);
    } catch {
      alert(`Invalid identifier pattern:\n${pat}\n\nCheck for special characters.`);
      return;
    }
  }
  const domains = editDomains.value.split(',').map(s => s.trim()).filter(Boolean);
  currentSettings.currencies[code] = {
    name: editName.value.trim() || code,
    symbol: editSymbol.value.trim() || code,
    identifiers: [...editingIdentifiers],
    domains,
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
    customRatesGrid.innerHTML = '<p class="hint" style="padding:10px 12px;">Add conversion pairs first.</p>';
    return;
  }

  const normalizedRates = RatesUtil.getCustomRates(currentSettings);
  const conflicts = RatesUtil.getConflicts(currentRates);

  const seen = new Set();
  let html = '';
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
    const nf = currentSettings ? currentSettings.numberFormat : null;
    const conflictData = conflicts[inputKey] || conflicts[reverseInputKey];
    const conflictHtml = conflictData
      ? `<span class="rate-source-picker" data-pair="${inputKey}" title="Click to change source">${RatesUtil.escapeHtml(RatesUtil.getSourceDisplayName(RatesUtil.getActiveSourceForPair(inputKey, reverseInputKey, currentSettings, currentRates)))}</span>`
      : '';

    const searchData = [displayFrom, displayTo, inputKey].join(' ').toLowerCase();

    html += `<div class="custom-rate-row" data-search="${searchData}">
      <span class="custom-rate-pair">
        <span>1 ${RatesUtil.escapeHtml(displayFrom)}</span>
      </span>
      <span class="custom-rate-equals">=</span>
      <input type="number" step="0.0001" class="custom-rate-input" data-pair="${inputKey}" value="${val}" placeholder="rate">
      <span class="custom-rate-target">${RatesUtil.escapeHtml(displayTo)}</span>
      ${conflictHtml}
    </div>`;
  }
  customRatesGrid.innerHTML = html;

  // Auto-save when custom rate inputs change
  customRatesGrid.querySelectorAll('input[data-pair]').forEach((input) => {
    input.addEventListener('input', scheduleAutoSave);
  });

  // Source picker (conflict resolver)
  customRatesGrid.querySelectorAll('.rate-source-picker').forEach(el => {
    el.addEventListener('click', handleSourcePickerClick);
  });
}

function handleSourcePickerClick(e) {
  const el = e.currentTarget;
  const customPairKey = el.dataset.pair;
  const reversePairKey = customPairKey.split(':').reverse().join(':');
  const conflicts = RatesUtil.getConflicts(currentRates);
  const conflictData = conflicts[customPairKey] || conflicts[reversePairKey];
  if (!conflictData) return;

  // Use the actual pairKey that exists in conflicts for saving overrides
  const resolvedPairKey = conflicts[customPairKey] ? customPairKey : reversePairKey;

  UICommon.closeAllSourcePickerDropdowns();

  const activeSource = RatesUtil.getActiveSourceForPair(customPairKey, reversePairKey, currentSettings, currentRates);
  const nf = currentSettings ? currentSettings.numberFormat : null;
  const sourceIds = Object.keys(conflictData);

  const dropdown = document.createElement('div');
  dropdown.className = 'rate-source-picker-dropdown open';
  dropdown.innerHTML = `
    <div class="rate-source-picker-list">
      ${sourceIds.map(id => {
        const isActive = id === activeSource;
        const rate = conflictData[id];
        return `<div class="rate-source-picker-item${isActive ? ' active' : ''}" data-source-id="${id}" data-label="${RatesUtil.escapeHtml(RatesUtil.getSourceDisplayName(id).toLowerCase())}">
          <span class="rate-source-picker-item-check"></span>
          <span class="rate-source-picker-item-label">${RatesUtil.escapeHtml(RatesUtil.getSourceDisplayName(id))}</span>
          <span class="rate-source-picker-item-rate">${rate ? RatesUtil.formatNumber(rate, 4, nf) : ''}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  el.classList.add('active');

  // Append to body to avoid clipping by scrollable parents
  document.body.appendChild(dropdown);

  // Position below the picker element
  const rect = el.getBoundingClientRect();
  dropdown.style.left = rect.left + 'px';
  dropdown.style.top = (rect.bottom + 4) + 'px';

  const listEl = dropdown.querySelector('.rate-source-picker-list');

  // Close on outside click
  const closeHandler = (ev) => {
    if (!dropdown.contains(ev.target) && ev.target !== el) {
      UICommon.closeAllSourcePickerDropdowns();
    }
  };
  UICommon.setSourcePickerCloseHandler(closeHandler);

  listEl.addEventListener('click', async (ev) => {
    const item = ev.target.closest('.rate-source-picker-item');
    if (!item) return;
    const sourceId = item.dataset.sourceId;

    if (!currentSettings.rateSourceOverrides) currentSettings.rateSourceOverrides = {};
    currentSettings.rateSourceOverrides[resolvedPairKey] = sourceId;
    await RatesUtil.saveSettings(currentSettings);
    showSaveToast();

    UICommon.closeAllSourcePickerDropdowns();
    renderCustomRatesGrid();
  });
}

// Custom rates search
const customRatesSearch = document.getElementById('customRatesSearch');
if (customRatesSearch && customRatesGrid) {
  customRatesSearch.addEventListener('input', () => {
    const q = customRatesSearch.value.toLowerCase().trim();
    customRatesGrid.querySelectorAll('.custom-rate-row').forEach(row => {
      const haystack = row.dataset.search || '';
      row.style.display = !q || haystack.includes(q) ? '' : 'none';
    });
  });
}

// ---- Domain Overrides ----

function renderDomainOverrides(map) {
  const section = document.getElementById('domainOverridesSection');
  const list = document.getElementById('domainOverridesList');
  const entries = Object.entries(map || {});
  if (entries.length === 0) {
    list.innerHTML = '<p class="hint">No domain overrides set.</p>';
    return;
  }
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

function populateDomainCurrencySelect() {
  const select = document.getElementById('domainAddCurrency');
  const currencies = currentSettings.currencies || {};
  const codes = Object.keys(currencies).sort();
  select.innerHTML = codes.map((code) => {
    const cur = currencies[code];
    const label = cur ? `${code} (${cur.name})` : code;
    return `<option value="${code}">${RatesUtil.escapeHtml(label)}</option>`;
  }).join('');
}

document.getElementById('domainAddBtn').addEventListener('click', () => {
  const input = document.getElementById('domainAddInput');
  const select = document.getElementById('domainAddCurrency');
  const domain = input.value.trim().toLowerCase();
  if (!domain || !select.value) return;
  if (!currentSettings.domainCurrencyMap) currentSettings.domainCurrencyMap = {};
  currentSettings.domainCurrencyMap[domain] = select.value;
  input.value = '';
  renderDomainOverrides(currentSettings.domainCurrencyMap);
  scheduleAutoSave();
});

// ---- Whitelist chips ----

function renderWhitelistChips() {
  const sites = currentSettings.whitelist || [];
  whitelistChips.innerHTML = sites.map((site, i) =>
    `<span class="chip" data-index="${i}">
      ${RatesUtil.escapeHtml(site)}
      <button class="chip-remove" data-index="${i}" title="Remove">&times;</button>
    </span>`
  ).join('');
  whitelistChips.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSettings.whitelist.splice(parseInt(btn.dataset.index), 1);
      renderWhitelistChips();
      scheduleAutoSave();
    });
  });
}

addWhitelistBtn.addEventListener('click', () => {
  const domain = whitelistInput.value.trim().toLowerCase();
  if (!domain) return;
  if (!currentSettings.whitelist) currentSettings.whitelist = [];
  if (currentSettings.whitelist.includes(domain)) {
    whitelistInput.value = '';
    return;
  }
  currentSettings.whitelist.push(domain);
  whitelistInput.value = '';
  renderWhitelistChips();
  scheduleAutoSave();
});

whitelistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addWhitelistBtn.click();
  }
});

// ---- Load ----

async function loadSettings() {
  currentSettings = await RatesUtil.getSettings();

  [currentRates, currentFetchStatus, currentLoadedRates] = await Promise.all([
    RatesUtil.getCachedRates(),
    RatesUtil.getFetchStatus(),
    RatesUtil.getLoadedRates(),
  ]);

  // Apply theme
  UICommon.applyTheme(UICommon.getEffectiveTheme(currentSettings));
  renderThemeSelector();
  renderTimeFormatSelector();
  renderNumberFormatSelector();

  // Enabled toggle
  optEnabled.checked = currentSettings.enabled !== false;

  renderPairChips();
  populatePairDropdowns();
  initOptPickerEvents();
  renderCurrencyLibrary();

  setCheckboxValues(rateSourceBoxes, currentSettings.rateSources || []);
  renderCustomRatesGrid();
  renderFetchStatus(currentFetchStatus, currentRates);
  renderLoadedRates(currentLoadedRates);
  renderSourceErrors(currentLoadedRates);

  setRadioValue(siteModeRadios, currentSettings.siteMode);
  renderWhitelistChips();

  renderDomainOverrides(currentSettings.domainCurrencyMap);
  populateDomainCurrencySelect();
  updateVisibility();
  renderPreview();
}

loadSettings();

// ---- Currency Library: fit grid to viewport ----

function fitLibraryGrid() {
  const gridWrap = document.querySelector('.col-library .cur-lib-grid-wrap');
  if (!gridWrap) return;
  const rect = gridWrap.getBoundingClientRect();
  const padding = 24; // bottom margin
  const available = window.innerHeight - rect.top - padding;
  gridWrap.style.maxHeight = Math.max(120, available) + 'px';
}

// Patch renderCurrencyLibrary to also fit grid after render
const _origRenderCurrencyLibrary = renderCurrencyLibrary;
renderCurrencyLibrary = function() {
  _origRenderCurrencyLibrary();
  requestAnimationFrame(fitLibraryGrid);
};

window.addEventListener('resize', fitLibraryGrid);

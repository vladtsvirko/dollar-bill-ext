// Generate rate source checkboxes dynamically from RATE_SOURCES
(function buildSourceList() {
  const list = document.getElementById('rateSourceList');
  if (!list || typeof RatesUtil === 'undefined') return;
  const sources = RatesUtil.RATE_SOURCES || {};
  list.innerHTML = Object.entries(sources).map(([id, src]) =>
    `<label class="toggle-option" data-label="${FormatUtils.escapeHtml(src.name)}">
      <input type="checkbox" name="rateSource" value="${id}">
      <span class="toggle-option-label">${FormatUtils.escapeHtml(src.name)}</span>
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
const langTrigger = document.getElementById('langTrigger');
const langDropdown = document.getElementById('langDropdown');
const langSearch = document.getElementById('langSearch');
const langList = document.getElementById('langList');
const langText = document.getElementById('langText');

const reloadRatesBtn = document.getElementById('reloadRatesBtn');
const toggleLoadedRatesBtn = document.getElementById('toggleLoadedRates');
const loadedRatesContent = document.getElementById('loadedRatesContent');
const loadedRatesList = document.getElementById('loadedRatesList');
const loadedRatesToggleLabel = document.getElementById('loadedRatesToggleLabel');
const loadedRatesChevron = document.getElementById('loadedRatesChevron');
let loadedRatesExpanded = false;
let currentLoadedRates = null;

const pairChips = document.getElementById('pairChips');
const addPairBtn = document.getElementById('addPairBtn');
let optSelectedFrom = null;
let optSelectedTo = null;
let optPickerEventsInitialized = false;

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
let currentRatesPairCount = 0;
let currentFetchStatus = null;
let editingCurrency = null;
let autoSaveTimer = null;

// ---- Auto-save ----

function showSaveToast() {
  saveToast.classList.add('show');
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveToast.classList.remove('show'), 1500);
}

async function autoSave() {
  if (!currentSettings) return;
  const customRates = {};
  // Collect amount + rate pairs from the grid
  const rows = customRatesGrid.querySelectorAll('.custom-rate-row');
  rows.forEach((row) => {
    const amountInput = row.querySelector('.custom-rate-amount-input');
    const rateInput = row.querySelector('.custom-rate-input');
    if (!rateInput) return;
    const pair = rateInput.dataset.pair;
    const rateVal = rateInput.value.trim();
    const amountVal = amountInput ? amountInput.value.trim() : '1';
    if (rateVal) {
      const num = parseFloat(rateVal);
      const amt = parseFloat(amountVal) || 1;
      if (!isNaN(num) && num > 0) {
        customRates[pair] = { amount: amt, rate: num };
      }
    }
  });

  currentSettings.rateSources = getCheckboxValues(rateSourceBoxes);
  currentSettings.customRates = customRates;
  currentSettings.siteMode = getRadioValue(siteModeRadios) || 'all';

  // Auto-select custom source for newly added custom rates
  for (const pairKey of Object.keys(customRates)) {
    const [from, to] = pairKey.split(':');
    RatesUtil.setSelection(currentSettings, from, to, RatesUtil.CUSTOM_SOURCE);
  }

  await RatesUtil.saveSettings(currentSettings);
  showSaveToast();
}

let saveDebounce = null;
function scheduleAutoSave() {
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(autoSave, 600);
}

// ---- Helpers ----

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

const rateSourceSearch = document.getElementById('rateSourceSearch');
const rateSourceListEl = document.getElementById('rateSourceList');
if (rateSourceSearch && rateSourceListEl) {
  rateSourceSearch.addEventListener('input', () => {
    const q = rateSourceSearch.value.toLowerCase().trim();
    rateSourceListEl.querySelectorAll('.toggle-option').forEach(opt => {
      const label = (opt.dataset.label || '').toLowerCase();
      opt.style.display = !q || label.includes(q) ? '' : 'none';
    });
  });
}

// ---- Drag-to-reorder ----

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
  PairChips.renderOptionsChips(currentSettings.conversionPairs || [], pairChips, currentSettings, (idx) => {
    currentSettings.conversionPairs.splice(idx, 1);
    renderPairChips();
    populatePairDropdowns();
    renderCustomRatesGrid();
    Preview.render(document.getElementById('previewContent'), currentSettings);
    scheduleAutoSave();
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

  CurrencyPicker.bindPickerEvents({
    fromTrigger, fromDropdown, fromSearch, fromList,
    toTrigger, toDropdown, toSearch, toList,
    getFrom: () => optSelectedFrom,
    getTo: () => optSelectedTo,
    setFrom: (v) => { optSelectedFrom = v; },
    setTo: (v) => { optSelectedTo = v; },
    currencies: currentSettings.currencies || {},
  });
}

addPairBtn.addEventListener('click', () => {
  const errorEl = document.getElementById('addPairError');
  errorEl.textContent = '';
  errorEl.style.display = 'none';

  if (!optSelectedFrom || !optSelectedTo) {
    errorEl.textContent = I18n.t('options.selectBothCurrencies');
    errorEl.style.display = 'block';
    return;
  }
  if (optSelectedFrom === optSelectedTo) {
    errorEl.textContent = I18n.t('options.fromToMustDiffer');
    errorEl.style.display = 'block';
    return;
  }
  const pairs = currentSettings.conversionPairs || [];
  if (pairs.some(p =>
    (p.from === optSelectedFrom && p.to === optSelectedTo) ||
    (p.from === optSelectedTo && p.to === optSelectedFrom)
  )) {
    errorEl.textContent = I18n.t('options.pairAlreadyExists');
    errorEl.style.display = 'block';
    return;
  }

  pairs.push({ from: optSelectedFrom, to: optSelectedTo });
  currentSettings.conversionPairs = pairs;
  populatePairDropdowns();
  renderPairChips();
  renderCustomRatesGrid();
  Preview.render(document.getElementById('previewContent'), currentSettings);
  scheduleAutoSave();
});

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
    renderFetchStatus();
    renderLoadedRates();
    LoadedRates.renderSourceErrors(currentRates);
  } finally {
    reloadRatesBtn.classList.remove('loading');
    reloadRatesBtn.disabled = false;
  }
}

reloadRatesBtn.addEventListener('click', reloadRates);

function renderFetchStatus() {
  FetchStatusUI.renderOptions({
    dotEl: document.getElementById('fetchStatusDot'),
    titleEl: document.getElementById('fetchStatusTitle'),
    detailsEl: document.getElementById('fetchStatusDetails'),
    fetchStatus: currentFetchStatus,
    rates: currentRates,
    timeFormat: currentSettings ? currentSettings.timeFormat : null,
    loadedRates: currentLoadedRates,
  });
}

function renderLoadedRates() {
  const info = LoadedRates.render({
    listEl: loadedRatesList,
    cachedRates: currentRates,
    settings: currentSettings,
  });
  currentRatesPairCount = info.count || 0;
  updateLoadedRatesToggleLabel(currentRatesPairCount || null);
}

function updateLoadedRatesToggleLabel(count) {
  if (count) {
    loadedRatesToggleLabel.textContent = loadedRatesExpanded
      ? I18n.t('options.hideLoadedRatesCount', { count })
      : I18n.t('options.showLoadedRatesCount', { count });
  } else {
    loadedRatesToggleLabel.textContent = loadedRatesExpanded
      ? I18n.t('options.hideLoadedRates')
      : I18n.t('options.showLoadedRates');
  }
  loadedRatesChevron.style.transform = loadedRatesExpanded ? 'rotate(180deg)' : '';
}

toggleLoadedRatesBtn.addEventListener('click', () => {
  loadedRatesExpanded = !loadedRatesExpanded;
  loadedRatesContent.style.display = loadedRatesExpanded ? 'block' : 'none';
  updateLoadedRatesToggleLabel(currentRatesPairCount || null);
});

// ---- Theme ----

function renderThemeSelector() {
  ThemeHandler.renderOptionsSelector(themeOptions, currentSettings ? currentSettings.theme : null);
}

ThemeHandler.watchSystem(() => {
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

// ---- Time/Number format ----

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
  renderFetchStatus();
  await RatesUtil.saveSettings(currentSettings);
  showSaveToast();
});

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
  Preview.render(document.getElementById('previewContent'), currentSettings);
  renderLoadedRates();
  await RatesUtil.saveSettings(currentSettings);
  showSaveToast();
});

// Sync with popup changes
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
      currentSettings.timeFormat = newSettings.timeFormat;
      currentSettings.numberFormat = newSettings.numberFormat;
    }
  }
});

optEnabled.addEventListener('change', async () => {
  if (!currentSettings) return;
  currentSettings.enabled = optEnabled.checked;
  await RatesUtil.saveSettings(currentSettings);
  showSaveToast();
});

// ---- Custom Rates Grid ----

function renderCustomRatesGrid() {
  CustomRates.renderGrid({
    grid: customRatesGrid,
    settings: currentSettings,
    rates: currentRates,
    onScheduleSave: scheduleAutoSave,
    onSourcePickerClick: handleSourcePickerClick,
  });
}

function handleSourcePickerClick(e) {
  const el = e.currentTarget;
  const customPairKey = el.dataset.pair;
  const reversePairKey = customPairKey.split(':').reverse().join(':');
  const effectiveRates = currentRates ? RatesUtil.getEffectiveRates(currentSettings, currentRates) : {};
  const conflicts = RatesUtil.getConflicts(effectiveRates);
  const conflictData = conflicts[customPairKey] || conflicts[reversePairKey];
  if (!conflictData) return;

  SourcePicker.createDropdown({
    el,
    customPairKey,
    conflictData,
    activeSource: RatesUtil.getActiveSourceForPair(customPairKey, reversePairKey, currentSettings, currentRates),
    settings: currentSettings,
    onSelected: async (sourceId) => {
      const [from, to] = customPairKey.split(':');
      RatesUtil.setSelection(currentSettings, from, to, sourceId);
      await RatesUtil.saveSettings(currentSettings);
      showSaveToast();
      renderCustomRatesGrid();
    },
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

function renderDomainOverrides() {
  SiteFilter.renderDomainOverrides(
    document.getElementById('domainOverridesList'),
    currentSettings.domainCurrencyMap,
    async (domain) => {
      delete currentSettings.domainCurrencyMap[domain];
      renderDomainOverrides();
      scheduleAutoSave();
    }
  );
}

document.getElementById('domainAddBtn').addEventListener('click', () => {
  const input = document.getElementById('domainAddInput');
  const select = document.getElementById('domainAddCurrency');
  const domain = input.value.trim().toLowerCase();
  if (!domain || !select.value) return;
  if (!currentSettings.domainCurrencyMap) currentSettings.domainCurrencyMap = {};
  currentSettings.domainCurrencyMap[domain] = select.value;
  input.value = '';
  renderDomainOverrides();
  scheduleAutoSave();
});

// ---- Whitelist ----

function renderWhitelistChips() {
  SiteFilter.renderWhitelistChips(whitelistChips, currentSettings.whitelist || [], (idx) => {
    currentSettings.whitelist.splice(idx, 1);
    renderWhitelistChips();
    scheduleAutoSave();
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

// ---- Currency Editor ----

function renderEditorIdentifiers() {
  editIdentifiers.innerHTML = editingIdentifiers.map((id, i) => {
    const example = `100 ${id}`;
    return `<span class="identifier-chip" title="${FormatUtils.escapeHtml(example)}">
      ${FormatUtils.escapeHtml(id)}
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
  Preview.render(document.getElementById('previewContent'), currentSettings);
  scheduleAutoSave();
}

addCurrencyBtn.addEventListener('click', () => openCurrencyEditor(null));

cancelCurrencyBtn.addEventListener('click', () => {
  currencyEditor.style.display = 'none';
  editingCurrency = null;
});

saveCurrencyBtn.addEventListener('click', () => {
  const code = editCode.value.trim().toUpperCase();
  if (!code) { alert(I18n.t('options.currencyCodeRequired')); return; }
  if (!/^[A-Z]{3}$/.test(code)) { alert(I18n.t('options.currencyCodeFormat')); return; }
  if (code.includes(':')) { alert(I18n.t('options.currencyCodeNoColon')); return; }
  if (!editingCurrency && currentSettings.currencies[code]) {
    alert(I18n.t('options.currencyAlreadyExists'));
    return;
  }
  if (editingIdentifiers.length === 0) {
    alert(I18n.t('options.addOneIdentifier'));
    return;
  }
  const patterns = RatesUtil.buildPatternsFromIdentifiers(editingIdentifiers);
  for (const pat of patterns) {
    try { new RegExp(pat); }
    catch { alert(I18n.t('options.invalidIdentifierPattern', { pattern: pat })); return; }
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
  Preview.render(document.getElementById('previewContent'), currentSettings);
  scheduleAutoSave();
});

// ---- Currency Library ----

function renderCurrencyLibrary() {
  CurrencyLibrary.render({
    container: currencyLibrary,
    editor: currencyEditor,
    settings: currentSettings,
    onScheduleSave: scheduleAutoSave,
  });

  currencyLibrary.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openCurrencyEditor(btn.dataset.edit));
  });
  currencyLibrary.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteCurrency(btn.dataset.delete));
  });
}

// ---- Load ----

async function loadSettings() {
  currentSettings = await RatesUtil.getSettings();

  await I18n.init(currentSettings.language);
  I18n.applyToPage();

  [currentRates, currentFetchStatus, currentLoadedRates] = await Promise.all([
    RatesUtil.getCachedRates(),
    RatesUtil.getFetchStatus(),
    RatesUtil.getLoadedRates(),
  ]);

  UICommon.applyTheme(UICommon.getEffectiveTheme(currentSettings));
  renderThemeSelector();
  renderTimeFormatSelector();
  renderNumberFormatSelector();
  renderLanguageSelector();

  optEnabled.checked = currentSettings.enabled !== false;

  renderPairChips();
  populatePairDropdowns();
  initOptPickerEvents();
  renderCurrencyLibrary();

  setCheckboxValues(rateSourceBoxes, currentSettings.rateSources || []);
  renderCustomRatesGrid();
  renderFetchStatus();
  renderLoadedRates();
  LoadedRates.renderSourceErrors(currentRates);

  setRadioValue(siteModeRadios, currentSettings.siteMode);
  renderWhitelistChips();

  renderDomainOverrides();
  SiteFilter.populateDomainCurrencySelect(
    document.getElementById('domainAddCurrency'),
    currentSettings.currencies || {}
  );
  updateVisibility();
  Preview.render(document.getElementById('previewContent'), currentSettings);
}

function renderLanguageSelector() {
  const locales = I18n.getAvailableLocales();
  const current = currentSettings ? currentSettings.language : null;
  const label = current
    ? (locales.find(l => l.code === current) || {}).name || current
    : I18n.t('options.languageAuto');
  langText.textContent = label;
  langText.classList.toggle('placeholder', !current);
  langList.innerHTML = renderLanguageList(locales, current);
}

function renderLanguageList(locales, selected, filter) {
  const q = (filter || '').toLowerCase();
  const items = [{ code: '', name: I18n.t('options.languageAuto') }, ...locales];
  const filtered = items.filter(l => !q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
  if (filtered.length === 0) {
    return `<div class="currency-picker-item empty">${I18n.t('ui.noResults')}</div>`;
  }
  return filtered.map(l =>
    `<div class="currency-picker-item${selected === l.code ? ' selected' : ''}" data-lang="${l.code}">${l.name}</div>`
  ).join('');
}

function closeLangDropdown() {
  langDropdown.classList.remove('open');
  langTrigger.classList.remove('active');
}

async function applyLanguageChange(value) {
  if (value === currentSettings.language) return;
  currentSettings.language = value;
  await RatesUtil.saveSettings(currentSettings);
  await I18n.init(value);
  I18n.applyToPage();
  renderThemeSelector();
  renderTimeFormatSelector();
  renderNumberFormatSelector();
  renderLanguageSelector();
  renderPairChips();
  renderCurrencyLibrary();
  renderCustomRatesGrid();
  renderFetchStatus();
  renderLoadedRates();
  renderWhitelistChips();
  renderDomainOverrides();
  Preview.render(document.getElementById('previewContent'), currentSettings);
  showSaveToast();
}

langTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = langDropdown.classList.contains('open');
  closeLangDropdown();
  if (!isOpen) {
    langDropdown.classList.add('open');
    langTrigger.classList.add('active');
    langSearch.value = '';
    const locales = I18n.getAvailableLocales();
    const current = currentSettings ? currentSettings.language : null;
    langList.innerHTML = renderLanguageList(locales, current);
    langSearch.focus();
  }
});

langSearch.addEventListener('input', () => {
  const locales = I18n.getAvailableLocales();
  const current = currentSettings ? currentSettings.language : null;
  langList.innerHTML = renderLanguageList(locales, current, langSearch.value);
});

langList.addEventListener('click', async (e) => {
  const item = e.target.closest('.currency-picker-item');
  if (!item || item.classList.contains('empty')) return;
  closeLangDropdown();
  await applyLanguageChange(item.dataset.lang || null);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#langPicker')) closeLangDropdown();
});

loadSettings();

// ---- Fit grid to viewport ----

function fitLibraryGrid() {
  const gridWrap = document.querySelector('.col-library .cur-lib-grid-wrap');
  if (!gridWrap) return;
  const rect = gridWrap.getBoundingClientRect();
  const padding = 24;
  const available = window.innerHeight - rect.top - padding;
  gridWrap.style.maxHeight = Math.max(120, available) + 'px';
}

const _origRenderCurrencyLibrary = renderCurrencyLibrary;
renderCurrencyLibrary = function() {
  _origRenderCurrencyLibrary();
  requestAnimationFrame(fitLibraryGrid);
};

window.addEventListener('resize', fitLibraryGrid);

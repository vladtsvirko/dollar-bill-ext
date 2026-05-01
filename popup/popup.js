const enabledEl = document.getElementById('enabled');
const rateCardsEl = document.getElementById('rateCards');
const rateSearchEl = document.getElementById('rateSearch');
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

let addPairFormOpen = false;
let selectedFrom = null;
let selectedTo = null;
let isRefreshing = false;

// --- Theme ---

function getThemeSetting() {
  return currentSettings && currentSettings.theme ? currentSettings.theme : '';
}

function setTheme(themeSetting) {
  if (!currentSettings) return;
  currentSettings.theme = themeSetting || null;
  UICommon.applyTheme(UICommon.getEffectiveTheme(currentSettings));
  ThemeHandler.renderPopupSegmented(themeSegmented, currentSettings.theme);
  RatesUtil.saveSettings(currentSettings);
}

themeSegmented.addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-seg');
  if (!btn) return;
  setTheme(btn.dataset.themeValue);
});

ThemeHandler.watchSystem(() => {
  if (!getThemeSetting()) {
    UICommon.applyTheme(UICommon.detectSystemTheme());
  }
});

// --- Fetch status tooltip ---

sourceTrigger.addEventListener('mouseenter', () => sourceTooltip.classList.add('show'));
sourceTrigger.addEventListener('mouseleave', () => sourceTooltip.classList.remove('show'));

// --- Source dropdown ---

function renderSourceDropdown(settings) {
  const selectedSources = settings.rateSources || [];
  if (selectedSources.length === 0) sourceNameEl.textContent = I18n.t('popup.noSource');
  else if (selectedSources.length === 1) sourceNameEl.textContent = RateSources.getSourceDisplayName(selectedSources[0]);
  else sourceNameEl.textContent = I18n.t('popup.sourcesCount', { count: selectedSources.length });

  const options = [];
  for (const [id, src] of Object.entries(RatesUtil.RATE_SOURCES)) {
    if (id === RatesUtil.CUSTOM_SOURCE) continue;
    options.push({ id, name: src.name });
  }

  sourceDropdown.innerHTML = `
    <input type="text" class="source-dropdown-search" id="sourceDropdownSearch" placeholder="${FormatUtils.escapeHtml(I18n.t('popup.searchSources'))}">
    <div class="source-dropdown-list" id="sourceDropdownList">
      ${options.map(opt => `
        <div class="source-option${selectedSources.includes(opt.id) ? ' active' : ''}" data-source="${opt.id}" data-label="${FormatUtils.escapeHtml(opt.name.toLowerCase())}">
          <span class="source-option-check"></span>
          <span>${FormatUtils.escapeHtml(opt.name)}</span>
        </div>
      `).join('')}
    </div>
  `;

  const searchInput = document.getElementById('sourceDropdownSearch');
  const listEl = document.getElementById('sourceDropdownList');
  if (searchInput && listEl) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      listEl.querySelectorAll('.source-option').forEach(opt => {
        const label = opt.dataset.label || '';
        opt.style.display = !q || label.includes(q) ? '' : 'none';
      });
    });
  }
}

sourceTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = sourceDropdown.classList.contains('open');
  sourceDropdown.classList.toggle('open', !isOpen);
  if (!isOpen) {
    const searchInput = document.getElementById('sourceDropdownSearch');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
      const listEl = document.getElementById('sourceDropdownList');
      if (listEl) listEl.querySelectorAll('.source-option').forEach(opt => opt.style.display = '');
    }
  }
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
  if (idx >= 0) sources.splice(idx, 1);
  else sources.push(sourceId);

  currentSettings.rateSources = sources;
  await RatesUtil.saveSettings(currentSettings);
  renderSourceDropdown(currentSettings);

  RateCards.invalidateCache();
  await refreshRates();
});

// --- Reload ---

async function refreshRates() {
  isRefreshing = true;
  sourceReload.classList.add('loading');
  try {
    const { rates, fetchStatus } = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'updateRates' }, resolve);
    });
    if (rates) {
      currentRates = rates;
      currentConflicts = RatesUtil.getEffectiveConflicts(currentSettings, currentRates);
      renderConflictBanner();
      renderSourceTimestamp(currentRates);
      if (converterInput.value.trim()) {
        PopupConverter.render({ converterFrom, converterTo, converterInput, converterResult, cachedRates: currentRates, settings: currentSettings, getEffectiveRates: RateCards.getEffectiveRates });
      }
    }
    FetchStatusUI.renderPopup({ dotEl: sourceDot, tooltipEl: sourceTooltip, fetchStatus, rates: rates || currentRates, timeFormat: currentSettings.timeFormat });
  } finally {
    sourceReload.classList.remove('loading');
    isRefreshing = false;
    RateCards.render({ rateCardsEl, rateSearchEl, cachedRates: currentRates, settings: currentSettings, currentConflicts, isRefreshing, onCustomRateChange: handleCustomRateChange, onSourcePickerClick: handleSourcePickerClick });
  }
}

sourceReload.addEventListener('click', refreshRates);

function renderSourceTimestamp(rates) {
  sourceTimeEl.textContent = FormatUtils.formatTimestamp(rates && rates.timestamp, currentSettings.timeFormat);
}

// --- Conflict banner ---

function renderConflictBanner() {
  const pairs = currentSettings.conversionPairs || [];
  const pairKeys = new Set();
  for (const p of pairs) pairKeys.add([p.from, p.to].sort().join(':'));

  const unresolvedCount = Object.keys(currentConflicts).filter(pairKey => {
    const reverseKey = pairKey.split(':').reverse().join(':');
    if (!pairKeys.has(pairKey) && !pairKeys.has(reverseKey)) return false;
    const [from, to] = pairKey.split(':');
    return !RatesUtil.findSelection(from, to, currentSettings.rateSourceSelections);
  }).length;

  if (unresolvedCount > 0) {
    conflictBanner.style.display = 'flex';
    conflictBannerText.textContent = unresolvedCount === 1
      ? I18n.t('popup.conflictOneRate')
      : I18n.t('popup.conflictManyRates', { count: unresolvedCount });
  } else {
    conflictBanner.style.display = 'none';
  }
}

// --- Rate cards handlers ---

async function handleCustomRateChange(e) {
  const input = e.target;
  const base = input.dataset.base;
  const quote = input.dataset.quote;
  const val = parseFloat(input.value);
  if (isNaN(val) || val <= 0) return;

  if (!currentSettings.customRates) currentSettings.customRates = {};
  currentSettings.customRates[`${base}:${quote}`] = { amount: 1, rate: val };

  await RatesUtil.saveSettings(currentSettings);

  RateCards.invalidateCache();
  RateCards.render({ rateCardsEl, rateSearchEl, cachedRates: currentRates, settings: currentSettings, currentConflicts, isRefreshing, onCustomRateChange: handleCustomRateChange, onSourcePickerClick: handleSourcePickerClick });
  renderSourceTimestamp(currentRates);
  renderConflictBanner();

  if (converterInput.value.trim()) {
    PopupConverter.render({ converterFrom, converterTo, converterInput, converterResult, cachedRates: currentRates, settings: currentSettings, getEffectiveRates: RateCards.getEffectiveRates });
  }
}

async function handleSourcePickerClick(e) {
  const el = e.currentTarget;
  const customPairKey = el.dataset.pair;
  const reversePairKey = customPairKey.split(':').reverse().join(':');
  const effectiveRates = RateCards.getEffectiveRates(currentSettings, currentRates);
  const allConflicts = RatesUtil.getConflicts(effectiveRates);
  const conflictData = allConflicts[customPairKey] || allConflicts[reversePairKey];
  if (!conflictData) return;

  SourcePicker.createDropdown({
    el,
    customPairKey,
    conflictData,
    activeSource: RatesUtil.getActiveSourceForPair(customPairKey, reversePairKey, currentSettings, currentRates),
    settings: currentSettings,
    appendTo: document.querySelector('.popup'),
    onSelected: async (sourceId) => {
      const [from, to] = customPairKey.split(':');
      RatesUtil.setSelection(currentSettings, from, to, sourceId);
      await RatesUtil.saveSettings(currentSettings);
      RateCards.invalidateCache();
      RateCards.render({ rateCardsEl, rateSearchEl, cachedRates: currentRates, settings: currentSettings, currentConflicts, onCustomRateChange: handleCustomRateChange, onSourcePickerClick: handleSourcePickerClick });
      renderConflictBanner();
    },
  });
}

// --- Search ---

rateSearchEl.addEventListener('input', () => {
  RateCards.filterRateCards(rateSearchEl, rateCardsEl);
});

// --- Conversion Pairs ---

function renderPairChips(settings) {
  PairChips.renderPopupChips(settings.conversionPairs || [], pairChipsEl, async (idx) => {
    currentSettings.conversionPairs.splice(idx, 1);
    await RatesUtil.saveSettings(currentSettings);
    renderPairChips(currentSettings);
    RateCards.render({ rateCardsEl, rateSearchEl, cachedRates: currentRates, settings: currentSettings, currentConflicts, isRefreshing, onCustomRateChange: handleCustomRateChange, onSourcePickerClick: handleSourcePickerClick });
    renderConflictBanner();
    PopupConverter.populateSelects({ converterFrom, converterTo, settings: currentSettings });
  }, () => toggleAddPairForm());
}

// --- Add Pair Form ---

function toggleAddPairForm() {
  if (addPairFormOpen) {
    addPairFormOpen = false;
    selectedFrom = null;
    selectedTo = null;
    document.removeEventListener('click', onAddPairFormClickOutside);
    document.getElementById('addPairForm').innerHTML = '';
    const btn = document.getElementById('addPairPopup');
    if (btn) btn.classList.remove('active');
  } else {
    addPairFormOpen = true;
    selectedFrom = null;
    selectedTo = null;
    renderAddPairForm();
    const btn = document.getElementById('addPairPopup');
    if (btn) btn.classList.add('active');
  }
}

function renderAddPairForm() {
  const formEl = document.getElementById('addPairForm');
  formEl.innerHTML = `
    <div class="add-pair-row">
      <div class="currency-picker" id="fromPicker">
        <button class="currency-picker-trigger" id="fromPickerTrigger">
          <span class="currency-picker-text placeholder">${FormatUtils.escapeHtml(I18n.t('popup.fromPlaceholder'))}</span>
          <span class="source-chevron">&#9662;</span>
        </button>
        <div class="currency-picker-dropdown" id="fromPickerDropdown">
          <input type="text" class="currency-picker-search" id="fromPickerSearch" placeholder="${FormatUtils.escapeHtml(I18n.t('popup.searchPlaceholder'))}">
          <div class="currency-picker-list" id="fromPickerList"></div>
        </div>
      </div>
      <span class="converter-arrow">&rarr;</span>
      <div class="currency-picker" id="toPicker">
        <button class="currency-picker-trigger" id="toPickerTrigger">
          <span class="currency-picker-text placeholder">${FormatUtils.escapeHtml(I18n.t('popup.toPlaceholder'))}</span>
          <span class="source-chevron">&#9662;</span>
        </button>
        <div class="currency-picker-dropdown" id="toPickerDropdown">
          <input type="text" class="currency-picker-search" id="toPickerSearch" placeholder="${FormatUtils.escapeHtml(I18n.t('popup.searchPlaceholder'))}">
          <div class="currency-picker-list" id="toPickerList"></div>
        </div>
      </div>
    </div>
    <div class="add-pair-actions">
      <button class="add-pair-btn" id="addPairConfirmBtn">${FormatUtils.escapeHtml(I18n.t('popup.addBtn'))}</button>
      <button class="add-pair-cancel" id="addPairCancelBtn">${FormatUtils.escapeHtml(I18n.t('popup.cancelBtn'))}</button>
    </div>
    <div class="add-pair-error" id="addPairError"></div>
  `;

  const { closeDropdowns } = CurrencyPicker.bindPickerEvents({
    fromTrigger: document.getElementById('fromPickerTrigger'),
    fromDropdown: document.getElementById('fromPickerDropdown'),
    fromSearch: document.getElementById('fromPickerSearch'),
    fromList: document.getElementById('fromPickerList'),
    toTrigger: document.getElementById('toPickerTrigger'),
    toDropdown: document.getElementById('toPickerDropdown'),
    toSearch: document.getElementById('toPickerSearch'),
    toList: document.getElementById('toPickerList'),
    getFrom: () => selectedFrom,
    getTo: () => selectedTo,
    setFrom: (v) => { selectedFrom = v; },
    setTo: (v) => { selectedTo = v; },
    currencies: currentSettings.currencies || {},
  });

  // Store closeDropdowns for click-outside handler
  window._popupCloseDropdowns = closeDropdowns;

  document.getElementById('addPairConfirmBtn').addEventListener('click', handleAddPair);
  document.getElementById('addPairCancelBtn').addEventListener('click', () => toggleAddPairForm());
  document.addEventListener('click', onAddPairFormClickOutside);
}

function onAddPairFormClickOutside(e) {
  if (!addPairFormOpen) return;
  const fromPicker = document.getElementById('fromPicker');
  const toPicker = document.getElementById('toPicker');
  if (!fromPicker || !toPicker) return;
  if (!fromPicker.contains(e.target) && !toPicker.contains(e.target)) {
    if (window._popupCloseDropdowns) window._popupCloseDropdowns();
  }
}

async function handleAddPair() {
  const errorEl = document.getElementById('addPairError');
  errorEl.textContent = '';
  errorEl.style.display = 'none';
  if (!selectedFrom || !selectedTo) {
    errorEl.textContent = I18n.t('popup.selectBothCurrencies');
    errorEl.style.display = 'block';
    return;
  }
  if (selectedFrom === selectedTo) {
    errorEl.textContent = I18n.t('popup.fromToMustDiffer');
    errorEl.style.display = 'block';
    return;
  }
  const pairs = currentSettings.conversionPairs || [];
  if (pairs.some(p =>
    (p.from === selectedFrom && p.to === selectedTo) ||
    (p.from === selectedTo && p.to === selectedFrom)
  )) {
    errorEl.textContent = I18n.t('popup.pairAlreadyExists');
    errorEl.style.display = 'block';
    return;
  }

  pairs.push({ from: selectedFrom, to: selectedTo });
  currentSettings.conversionPairs = pairs;
  await RatesUtil.saveSettings(currentSettings);

  addPairFormOpen = false;
  selectedFrom = null;
  selectedTo = null;
  document.removeEventListener('click', onAddPairFormClickOutside);
  document.getElementById('addPairForm').innerHTML = '';

  RateCards.invalidateCache();
  renderPairChips(currentSettings);
  PopupConverter.populateSelects({ converterFrom, converterTo, settings: currentSettings });

  isRefreshing = true;
  RateCards.render({ rateCardsEl, rateSearchEl, cachedRates: currentRates, settings: currentSettings, currentConflicts, isRefreshing, onCustomRateChange: handleCustomRateChange, onSourcePickerClick: handleSourcePickerClick });
  refreshRates();
}

// --- Quick Convert ---

converterFrom.addEventListener('change', () => {
  PopupConverter.render({ converterFrom, converterTo, converterInput, converterResult, cachedRates: currentRates, settings: currentSettings, getEffectiveRates: RateCards.getEffectiveRates });
});
converterTo.addEventListener('change', () => {
  PopupConverter.render({ converterFrom, converterTo, converterInput, converterResult, cachedRates: currentRates, settings: currentSettings, getEffectiveRates: RateCards.getEffectiveRates });
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
  currentConflicts = RatesUtil.getEffectiveConflicts(currentSettings, currentRates);

  await I18n.init(settings.language);
  I18n.applyToPage();

  enabledEl.checked = settings.enabled;

  UICommon.applyTheme(UICommon.getEffectiveTheme(currentSettings));
  ThemeHandler.renderPopupSegmented(themeSegmented, currentSettings.theme);
  renderSourceDropdown(settings);
  renderSourceTimestamp(rates);
  FetchStatusUI.renderPopup({ dotEl: sourceDot, tooltipEl: sourceTooltip, fetchStatus, rates, timeFormat: currentSettings.timeFormat });
  renderConflictBanner();
  RateCards.render({ rateCardsEl, rateSearchEl, cachedRates: rates, settings: currentSettings, currentConflicts, isRefreshing, onCustomRateChange: handleCustomRateChange, onSourcePickerClick: handleSourcePickerClick });
  renderPairChips(settings);
  PopupConverter.populateSelects({ converterFrom, converterTo, settings: currentSettings });

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
    PopupConverter.render({ converterFrom, converterTo, converterInput, converterResult, cachedRates: currentRates, settings: currentSettings, getEffectiveRates: RateCards.getEffectiveRates });
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

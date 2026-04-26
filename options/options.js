const rateSourceRadios = document.querySelectorAll('input[name="rateSource"]');
const customRatesSection = document.getElementById('customRatesSection');
const customRatesGrid = document.getElementById('customRatesGrid');
const siteModeRadios = document.querySelectorAll('input[name="siteMode"]');
const whitelistSection = document.getElementById('whitelistSection');
const whitelistEl = document.getElementById('whitelist');
const ambiguousPatternsEl = document.getElementById('ambiguousPatterns');
const saveToast = document.getElementById('saveToast');
const optEnabled = document.getElementById('optEnabled');
const themeOptions = document.getElementById('themeOptions');

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
let editingCurrency = null;
let autoSaveTimer = null;

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

// Listen for theme changes from popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings) {
    const newSettings = changes.settings.newValue;
    if (newSettings && currentSettings) {
      const oldTheme = currentSettings.theme;
      currentSettings.theme = newSettings.theme;
      if (oldTheme !== newSettings.theme) {
        applyTheme(getEffectiveTheme());
        renderThemeSelector();
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
  currentSettings.rateSource = getRadioValue(rateSourceRadios) || 'nbrb';
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

// ---- Radio helpers ----

function setRadioValue(radios, value) {
  for (const r of radios) r.checked = r.value === value;
}

function getRadioValue(radios) {
  for (const r of radios) if (r.checked) return r.value;
  return null;
}

function updateVisibility() {
  whitelistSection.style.display = getRadioValue(siteModeRadios) === 'whitelist' ? 'block' : 'none';
  scheduleAutoSave();
}

for (const r of siteModeRadios) r.addEventListener('change', updateVisibility);
for (const r of rateSourceRadios) r.addEventListener('change', scheduleAutoSave);

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

  // Group pairs by source, show up to 2 example sources
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
    html += `<label>1 ${displayFrom} = <input type="number" step="0.0001" data-pair="${inputKey}" value="${val}" placeholder="${displayTo}"> ${displayTo}</label>`;
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

  // Apply theme
  applyTheme(getEffectiveTheme());
  renderThemeSelector();

  // Enabled toggle
  optEnabled.checked = currentSettings.enabled !== false;

  renderPairChips();
  populatePairDropdowns();
  renderCurrencyLibrary();

  ambiguousPatternsEl.value = (currentSettings.ambiguousPatterns || []).join('\n');

  setRadioValue(rateSourceRadios, currentSettings.rateSource);
  renderCustomRatesGrid();

  setRadioValue(siteModeRadios, currentSettings.siteMode);
  whitelistEl.value = (currentSettings.whitelist || []).join('\n');

  renderDomainOverrides(currentSettings.domainCurrencyMap);
  updateVisibility();
  renderPreview();
}

loadSettings();

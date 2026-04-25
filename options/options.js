const rateSourceRadios = document.querySelectorAll('input[name="rateSource"]');
const customRatesSection = document.getElementById('customRatesSection');
const customRatesGrid = document.getElementById('customRatesGrid');
const siteModeRadios = document.querySelectorAll('input[name="siteMode"]');
const whitelistSection = document.getElementById('whitelistSection');
const whitelistEl = document.getElementById('whitelist');
const ambiguousPatternsEl = document.getElementById('ambiguousPatterns');
const saveToast = document.getElementById('saveToast');

// Source chips
const sourceChips = document.getElementById('sourceChips');
const addSourceSelect = document.getElementById('addSourceSelect');
const addSourceBtn = document.getElementById('addSourceBtn');

// Target chips
const targetChips = document.getElementById('targetChips');
const addTargetSelect = document.getElementById('addTargetSelect');
const addTargetBtn = document.getElementById('addTargetBtn');

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

// ---- Auto-save ----

function showSaveToast() {
  saveToast.classList.add('show');
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveToast.classList.remove('show'), 1500);
}

async function autoSave() {
  if (!currentSettings) return;
  if (currentSettings.sourceCurrencies.length === 0) return;
  if (currentSettings.targetCurrencies.length === 0) return;

  // Read custom rates from grid
  const customRates = {};
  customRatesGrid.querySelectorAll('input[data-pair]').forEach((input) => {
    const pair = input.dataset.pair;
    const val = input.value.trim();
    if (val) {
      const num = parseFloat(val);
      if (!isNaN(num)) customRates[pair] = num;
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
  customRatesSection.style.display = getRadioValue(rateSourceRadios) === 'custom' ? 'block' : 'none';
  whitelistSection.style.display = getRadioValue(siteModeRadios) === 'whitelist' ? 'block' : 'none';
  scheduleAutoSave();
}

for (const r of rateSourceRadios) r.addEventListener('change', updateVisibility);
for (const r of siteModeRadios) r.addEventListener('change', updateVisibility);

// ---- Drag-to-reorder ----

function setupDragReorder(container, field) {
  let draggedEl = null;

  container.addEventListener('dragstart', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    draggedEl = chip;
    chip.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragend', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) chip.classList.remove('dragging');
    draggedEl = null;
    container.querySelectorAll('.chip').forEach((c) => c.classList.remove('drag-over'));
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const chip = e.target.closest('.chip');
    if (chip && chip !== draggedEl) {
      container.querySelectorAll('.chip').forEach((c) => c.classList.remove('drag-over'));
      chip.classList.add('drag-over');
    }
  });

  container.addEventListener('dragleave', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) chip.classList.remove('drag-over');
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.chip');
    if (!target || !draggedEl || target === draggedEl) return;

    const code = draggedEl.dataset.code;
    const targetCode = target.dataset.code;
    const list = currentSettings[field];
    const fromIdx = list.indexOf(code);
    const toIdx = list.indexOf(targetCode);
    if (fromIdx === -1 || toIdx === -1) return;

    list.splice(fromIdx, 1);
    list.splice(toIdx, 0, code);

    // Re-render the chip list
    const renderFn = field === 'sourceCurrencies' ? renderSourceChips : renderTargetChips;
    renderFn();
    scheduleAutoSave();
  });
}

setupDragReorder(sourceChips, 'sourceCurrencies');
setupDragReorder(targetChips, 'targetCurrencies');

// ---- Source/Target chip rendering ----

function renderChips(container, list, onRemove) {
  container.innerHTML = list.map((code) => {
    const cur = currentSettings.currencies[code];
    const label = cur ? `${code} (${cur.name})` : code;
    return `<span class="chip" draggable="true" data-code="${code}">${label}<button class="chip-remove" data-code="${code}" title="Remove">&times;</button></span>`;
  }).join('');
  container.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => onRemove(btn.dataset.code));
  });
}

function populateDropdown(select, exclude) {
  const currencies = currentSettings.currencies;
  select.innerHTML = '<option value="">Select...</option>';
  for (const code of Object.keys(currencies).sort()) {
    if (!exclude.includes(code)) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = `${code} - ${currencies[code].name}`;
      select.appendChild(opt);
    }
  }
}

function createChipRenderer(containerEl, selectEl, field) {
  function render() {
    const list = currentSettings[field];
    renderChips(containerEl, list, (code) => {
      currentSettings[field] = currentSettings[field].filter((c) => c !== code);
      render();
      populateDropdown(selectEl, currentSettings[field]);
      renderCustomRatesGrid();
      renderPreview();
      scheduleAutoSave();
    });
    populateDropdown(selectEl, list);
  }
  return render;
}

const renderSourceChips = createChipRenderer(sourceChips, addSourceSelect, 'sourceCurrencies');
const renderTargetChips = createChipRenderer(targetChips, addTargetSelect, 'targetCurrencies');

addSourceBtn.addEventListener('click', () => {
  const code = addSourceSelect.value;
  if (!code || currentSettings.sourceCurrencies.includes(code)) return;
  currentSettings.sourceCurrencies.push(code);
  renderSourceChips();
  renderCustomRatesGrid();
  renderPreview();
  scheduleAutoSave();
});

addTargetBtn.addEventListener('click', () => {
  const code = addTargetSelect.value;
  if (!code || currentSettings.targetCurrencies.includes(code)) return;
  currentSettings.targetCurrencies.push(code);
  renderTargetChips();
  renderCustomRatesGrid();
  renderPreview();
  scheduleAutoSave();
});

// ---- Preview Panel ----

function renderPreview() {
  const previewContent = document.getElementById('previewContent');
  if (!previewContent || !currentSettings) return;

  const sources = currentSettings.sourceCurrencies;
  const targets = currentSettings.targetCurrencies;
  const currencies = currentSettings.currencies;

  if (sources.length === 0 || targets.length === 0) {
    previewContent.innerHTML = '<span style="color:#999">Add source and target currencies to see a preview.</span>';
    return;
  }

  // Show up to 2 example prices
  const examples = [];
  for (let i = 0; i < Math.min(sources.length, 2); i++) {
    const srcCode = sources[i];
    const srcCur = currencies[srcCode] || {};
    const symbol = srcCur.symbol || srcCode;
    const amount = 100;
    let html = `<span class="preview-price">${amount} ${srcCode}</span>`;

    for (const tc of targets) {
      const tcCur = currencies[tc] || {};
      const tcSymbol = tcCur.symbol || tc;
      // Use a placeholder conversion rate for preview
      const converted = (amount * (1 + targets.indexOf(tc) * 0.3)).toFixed(2);
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
  currentSettings.sourceCurrencies = currentSettings.sourceCurrencies.filter((c) => c !== code);
  currentSettings.targetCurrencies = currentSettings.targetCurrencies.filter((c) => c !== code);
  delete currentSettings.currencies[code];
  renderSourceChips();
  renderTargetChips();
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
  renderSourceChips();
  renderTargetChips();
  renderCustomRatesGrid();
  renderPreview();
  scheduleAutoSave();
});

// ---- Custom Rates Grid ----

function renderCustomRatesGrid() {
  const sources = currentSettings.sourceCurrencies;
  const targets = currentSettings.targetCurrencies;
  const cr = currentSettings.customRates || {};

  if (sources.length === 0 || targets.length === 0) {
    customRatesGrid.innerHTML = '<p class="hint">Add source and target currencies first.</p>';
    return;
  }

  let html = '<div class="grid-inputs">';
  for (const from of sources) {
    for (const to of targets) {
      const key = `${from}:${to}`;
      const val = cr[key] != null ? cr[key] : '';
      html += `<label>1 ${from} = <input type="number" step="0.0001" data-pair="${key}" value="${val}" placeholder="${to}"> ${to}</label>`;
    }
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

  renderSourceChips();
  renderTargetChips();
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

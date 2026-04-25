const rateSourceRadios = document.querySelectorAll('input[name="rateSource"]');
const customRatesSection = document.getElementById('customRatesSection');
const customRatesGrid = document.getElementById('customRatesGrid');
const siteModeRadios = document.querySelectorAll('input[name="siteMode"]');
const whitelistSection = document.getElementById('whitelistSection');
const whitelistEl = document.getElementById('whitelist');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');
const ambiguousPatternsEl = document.getElementById('ambiguousPatterns');

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

let currentSettings = null;
let editingCurrency = null; // null = new, string = editing existing code

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
}

for (const r of rateSourceRadios) r.addEventListener('change', updateVisibility);
for (const r of siteModeRadios) r.addEventListener('change', updateVisibility);

// ---- Source/Target chip rendering ----

function renderChips(container, list, onRemove) {
  container.innerHTML = list.map((code) => {
    const cur = currentSettings.currencies[code];
    const label = cur ? `${code} (${cur.name})` : code;
    return `<span class="chip" data-code="${code}">${label}<button class="chip-remove" data-code="${code}" title="Remove">&times;</button></span>`;
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
});

addTargetBtn.addEventListener('click', () => {
  const code = addTargetSelect.value;
  if (!code || currentSettings.targetCurrencies.includes(code)) return;
  currentSettings.targetCurrencies.push(code);
  renderTargetChips();
  renderCustomRatesGrid();
});

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
});

// ---- Custom Rates Grid ----

function renderCustomRatesGrid() {
  const sources = currentSettings.sourceCurrencies;
  const targets = currentSettings.targetCurrencies;
  const cr = currentSettings.customRates || {};
  const currencies = currentSettings.currencies;

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
    });
  });
}

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
}

// ---- Save ----

saveBtn.addEventListener('click', async () => {
  if (currentSettings.sourceCurrencies.length === 0) {
    alert('Please add at least one source currency.');
    return;
  }
  if (currentSettings.targetCurrencies.length === 0) {
    alert('Please add at least one target currency.');
    return;
  }

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

  saveStatus.textContent = 'Saved!';
  saveStatus.classList.add('show');
  setTimeout(() => saveStatus.classList.remove('show'), 2000);
});

loadSettings();

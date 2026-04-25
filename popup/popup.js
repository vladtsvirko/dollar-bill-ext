const enabledEl = document.getElementById('enabled');
const rateListEl = document.getElementById('rateList');
const refreshBtn = document.getElementById('refreshBtn');
const settingsLink = document.getElementById('settingsLink');

function renderRates(rates, settings) {
  if (!rates) {
    rateListEl.textContent = 'No rates available';
    return;
  }

  const sources = settings.sourceCurrencies || [];
  const targets = settings.targetCurrencies || [];
  const currencies = settings.currencies || {};

  const rows = [];
  for (const from of sources) {
    const fromRates = rates[from];
    if (!fromRates) continue;
    for (const to of targets) {
      const rate = fromRates[to];
      if (rate != null) {
        const info = currencies[to];
        const symbol = info ? info.symbol : to;
        rows.push(`<div class="rate-row"><span>1 ${from} =</span><span>${symbol}${rate.toFixed(4)}</span></div>`);
      }
    }
  }
  rateListEl.innerHTML = rows.length ? rows.join('') : 'No rates available';
}

async function loadPopup() {
  const [settings, rates] = await Promise.all([
    new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getSettings' }, resolve)),
    new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getRates' }, resolve)),
  ]);

  enabledEl.checked = settings.enabled;
  renderRates(rates, settings);
}

enabledEl.addEventListener('change', async () => {
  const settings = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'getSettings' }, resolve);
  });
  settings.enabled = enabledEl.checked;
  await RatesUtil.saveSettings(settings);
});

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Updating...';
  const rates = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'updateRates' }, resolve);
  });
  const settings = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'getSettings' }, resolve);
  });
  renderRates(rates, settings);
  refreshBtn.disabled = false;
  refreshBtn.textContent = 'Refresh rates';
});

settingsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

loadPopup();

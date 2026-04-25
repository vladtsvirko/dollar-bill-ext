const enabledEl = document.getElementById('enabled');
const rateCardsEl = document.getElementById('rateCards');
const freshnessText = document.getElementById('freshnessText');
const converterInput = document.getElementById('converterInput');
const converterResult = document.getElementById('converterResult');
const siteIndicator = document.getElementById('siteIndicator');
const settingsLink = document.getElementById('settingsLink');

function formatFreshness(timestamp) {
  if (!timestamp) return 'No data';
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Updated just now';
  if (diffMin < 60) return `Updated ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Updated ${diffHr}h ago`;
  return 'Updated over a day ago';
}

function renderRateCards(rates, settings) {
  if (!rates || !rates.timestamp) {
    rateCardsEl.innerHTML = '<div class="rate-card-skeleton">No rates available</div>';
    return;
  }

  const sources = settings.sourceCurrencies || [];
  const targets = settings.targetCurrencies || [];
  const currencies = settings.currencies || {};

  const cards = [];
  for (const from of sources) {
    const fromRates = rates[from];
    if (!fromRates) continue;
    for (const to of targets) {
      const rate = fromRates[to];
      if (rate == null) continue;
      const fromCur = currencies[from] || {};
      const toCur = currencies[to] || {};
      const fromSymbol = fromCur.symbol || from;
      const toSymbol = toCur.symbol || to;
      cards.push(`
        <div class="rate-card">
          <div class="rate-card-left">
            <div class="rate-card-flag">${toSymbol}</div>
            <div>
              <div class="rate-card-label">1 ${from} =</div>
            </div>
          </div>
          <div class="rate-card-value">${toSymbol}${rate.toFixed(4)} ${to}</div>
        </div>
      `);
    }
  }

  rateCardsEl.innerHTML = cards.length
    ? cards.join('')
    : '<div class="rate-card-skeleton">No rates available</div>';
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

  const sources = settings.sourceCurrencies || [];
  const targets = settings.targetCurrencies || [];
  const currencies = settings.currencies || {};

  const lines = [];
  for (const from of sources) {
    for (const to of targets) {
      const converted = RatesUtil.convert(amount, from, to, rates);
      if (converted !== null) {
        const toInfo = currencies[to] || {};
        const symbol = toInfo.symbol || to;
        lines.push(`
          <div class="converter-result-line">
            <span class="converter-result-symbol">${from} \u2192 ${to}</span>
            <span class="converter-result-value">${symbol}${converted.toFixed(2)}</span>
          </div>
        `);
      }
    }
  }

  converterResult.innerHTML = lines.join('');
}

async function loadPopup() {
  const [settings, rates] = await Promise.all([
    new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getSettings' }, resolve)),
    new Promise((resolve) => chrome.runtime.sendMessage({ type: 'getRates' }, resolve)),
  ]);

  enabledEl.checked = settings.enabled;
  renderRateCards(rates, settings);
  freshnessText.textContent = formatFreshness(rates && rates.timestamp);

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

  // Converter uses loaded rates/settings
  converterInput.addEventListener('input', () => {
    renderConverter(converterInput.value.trim(), rates, settings);
  });
}

enabledEl.addEventListener('change', async () => {
  const settings = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'getSettings' }, resolve);
  });
  settings.enabled = enabledEl.checked;
  await RatesUtil.saveSettings(settings);
});

settingsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

loadPopup();

const PickerBar = (() => {
  function showCurrencyPicker(settings, compiledDomainMap, onDone) {
    const existing = document.getElementById('dollarbill-picker');
    if (existing) return;

    const host = location.hostname;
    const sources = RateTables.getSourceCurrencies(settings);
    const currencies = settings.currencies || {};

    const bar = document.createElement('div');
    bar.id = 'dollarbill-picker';

    let buttonsHtml = sources.map((code) => {
      const cur = currencies[code];
      const label = cur ? `${code} (${cur.name})` : code;
      return `<button class="dbp-btn" data-currency="${FormatUtils.escapeHtml(code)}">${FormatUtils.escapeHtml(label)}</button>`;
    }).join('');

    bar.innerHTML = `
      <span class="dbp-label">Dollar Bill: ambiguous prices detected on <strong>${host}</strong></span>
      <span class="dbp-label">Choose base currency:</span>
      ${buttonsHtml}
      <button class="dbp-dismiss" title="Dismiss">&times;</button>
    `;

    bar.querySelector('.dbp-dismiss').addEventListener('click', () => bar.remove());

    bar.querySelectorAll('.dbp-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const currency = btn.dataset.currency;
        const current = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'getSettings' }, resolve);
        });
        if (!current.domainCurrencyMap) current.domainCurrencyMap = {};
        current.domainCurrencyMap[host] = currency;
        await RateFetch.saveSettings(current);
        bar.remove();
        if (onDone) onDone();
      });
    });

    document.body.appendChild(bar);
  }

  function resolveAmbiguousCurrency(settings, compiledDomainMap) {
    const host = location.hostname;
    if (settings.domainCurrencyMap && settings.domainCurrencyMap[host]) {
      return settings.domainCurrencyMap[host];
    }
    for (const { domain, code } of compiledDomainMap) {
      if (domain.startsWith('.')) {
        if (host.endsWith(domain)) return code;
      } else {
        if (host === domain || host.endsWith('.' + domain)) return code;
      }
    }
    return null;
  }

  return { showCurrencyPicker, resolveAmbiguousCurrency };
})();

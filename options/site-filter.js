const SiteFilter = (() => {
  function renderWhitelistChips(chipsEl, whitelist, onRemove) {
    chipsEl.innerHTML = whitelist.map((site, i) =>
      `<span class="chip" data-index="${i}">
        ${FormatUtils.escapeHtml(site)}
        <button class="chip-remove" data-index="${i}" title="Remove">&times;</button>
      </span>`
    ).join('');
    chipsEl.querySelectorAll('.chip-remove').forEach((btn) => {
      btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.index)));
    });
  }

  function renderDomainOverrides(listEl, map, onRemove) {
    const entries = Object.entries(map || {});
    if (entries.length === 0) {
      listEl.innerHTML = '<p class="hint">' + I18n.t('options.noDomainOverrides') + '</p>';
      return;
    }
    listEl.innerHTML = entries.map(([domain, currency]) => `
      <div class="domain-row">
        <span class="domain-name">${FormatUtils.escapeHtml(domain)}</span>
        <span class="domain-cur">${FormatUtils.escapeHtml(currency)}</span>
        <button class="domain-remove" data-domain="${FormatUtils.escapeHtml(domain)}" title="Remove">&times;</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.domain-remove').forEach((btn) => {
      btn.addEventListener('click', () => onRemove(btn.dataset.domain));
    });
  }

  function populateDomainCurrencySelect(selectEl, currencies) {
    const codes = Object.keys(currencies).sort();
    selectEl.innerHTML = codes.map((code) => {
      const cur = currencies[code];
      const label = cur ? `${code} (${cur.name})` : code;
      return `<option value="${code}">${FormatUtils.escapeHtml(label)}</option>`;
    }).join('');
  }

  return { renderWhitelistChips, renderDomainOverrides, populateDomainCurrencySelect };
})();

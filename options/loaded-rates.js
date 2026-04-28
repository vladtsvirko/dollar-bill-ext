const LoadedRates = (() => {
  function render({ listEl, loadedRatesMap, settings }) {
    if (!loadedRatesMap || typeof loadedRatesMap !== 'object' || Object.keys(loadedRatesMap).length === 0) {
      listEl.innerHTML = '<p class="hint">No rates loaded yet.</p>';
      return { count: 0 };
    }

    let html = '';
    let totalCount = 0;
    const nf = settings ? settings.numberFormat : null;

    for (const [sourceId, loadedRates] of Object.entries(loadedRatesMap)) {
      const sourceName = RateSources.getSourceDisplayName(sourceId);

      if (loadedRates && loadedRates.error) {
        html += `<div class="loaded-rates-meta loaded-rates-meta-error">${FormatUtils.escapeHtml(sourceName)} &middot; <span class="source-error-text">${FormatUtils.escapeHtml(loadedRates.error)}</span></div>`;
        continue;
      }

      if (!loadedRates || !loadedRates.rates) continue;
      const base = loadedRates.base;
      const convention = loadedRates.convention;
      const entries = Object.entries(loadedRates.rates)
        .filter(([code]) => code !== base)
        .sort((a, b) => a[0].localeCompare(b[0]));

      totalCount += entries.length;
      const age = loadedRates.timestamp ? FormatUtils.formatCacheAge(loadedRates) : '';
      const rateDateMeta = loadedRates.rateDate ? ` &middot; rates from ${FormatUtils.escapeHtml(formatRateDate(loadedRates.rateDate))}` : '';

      html += `<div class="loaded-rates-meta">${FormatUtils.escapeHtml(sourceName)} &middot; ${entries.length} currencies${rateDateMeta}${age ? ' &middot; fetched ' + FormatUtils.escapeHtml(age) + ' ago' : ''}</div>`;
      html += '<div class="loaded-rates-grid">';
      html += `<div class="loaded-rates-header"><span>Code</span><span>1 ${FormatUtils.escapeHtml(base)} =</span></div>`;
      for (const [code, rate] of entries) {
        const displayRate = convention === 'direct'
          ? (rate > 0 ? FormatUtils.formatNumber(1 / rate, 4, nf) : '&mdash;')
          : (rate > 0 ? FormatUtils.formatNumber(rate, 4, nf) : '&mdash;');
        html += `<div class="loaded-rates-row"><span class="loaded-rates-code">${FormatUtils.escapeHtml(code)}</span><span class="loaded-rates-value">${displayRate}</span></div>`;
      }
      html += '</div>';
    }

    listEl.innerHTML = html || '<p class="hint">No rates loaded yet.</p>';
    return { count: totalCount };
  }

  function renderSourceErrors(loadedRatesMap) {
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

  function formatRateDate(rateDate) {
    if (!rateDate) return '';
    const d = new Date(rateDate);
    if (isNaN(d.getTime())) return rateDate;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return { render, renderSourceErrors };
})();

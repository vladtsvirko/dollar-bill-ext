const LoadedRates = (() => {
  function render({ listEl, cachedRates, settings }) {
    if (!cachedRates || typeof cachedRates !== 'object') {
      listEl.innerHTML = '<p class="hint">' + I18n.t('options.noRatesLoaded') + '</p>';
      return { count: 0 };
    }

    const usedSources = cachedRates._usedSources || [];
    const sourceErrors = cachedRates._sourceErrors || {};
    if (usedSources.length === 0 && Object.keys(sourceErrors).length === 0) {
      listEl.innerHTML = '<p class="hint">' + I18n.t('options.noRatesLoaded') + '</p>';
      return { count: 0 };
    }

    let html = '';
    const nf = settings ? settings.numberFormat : null;

    // Show source errors first
    for (const sourceId of Object.keys(sourceErrors)) {
      const sourceName = RateSources.getSourceDisplayName(sourceId);
      html += `<div class="loaded-rates-meta loaded-rates-meta-error">${FormatUtils.escapeHtml(sourceName)} &middot; <span class="source-error-text">${FormatUtils.escapeHtml(sourceErrors[sourceId])}</span></div>`;
    }

    // Collect all currency pairs from the merged table
    const allPairs = [];
    for (const [from, toMap] of Object.entries(cachedRates)) {
      if (RateTables.META_KEYS.has(from) || !toMap || typeof toMap !== 'object') continue;
      for (const [to, sourceMap] of Object.entries(toMap)) {
        if (!sourceMap || typeof sourceMap !== 'object') continue;
        allPairs.push({ from, to, sourceMap });
      }
    }

    const totalCount = allPairs.length;
    const age = cachedRates.timestamp ? FormatUtils.formatCacheAge(cachedRates) : '';

    html += `<div class="loaded-rates-meta">${I18n.t('fetchStatus.currencies')} ${totalCount}${age ? ' &middot; ' + I18n.t('fetchStatus.fetchedAgo', { age: FormatUtils.escapeHtml(age) }) : ''}</div>`;
    html += '<div class="loaded-rates-grid">';
    html += `<div class="loaded-rates-header"><span>${I18n.t('loadedRates.code')}</span><span>${I18n.t('loadedRates.rate')}</span></div>`;

    // Group by "from" currency and sort
    const fromGroups = {};
    for (const pair of allPairs) {
      if (!fromGroups[pair.from]) fromGroups[pair.from] = [];
      fromGroups[pair.from].push(pair);
    }

    for (const from of Object.keys(fromGroups).sort()) {
      const pairs = fromGroups[from].sort((a, b) => a.to.localeCompare(b.to));
      for (const pair of pairs) {
        const entry = RateTables.resolveActiveEntry(pair.from, pair.to, pair.sourceMap, null, usedSources);
        if (!entry) continue;
        const perUnit = MathOps.toNumber(MathOps.div(entry.rate, entry.amount));
        const displayRate = NumberFormatter.formatNumber(perUnit, 4, nf);
        html += `<div class="loaded-rates-row"><span class="loaded-rates-code">${FormatUtils.escapeHtml(pair.from)} &rarr; ${FormatUtils.escapeHtml(pair.to)}</span><span class="loaded-rates-value">${displayRate}</span></div>`;
      }
    }
    html += '</div>';

    listEl.innerHTML = html || '<p class="hint">' + I18n.t('options.noRatesLoaded') + '</p>';
    return { count: totalCount };
  }

  function renderSourceErrors(cachedRates) {
    document.querySelectorAll('.source-error-indicator').forEach(el => el.remove());
    if (!cachedRates || typeof cachedRates !== 'object') return;
    const sourceErrors = cachedRates._sourceErrors || {};
    for (const [sourceId, errorMsg] of Object.entries(sourceErrors)) {
      const checkbox = document.querySelector(`input[name="rateSource"][value="${CSS.escape(sourceId)}"]`);
      if (!checkbox) continue;
      const label = checkbox.closest('.toggle-option');
      if (!label) continue;
      const span = document.createElement('span');
      span.className = 'source-error-indicator';
      span.title = errorMsg;
      span.textContent = '!';
      label.appendChild(span);
    }
  }

  return { render, renderSourceErrors };
})();

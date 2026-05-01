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

    const nf = settings ? settings.numberFormat : null;

    // Collect all currency pairs with their sourceMap
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

    let html = '';

    // Show source errors first
    for (const sourceId of Object.keys(sourceErrors)) {
      const sourceName = RateSources.getSourceDisplayName(sourceId);
      html += `<div class="loaded-rates-meta loaded-rates-meta-error">${FormatUtils.escapeHtml(sourceName)} &middot; <span class="source-error-text">${FormatUtils.escapeHtml(sourceErrors[sourceId])}</span></div>`;
    }

    html += `<div class="loaded-rates-meta">${I18n.t('fetchStatus.currencies')} ${totalCount}${age ? ' &middot; ' + I18n.t('fetchStatus.fetchedAgo', { age: FormatUtils.escapeHtml(age) }) : ''}</div>`;

    // Group pairs by source
    const sourceGroups = {};
    for (const pair of allPairs) {
      for (const [sourceId, entry] of Object.entries(pair.sourceMap)) {
        if (!sourceGroups[sourceId]) sourceGroups[sourceId] = [];
        sourceGroups[sourceId].push({ from: pair.from, to: pair.to, entry });
      }
    }

    // Sort sources by display name
    const sortedSourceIds = Object.keys(sourceGroups).sort((a, b) =>
      RateSources.getSourceDisplayName(a).localeCompare(RateSources.getSourceDisplayName(b))
    );

    html += '<div class="loaded-rates-sources">';
    for (const sourceId of sortedSourceIds) {
      const pairs = sourceGroups[sourceId].sort((a, b) =>
        a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
      );
      const sourceName = RateSources.getSourceDisplayName(sourceId);
      const groupId = 'lr-' + sourceId.replace(/[^a-zA-Z0-9]/g, '_');

      html += `<div class="loaded-rates-source-group">`;
      html += `<div class="loaded-rates-source-header" data-target="${groupId}">`;
      html += `<span class="loaded-rates-chevron">&#9656;</span>`;
      html += `<span class="loaded-rates-source-name">${FormatUtils.escapeHtml(sourceName)}</span>`;
      html += `<span class="loaded-rates-source-count">${pairs.length}</span>`;
      html += `</div>`;
      html += `<div class="loaded-rates-source-body" id="${groupId}">`;
      html += `<div class="loaded-rates-grid">`;
      html += `<div class="loaded-rates-header"><span>${I18n.t('loadedRates.code')}</span><span>${I18n.t('loadedRates.rate')}</span><span>${I18n.t('loadedRates.source')}</span></div>`;

      for (const pair of pairs) {
        const perUnit = MathOps.toNumber(MathOps.div(pair.entry.rate, pair.entry.amount));
        const displayRate = NumberFormatter.formatNumber(perUnit, 4, nf);
        const typeLabel = pair.entry.type === RateTables.RATE_TYPE.SOURCE_INVERSED ? 'inv.' : pair.entry.type === RateTables.RATE_TYPE.MANUAL ? 'man.' : '';
        html += `<div class="loaded-rates-row"><span class="loaded-rates-code">${FormatUtils.escapeHtml(pair.from)} &rarr; ${FormatUtils.escapeHtml(pair.to)}</span><span class="loaded-rates-value">${displayRate}</span><span class="loaded-rates-type">${FormatUtils.escapeHtml(typeLabel)}</span></div>`;
      }

      html += `</div></div></div>`;
    }
    html += '</div>';

    listEl.innerHTML = html || '<p class="hint">' + I18n.t('options.noRatesLoaded') + '</p>';

    // Bind collapsible headers
    listEl.querySelectorAll('.loaded-rates-source-header').forEach(header => {
      header.addEventListener('click', () => {
        const targetId = header.dataset.target;
        const body = document.getElementById(targetId);
        if (!body) return;
        const open = body.classList.toggle('open');
        header.querySelector('.loaded-rates-chevron').style.transform = open ? 'rotate(90deg)' : '';
      });
    });

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

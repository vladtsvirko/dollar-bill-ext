const FetchStatusUI = (() => {
  function renderPopup({ dotEl, tooltipEl, fetchStatus, rates, timeFormat }) {
    const state = FormatUtils.getFetchState(fetchStatus, rates);
    dotEl.className = 'source-dot source-dot-' + state;

    const lines = [];
    if (fetchStatus && fetchStatus.lastFetchTime) {
      lines.push(I18n.t('fetchStatus.lastFetch', { time: FormatUtils.formatTimestamp(fetchStatus.lastFetchTime, timeFormat) }));
    }
    if (fetchStatus && fetchStatus.lastSuccessTime) {
      lines.push(I18n.t('fetchStatus.lastSuccess', { time: FormatUtils.formatTimestamp(fetchStatus.lastSuccessTime, timeFormat) }));
    }
    if (rates && rates.timestamp) {
      lines.push(I18n.t('fetchStatus.cacheAge', { age: FormatUtils.formatCacheAge(rates) }));
    }
    if (fetchStatus && fetchStatus.lastError) {
      lines.push(I18n.t('fetchStatus.error', { error: fetchStatus.lastError }));
      if (fetchStatus.consecutiveFailures > 1) {
        lines.push(I18n.t('fetchStatus.failedTimes', { count: fetchStatus.consecutiveFailures }));
      }
    }
    if (lines.length === 0) {
      lines.push(I18n.t('fetchStatus.noFetchData'));
    }
    tooltipEl.innerHTML = lines.map(l => FormatUtils.escapeHtml(l)).join('<br>');
  }

  function renderOptions({ dotEl, titleEl, detailsEl, fetchStatus, rates, timeFormat, loadedRates }) {
    const state = FormatUtils.getFetchState(fetchStatus, rates);
    const sourceErrors = loadedRates
      ? Object.values(loadedRates).filter(lr => lr && lr.error)
      : [];

    if (state === 'error') {
      dotEl.className = 'fetch-status-dot fetch-status-dot-error';
      titleEl.textContent = I18n.t('fetchStatus.fetchFailed');
      titleEl.className = 'fetch-status-title fetch-status-title-error';
    } else if (sourceErrors.length > 0) {
      dotEl.className = 'fetch-status-dot fetch-status-dot-stale';
      titleEl.textContent = I18n.t('fetchStatus.sourcesFailed', { count: sourceErrors.length, suffix: sourceErrors.length > 1 ? 's' : '' });
      titleEl.className = 'fetch-status-title fetch-status-title-error';
    } else if (state === 'stale') {
      dotEl.className = 'fetch-status-dot fetch-status-dot-stale';
      titleEl.textContent = (fetchStatus && fetchStatus.lastFetchTime) ? I18n.t('fetchStatus.ratesStale') : I18n.t('fetchStatus.noFetchDataShort');
      titleEl.className = 'fetch-status-title';
    } else {
      dotEl.className = 'fetch-status-dot fetch-status-dot-ok';
      titleEl.textContent = I18n.t('fetchStatus.upToDate');
      titleEl.className = 'fetch-status-title';
    }

    const rows = [];
    if (fetchStatus && fetchStatus.lastFetchTime) {
      rows.push([I18n.t('fetchStatus.lastFetchAttempt'), FormatUtils.formatTimestamp(fetchStatus.lastFetchTime, timeFormat, 'Never')]);
    }
    if (fetchStatus && fetchStatus.lastSuccessTime) {
      rows.push([I18n.t('fetchStatus.lastSuccessfulFetch'), FormatUtils.formatTimestamp(fetchStatus.lastSuccessTime, timeFormat, 'Never')]);
    }
    if (rates && rates.timestamp) {
      rows.push([I18n.t('fetchStatus.cacheAgeShort'), FormatUtils.formatCacheAge(rates)]);
      rows.push([I18n.t('fetchStatus.cacheTimestamp'), FormatUtils.formatTimestamp(rates.timestamp, timeFormat, 'Never')]);
    }
    const usedSources = RateTables.getUsedSources(rates);
    if (usedSources.length > 0) {
      rows.push([I18n.t('fetchStatus.sources'), usedSources.map(id => RateSources.getSourceDisplayName(id)).join(', ')]);
    }
    if (fetchStatus && fetchStatus.lastError) {
      rows.push([I18n.t('fetchStatus.errorLabel'), fetchStatus.lastError]);
      if (fetchStatus.consecutiveFailures > 1) {
        rows.push([I18n.t('fetchStatus.consecutiveFailures'), fetchStatus.consecutiveFailures]);
      }
    }
    if (loadedRates) {
      for (const [sourceId, lr] of Object.entries(loadedRates)) {
        if (lr && lr.error) {
          rows.push([RateSources.getSourceDisplayName(sourceId), lr.error]);
        }
      }
    }

    detailsEl.innerHTML = rows.map(([label, value]) =>
      `<div class="fetch-status-row"><span class="fetch-status-label">${FormatUtils.escapeHtml(label)}</span><span class="fetch-status-value">${FormatUtils.escapeHtml(value)}</span></div>`
    ).join('');
  }

  return { renderPopup, renderOptions };
})();

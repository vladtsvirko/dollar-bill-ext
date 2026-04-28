const FetchStatusUI = (() => {
  function renderPopup({ dotEl, tooltipEl, fetchStatus, rates, timeFormat }) {
    const state = FormatUtils.getFetchState(fetchStatus, rates);
    dotEl.className = 'source-dot source-dot-' + state;

    const lines = [];
    if (fetchStatus && fetchStatus.lastFetchTime) {
      lines.push('Last fetch: ' + FormatUtils.formatTimestamp(fetchStatus.lastFetchTime, timeFormat));
    }
    if (fetchStatus && fetchStatus.lastSuccessTime) {
      lines.push('Last success: ' + FormatUtils.formatTimestamp(fetchStatus.lastSuccessTime, timeFormat));
    }
    if (rates && rates.timestamp) {
      lines.push('Cache age: ' + FormatUtils.formatCacheAge(rates));
    }
    if (fetchStatus && fetchStatus.lastError) {
      lines.push('Error: ' + fetchStatus.lastError);
      if (fetchStatus.consecutiveFailures > 1) {
        lines.push('Failed ' + fetchStatus.consecutiveFailures + ' times in a row');
      }
    }
    if (lines.length === 0) {
      lines.push('No fetch data yet');
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
      titleEl.textContent = 'Fetch failed';
      titleEl.className = 'fetch-status-title fetch-status-title-error';
    } else if (sourceErrors.length > 0) {
      dotEl.className = 'fetch-status-dot fetch-status-dot-stale';
      titleEl.textContent = `${sourceErrors.length} source${sourceErrors.length > 1 ? 's' : ''} failed`;
      titleEl.className = 'fetch-status-title fetch-status-title-error';
    } else if (state === 'stale') {
      dotEl.className = 'fetch-status-dot fetch-status-dot-stale';
      titleEl.textContent = (fetchStatus && fetchStatus.lastFetchTime) ? 'Rates are stale' : 'No fetch data';
      titleEl.className = 'fetch-status-title';
    } else {
      dotEl.className = 'fetch-status-dot fetch-status-dot-ok';
      titleEl.textContent = 'Up to date';
      titleEl.className = 'fetch-status-title';
    }

    const rows = [];
    if (fetchStatus && fetchStatus.lastFetchTime) {
      rows.push(['Last fetch attempt', FormatUtils.formatTimestamp(fetchStatus.lastFetchTime, timeFormat, 'Never')]);
    }
    if (fetchStatus && fetchStatus.lastSuccessTime) {
      rows.push(['Last successful fetch', FormatUtils.formatTimestamp(fetchStatus.lastSuccessTime, timeFormat, 'Never')]);
    }
    if (rates && rates.timestamp) {
      rows.push(['Cache age', FormatUtils.formatCacheAge(rates)]);
      rows.push(['Cache timestamp', FormatUtils.formatTimestamp(rates.timestamp, timeFormat, 'Never')]);
    }
    const usedSources = RateTables.getUsedSources(rates);
    if (usedSources.length > 0) {
      rows.push(['Sources', usedSources.map(id => RateSources.getSourceDisplayName(id)).join(', ')]);
    }
    if (fetchStatus && fetchStatus.lastError) {
      rows.push(['Error', fetchStatus.lastError]);
      if (fetchStatus.consecutiveFailures > 1) {
        rows.push(['Consecutive failures', fetchStatus.consecutiveFailures]);
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

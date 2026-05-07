const FormatUtils = (() => {
  const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  const _escapeRe = /[&<>"]/g;

  function escapeHtml(str) {
    return str.replace(_escapeRe, ch => _escapeMap[ch]);
  }

  let _detectedHourCycle = null;

  function detectHourCycle() {
    if (!_detectedHourCycle) {
      const resolved = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
        .resolvedOptions().hourCycle;
      _detectedHourCycle = (resolved === 'h23' || resolved === 'h24') ? 'h23' : 'h12';
    }
    return _detectedHourCycle;
  }

  function formatTimestamp(timestamp, timeFormat, fallback) {
    if (!timestamp) return fallback || '';
    const d = new Date(timestamp);
    const hour12 = timeFormat === '24h' ? false
      : timeFormat === '12h' ? true
      : detectHourCycle() === 'h12';
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12,
    });
  }

  function getFetchState(fetchStatus, rates) {
    if (fetchStatus && fetchStatus.lastError) return 'error';
    if (!rates || !rates.timestamp || !RateTables.isCacheValid(rates)) return 'stale';
    if (!fetchStatus || !fetchStatus.lastFetchTime) return 'stale';
    return 'ok';
  }

  function formatCacheAge(rates) {
    if (!rates || !rates.timestamp) return '';
    const ageMin = Math.round((Date.now() - rates.timestamp) / 60000);
    return ageMin < 1 ? '< 1 min' : ageMin + ' min';
  }

  const _regexCache = new Map();

  function matchesHost(hostname, pattern) {
    try {
      if (hostname === pattern || hostname.endsWith('.' + pattern)) return true;
      let re = _regexCache.get(pattern);
      if (!re) {
        re = new RegExp(pattern);
        _regexCache.set(pattern, re);
      }
      return re.test(hostname);
    } catch {
      return hostname.includes(pattern);
    }
  }

  function isHostInList(hostname, patterns) {
    return (patterns || []).some(p => matchesHost(hostname, p));
  }

  return {
    escapeHtml,
    detectHourCycle,
    formatTimestamp,
    getFetchState,
    formatCacheAge,
    matchesHost,
    isHostInList,
  };
})();

importScripts('core/currencies.js', 'core/math.js', 'core/rate-sources.js', 'core/migrations.js', 'core/settings.js', 'core/i18n.js', 'core/patterns.js', 'core/rate-tables.js', 'core/number-formatter.js', 'core/format-utils.js', 'core/rate-fetch.js', 'core/rates.js');

const ALARM_NAME = 'dollarbill-update-rates';
const ALARM_INTERVAL_MIN = 30;

async function updateRates() {
  try {
    const settings = await RatesUtil.getSettings();
    await RatesUtil.fetchAndCacheRates(settings.rateSources || ['nbrb']);
    try {
      await RatesUtil.saveFetchStatus({
        lastFetchTime: Date.now(),
        lastSuccessTime: Date.now(),
        lastError: null,
        consecutiveFailures: 0,
      });
    } catch (_) { /* best effort */ }
    console.log('[DollarBill] Rates updated successfully');
    return { success: true };
  } catch (err) {
    const prev = await RatesUtil.getFetchStatus();
    try {
      await RatesUtil.saveFetchStatus({
        lastFetchTime: Date.now(),
        lastSuccessTime: prev.lastSuccessTime,
        lastError: err.message,
        consecutiveFailures: (prev.consecutiveFailures || 0) + 1,
      });
    } catch (_) { /* best effort */ }
    console.error('[DollarBill] Failed to update rates:', err.message);
    return { success: false, error: err.message };
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await updateRates();
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_INTERVAL_MIN });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    updateRates();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getRates') {
    RatesUtil.getCachedRates().then(sendResponse);
    return true;
  }
  if (msg.type === 'updateRates') {
    updateRates().then(async (result) => {
      const [fetchStatus, loadedRates, rates] = await Promise.all([
        RatesUtil.getFetchStatus(),
        RatesUtil.getLoadedRates(),
        result.success ? RatesUtil.getCachedRates() : Promise.resolve(null),
      ]);
      sendResponse({ rates, fetchStatus, loadedRates });
    }).catch(() => sendResponse({ rates: null, fetchStatus: null, loadedRates: null }));
    return true;
  }
  if (msg.type === 'getSettings') {
    RatesUtil.getSettings().then(sendResponse);
    return true;
  }
  if (msg.type === 'getFetchStatus') {
    RatesUtil.getFetchStatus().then(sendResponse);
    return true;
  }
  if (msg.type === 'getLoadedRates') {
    RatesUtil.getLoadedRates().then(sendResponse);
    return true;
  }
});

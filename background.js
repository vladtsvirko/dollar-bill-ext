importScripts('lib/rates.js');

const ALARM_NAME = 'dollarbill-update-rates';
const ALARM_INTERVAL_MIN = 30;

async function updateRates() {
  try {
    const settings = await RatesUtil.getSettings();
    if (settings.rateSource === 'custom') {
      const customRates = RatesUtil.getCustomRates(settings);
      customRates.timestamp = Date.now();
      await RatesUtil.cacheRates(customRates);
      return;
    }
    await RatesUtil.fetchAndCacheRates(settings.rateSource, settings);
    console.log('[DollarBill] Rates updated successfully');
  } catch (err) {
    console.error('[DollarBill] Failed to update rates:', err.message);
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
    updateRates().then(() => RatesUtil.getCachedRates()).then(sendResponse);
    return true;
  }
  if (msg.type === 'getSettings') {
    RatesUtil.getSettings().then(sendResponse);
    return true;
  }
});

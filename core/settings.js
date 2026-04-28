const Settings = (() => {
  const SETTINGS_KEY = 'dollarbill_settings';

  const DEFAULT_SETTINGS = {
    enabled: true,
    currencies: JSON.parse(JSON.stringify(Currencies.DEFAULT_CURRENCIES)),
    conversionPairs: [
      { from: 'BYN', to: 'USD' },
      { from: 'BYN', to: 'EUR' },
      { from: 'RUB', to: 'USD' },
      { from: 'RUB', to: 'EUR' },
    ],
    rateSources: ['nbrb'],
    rateSourceOverrides: {},
    customRates: {},
    domainCurrencyMap: {},
    siteMode: 'all',
    whitelist: [],
    theme: null,
    timeFormat: null,
    numberFormat: null,
    _settingsVersion: 7,
  };

  async function getSettings() {
    let localResult = await chrome.storage.local.get(SETTINGS_KEY);
    if (!localResult[SETTINGS_KEY]) {
      const syncResult = await chrome.storage.sync.get(SETTINGS_KEY);
      if (syncResult[SETTINGS_KEY]) {
        await chrome.storage.local.set({ [SETTINGS_KEY]: syncResult[SETTINGS_KEY] });
        await chrome.storage.sync.remove(SETTINGS_KEY);
        localResult = { [SETTINGS_KEY]: syncResult[SETTINGS_KEY] };
      }
    }

    let stored = localResult[SETTINGS_KEY] || {};

    stored = await Migrations.migrate(stored);

    const merged = { ...DEFAULT_SETTINGS, ...stored };
    if (stored.currencies) {
      merged.currencies = { ...DEFAULT_SETTINGS.currencies, ...stored.currencies };
    }
    return merged;
  }

  async function saveSettings(settings) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }

  return { DEFAULT_SETTINGS, SETTINGS_KEY, getSettings, saveSettings };
})();

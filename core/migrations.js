const Migrations = (() => {
  function migrateSettingsV1toV2(stored) {
    if (stored._settingsVersion >= 2) return stored;
    if (!stored.sourceCurrencies && !stored.targetCurrencies) return stored;

    const pairs = [];
    const sources = stored.sourceCurrencies || [];
    const targets = stored.targetCurrencies || [];
    for (const from of sources) {
      for (const to of targets) {
        if (from !== to) {
          pairs.push({ from, to });
        }
      }
    }

    stored.conversionPairs = pairs;
    if (stored.rateSource === 'custom') {
      stored.rateSource = 'nbrb';
    }
    stored._settingsVersion = 2;
    delete stored.sourceCurrencies;
    delete stored.targetCurrencies;
    return stored;
  }

  function migrateSettingsV2toV3(stored) {
    if (stored._settingsVersion >= 3) return stored;
    stored._settingsVersion = 3;
    return stored;
  }

  function migrateSettingsV3toV4(stored) {
    if (stored._settingsVersion >= 4) return stored;
    if (stored.rateSource && !stored.rateSources) {
      stored.rateSources = Array.isArray(stored.rateSource) ? stored.rateSource : [stored.rateSource];
    }
    delete stored.rateSource;
    if (!stored.rateSources) stored.rateSources = ['nbrb'];
    stored.rateSourceOverrides = stored.rateSourceOverrides || {};
    stored._settingsVersion = 4;
    return stored;
  }

  function migrateSettingsV4toV5(stored) {
    if (stored._settingsVersion >= 5) return stored;
    delete stored.currencies;
    delete stored.ambiguousPatterns;
    stored._settingsVersion = 5;
    return stored;
  }

  function migrateSettingsV5toV6(stored) {
    if (stored._settingsVersion >= 6) return stored;
    stored._settingsVersion = 6;
    return stored;
  }

  async function migrate(stored) {
    const MIGRATIONS = [
      migrateSettingsV1toV2,
      migrateSettingsV2toV3,
      migrateSettingsV3toV4,
      migrateSettingsV4toV5,
      migrateSettingsV5toV6,
    ];

    const SETTINGS_KEY = Settings.SETTINGS_KEY;

    for (const fn of MIGRATIONS) {
      const prevVersion = stored._settingsVersion || 0;
      stored = fn(stored);
      if (stored._settingsVersion > prevVersion) {
        await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
      }
    }

    return stored;
  }

  return { migrate };
})();

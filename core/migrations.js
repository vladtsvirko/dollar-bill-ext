const Migrations = (() => {
  function migrateV1toV2(stored) {
    if ((stored._settingsVersion || 0) >= 2) return stored;

    // Convert customRates from number to {amount, rate}
    if (stored.customRates) {
      for (const [key, val] of Object.entries(stored.customRates)) {
        if (typeof val === 'number') {
          stored.customRates[key] = { amount: 1, rate: val };
        }
      }
    }

    // Convert rateSourceOverrides map to rateSourceSelections list
    if (stored.rateSourceOverrides) {
      const selections = [];
      for (const [pairKey, source] of Object.entries(stored.rateSourceOverrides)) {
        const [from, to] = pairKey.split(':');
        if (from && to && source) selections.push({ from, to, source });
      }
      stored.rateSourceSelections = selections;
      delete stored.rateSourceOverrides;
    }

    stored._settingsVersion = 2;
    return stored;
  }

  function migrateV2toV3(stored) {
    if ((stored._settingsVersion || 0) >= 3) return stored;
    stored._settingsVersion = 3;
    return stored;
  }

  function migrateV3toV4(stored) {
    if ((stored._settingsVersion || 0) >= 4) return stored;
    // Rename old CUSTOM_SOURCE value from 'custom' to 'manual'
    if (stored.rateSourceSelections) {
      for (const sel of stored.rateSourceSelections) {
        if (sel.source === 'custom') sel.source = 'manual';
      }
    }
    stored._settingsVersion = 4;
    return stored;
  }

  function migrateV4toV5(stored) {
    if ((stored._settingsVersion || 0) >= 5) return stored;
    if (stored.siteMode === 'all') {
      stored.siteMode = 'blacklist';
      stored.blacklist = [];
    }
    if (!stored.blacklist) stored.blacklist = [];
    stored._settingsVersion = 5;
    return stored;
  }

  async function migrate(stored) {
    const MIGRATIONS = [
      migrateV1toV2,
      migrateV2toV3,
      migrateV3toV4,
      migrateV4toV5,
    ];

    const SETTINGS_KEY = Settings.SETTINGS_KEY;
    let versionBumped = false;
    const prevVersion = stored._settingsVersion || 0;

    for (const fn of MIGRATIONS) {
      stored = fn(stored);
    }

    if ((stored._settingsVersion || 0) > prevVersion) {
      versionBumped = true;
      await chrome.storage.local.set({ [SETTINGS_KEY]: stored });
    }

    // Clear cached rates if format changed
    if (versionBumped) {
      try {
        await chrome.storage.local.remove(['dollarbill_rates', 'dollarbill_rates_v2']);
      } catch (_) { /* best effort */ }
    }

    return stored;
  }

  return { migrate };
})();

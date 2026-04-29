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

  async function migrate(stored) {
    const MIGRATIONS = [
      migrateV1toV2,
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
        await chrome.storage.local.remove('dollarbill_rates');
      } catch (_) { /* best effort */ }
    }

    return stored;
  }

  return { migrate };
})();

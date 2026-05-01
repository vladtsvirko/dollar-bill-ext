const Migrations = (() => {

  async function migrate(stored) {
    const MIGRATIONS = [

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

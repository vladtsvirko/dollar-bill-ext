const Migrations = (() => {
  async function migrate(stored) {
  //no migrations for now, insert migration calls in sequential order
    const MIGRATIONS = [
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

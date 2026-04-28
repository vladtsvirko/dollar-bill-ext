const ThemeHandler = (() => {
  function renderPopupSegmented(container, currentTheme) {
    const active = currentTheme || '';
    container.querySelectorAll('.theme-seg').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeValue === active);
    });
  }

  function renderOptionsSelector(container, currentTheme) {
    const active = currentTheme === null ? '' : currentTheme;
    container.querySelectorAll('.theme-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeValue === active);
    });
  }

  function watchSystem(callback) {
    UICommon.watchSystemTheme(callback);
  }

  return { renderPopupSegmented, renderOptionsSelector, watchSystem };
})();

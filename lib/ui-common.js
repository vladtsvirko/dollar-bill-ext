const UICommon = (() => {
  // --- Theme ---

  function detectSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getEffectiveTheme(settings) {
    if (settings && settings.theme) return settings.theme;
    return detectSystemTheme();
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function watchSystemTheme(callback) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', callback);
  }

  // --- Currency list rendering ---

  function renderCurrencyListHTML(currencies, selectedCode, filter, availableCurrencies) {
    const codes = Object.keys(currencies).sort();
    const q = (filter || '').toLowerCase();
    const filtered = codes.filter(code => {
      const name = currencies[code].name || '';
      return !q || code.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      return '<div class="currency-picker-item empty">No results</div>';
    }

    // When searching, show flat filtered list
    const noRateLabel = (code) => (availableCurrencies && !availableCurrencies.has(code))
      ? '<span class="currency-no-rate">\u00B7 no rate</span>' : '';

    if (q) {
      return filtered.map(code => {
        const name = currencies[code].name || '';
        const isSelected = code === selectedCode ? ' selected' : '';
        return `<div class="currency-picker-item${isSelected}" data-code="${code}">${code} - ${RatesUtil.escapeHtml(name)}${noRateLabel(code)}</div>`;
      }).join('');
    }

    // When not searching, show popular currencies first, then alphabetical groups
    const popularCodes = Currencies.POPULAR_CURRENCIES.filter(c => currencies[c]);
    const remainingCodes = filtered.filter(c => !Currencies.POPULAR_CURRENCIES.includes(c));

    let html = '';
    if (popularCodes.length > 0) {
      html += '<div class="currency-picker-group-label">Popular</div>';
      for (const code of popularCodes) {
        const name = currencies[code].name || '';
        const isSelected = code === selectedCode ? ' selected' : '';
        html += `<div class="currency-picker-item${isSelected}" data-code="${code}">${code} - ${RatesUtil.escapeHtml(name)}${noRateLabel(code)}</div>`;
      }
    }

    let currentLetter = '';
    for (const code of remainingCodes) {
      const letter = code[0];
      if (letter !== currentLetter) {
        currentLetter = letter;
        html += `<div class="currency-picker-group-label">${letter}</div>`;
      }
      const name = currencies[code].name || '';
      const isSelected = code === selectedCode ? ' selected' : '';
      html += `<div class="currency-picker-item${isSelected}" data-code="${code}">${code} - ${RatesUtil.escapeHtml(name)}${noRateLabel(code)}</div>`;
    }

    return html;
  }

  // --- Source picker ---

  let _activeCloseHandler = null;

  function closeAllSourcePickerDropdowns() {
    document.querySelectorAll('.rate-source-picker-dropdown').forEach(d => d.remove());
    document.querySelectorAll('.rate-source-picker.active').forEach(el => {
      el.classList.remove('active');
      el.style.overflow = '';
    });
    if (_activeCloseHandler) {
      document.removeEventListener('click', _activeCloseHandler);
      _activeCloseHandler = null;
    }
  }

  function setSourcePickerCloseHandler(handler) {
    if (_activeCloseHandler) {
      document.removeEventListener('click', _activeCloseHandler);
    }
    _activeCloseHandler = handler;
    setTimeout(() => document.addEventListener('click', handler), 0);
  }

  return {
    detectSystemTheme,
    getEffectiveTheme,
    applyTheme,
    watchSystemTheme,
    renderCurrencyListHTML,
    closeAllSourcePickerDropdowns,
    setSourcePickerCloseHandler,
  };
})();

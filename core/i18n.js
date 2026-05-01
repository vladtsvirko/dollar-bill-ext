const I18n = (() => {
  const LOCALE_REGISTRY = [
    { code: 'en', name: 'English' },
    { code: 'pl', name: 'Polski' },
    { code: 'be', name: 'Беларуская' },
    { code: 'ru', name: 'Русский' },
  ];

  let _translations = null;
  let _fallbackTranslations = null;
  let _currentLocale = null;

  async function _loadJSON(locale) {
    try {
      const url = chrome.runtime.getURL(`locales/${locale}.json`);
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  async function init(locale) {
    if (!_fallbackTranslations) {
      _fallbackTranslations = await _loadJSON('en') || {};
    }

    let resolved = locale || null;

    if (!resolved) {
      const navLang = (navigator.language || '').toLowerCase();
      for (const entry of LOCALE_REGISTRY) {
        if (entry.code !== 'en' && (navLang === entry.code || navLang.startsWith(entry.code + '-'))) {
          resolved = entry.code;
          break;
        }
      }
    }

    if (!resolved) resolved = 'en';
    if (resolved === _currentLocale && _translations) return;

    if (resolved && resolved !== 'en') {
      const data = await _loadJSON(resolved);
      if (data) {
        _translations = data;
        _currentLocale = resolved;
        return;
      }
    }

    _translations = _fallbackTranslations;
    _currentLocale = 'en';
  }

  function t(key, params) {
    const source = _translations || _fallbackTranslations;
    let val = (source && source[key]) || (_fallbackTranslations && _fallbackTranslations[key]) || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        val = val.replaceAll('{{' + k + '}}', v);
      }
    }
    return val;
  }

  function applyToPage() {
    document.querySelectorAll('[data-i18n],[data-i18n-placeholder],[data-i18n-title]').forEach(el => {
      const keyText = el.getAttribute('data-i18n');
      if (keyText) {
        const val = t(keyText);
        if (val !== keyText) el.textContent = val;
      }
      const keyPlaceholder = el.getAttribute('data-i18n-placeholder');
      if (keyPlaceholder) {
        const val = t(keyPlaceholder);
        if (val !== keyPlaceholder) el.placeholder = val;
      }
      const keyTitle = el.getAttribute('data-i18n-title');
      if (keyTitle) {
        const val = t(keyTitle);
        if (val !== keyTitle) el.title = val;
      }
    });
  }

  function getCurrentLocale() {
    return _currentLocale;
  }

  function getAvailableLocales() {
    return LOCALE_REGISTRY;
  }

  return { init, t, applyToPage, getCurrentLocale, getAvailableLocales };
})();

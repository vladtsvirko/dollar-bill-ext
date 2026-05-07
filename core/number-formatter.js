const NumberFormatter = (() => {
  // Cache Intl.NumberFormat instances keyed by (locale, decimals)
  const _intlCache = new Map();

  function _getIntlFormatter(locale, decimals) {
    const key = locale + '|' + decimals;
    let fmt = _intlCache.get(key);
    if (!fmt) {
      fmt = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      _intlCache.set(key, fmt);
    }
    return fmt;
  }

  function formatNumber(value, decimals, numberFormat) {
    if (value == null) return '';
    const num = new BigNumber(value);
    if (num.isNaN() || !num.isFinite()) return '';
    const locale = numberFormat || undefined;
    return _getIntlFormatter(locale, decimals).format(num.toNumber());
  }

  function formatRate(value, decimals) {
    if (value == null) return '';
    const dp = decimals != null ? decimals : 4;
    if (!MathOps.isValid(value)) return '';
    return MathOps.round(value, dp);
  }

  function parsePriceText(str) {
    const s = str.replace(/\s/g, '');
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    let normalized;
    if (lastComma > lastDot) {
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      normalized = s.replace(/,/g, '');
    } else {
      normalized = s.replace(',', '.');
    }
    const n = new BigNumber(normalized);
    if (n.isNaN() || !n.isFinite()) return null;
    return n.toString();
  }

  return { formatNumber, formatRate, parsePriceText };
})();

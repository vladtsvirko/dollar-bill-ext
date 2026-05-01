const NumberFormatter = (() => {
  function formatNumber(value, decimals, numberFormat) {
    if (value == null) return '';
    const num = new BigNumber(value);
    if (num.isNaN() || !num.isFinite()) return '';
    const locale = numberFormat || undefined;
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num.toNumber());
  }

  function formatRate(value, decimals) {
    if (value == null) return '';
    const dp = decimals != null ? decimals : 4;
    if (!MathOps.isValid(value)) return '';
    return MathOps.round(value, dp);
  }

  function formatCacheAge(rates) {
    if (!rates || !rates.timestamp) return '';
    const ageMin = Math.round((Date.now() - rates.timestamp) / 60000);
    return ageMin < 1 ? '< 1 min' : ageMin + ' min';
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

  return { formatNumber, formatRate, formatCacheAge, parsePriceText };
})();

const NumberFormatter = (() => {
  function formatNumber(value, decimals, numberFormat) {
    if (value == null) return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '';
    const locale = numberFormat || undefined;
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  function formatRate(value, decimals) {
    if (value == null) return '';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '';
    const dp = decimals != null ? decimals : 4;
    const factor = Math.pow(10, dp);
    return String(Math.round(num * factor) / factor);
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
    let result;
    if (lastComma > lastDot) {
      result = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    } else if (lastDot > lastComma) {
      result = parseFloat(s.replace(/,/g, ''));
    } else {
      result = parseFloat(s.replace(',', '.'));
    }
    if (isNaN(result) || !isFinite(result)) return null;
    return String(result);
  }

  return { formatNumber, formatRate, formatCacheAge, parsePriceText };
})();

const MathOps = (() => {
  function _toNum(a) {
    if (typeof a === 'number') return a;
    return parseFloat(a);
  }

  function add(a, b) {
    return String(_toNum(a) + _toNum(b));
  }

  function sub(a, b) {
    return String(_toNum(a) - _toNum(b));
  }

  function mul(a, b) {
    return String(_toNum(a) * _toNum(b));
  }

  function div(a, b) {
    const bn = _toNum(b);
    if (bn === 0) return '0';
    return String(_toNum(a) / bn);
  }

  function round(val, dp) {
    const factor = Math.pow(10, dp);
    return String(Math.round(_toNum(val) * factor) / factor);
  }

  function inv(val) {
    const n = _toNum(val);
    if (n === 0) return '0';
    return String(1 / n);
  }

  function gt(a, b) {
    return _toNum(a) > _toNum(b);
  }

  function gte(a, b) {
    return _toNum(a) >= _toNum(b);
  }

  function lt(a, b) {
    return _toNum(a) < _toNum(b);
  }

  function eq(a, b) {
    return _toNum(a) === _toNum(b);
  }

  function isValid(val) {
    if (val == null) return false;
    const n = _toNum(val);
    return !isNaN(n) && isFinite(n);
  }

  function isPositive(val) {
    return _toNum(val) > 0;
  }

  function isZero(val) {
    return _toNum(val) === 0;
  }

  function fromNumber(n) {
    if (n == null || isNaN(n) || !isFinite(n)) return '0';
    return String(n);
  }

  function toNumber(s) {
    return _toNum(s);
  }

  function parseInt_(s) {
    const n = globalThis.parseInt(s, 10);
    if (isNaN(n)) return '0';
    return String(n);
  }

  return {
    add, sub, mul, div, round, inv,
    gt, gte, lt, eq,
    isValid, isPositive, isZero,
    fromNumber, toNumber, parseInt: parseInt_,
  };
})();

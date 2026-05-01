const MathOps = (() => {
  // Configure BigNumber: 8 decimal places, round half up
  BigNumber.config({ DECIMAL_PLACES: 8, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });

  function _bn(v) { return new BigNumber(v); }

  function add(a, b)      { return _bn(a).plus(b).toString(); }
  function sub(a, b)      { return _bn(a).minus(b).toString(); }
  function mul(a, b)      { return _bn(a).times(b).toString(); }
  function div(a, b)      { return _bn(b).isZero() ? '0' : _bn(a).div(b).toString(); }
  function round(val, dp) { return _bn(val).dp(dp).toString(); }
  function inv(val)       { const n = _bn(val); return n.isZero() ? '0' : _bn(1).div(n).toString(); }
  function gt(a, b)       { return _bn(a).gt(b); }
  function gte(a, b)      { return _bn(a).gte(b); }
  function lt(a, b)       { return _bn(a).lt(b); }
  function eq(a, b)       { return _bn(a).eq(b); }
  function isValid(val)   { const n = _bn(val); return !n.isNaN() && n.isFinite(); }
  function isPositive(val) { const n = _bn(val); return n.isPositive() && !n.isZero(); }
  function isZero(val)    { return _bn(val).isZero(); }
  function fromNumber(n)  { if (n == null || isNaN(n) || !isFinite(n)) return '0'; return _bn(n).toString(); }
  function toNumber(s)    { return _bn(s).toNumber(); }
  function parseInt_(s)   { const n = _bn(s).integerValue(); return n.isNaN() ? '0' : n.toString(); }
  function parseNumber(s) { const n = _bn(s); return n.isNaN() || !n.isFinite() ? '0' : n.toString(); }

  return {
    add, sub, mul, div, round, inv,
    gt, gte, lt, eq,
    isValid, isPositive, isZero,
    fromNumber, toNumber, parseInt: parseInt_, parseNumber,
  };
})();

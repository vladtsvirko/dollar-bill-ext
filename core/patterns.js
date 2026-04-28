const Patterns = (() => {
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function identifierToRegexBody(id) {
    const parts = id.trim().split(/\s+/);
    return parts.map(p => {
      let escaped = escapeRegex(p);
      escaped = escaped.replace(/\\\./g, '\\.?'); // optional dots
      return escaped;
    }).join('\\s+');
  }

  const CURRENCY_SYMBOLS = '$€₽¥₩£₱฿₫₹₴₺₼₸₭₮₾₵₡₲₦₪؋៛ƒ';

  function buildPatternsFromIdentifiers(identifiers) {
    const patterns = [];
    for (const id of identifiers) {
      if (!id.trim()) continue;
      const regexBody = identifierToRegexBody(id);
      const notAfterLetterOrCur = `(?<![\\p{L}${CURRENCY_SYMBOLS}])`;
      const notBeforeLetter = `(?![\\p{L}])`;
      const amount = `(?<![.,\\d])(\\d[\\d\\s]*(?:[.,]\\d{1,4})?)`;
      const body = `(?:${regexBody})`;
      patterns.push(`${amount}\\s*${notAfterLetterOrCur}${body}${notBeforeLetter}`);
      patterns.push(`${notAfterLetterOrCur}${body}\\s*${amount}${notBeforeLetter}`);
    }
    return patterns;
  }

  function buildIdentifierOwnerMap(currencies) {
    const map = {};
    for (const [code, cur] of Object.entries(currencies || {})) {
      for (const id of (cur.identifiers || [])) {
        const norm = id.trim().toLowerCase();
        if (!map[norm]) map[norm] = [];
        if (!map[norm].some(e => e.code === code)) {
          map[norm].push({ code, originalId: id });
        }
      }
    }
    return map;
  }

  function detectIdentifierConflicts(currencies) {
    const ownerMap = buildIdentifierOwnerMap(currencies);
    const conflicts = [];
    for (const [id, entries] of Object.entries(ownerMap)) {
      if (entries.length > 1) {
        conflicts.push({ identifier: id, currencies: entries.map(e => e.code) });
      }
    }
    return conflicts;
  }

  return {
    CURRENCY_SYMBOLS,
    escapeRegex,
    identifierToRegexBody,
    buildPatternsFromIdentifiers,
    buildIdentifierOwnerMap,
    detectIdentifierConflicts,
  };
})();

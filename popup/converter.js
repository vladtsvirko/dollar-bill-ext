const PopupConverter = (() => {
  function populateSelects({ converterFrom, converterTo, settings }) {
    const currencies = settings.currencies || {};
    const allCodes = Object.keys(currencies);
    if (allCodes.length === 0) return;

    const prevFrom = converterFrom.value;
    const prevTo = converterTo.value;

    const makeOptions = (selected) => {
      return allCodes.map(code =>
        `<option value="${code}"${code === selected ? ' selected' : ''}>${code}</option>`
      ).join('');
    };

    const firstPair = settings.conversionPairs && settings.conversionPairs[0];
    const defaultFrom = firstPair ? firstPair.from : allCodes[0];
    const defaultTo = firstPair ? firstPair.to : allCodes[allCodes.length > 1 ? 1 : 0];

    converterFrom.innerHTML = makeOptions(allCodes.includes(prevFrom) ? prevFrom : defaultFrom);
    converterTo.innerHTML = makeOptions(allCodes.includes(prevTo) ? prevTo : defaultTo);
  }

  function render({ converterFrom, converterTo, converterInput, converterResult, cachedRates, settings, getEffectiveRates }) {
    const value = converterInput.value.trim();
    if (!value || isNaN(value) || !settings) {
      converterResult.innerHTML = '';
      return;
    }

    const amount = parseFloat(value);
    if (isNaN(amount) || amount === 0) {
      converterResult.innerHTML = '';
      return;
    }

    const from = converterFrom.value;
    const to = converterTo.value;
    if (!from || !to || from === to) {
      converterResult.innerHTML = '';
      return;
    }

    const rates = getEffectiveRates(settings, cachedRates);
    const converted = RateTables.convert(amount, from, to, rates);
    if (converted === null) {
      converterResult.innerHTML = '';
      return;
    }

    const toInfo = (settings.currencies || {})[to] || {};
    const symbol = toInfo.symbol || to;
    const nf = settings.numberFormat;

    converterResult.innerHTML = `
      <div class="converter-result-line">
        <span class="converter-result-symbol">${from} \u2192 ${to}</span>
        <span class="converter-result-value">${symbol}${FormatUtils.formatNumber(converted, 2, nf)}</span>
      </div>
    `;
  }

  return { populateSelects, render };
})();

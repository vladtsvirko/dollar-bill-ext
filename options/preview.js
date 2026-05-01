const Preview = (() => {
  let _cachedRates = null;

  RateFetch.getCachedRates().then(r => { _cachedRates = r; });

  function render(previewContentEl, settings) {
    if (!previewContentEl || !settings) return;

    const pairs = settings.conversionPairs || [];
    const currencies = settings.currencies;

    if (pairs.length === 0) {
      previewContentEl.innerHTML = '<span style="color:var(--text-tertiary)">' + I18n.t('options.addConversionPairsPreview') + '</span>';
      return;
    }

    const sourceMap = RatesUtil.buildConversionMap(settings);
    const sources = Object.keys(sourceMap).slice(0, 2);
    const examples = [];
    const nf = settings ? settings.numberFormat : null;
    const effectiveRates = _cachedRates ? RateTables.getEffectiveRates(settings, _cachedRates) : null;

    for (const srcCode of sources) {
      const amount = 12345;
      let html = `<span class="preview-price">${amount} ${srcCode}</span>`;

      for (const tc of sourceMap[srcCode]) {
        const tcCur = currencies[tc] || {};
        const tcSymbol = tcCur.symbol || tc;
        let converted;
        if (effectiveRates) {
          converted = RateTables.convert(amount, srcCode, tc, effectiveRates, settings.rateSourceSelections);
        }
        if (converted == null) {
          converted = amount * 1.37;
        }
        html += ` <span class="db-pill">${amount} ${srcCode} = ${tcSymbol}${NumberFormatter.formatNumber(converted, 2, nf)}</span>`;
      }
      examples.push(html);
    }

    previewContentEl.innerHTML = examples.join('<br>');
  }

  return { render };
})();

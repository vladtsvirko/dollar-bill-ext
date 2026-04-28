const Preview = (() => {
  function render(previewContentEl, settings) {
    if (!previewContentEl || !settings) return;

    const pairs = settings.conversionPairs || [];
    const currencies = settings.currencies;

    if (pairs.length === 0) {
      previewContentEl.innerHTML = '<span style="color:var(--text-tertiary)">Add conversion pairs to see a preview.</span>';
      return;
    }

    const sourceMap = RatesUtil.buildConversionMap(settings);
    const sources = Object.keys(sourceMap).slice(0, 2);
    const examples = [];
    const nf = settings ? settings.numberFormat : null;

    for (const srcCode of sources) {
      const amount = 100;
      let html = `<span class="preview-price">${amount} ${srcCode}</span>`;

      for (const tc of sourceMap[srcCode]) {
        const tcCur = currencies[tc] || {};
        const tcSymbol = tcCur.symbol || tc;
        const converted = amount * (1 + Math.random() * 0.5);
        html += ` <span class="db-pill">${tcSymbol}${FormatUtils.formatNumber(converted, 2, nf)}</span>`;
      }
      examples.push(html);
    }

    previewContentEl.innerHTML = examples.join('<br>');
  }

  return { render };
})();

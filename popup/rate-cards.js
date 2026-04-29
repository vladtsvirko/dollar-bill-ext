const RateCards = (() => {
  const RESET_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';

  let effectiveRatesCache = null;
  let effectiveRatesInput = null;

  function getEffectiveRates(settings, cachedRates) {
    const key = cachedRates && cachedRates.timestamp;
    if (effectiveRatesCache && effectiveRatesInput === key) return effectiveRatesCache;
    effectiveRatesCache = RatesUtil.getEffectiveRates(settings, cachedRates);
    effectiveRatesInput = key;
    return effectiveRatesCache;
  }

  function invalidateCache() {
    effectiveRatesCache = null;
    effectiveRatesInput = null;
  }

  function render({ rateCardsEl, rateSearchEl, cachedRates, settings, currentConflicts, isRefreshing, onCustomRateChange, onCustomRateReset, onSourcePickerClick }) {
    const rates = getEffectiveRates(settings, cachedRates);
    const pairs = settings.conversionPairs || [];
    const currencies = settings.currencies || {};

    if (pairs.length === 0) {
      rateCardsEl.innerHTML = '<div class="rate-card-skeleton">' + I18n.t('popup.noRatesAvailable') + '</div>';
      return;
    }

    const cards = [];
    const seen = new Set();
    for (const pair of pairs) {
      const pairKey = [pair.from, pair.to].sort().join(':');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const rateInfo = RatesUtil.formatRateForDisplay(pair.from, pair.to, rates);

      if (!rateInfo) {
        const loadingClass = isRefreshing ? ' rate-card-loading' : ' rate-card-no-rate';
        const placeholder = isRefreshing ? I18n.t('popup.loadingEllipsis') : I18n.t('popup.rate');
        const disabled = isRefreshing ? ' disabled' : '';
        const symbol = (currencies[pair.from] || {}).symbol || pair.from;
        cards.push(`
        <div class="rate-card${loadingClass}" data-pair="${pair.from}:${pair.to}" data-search="${pair.from.toLowerCase()} ${pair.to.toLowerCase()} ${FormatUtils.escapeHtml(symbol).toLowerCase()}">
          <div class="rate-card-left">
            <div class="rate-card-flag">${FormatUtils.escapeHtml((currencies[pair.from] || {}).symbol || pair.from)}</div>
            <div class="rate-card-label">1 <code>${pair.from}</code> =</div>
          </div>
          <div class="rate-card-right">
            <div class="rate-input-group">
              <input class="rate-card-value-input" type="text"
                value="" placeholder="${placeholder}"
                data-base="${pair.from}" data-quote="${pair.to}"${disabled}>
              <span class="rate-input-code">${pair.to}</span>
            </div>
          </div>
        </div>
      `);
        continue;
      }
      const baseCur = currencies[rateInfo.base] || {};
      const baseSymbol = baseCur.symbol || rateInfo.base;

      const customPairKey = `${rateInfo.base}:${rateInfo.quote}`;
      const reversePairKey = `${rateInfo.quote}:${rateInfo.base}`;
      const hasOverride = settings.customRates && (
        settings.customRates[customPairKey] != null ||
        settings.customRates[reversePairKey] != null
      );

      const conflictData = currentConflicts[customPairKey] || currentConflicts[reversePairKey];
      const isConflict = !!conflictData;

      let sourceTag = '';
      if (isConflict) {
        const activeSource = RatesUtil.getActiveSourceForPair(customPairKey, reversePairKey, settings, cachedRates);
        sourceTag = `<span class="rate-source-picker" data-pair="${customPairKey}" title="${FormatUtils.escapeHtml(RateSources.getSourceDisplayName(activeSource))}">${FormatUtils.escapeHtml(activeSource.toUpperCase())}</span>`;
      }

      cards.push(`
        <div class="rate-card${hasOverride ? ' rate-card-custom' : ''}${isConflict && !hasOverride ? ' rate-card-conflict' : ''}" data-pair="${customPairKey}" data-search="${rateInfo.base.toLowerCase()} ${rateInfo.quote.toLowerCase()} ${FormatUtils.escapeHtml(baseSymbol).toLowerCase()}">
          <div class="rate-card-left">
            <div class="rate-card-flag">${FormatUtils.escapeHtml(baseSymbol)}</div>
            <div class="rate-card-label">1 <code>${rateInfo.base}</code> =</div>
          </div>
          <div class="rate-card-right">
            <div class="rate-input-group">
              <input class="rate-card-value-input" type="text"
                value="${rateInfo.rate.toFixed(4)}"
                data-base="${rateInfo.base}" data-quote="${rateInfo.quote}">
              <span class="rate-input-code">${rateInfo.quote}</span>
            </div>
            ${hasOverride ? `<button class="rate-card-reset" title="${I18n.t('options.resetToFetchedRate')}" data-base="${rateInfo.base}" data-quote="${rateInfo.quote}">${RESET_SVG}</button>` : ''}
          </div>
          ${sourceTag}
        </div>
      `);
    }

    const savedScroll = rateCardsEl.scrollTop;
    rateCardsEl.innerHTML = cards.length
      ? cards.join('')
      : '<div class="rate-card-skeleton">' + I18n.t('popup.noRatesAvailable') + '</div>';
    rateCardsEl.scrollTop = savedScroll;

    rateCardsEl.querySelectorAll('.rate-card-value-input').forEach(input => {
      input.addEventListener('change', onCustomRateChange);
    });

    rateCardsEl.querySelectorAll('.rate-card-reset').forEach(btn => {
      btn.addEventListener('click', onCustomRateReset);
    });

    rateCardsEl.querySelectorAll('.rate-source-picker').forEach(el => {
      el.addEventListener('click', onSourcePickerClick);
    });

    filterRateCards(rateSearchEl, rateCardsEl);
  }

  function filterRateCards(rateSearchEl, rateCardsEl) {
    const q = rateSearchEl.value.toLowerCase().trim();
    rateCardsEl.querySelectorAll('.rate-card').forEach(card => {
      card.style.display = (!q || (card.dataset.search || '').includes(q)) ? '' : 'none';
    });
  }

  return { render, filterRateCards, getEffectiveRates, invalidateCache, RESET_SVG };
})();

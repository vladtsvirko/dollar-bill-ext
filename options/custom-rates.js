const CustomRates = (() => {
  function renderGrid({ grid, settings, rates, onScheduleSave, onSourcePickerClick }) {
    const pairs = settings.conversionPairs || [];

    if (pairs.length === 0) {
      grid.innerHTML = '<p class="hint" style="padding:10px 12px;">' + I18n.t('options.addPairsFirst') + '</p>';
      return;
    }

    const normalizedRates = RatesUtil.getCustomRates(settings);
    const effectiveRates = rates ? RatesUtil.getEffectiveRates(settings, rates) : normalizedRates;
    const selections = settings.rateSourceSelections || [];
    const conflicts = RatesUtil.getConflicts(effectiveRates);

    const seen = new Set();
    let html = '';
    for (const pair of pairs) {
      const pairKey = [pair.from, pair.to].sort().join(':');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const rateInfo = RatesUtil.formatRateForDisplay(pair.from, pair.to, effectiveRates);
      const displayFrom = rateInfo ? rateInfo.base : pair.from;
      const displayTo = rateInfo ? rateInfo.quote : pair.to;
      const displayAmount = rateInfo && rateInfo.amount ? rateInfo.amount : 1;
      const val = rateInfo ? rateInfo.rate : '';

      const inputKey = `${displayFrom}:${displayTo}`;
      const reverseInputKey = `${displayTo}:${displayFrom}`;

      // Look up stored custom rate for amount
      const storedCustom = settings.customRates || {};
      const customEntry = storedCustom[inputKey] || storedCustom[reverseInputKey];
      const customAmount = (customEntry && typeof customEntry === 'object' && customEntry.amount) || displayAmount;

      const conflictData = conflicts[inputKey] || conflicts[reverseInputKey];
      const conflictHtml = conflictData
        ? `<span class="rate-source-picker" data-pair="${inputKey}" title="${FormatUtils.escapeHtml(I18n.t('options.clickToChangeSource'))}">${FormatUtils.escapeHtml(RateSources.getSourceDisplayName(RatesUtil.getActiveSourceForPair(inputKey, reverseInputKey, settings, rates)))}</span>`
        : '';

      const searchData = [displayFrom, displayTo, inputKey].join(' ').toLowerCase();

      html += `<div class="custom-rate-row" data-search="${searchData}">
        <span class="custom-rate-pair">
          <input type="number" step="1" min="1" class="custom-rate-amount-input" data-pair="${inputKey}" value="${customAmount}">
          <span>${FormatUtils.escapeHtml(displayFrom)}</span>
        </span>
        <span class="custom-rate-equals">=</span>
        ${conflictHtml}
        <input type="number" step="0.0001" class="custom-rate-input" data-pair="${inputKey}" value="${val}" placeholder="${I18n.t('options.ratePlaceholder')}">
        <span class="custom-rate-target">${FormatUtils.escapeHtml(displayTo)}</span>
      </div>`;
    }
    grid.innerHTML = html;

    grid.querySelectorAll('input[data-pair]').forEach((input) => {
      input.addEventListener('input', onScheduleSave);
    });

    grid.querySelectorAll('.rate-source-picker').forEach(el => {
      el.addEventListener('click', onSourcePickerClick);
    });
  }

  return { renderGrid };
})();

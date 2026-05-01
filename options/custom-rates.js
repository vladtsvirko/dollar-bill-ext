const CustomRates = (() => {
  function renderGrid({ grid, settings, onScheduleSave, onDelete }) {
    const customRates = settings.customRates || {};
    const entries = Object.entries(customRates);

    if (entries.length === 0) {
      grid.innerHTML = '<p class="hint" style="padding:10px 12px;">' + I18n.t('options.manualRateEmpty') + '</p>';
      return;
    }

    let html = '';
    for (const [pairKey, entry] of entries) {
      const [from, to] = pairKey.split(':');
      const amount = (entry && typeof entry === 'object' && entry.amount) || 1;
      const val = (entry && typeof entry === 'object' && entry.rate) ? entry.rate : '';

      const searchData = [from, to, pairKey].join(' ').toLowerCase();

      html += `<div class="custom-rate-row" data-search="${searchData}">
        <span class="custom-rate-pair">
          <input type="number" step="1" min="1" class="custom-rate-amount-input" data-pair="${FormatUtils.escapeHtml(pairKey)}" value="${amount}">
          <span>${FormatUtils.escapeHtml(from)}</span>
        </span>
        <span class="custom-rate-equals">=</span>
        <input type="number" step="0.0001" class="custom-rate-input" data-pair="${FormatUtils.escapeHtml(pairKey)}" value="${val}" placeholder="${I18n.t('options.ratePlaceholder')}">
        <span class="custom-rate-target">${FormatUtils.escapeHtml(to)}</span>
        <button class="custom-rate-delete" data-pair="${FormatUtils.escapeHtml(pairKey)}" title="${FormatUtils.escapeHtml(I18n.t('options.deleteManualRate'))}">&times;</button>
      </div>`;
    }
    grid.innerHTML = html;

    grid.querySelectorAll('input[data-pair]').forEach((input) => {
      input.addEventListener('input', onScheduleSave);
    });

    if (onDelete) {
      grid.querySelectorAll('.custom-rate-delete').forEach(btn => {
        btn.addEventListener('click', () => onDelete(btn.dataset.pair));
      });
    }
  }

  return { renderGrid };
})();

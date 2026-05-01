const SourcePicker = (() => {
  function createDropdown({ el, customPairKey, conflictData, activeSource, settings, onSelected, appendTo }) {
    UICommon.closeAllSourcePickerDropdowns();

    const nf = settings ? settings.numberFormat : null;
    const sourceIds = Object.keys(conflictData);

    const dropdown = document.createElement('div');
    dropdown.className = 'rate-source-picker-dropdown open';
    dropdown.innerHTML = `
      <div class="rate-source-picker-list">
        ${sourceIds.map(id => {
          const isActive = id === activeSource;
          const entry = conflictData[id];
          let rateStr = '';
          if (entry && typeof entry === 'object' && entry.rate !== undefined) {
            rateStr = `${entry.amount || 1} ${customPairKey.split(':')[0]} = ${NumberFormatter.formatNumber(entry.rate, 4, nf)} ${customPairKey.split(':')[1]}`;
            if (entry.type) rateStr += ` (${entry.type})`;
          } else if (typeof entry === 'number') {
            rateStr = NumberFormatter.formatNumber(entry, 4, nf);
          }
          return `<div class="rate-source-picker-item${isActive ? ' active' : ''}" data-source-id="${id}" data-label="${FormatUtils.escapeHtml(RateSources.getSourceDisplayName(id).toLowerCase())}">
            <span class="rate-source-picker-item-check"></span>
            <span class="rate-source-picker-item-label">${FormatUtils.escapeHtml(RateSources.getSourceDisplayName(id))}</span>
            <span class="rate-source-picker-item-rate">${FormatUtils.escapeHtml(rateStr)}</span>
          </div>`;
        }).join('')}
      </div>
    `;

    el.classList.add('active');

    const container = appendTo || document.body;
    container.appendChild(dropdown);

    // Position below the picker element, right-aligned
    const rect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    dropdown.style.left = 'auto';
    dropdown.style.right = (containerRect.right - rect.right) + 'px';
    dropdown.style.top = (rect.bottom - containerRect.top + 4) + 'px';

    const listEl = dropdown.querySelector('.rate-source-picker-list');

    const closeHandler = (ev) => {
      if (!dropdown.contains(ev.target) && ev.target !== el) {
        UICommon.closeAllSourcePickerDropdowns();
      }
    };
    UICommon.setSourcePickerCloseHandler(closeHandler);

    listEl.addEventListener('click', async (ev) => {
      const item = ev.target.closest('.rate-source-picker-item');
      if (!item) return;
      const sourceId = item.dataset.sourceId;
      if (onSelected) await onSelected(sourceId);
      UICommon.closeAllSourcePickerDropdowns();
    });
  }

  return { createDropdown };
})();

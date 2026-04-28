const SourcePicker = (() => {
  function createDropdown({ el, customPairKey, conflictData, activeSource, settings, rates, onSelected, appendTo }) {
    UICommon.closeAllSourcePickerDropdowns();

    const nf = settings ? settings.numberFormat : null;
    const sourceIds = Object.keys(conflictData);

    const dropdown = document.createElement('div');
    dropdown.className = 'rate-source-picker-dropdown open';
    dropdown.innerHTML = `
      <div class="rate-source-picker-list">
        ${sourceIds.map(id => {
          const isActive = id === activeSource;
          const rate = conflictData[id];
          return `<div class="rate-source-picker-item${isActive ? ' active' : ''}" data-source-id="${id}" data-label="${FormatUtils.escapeHtml(RateSources.getSourceDisplayName(id).toLowerCase())}">
            <span class="rate-source-picker-item-check"></span>
            <span class="rate-source-picker-item-label">${FormatUtils.escapeHtml(RateSources.getSourceDisplayName(id))}</span>
            <span class="rate-source-picker-item-rate">${rate ? FormatUtils.formatNumber(rate, 4, nf) : ''}</span>
          </div>`;
        }).join('')}
      </div>
    `;

    el.classList.add('active');

    const container = appendTo || document.body;
    container.appendChild(dropdown);

    // Position below the picker element
    const rect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    dropdown.style.left = (rect.left - containerRect.left) + 'px';
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

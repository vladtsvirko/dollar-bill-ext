const PairChips = (() => {
  function renderPopupChips(pairs, container, onRemove, onAdd) {
    container.innerHTML = pairs.map((p, i) => `
      <span class="pair-chip">${p.from} <span class="pair-chip-arrow">&rarr;</span> ${p.to}
        <button class="pair-chip-remove" data-index="${i}" title="Remove pair">&times;</button>
      </span>
    `).join('') + '<button class="pair-chip-add" id="addPairPopup" title="Add conversion pair">+</button>';

    container.querySelectorAll('.pair-chip-remove').forEach(btn => {
      btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.index)));
    });

    document.getElementById('addPairPopup').addEventListener('click', onAdd);
  }

  function renderOptionsChips(pairs, container, settings, onRemove) {
    container.innerHTML = pairs.map((p, i) => {
      const fromCur = settings.currencies[p.from];
      const toCur = settings.currencies[p.to];
      const fromLabel = fromCur ? `${p.from} (${fromCur.name})` : p.from;
      const toLabel = toCur ? `${p.to} (${toCur.name})` : p.to;
      return `<span class="chip" draggable="true" data-from="${p.from}" data-to="${p.to}" data-index="${i}">
        ${FormatUtils.escapeHtml(fromLabel)} &rarr; ${FormatUtils.escapeHtml(toLabel)}
        <button class="chip-remove" data-index="${i}" title="Remove">&times;</button>
      </span>`;
    }).join('');

    container.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.index)));
    });
  }

  return { renderPopupChips, renderOptionsChips };
})();

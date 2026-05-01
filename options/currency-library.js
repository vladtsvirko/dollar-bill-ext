const CurrencyLibrary = (() => {
  function render({ container, editor, settings, onScheduleSave }) {
    const currencies = settings.currencies;
    const ownerMap = RatesUtil.buildIdentifierOwnerMap(currencies);
    const idToCodes = {};
    const conflictIdentifiers = new Set();
    for (const [norm, ent] of Object.entries(ownerMap)) {
      idToCodes[norm] = ent.map(e => e.code);
      if (ent.length > 1) {
        conflictIdentifiers.add(norm);
      }
    }

    const conflicts = RatesUtil.detectIdentifierConflicts(currencies);
    const entries = Object.entries(currencies).sort((a, b) => a[0].localeCompare(b[0]));

    const usedCodes = new Set();
    for (const p of (settings.conversionPairs || [])) {
      usedCodes.add(p.from);
      usedCodes.add(p.to);
    }
    const defaultCodes = new Set(Object.keys(RatesUtil.DEFAULT_CURRENCIES));

    const usedEntries = [];
    const customEntries = [];
    const popularEntries = [];
    const remainingEntries = [];

    for (const entry of entries) {
      const code = entry[0];
      if (usedCodes.has(code)) {
        usedEntries.push(entry);
      } else if (!defaultCodes.has(code)) {
        customEntries.push(entry);
      } else if (Currencies.POPULAR_CURRENCIES.includes(code)) {
        popularEntries.push(entry);
      } else {
        remainingEntries.push(entry);
      }
    }

    usedEntries.sort((a, b) => {
      const ai = RatesUtil.POPULAR_CURRENCIES.indexOf(a[0]);
      const bi = RatesUtil.POPULAR_CURRENCIES.indexOf(b[0]);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a[0].localeCompare(b[0]);
    });
    customEntries.sort((a, b) => a[0].localeCompare(b[0]));
    popularEntries.sort((a, b) =>
      RatesUtil.POPULAR_CURRENCIES.indexOf(a[0]) - RatesUtil.POPULAR_CURRENCIES.indexOf(b[0])
    );

    function renderTile(code, cur) {
      const domainStr = (cur.domains || []).join(', ') || '';
      const idChips = (cur.identifiers || []).map(id => {
        const norm = id.trim().toLowerCase();
        const isShared = conflictIdentifiers.has(norm);
        const cls = isShared ? 'identifier-chip identifier-chip-shared' : 'identifier-chip';
        let title;
        if (isShared && idToCodes[norm]) {
          const others = idToCodes[norm].filter(c => c !== code);
          title = I18n.t('options.sharedWith', { codes: others.join(', ') });
        } else {
          title = `100 ${id}`;
        }
        return `<span class="${cls}" title="${FormatUtils.escapeHtml(title)}">${FormatUtils.escapeHtml(id)}</span>`;
      }).join('');
      const hasConflict = (cur.identifiers || []).some(id => conflictIdentifiers.has(id.trim().toLowerCase()));
      const conflictCls = hasConflict ? ' cur-tile-conflict' : '';

      return `
        <div class="cur-tile${conflictCls}" data-code="${code}" data-search="${code.toLowerCase()} ${(cur.name || '').toLowerCase()} ${(cur.symbol || '').toLowerCase()} ${(cur.identifiers || []).join(' ').toLowerCase()}">
          <div class="cur-tile-top">
            <span class="cur-tile-code">${code}</span>
            <span class="cur-tile-symbol">${FormatUtils.escapeHtml(cur.symbol || '')}</span>
            <div class="cur-tile-actions">
              <button class="cur-tile-btn" data-edit="${code}" title="${I18n.t('ui.tooltip.edit')}">&#9998;</button>
              <button class="cur-tile-btn cur-tile-btn-danger" data-delete="${code}" title="${I18n.t('ui.tooltip.delete')}">&times;</button>
            </div>
          </div>
          <div class="cur-tile-name">${FormatUtils.escapeHtml(cur.name || '')}</div>
          ${domainStr ? `<div class="cur-tile-domains">${FormatUtils.escapeHtml(domainStr)}</div>` : ''}
          <div class="cur-tile-detail">
            <div class="cur-tile-ids">${idChips || '<span class="no-identifiers">' + I18n.t('options.noIdentifiers') + '</span>'}</div>
          </div>
        </div>
      `;
    }

    let html = '<div class="cur-lib-search-wrap">';
    html += '<input type="text" class="cur-lib-search" id="curLibSearch" placeholder="' + FormatUtils.escapeHtml(I18n.t('options.searchCurrencies')) + '">';
    html += '</div>';

    if (conflicts.length > 0) {
      const pairCurrencies = new Set();
      for (const p of (settings.conversionPairs || [])) {
        pairCurrencies.add(p.from);
        pairCurrencies.add(p.to);
      }
      const activeConflicts = [];
      const otherConflicts = [];
      for (const c of conflicts) {
        if (c.currencies.some(code => pairCurrencies.has(code))) {
          activeConflicts.push(c);
        } else {
          otherConflicts.push(c);
        }
      }

      const hasAnyConflicts = activeConflicts.length > 0 || otherConflicts.length > 0;
      if (hasAnyConflicts) {
        html += '<div class="conflict-warnings">';
        html += '<h3>' + I18n.t('options.identifierConflicts') + '</h3>';
        for (const c of activeConflicts) {
          const domainInfo = c.currencies.map(code => {
            const cur = currencies[code];
            const domains = (cur.domains || []).join(', ') || I18n.t('options.noDomains');
            return `<strong>${code}</strong> ${I18n.t('options.onDomains')} ${FormatUtils.escapeHtml(domains)}`;
          }).join('; ');
          html += `<div class="conflict-item">
            <span class="conflict-identifier">"${FormatUtils.escapeHtml(c.identifier)}"</span> ${I18n.t('options.isSharedBy')} ${c.currencies.join(', ')}. ${I18n.t('options.resolution')} ${domainInfo}
          </div>`;
        }

        if (otherConflicts.length > 0) {
          html += '<details class="conflict-other-details">';
          html += `<summary class="conflict-other-summary">${I18n.t('options.otherConflictingIdentifiers', { count: otherConflicts.length })}</summary>`;
          for (const c of otherConflicts) {
            const domainInfo = c.currencies.map(code => {
              const cur = currencies[code];
              const domains = (cur.domains || []).join(', ') || I18n.t('options.noDomains');
              return `<strong>${code}</strong> ${I18n.t('options.onDomains')} ${FormatUtils.escapeHtml(domains)}`;
            }).join('; ');
            html += `<div class="conflict-item">
              <span class="conflict-identifier">"${FormatUtils.escapeHtml(c.identifier)}"</span> ${I18n.t('options.isSharedBy')} ${c.currencies.join(', ')}. ${I18n.t('options.resolution')} ${domainInfo}
            </div>`;
          }
          html += '</details>';
        }
        html += '</div>';
      }
    }

    if (conflicts.length > 0) {
      const count = conflictIdentifiers.size;
      html += `<div class="conflict-legend">${I18n.t('options.sharedIdentifiers', { count, suffix: count !== 1 ? 's are' : ' is' })}</div>`;
    }

    html += '<div class="cur-lib-grid-wrap" id="curLibGridWrap">';
    html += '<div class="cur-lib-grid" id="curLibGrid">';

    if (usedEntries.length > 0) {
      html += '<div class="cur-lib-group-label cur-lib-group-used" data-group=" Used">' + I18n.t('options.used') + '</div>';
      html += '<div class="cur-lib-group-tiles">';
      for (const [code, cur] of usedEntries) html += renderTile(code, cur);
      html += '</div>';
    }

    if (customEntries.length > 0) {
      html += '<div class="cur-lib-group-label cur-lib-group-custom" data-group=" Custom">' + I18n.t('options.custom') + '</div>';
      html += '<div class="cur-lib-group-tiles">';
      for (const [code, cur] of customEntries) html += renderTile(code, cur);
      html += '</div>';
    }

    if (popularEntries.length > 0) {
      html += '<div class="cur-lib-group-label" data-group=" Popular">' + I18n.t('options.popular') + '</div>';
      html += '<div class="cur-lib-group-tiles">';
      for (const [code, cur] of popularEntries) html += renderTile(code, cur);
      html += '</div>';
    }

    let currentLetter = '';
    let groupOpen = false;
    for (const [code, cur] of remainingEntries) {
      const letter = code[0];
      if (letter !== currentLetter) {
        if (groupOpen) html += '</div>';
        currentLetter = letter;
        groupOpen = true;
        html += `<div class="cur-lib-group-label" data-group="${letter}">${letter}</div>`;
        html += '<div class="cur-lib-group-tiles">';
      }
      html += renderTile(code, cur);
    }
    if (groupOpen) html += '</div>';

    html += '</div></div>';

    container.innerHTML = html;

    // Search filter
    const searchInput = document.getElementById('curLibSearch');
    const grid = document.getElementById('curLibGrid');
    if (searchInput && grid) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        grid.querySelectorAll('.cur-tile').forEach(tile => {
          const haystack = tile.dataset.search || '';
          tile.style.display = !q || haystack.includes(q) ? '' : 'none';
        });
        grid.querySelectorAll('.cur-lib-group-label').forEach(label => {
          label.style.display = q ? 'none' : '';
        });
      });
    }

    // Tile expand/collapse
    grid.querySelectorAll('.cur-tile').forEach(tile => {
      tile.addEventListener('click', (e) => {
        if (e.target.closest('.cur-tile-btn')) return;
        tile.classList.toggle('cur-tile-expanded');
      });
    });
  }

  return { render };
})();

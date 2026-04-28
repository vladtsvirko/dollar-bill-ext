const CurrencyPicker = (() => {
  function renderList(currencies, selectedCode, filter) {
    return UICommon.renderCurrencyListHTML(currencies, selectedCode, filter);
  }

  function bindPickerEvents({ fromTrigger, fromDropdown, fromSearch, fromList, toTrigger, toDropdown, toSearch, toList, getFrom, getTo, setFrom, setTo, currencies }) {
    function closeDropdowns() {
      fromDropdown.classList.remove('open');
      fromTrigger.classList.remove('active');
      toDropdown.classList.remove('open');
      toTrigger.classList.remove('active');
    }

    fromTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = fromDropdown.classList.contains('open');
      closeDropdowns();
      if (!isOpen) {
        fromDropdown.classList.add('open');
        fromTrigger.classList.add('active');
        fromSearch.value = '';
        fromList.innerHTML = renderList(currencies, getFrom());
        fromSearch.focus();
      }
    });

    toTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = toDropdown.classList.contains('open');
      closeDropdowns();
      if (!isOpen) {
        toDropdown.classList.add('open');
        toTrigger.classList.add('active');
        toSearch.value = '';
        toList.innerHTML = renderList(currencies, getTo());
        toSearch.focus();
      }
    });

    fromSearch.addEventListener('input', () => {
      fromList.innerHTML = renderList(currencies, getFrom(), fromSearch.value);
    });
    toSearch.addEventListener('input', () => {
      toList.innerHTML = renderList(currencies, getTo(), toSearch.value);
    });

    fromList.addEventListener('click', (e) => {
      const item = e.target.closest('.currency-picker-item');
      if (!item || item.classList.contains('empty')) return;
      setFrom(item.dataset.code);
      const textEl = fromTrigger.querySelector('.currency-picker-text');
      textEl.textContent = item.dataset.code;
      textEl.classList.remove('placeholder');
      closeDropdowns();
    });

    toList.addEventListener('click', (e) => {
      const item = e.target.closest('.currency-picker-item');
      if (!item || item.classList.contains('empty')) return;
      setTo(item.dataset.code);
      const textEl = toTrigger.querySelector('.currency-picker-text');
      textEl.textContent = item.dataset.code;
      textEl.classList.remove('placeholder');
      closeDropdowns();
    });

    return { closeDropdowns };
  }

  return { renderList, bindPickerEvents };
})();

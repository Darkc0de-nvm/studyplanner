(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { menu: '.select, .user-menu', radio: 'input[type="radio"]', value: '[data-select-value]', summary: 'summary' };
  const EXPANDED = 'aria-expanded';

  function sync(menu) {
    menu.querySelector(SELECTOR.summary).setAttribute(EXPANDED, String(menu.open));
    const value = menu.querySelector(SELECTOR.value);
    if (!value) return;
    const selected = menu.querySelector(`${SELECTOR.radio}:checked`);
    value.textContent = selected ? selected.labels[0].querySelector('span').textContent : 'Оберіть дисципліну';
  }

  function close(except) {
    document.querySelectorAll(SELECTOR.menu).forEach(menu => {
      if (menu !== except) {
        menu.open = false;
        sync(menu);
      }
    });
  }

  function init() {
    document.querySelectorAll(SELECTOR.menu).forEach(menu => {
      sync(menu);
      menu.addEventListener('toggle', () => {
        if (menu.open) close(menu);
        sync(menu);
      });
      menu.addEventListener('change', event => {
        if (!event.target.matches(SELECTOR.radio)) return;
        menu.open = false;
        sync(menu);
        menu.querySelector(SELECTOR.summary).focus();
      });
      menu.addEventListener('click', event => {
        if (event.target.closest('label') && event.target.closest('label').control?.checked) {
          menu.open = false;
          sync(menu);
        }
      });
    });
    document.addEventListener('click', event => close(event.target.closest(SELECTOR.menu)));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const opened = [...document.querySelectorAll(SELECTOR.menu)].find(menu => menu.open);
      if (!opened) return;
      event.preventDefault();
      close();
      opened.querySelector(SELECTOR.summary).focus();
    });
  }

  app.selects = { init, sync, close };
})();

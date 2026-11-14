(() => {
  'use strict';

  const app = window.StudyPlanner = window.StudyPlanner || {};
  const SELECTOR = { links: '.app-nav a, .bottom-tabs a', reload: '[data-reload]' };
  const CURRENT = 'aria-current';

  function init() {
    const page = location.pathname.split('/').pop();
    document.querySelectorAll(SELECTOR.links).forEach(link => {
      const current = new URL(link.href).pathname.split('/').pop() === page;
      if (current) link.setAttribute(CURRENT, 'page');
      else link.removeAttribute(CURRENT);
    });
    document.querySelectorAll(SELECTOR.reload).forEach(button => button.addEventListener('click', event => { event.preventDefault(); location.reload(); }));
  }

  app.navigation = { init };
})();

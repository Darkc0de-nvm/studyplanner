(() => {
  'use strict';

  const app = window.StudyPlanner;
  const PAGE = { tasks: 'tasks', state: 'task-state' };
  const STATES = ['search', 'no-results', 'first-run', 'filter', 'filter-open', 'done', 'empty-group', 'user-menu', 'details-empty'];
  const OPEN_FILTER_CARD = 'seed-2';
  const SELECTOR = { filter: '.app-filter', userMenu: '.user-menu' };

  function initTasks() {
    const requested = new URLSearchParams(location.search).get('state');
    const state = STATES.includes(requested) ? requested : '';
    app.storage.setPreview(state);
    app.tasks.init();
    app.selects.init();
    app.filters.init(state);
    app.forms.init();
    app.render.init({ compactTitleId: state === 'filter-open' ? OPEN_FILTER_CARD : null });
    app.modals.init(state === 'details-empty' ? app.tasks.all().find(task => !task.description) : null);
    if (state === 'filter-open') document.querySelector(SELECTOR.filter).open = true;
    if (state === 'user-menu') document.querySelector(SELECTOR.userMenu).open = true;
  }

  function init() {
    if (document.body.dataset.page === PAGE.state) {
      location.replace(`tasks.html?state=${encodeURIComponent(document.body.dataset.state)}${location.hash}`);
      return;
    }
    if (document.body.dataset.page === PAGE.tasks) initTasks();
  }

  init();
})();

(() => {
  'use strict';

  const app = window.StudyPlanner;
  const PAGE = { tasks: 'tasks', state: 'task-state', calendar: 'calendar', calendarState: 'calendar-state', authState: 'auth-state', login: 'login', register: 'register' };
  const STATES = ['search', 'no-results', 'first-run', 'filter', 'filter-open', 'done', 'empty-group', 'user-menu', 'details-empty'];
  const CALENDAR_STATES = ['filter', 'filter-open', 'details-empty'];
  const OPEN_FILTER_CARD = 'seed-2';
  const SELECTOR = { filter: '.app-filter', userMenu: '.user-menu' };

  function initPlanner(page) {
    const calendar = page === PAGE.calendar;
    const requested = new URLSearchParams(location.search).get('state');
    const state = (calendar ? CALENDAR_STATES : STATES).includes(requested) ? requested : '';
    app.storage.setPreview(state, calendar ? '2' : '3');
    app.tasks.init();
    app.selects.init();
    app.filters.init(state, calendar ? app.calendar.render : app.render.list);
    app.datepicker.init();
    app.forms.init();
    if (!calendar) app.render.init({ compactTitleId: state === 'filter-open' ? OPEN_FILTER_CARD : null });
    app.modals.init(state === 'details-empty' ? app.tasks.all().find(task => !task.description) : null);
    if (calendar) app.calendar.init();
    app.auth.profile();
    if (state === 'filter-open') document.querySelector(SELECTOR.filter).open = true;
    if (state === 'user-menu') document.querySelector(SELECTOR.userMenu).open = true;
  }

  function init() {
    app.navigation?.init();
    if (document.body.dataset.page === PAGE.state) {
      location.replace(`tasks.html?state=${encodeURIComponent(document.body.dataset.state)}${location.hash}`);
      return;
    }
    if ([PAGE.calendarState, PAGE.authState].includes(document.body.dataset.page)) {
      location.replace(document.querySelector('a').href + location.hash);
      return;
    }
    if ([PAGE.tasks, PAGE.calendar].includes(document.body.dataset.page)) initPlanner(document.body.dataset.page);
    if ([PAGE.login, PAGE.register].includes(document.body.dataset.page)) {
      app.forms.init();
      app.auth.init(new URLSearchParams(location.search).get('state'));
    }
    if (document.body.dataset.page === 'static') app.selects?.init();
  }

  init();
})();

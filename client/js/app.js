(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  const PAGE = {
    tasks: 'tasks',
    state: 'task-state',
    calendar: 'calendar',
    calendarState: 'calendar-state',
    authState: 'auth-state',
    login: 'login',
    register: 'register',
    static: 'static',
  };

  const STATES = ['search', 'no-results', 'first-run', 'filter', 'filter-open', 'done', 'empty-group', 'user-menu', 'details-empty'];
  const CALENDAR_STATES = ['filter', 'filter-open', 'details-empty'];
  const SELECTOR = { filter: '.app-filter', userMenu: '.user-menu' };

  function initNetworkBanner() {
    let banner = document.getElementById('network-offline-banner');
    function updateBanner() {
      const isOffline = !navigator.onLine;
      if (isOffline) {
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'network-offline-banner';
          banner.className = 'alert alert--error';
          banner.setAttribute('role', 'status');
          banner.setAttribute('aria-live', 'polite');
          banner.style.cssText = 'position:sticky;top:0;z-index:9999;margin:0;border-radius:0;text-align:center;padding:0.75rem;';
          banner.textContent = 'Відсутнє підключення до мережі. Перевірте зв’язок.';
          document.body.prepend(banner);
        }
        banner.hidden = false;
      } else if (banner) {
        banner.hidden = true;
      }
    }
    window.addEventListener('online', updateBanner);
    window.addEventListener('offline', updateBanner);
    if (!navigator.onLine) updateBanner();
  }

  async function initPlanner(page) {
    const calendar = page === PAGE.calendar;
    const requested = new URLSearchParams(location.search).get('state');

    // Every planner page is protected, including visual QA previews: the
    // demo data now comes from the seeded server account, not localStorage.
    let user = null;
    if (app.auth && typeof app.auth.requireAuth === 'function') {
      try {
        user = await app.auth.requireAuth();
      } catch (err) {
        // Offline/timeout: render the shell with empty data and the network
        // banner instead of redirecting to the login page.
        if (!(err && (err.isOffline || err.status === 0))) return;
      }
    }

    const state = (calendar ? CALENDAR_STATES : STATES).includes(requested) ? requested : '';
    if (app.storage) app.storage.setPreview(state, calendar ? '2' : '3');
    if (app.selects) app.selects.init();
    if (app.filters) app.filters.init(state, calendar ? app.calendar.render : app.render.list);
    if (app.datepicker) app.datepicker.init();
    if (app.forms) app.forms.init();
    if (app.tasks) await app.tasks.init();

    // Preview states select a discipline by its Lab 4 position; real API ids
    // are UUIDs, so the position is resolved after disciplines are loaded.
    if (state === 'filter' && app.filters && typeof app.filters.setDiscipline === 'function') {
      const list = app.tasks.getDisciplinesList();
      const discipline = list[calendar ? 1 : 2];
      if (discipline) app.filters.setDiscipline(String(discipline.id));
    }

    if (!calendar && app.render) {
      let compactTitleId = null;
      if (state === 'filter-open') {
        const compactCard = app.tasks.all().find(task =>
          task.title.startsWith('Додати інтерактивні елементи')
        );
        compactTitleId = compactCard ? compactCard.id : null;
      }
      app.render.init({ compactTitleId });
    }
    if (app.modals) app.modals.init(state === 'details-empty' ? app.tasks.all().find(task => !task.description) : null);
    if (calendar && app.calendar) app.calendar.init();
    if (user && app.auth) app.auth.profile(user);

    if (state === 'filter-open') {
      const filter = document.querySelector(SELECTOR.filter);
      if (filter) filter.open = true;
    }
    if (state === 'user-menu') {
      const userMenu = document.querySelector(SELECTOR.userMenu);
      if (userMenu) userMenu.open = true;
    }
  }

  function init() {
    initNetworkBanner();
    app.navigation?.init();

    if (document.body.dataset.page === PAGE.state) {
      location.replace(`tasks.html?state=${encodeURIComponent(document.body.dataset.state)}${location.hash}`);
      return;
    }
    if ([PAGE.calendarState, PAGE.authState].includes(document.body.dataset.page)) {
      location.replace(document.querySelector('a').href + location.hash);
      return;
    }
    if ([PAGE.tasks, PAGE.calendar].includes(document.body.dataset.page)) {
      initPlanner(document.body.dataset.page);
    }
    if ([PAGE.login, PAGE.register].includes(document.body.dataset.page)) {
      app.forms.init();
      app.auth.init(new URLSearchParams(location.search).get('state'));
    }
    if (document.body.dataset.page === PAGE.static) {
      app.selects?.init();
      app.account?.init();
    }
    const deletedAlert = document.getElementById('deleted-alert');
    if (deletedAlert && new URLSearchParams(location.search).get('deleted') === '1') {
      deletedAlert.hidden = false;
    }
  }

  init();
})();

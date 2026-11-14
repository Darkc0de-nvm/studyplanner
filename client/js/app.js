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
    account: 'account',
    static: 'static',
  };

  const STATES = ['search', 'no-results', 'first-run', 'filter', 'filter-open', 'done', 'empty-group', 'user-menu', 'details-empty'];
  const CALENDAR_STATES = ['filter', 'filter-open', 'details-empty'];
  const SELECTOR = { filter: '.app-filter', userMenu: '.user-menu' };

  function ensureWifiSymbol() {
    if (document.getElementById('icon-wifi')) return;
    const sprite = document.querySelector('.icon-sprite');
    if (!sprite) return;

    const svgNamespace = 'http://www.w3.org/2000/svg';
    const symbol = document.createElementNS(svgNamespace, 'symbol');
    symbol.id = 'icon-wifi';
    symbol.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(svgNamespace, 'path');
    path.setAttribute('d', 'm2 2 20 20M8.5 16.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 5-2M2 8a16 16 0 0 1 4-2m4-1a16 16 0 0 1 12 3m-8 2a10 10 0 0 1 5 2M12 20h.01');
    symbol.append(path);
    sprite.append(symbol);
  }

  function renderOfflineNotice(container) {
    ensureWifiSymbol();
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(svgNamespace, 'svg');
    icon.classList.add('icon', 'network-banner__icon');
    icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svgNamespace, 'use');
    use.setAttribute('href', '#icon-wifi');
    icon.append(use);

    const content = document.createElement('div');
    content.className = 'network-banner__content';
    const title = document.createElement('strong');
    title.className = 'network-banner__title';
    title.textContent = 'Немає з’єднання';
    const message = document.createElement('span');
    message.className = 'network-banner__message';
    message.textContent = 'Перевірте доступність інтернету.';
    content.append(title, message);
    container.replaceChildren(icon, content);
  }

  app.renderOfflineNotice = renderOfflineNotice;

  function initNetworkBanner() {
    let banner = document.getElementById('network-offline-banner');
    function updateBanner() {
      const isOffline = !navigator.onLine;
      if (isOffline) {
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'network-offline-banner';
          banner.className = 'alert network-banner';
          banner.setAttribute('role', 'status');
          banner.setAttribute('aria-live', 'polite');
          renderOfflineNotice(banner);
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

  function initPageTransitions() {
    const body = document.body;
    const storageKey = 'studyplanner-page-transition';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let shouldEnter = false;
    try {
      shouldEnter = sessionStorage.getItem(storageKey) === '1';
      sessionStorage.removeItem(storageKey);
    } catch {
      // Page transitions remain optional when storage is unavailable.
    }

    let pendingEnter = shouldEnter && !reducedMotion;
    function enterPage() {
      if (!pendingEnter) return;
      pendingEnter = false;
      body.classList.add('page-entering');
      body.addEventListener('animationend', event => {
        if (event.target === body && event.animationName === 'page-enter') {
          body.classList.remove('page-entering');
        }
      });
    }

    document.addEventListener('click', event => {
      if (event.defaultPrevented || reducedMotion || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;

      let destination;
      try {
        destination = new URL(link.href, location.href);
      } catch {
        return;
      }
      if (destination.origin !== location.origin || (destination.pathname === location.pathname && destination.search === location.search)) return;
      if (body.classList.contains('page-leaving')) return;

      event.preventDefault();
      body.classList.add('page-leaving');
      try {
        sessionStorage.setItem(storageKey, '1');
      } catch {
        // The outgoing animation still works when storage is unavailable.
      }
      let navigated = false;
      let fallback;
      const finishOnLeave = event => {
        if (event.target === body && event.animationName === 'page-leave') navigate();
      };
      const navigate = () => {
        if (navigated) return;
        navigated = true;
        window.clearTimeout(fallback);
        body.removeEventListener('animationend', finishOnLeave);
        location.assign(destination.href);
      };
      body.addEventListener('animationend', finishOnLeave);
      const duration = getComputedStyle(body).animationDuration
        .split(',')[0]
        .trim()
        .replace('ms', '');
      const durationMs = duration.endsWith('s') ? parseFloat(duration) * 1000 : parseFloat(duration);
      fallback = window.setTimeout(navigate, Number.isFinite(durationMs) ? durationMs + 80 : 400);
    });

    return enterPage;
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
    const enterPage = initPageTransitions();
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
      enterPage();
      initPlanner(document.body.dataset.page);
    }
    if ([PAGE.login, PAGE.register].includes(document.body.dataset.page)) {
      app.forms.init();
      app.auth.init(new URLSearchParams(location.search).get('state'));
    }
    if (document.body.dataset.page === PAGE.account) {
      enterPage();
      const showAccount = () => {
        app.account?.init();
        const accountPage = document.getElementById('main');
        if (accountPage) accountPage.hidden = false;
      };
      app.auth.requireAuth()
        .then(showAccount)
        .catch(err => {
          // Offline/timeout: render the shell with the network banner instead
          // of leaving the page empty, mirroring initPlanner.
          if (err && (err.isOffline || err.status === 0)) showAccount();
        });
    }
    if (document.body.dataset.page === PAGE.static) {
      app.selects?.init();
      const authHome = document.querySelector('[data-auth-home]');
      authHome?.addEventListener('click', async event => {
        event.preventDefault();
        try {
          await app.api.auth.me();
          location.assign('tasks.html');
        } catch {
          location.assign('index.html');
        }
      });
    }
    const deletedAlert = document.getElementById('deleted-alert');
    if (deletedAlert && new URLSearchParams(location.search).get('deleted') === '1') {
      deletedAlert.hidden = false;
    }
    if (![PAGE.tasks, PAGE.calendar, PAGE.account].includes(document.body.dataset.page)) enterPage();
  }

  init();
})();

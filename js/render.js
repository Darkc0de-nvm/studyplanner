(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { list: '.task-groups', card: '.task-card', title: '.task-card__title a', tag: '.task-card__discipline', meta: '.task-card__meta > span', description: '[data-description]', check: '.task-card__check', action: '[data-action]', groupTitle: '.group-header__title', count: '.group-count', cards: '.task-group__cards', results: '.filter-count', reset: '.filter-reset', add: '.app-add', searchCount: '[data-search-count]', slot: '.task-slot', inner: '.task-slot__inner', group: '.task-group', status: '[data-storage-status]', modal: '.modal', heading: 'h2' };
  const CLASS = { state: 'task-card--', stacked: 'task-card--stacked', hidden: 'visually-hidden', results: 'filter-count--visible', countOverdue: 'group-count--overdue', countSoon: 'group-count--soon', collapsing: 'task-slot--collapsing' };
  const GROUPS = { overdue: 'Прострочені', today: 'Сьогодні', week: 'Цей тиждень', later: 'Пізніше' };
  const TEMPLATE = { card: 'task-card-template', group: 'task-group-template', first: 'first-run-template', noResults: 'no-results-template', empty: 'empty-group-template', mark: 'search-mark-template', slot: 'task-slot-template' };
  let compactTitleId = null;
  const pending = new Set();
  const timers = new Map();
  const nodes = new Map();
  const groups = new Map();
  const MOTION = '(prefers-reduced-motion: reduce)';
  const TOKEN = { delay: '--delay-complete', reduced: '--delay-complete-reduced', collapse: '--duration-collapse' };

  function duration(token) {
    return parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue(token));
  }

  function refresh() {
    if (document.querySelector(SELECTOR.list)) list();
    else app.calendar.render();
  }

  function cancel(id) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    pending.delete(id);
    nodes.get(id)?.classList.remove(CLASS.collapsing);
  }

  function cancelPending() {
    [...pending].forEach(cancel);
  }

  function moveFocus(slot) {
    if (!slot.contains(document.activeElement)) return;
    const container = slot.parentElement;
    const siblings = [...container.querySelectorAll(SELECTOR.slot)];
    const index = siblings.indexOf(slot);
    const next = siblings.slice(index + 1).find(item => !item.classList.contains(CLASS.collapsing));
    const previous = siblings.slice(0, index).reverse().find(item => !item.classList.contains(CLASS.collapsing));
    const heading = container.closest(SELECTOR.group)?.querySelector(SELECTOR.groupTitle) || container.closest(SELECTOR.modal)?.querySelector(SELECTOR.heading);
    const target = (next || previous)?.querySelector(SELECTOR.check) || heading;
    if (target) {
      if (target === heading) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }

  function finish(id) {
    const slot = nodes.get(id);
    if (slot) moveFocus(slot);
    cancel(id);
    refresh();
  }

  function complete(id) {
    if (pending.has(id) || app.filters.current().showDone) return;
    pending.add(id);
    const reduced = window.matchMedia(MOTION).matches;
    timers.set(id, setTimeout(() => {
      if (reduced) finish(id);
      else {
        nodes.get(id)?.classList.add(CLASS.collapsing);
        timers.set(id, setTimeout(() => finish(id), duration(TOKEN.collapse)));
      }
    }, duration(reduced ? TOKEN.reduced : TOKEN.delay)));
  }

  function visible(tasks) {
    for (const [id, slot] of nodes) {
      const task = app.tasks.all().find(item => item.id === id);
      if (!task) { cancel(id); nodes.delete(id); }
      else if (!task.done) cancel(id);
      else if (slot.isConnected && slot.querySelector(SELECTOR.card).dataset.taskState !== 'done') complete(id);
    }
    return tasks.filter(task => app.filters.matches(pending.has(task.id) ? { ...task, done: false } : task));
  }

  function reconcile(container, children) {
    // Remove stale siblings first so surviving focused nodes never need to move
    const keep = new Set(children);
    [...container.children].forEach(child => { if (!keep.has(child)) child.remove(); });
    let cursor = container.firstElementChild;
    children.forEach(child => {
      if (cursor === child) cursor = cursor.nextElementSibling;
      else container.insertBefore(child, cursor);
    });
  }

  function cards(container, tasks, stacked = false) {
    const children = tasks.map(task => {
      let slot = nodes.get(task.id);
      if (!slot) {
        slot = clone(TEMPLATE.slot).firstElementChild;
        slot.querySelector(SELECTOR.inner).append(card(task, stacked));
        nodes.set(task.id, slot);
      } else updateCard(slot.querySelector(SELECTOR.card), task, stacked);
      return slot;
    });
    reconcile(container, children);
  }


  function clone(id) {
    return document.getElementById(id).content.cloneNode(true);
  }

  function card(task, stacked = false) {
    const fragment = clone(TEMPLATE.card);
    const element = fragment.querySelector(SELECTOR.card);
    updateCard(element, task, stacked);
    return fragment;
  }

  function updateCard(element, task, stacked) {
    const today = app.dates.today();
    const state = app.tasks.getTaskState(task, today);
    element.dataset.taskId = task.id;
    if (element.dataset.taskState) element.classList.remove(CLASS.state + element.dataset.taskState);
    element.classList.add(CLASS.state + state);
    element.classList.toggle(CLASS.stacked, stacked === true);
    element.dataset.taskState = state;
    element.querySelector(SELECTOR.title).textContent = task.title;
    highlight(element.querySelector(SELECTOR.title), task.title);
    // The Lab 3 open-filter frame has no space before this description icon
    if (task.id === compactTitleId) element.querySelector(SELECTOR.title).nextSibling.textContent = '';
    const tag = element.querySelector(SELECTOR.tag);
    tag.textContent = app.tasks.disciplines[task.disciplineId];
    tag.className = `tag task-card__discipline tag--${task.disciplineId}`;
    const time = element.querySelector('time');
    time.dateTime = task.deadline;
    time.textContent = app.dates.format(task.deadline);
    const relative = element.querySelector(SELECTOR.meta);
    relative.hidden = task.done;
    relative.textContent = `· ${app.dates.relative(task.deadline, today)}`;
    element.querySelector(SELECTOR.description).hidden = !task.description;
    const check = element.querySelector(SELECTOR.check);
    check.checked = task.done;
    check.setAttribute('aria-label', `${task.done ? 'Позначити невиконаним' : 'Позначити виконаним'}: ${task.title}`);
    element.querySelectorAll(SELECTOR.action).forEach(action => {
      const label = { edit: 'Редагувати', delete: 'Видалити' }[action.dataset.action];
      if (label) action.setAttribute('aria-label', `${label}: ${task.title}`);
    });
  }

  function highlight(element, title) {
    const query = app.filters.current().query.trim().toLocaleLowerCase('uk');
    if (!query) return;
    const lower = title.toLocaleLowerCase('uk');
    const content = document.createDocumentFragment();
    let start = 0;
    let index = lower.indexOf(query);
    while (index >= 0) {
      content.append(document.createTextNode(title.slice(start, index)));
      const mark = clone(TEMPLATE.mark);
      mark.querySelector('mark').textContent = title.slice(index, index + query.length);
      content.append(mark);
      start = index + query.length;
      index = lower.indexOf(query, start);
    }
    content.append(document.createTextNode(title.slice(start)));
    element.replaceChildren(content);
  }

  function list() {
    const container = document.querySelector(SELECTOR.list);
    const all = app.tasks.all();
    document.querySelector(SELECTOR.add).hidden = !all.length;
    const matchingTasks = visible(all);
    const filters = app.filters.current();
    const filtered = Boolean(filters.query || filters.discipline !== '0');
    const results = document.querySelector(SELECTOR.results);
    results.textContent = `Показано: ${matchingTasks.length} з ${all.filter(task => filters.showDone || !task.done || pending.has(task.id)).length}`;
    const disciplineFiltered = filters.discipline !== '0';
    results.classList.toggle(CLASS.hidden, !disciplineFiltered);
    results.classList.toggle(CLASS.results, disciplineFiltered);
    document.querySelector(SELECTOR.reset).hidden = !disciplineFiltered;
    const searchCount = document.querySelector(SELECTOR.searchCount);
    searchCount.hidden = !filters.query || !matchingTasks.length;
    searchCount.textContent = `Знайдено: ${matchingTasks.length}`;
    const content = document.createDocumentFragment();
    const sections = [];
    if (!all.length) content.append(clone(TEMPLATE.first));
    else if (!matchingTasks.length && filtered) content.append(clone(TEMPLATE.noResults));
    else Object.entries(GROUPS).forEach(([id, title]) => {
      const matching = matchingTasks.filter(task => app.dates.group(task.deadline) === id);
      if (filtered && !matching.length) return;
      const fragment = groups.get(id) || clone(TEMPLATE.group).firstElementChild;
      groups.set(id, fragment);
      fragment.querySelector(SELECTOR.groupTitle).textContent = title;
      const count = fragment.querySelector(SELECTOR.count);
      count.textContent = matching.length;
      if (id === 'overdue') count.classList.add(CLASS.countOverdue);
      if (id === 'week') count.classList.add(CLASS.countSoon);
      const container = fragment.querySelector(SELECTOR.cards);
      cards(container, matching);
      if (!matching.length) container.append(clone(TEMPLATE.empty));
      sections.push(fragment);
    });
    reconcile(container, sections.length ? sections : [...content.children]);
  }

  function bind(container) {
    // One delegated listener also handles cards created after filtering or saving
    container.addEventListener('click', event => {
      const action = event.target.closest(SELECTOR.action);
      if (!action || !container.contains(action)) return;
      const element = action.closest(SELECTOR.card);
      const task = app.tasks.all().find(item => item.id === element.dataset.taskId);
      if (!task) return;
      if (action.dataset.action === 'toggle') {
        if (task.done) cancel(task.id);
        else complete(task.id);
        app.tasks.toggle(task.id);
        document.querySelector(SELECTOR.status).textContent = task.done ? 'Виконання скасовано' : 'Завдання виконано';
      } else {
        event.preventDefault();
        app.modals.showTask(action.dataset.action, task, action);
      }
    });
  }

  function init(options = {}) {
    compactTitleId = options.compactTitleId || null;
    bind(document.querySelector(SELECTOR.list));
    app.tasks.subscribe(list);
    list();
  }

  window.addEventListener('pagehide', cancelPending);
  app.render = { init, list, card, cards, visible, cancelPending, bind, clone };
})();

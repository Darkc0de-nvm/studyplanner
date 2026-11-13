(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { list: '.task-groups', card: '.task-card', title: '.task-card__title a', tag: '.task-card__discipline', meta: '.task-card__meta > span', description: '[data-description]', check: '.task-card__check', action: '[data-action]', groupTitle: '.group-header__title', count: '.group-count', cards: '.task-group__cards', results: '.filter-count', reset: '.filter-reset', add: '.app-add', searchCount: '[data-search-count]', slot: '.task-slot', inner: '.task-slot__inner', group: '.task-group', status: '[data-storage-status]', modal: '.modal', heading: 'h2' };
  const CLASS = { state: 'task-card--', stacked: 'task-card--stacked', pending: 'task-card--pending', hidden: 'visually-hidden', results: 'filter-count--visible', countOverdue: 'group-count--overdue', countSoon: 'group-count--soon', collapsing: 'task-slot--collapsing', entering: 'task-slot--entering', removing: 'task-slot--removing' };
  const GROUPS = { overdue: 'Прострочені', today: 'Сьогодні', week: 'Цей тиждень', later: 'Пізніше' };
  const TEMPLATE = { card: 'task-card-template', group: 'task-group-template', first: 'first-run-template', noResults: 'no-results-template', empty: 'empty-group-template', mark: 'search-mark-template', slot: 'task-slot-template' };
  let compactTitleId = null;
  const pending = new Set();
  const timers = new Map();
  const nodes = new Map();
  const groups = new Map();
  const MOTION = '(prefers-reduced-motion: reduce)';
  const TOKEN = { delay: '--delay-complete', reduced: '--delay-complete-reduced', collapse: '--duration-collapse' };
  const removals = new Map();

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
    const entering = [];
    const children = tasks.map(task => {
      let slot = nodes.get(task.id);
      if (!slot) {
        slot = clone(TEMPLATE.slot).firstElementChild;
        slot.dataset.taskId = task.id;
        slot.querySelector(SELECTOR.inner).append(card(task, stacked));
        nodes.set(task.id, slot);
      } else {
        if (!slot.isConnected && slot.classList.contains(CLASS.entering)) entering.push(slot);
        updateCard(slot.querySelector(SELECTOR.card), task, stacked);
      }
      return slot;
    });
    reconcile(container, children);
    entering.forEach(animateEntry);
  }

  function animateEntry(slot) {
    if (window.matchMedia(MOTION).matches) return;
    slot.classList.remove(CLASS.entering);
    void slot.offsetWidth;
    slot.classList.add(CLASS.entering);
    slot.addEventListener('animationend', event => {
      if (event.target === slot && event.animationName === 'task-slot-enter') {
        slot.classList.remove(CLASS.entering);
      }
    }, { once: true });
  }

  function animateRemoval(id) {
    const slot = nodes.get(id);
    if (!slot?.isConnected || window.matchMedia(MOTION).matches) return Promise.resolve();

    slot.inert = true;
    slot.classList.remove(CLASS.entering);
    slot.classList.add(CLASS.removing);

    return new Promise(resolve => {
      let timer;
      const finish = remove => {
        clearTimeout(timer);
        slot.removeEventListener('animationend', onAnimationEnd);
        if (remove) slot.remove();
        removals.delete(id);
        resolve();
      };
      const onAnimationEnd = event => {
        if (event.target === slot && event.animationName === 'task-slot-exit') finish(true);
      };
      slot.addEventListener('animationend', onAnimationEnd);
      timer = window.setTimeout(() => finish(true), duration(TOKEN.collapse) + 80);
      removals.set(id, { cancel: () => finish(false) });
    });
  }

  function cancelRemoval(id) {
    removals.get(id)?.cancel();
    const slot = nodes.get(id);
    if (!slot) return;
    const wasConnected = slot.isConnected;
    slot.classList.remove(CLASS.removing);
    slot.inert = false;
    if (wasConnected) animateEntry(slot);
    else slot.classList.add(CLASS.entering);
  }

  function finalizeRemoval(id) {
    removals.get(id)?.cancel();
    nodes.get(id)?.remove();
    nodes.delete(id);
  }

  function remap(oldId, newId) {
    const slot = nodes.get(oldId);
    if (!slot) return;
    nodes.delete(oldId);
    nodes.set(newId, slot);
    slot.dataset.taskId = newId;
    if (slot.isConnected) animateEntry(slot);
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
    const pending = Boolean(task.pending) || (app.tasks.isBusy ? app.tasks.isBusy(task.id) : false);
    element.classList.toggle(CLASS.pending, pending);
    element.setAttribute('aria-busy', String(pending));
    element.querySelector(SELECTOR.title).textContent = task.title;
    highlight(element.querySelector(SELECTOR.title), task.title);
    // The Lab 3 open-filter frame has no space before this description icon
    if (task.id === compactTitleId) element.querySelector(SELECTOR.title).nextSibling.textContent = '';
    const tag = element.querySelector(SELECTOR.tag);
    const color = app.tasks.getDisciplineColor ? app.tasks.getDisciplineColor(task.disciplineId) : task.disciplineId;
    tag.textContent = app.tasks.getDisciplineName ? app.tasks.getDisciplineName(task.disciplineId) : app.tasks.disciplines[task.disciplineId];
    tag.className = `tag task-card__discipline tag--${color}`;
    const time = element.querySelector('time');
    time.dateTime = task.deadline;
    time.textContent = app.dates.format(task.deadline);
    const relative = element.querySelector(SELECTOR.meta);
    relative.hidden = task.done;
    relative.textContent = `· ${app.dates.relative(task.deadline, today)}`;
    element.querySelector(SELECTOR.description).hidden = !task.description;
    const check = element.querySelector(SELECTOR.check);
    check.checked = task.done;
    check.disabled = pending;
    check.setAttribute('aria-label', `${task.done ? 'Позначити невиконаним' : 'Позначити виконаним'}: ${task.title}`);
    element.querySelectorAll(SELECTOR.action).forEach(action => {
      const label = { edit: 'Редагувати', delete: 'Видалити' }[action.dataset.action];
      if (label) action.setAttribute('aria-label', `${label}: ${task.title}`);
      if (action.dataset.action !== 'toggle') {
        if (pending) action.setAttribute('aria-disabled', 'true');
        else action.removeAttribute('aria-disabled');
      }
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
      // Optimistic entries have a temporary id and cannot be mutated until the
      // server assigns the real one; busy cards ignore repeated actions.
      if (!task || task.pending || (app.tasks.isBusy && app.tasks.isBusy(task.id))) return;
      if (action.dataset.action === 'toggle') {
        const completing = !task.done;
        if (task.done) cancel(task.id);
        else complete(task.id);
        app.tasks.toggle(task.id);
        const status = document.querySelector(SELECTOR.status);
        if (status) status.textContent = completing ? 'Завдання виконано' : 'Виконання скасовано';
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
  app.render = { init, list, card, cards, visible, cancelPending, bind, clone, animateRemoval, cancelRemoval, finalizeRemoval, remap };
})();

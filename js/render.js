(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { list: '.task-groups', card: '.task-card', title: '.task-card__title a', tag: '.task-card__discipline', meta: '.task-card__meta > span', description: '[data-description]', check: '.task-card__check', action: '[data-action]', groupTitle: '.group-header__title', count: '.group-count', cards: '.task-group__cards', results: '.filter-count', reset: '.filter-reset', add: '.app-add', searchCount: '[data-search-count]' };
  const CLASS = { done: 'task-card--done', overdue: 'task-card--overdue', soon: 'task-card--soon', hidden: 'visually-hidden', results: 'filter-count--visible', countOverdue: 'group-count--overdue', countSoon: 'group-count--soon' };
  const GROUPS = { overdue: 'Прострочені', today: 'Сьогодні', week: 'Цей тиждень', later: 'Пізніше' };
  const TEMPLATE = { card: 'task-card-template', group: 'task-group-template', first: 'first-run-template', noResults: 'no-results-template', empty: 'empty-group-template', mark: 'search-mark-template' };
  let compactTitleId = null;

  function clone(id) {
    return document.getElementById(id).content.cloneNode(true);
  }

  function card(task) {
    const fragment = clone(TEMPLATE.card);
    const element = fragment.querySelector(SELECTOR.card);
    const group = app.dates.group(task.deadline);
    element.dataset.taskId = task.id;
    element.classList.toggle(CLASS.done, task.done);
    element.classList.toggle(CLASS.overdue, group === 'overdue');
    element.classList.toggle(CLASS.soon, group === 'week');
    element.querySelector(SELECTOR.title).textContent = task.title;
    highlight(element.querySelector(SELECTOR.title), task.title);
    // The Lab 3 open-filter frame has no space before this description icon
    if (task.id === compactTitleId) element.querySelector(SELECTOR.title).nextSibling.textContent = '';
    const tag = element.querySelector(SELECTOR.tag);
    tag.textContent = app.tasks.disciplines[task.disciplineId];
    tag.classList.add(`tag--${task.disciplineId}`);
    const time = element.querySelector('time');
    time.dateTime = task.deadline;
    time.textContent = app.dates.format(task.deadline);
    const relative = element.querySelector(SELECTOR.meta);
    if (task.done) relative.remove();
    else relative.textContent = `· ${app.dates.relative(task.deadline)}`;
    if (!task.description) element.querySelector(SELECTOR.description).remove();
    else if (task.done) element.querySelector(SELECTOR.description).querySelector('use').remove();
    const check = element.querySelector(SELECTOR.check);
    check.checked = task.done;
    check.setAttribute('aria-label', `${task.done ? 'Позначити невиконаним' : 'Позначити виконаним'}: ${task.title}`);
    element.querySelectorAll(SELECTOR.action).forEach(action => {
      const label = { edit: 'Редагувати', delete: 'Видалити' }[action.dataset.action];
      if (label) action.setAttribute('aria-label', `${label}: ${task.title}`);
    });
    return fragment;
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
    const visible = all.filter(app.filters.matches);
    const filters = app.filters.current();
    const filtered = Boolean(filters.query || filters.discipline !== '0');
    const results = document.querySelector(SELECTOR.results);
    results.textContent = `Показано: ${visible.length} з ${all.filter(task => filters.showDone || !task.done).length}`;
    const disciplineFiltered = filters.discipline !== '0';
    results.classList.toggle(CLASS.hidden, !disciplineFiltered);
    results.classList.toggle(CLASS.results, disciplineFiltered);
    document.querySelector(SELECTOR.reset).hidden = !disciplineFiltered;
    const searchCount = document.querySelector(SELECTOR.searchCount);
    searchCount.hidden = !filters.query || !visible.length;
    searchCount.textContent = `Знайдено: ${visible.length}`;
    const content = document.createDocumentFragment();
    if (!all.length) content.append(clone(TEMPLATE.first));
    else if (!visible.length && filtered) content.append(clone(TEMPLATE.noResults));
    else Object.entries(GROUPS).forEach(([id, title]) => {
      const matching = visible.filter(task => app.dates.group(task.deadline) === id);
      if (filtered && !matching.length) return;
      const fragment = clone(TEMPLATE.group);
      fragment.querySelector(SELECTOR.groupTitle).textContent = title;
      const count = fragment.querySelector(SELECTOR.count);
      count.textContent = matching.length;
      if (id === 'overdue') count.classList.add(CLASS.countOverdue);
      if (id === 'week') count.classList.add(CLASS.countSoon);
      const cards = fragment.querySelector(SELECTOR.cards);
      matching.sort((a, b) => Number(a.done) - Number(b.done)).forEach(task => cards.append(card(task)));
      if (!matching.length) cards.append(clone(TEMPLATE.empty));
      content.append(fragment);
    });
    container.replaceChildren(content);
  }

  function init(options = {}) {
    compactTitleId = options.compactTitleId || null;
    const container = document.querySelector(SELECTOR.list);
    // One delegated listener also handles cards created after filtering or saving
    container.addEventListener('click', event => {
      const action = event.target.closest(SELECTOR.action);
      if (!action || !container.contains(action)) return;
      const element = action.closest(SELECTOR.card);
      const task = app.tasks.all().find(item => item.id === element.dataset.taskId);
      if (!task) return;
      if (action.dataset.action === 'toggle') {
        app.tasks.toggle(task.id);
        const replacement = [...container.querySelectorAll(SELECTOR.card)].find(item => item.dataset.taskId === task.id);
        (replacement?.querySelector(SELECTOR.check) || container).focus();
      } else {
        event.preventDefault();
        app.modals.showTask(action.dataset.action, task, action);
      }
    });
    app.tasks.subscribe(list);
    list();
  }

  app.render = { init, list, card };
})();

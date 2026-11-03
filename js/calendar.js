(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { grid: '[data-calendar-grid]', cell: '[data-date]', heading: '.month-heading h1', month: '.month-calendar', step: '[data-month-step]', today: '[data-calendar-today]', reset: '.filter-reset', legend: '.calendar-legend [data-discipline-id]', cards: '.day-view__cards', dayTitle: '#day-title time', emptyTitle: '#day-empty-title time', subtitle: '.day-view__subtitle', addDay: '[data-add-day]' };
  const CLASS = { outside: 'calendar-cell--outside', today: 'calendar-cell--today', chip: 'calendar-chip--', dot: 'calendar-cell__dot--' };
  const TEMPLATE = { cell: 'calendar-cell-template', tasks: 'calendar-tasks-template', chip: 'calendar-chip-template', dot: 'calendar-dot-template', more: 'calendar-more-template' };
  const TARGET = { day: 'day', empty: 'day-empty', add: 'add-task' };
  const CHIP_LIMIT = 2;
  const DAYS_PER_WEEK = 7;
  let month;
  let selected;

  function longDate(date) {
    return new Intl.DateTimeFormat('uk', { day: 'numeric', month: 'long', year: 'numeric' }).format(date).replace(/ р\.$/, '');
  }

  function tasksOn(iso) {
    return app.tasks.all().filter(task => task.deadline === iso && app.filters.matches(task));
  }

  function appendMarkers(cell, tasks) {
    if (!tasks.length) return;
    const markers = app.render.clone(TEMPLATE.tasks);
    const chips = markers.querySelector('.calendar-cell__tasks');
    const dots = markers.querySelector('.calendar-cell__dots');
    tasks.slice(0, CHIP_LIMIT).forEach(task => {
      const chip = app.render.clone(TEMPLATE.chip);
      chip.firstElementChild.classList.add(CLASS.chip + task.disciplineId);
      chip.firstElementChild.textContent = task.title;
      chip.firstElementChild.dataset.taskId = task.id;
      chip.firstElementChild.dataset.taskState = app.tasks.getTaskState(task);
      chips.append(chip);
      const dot = app.render.clone(TEMPLATE.dot);
      dot.firstElementChild.classList.add(CLASS.dot + task.disciplineId);
      dot.firstElementChild.dataset.taskState = app.tasks.getTaskState(task);
      dots.append(dot);
    });
    if (tasks.length > CHIP_LIMIT) {
      const more = app.render.clone(TEMPLATE.more);
      more.firstElementChild.textContent = `+${tasks.length - CHIP_LIMIT} ще`;
      chips.append(more);
    }
    cell.append(markers);
  }

  function render() {
    const label = new Intl.DateTimeFormat('uk', { month: 'long', year: 'numeric' }).format(month).replace(/ р\.$/, '');
    document.querySelector(SELECTOR.heading).textContent = label[0].toLocaleUpperCase('uk') + label.slice(1);
    document.querySelector(SELECTOR.month).setAttribute('aria-label', `Календар на ${label}`);
    const start = new Date(month);
    const offset = (month.getDay() + 6) % DAYS_PER_WEEK;
    start.setDate(1 - offset);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells = Math.ceil((offset + days) / DAYS_PER_WEEK) * DAYS_PER_WEEK;
    const content = document.createDocumentFragment();
    for (let index = 0; index < cells; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = app.dates.toISO(date);
      const tasks = tasksOn(iso);
      const fragment = app.render.clone(TEMPLATE.cell);
      const cell = fragment.firstElementChild;
      cell.dataset.date = iso;
      cell.href = tasks.length ? `#${TARGET.day}` : `#${TARGET.empty}`;
      cell.classList.toggle(CLASS.outside, date.getMonth() !== month.getMonth());
      cell.classList.toggle(CLASS.today, iso === app.dates.toISO(app.dates.today()));
      cell.setAttribute('aria-label', `${longDate(date)}, ${tasks.length ? `завдань: ${tasks.length}` : 'немає завдань'}`);
      if (iso === app.dates.toISO(app.dates.today())) cell.setAttribute('aria-current', 'date');
      const time = cell.querySelector('time');
      time.dateTime = iso;
      time.querySelector('span').textContent = date.getDate();
      appendMarkers(cell, tasks);
      content.append(fragment);
    }
    document.querySelector(SELECTOR.grid).replaceChildren(content);
    const discipline = app.filters.current().discipline;
    document.querySelector(SELECTOR.reset).hidden = discipline === '0';
    document.querySelectorAll(SELECTOR.legend).forEach(item => { item.hidden = discipline !== '0' && item.dataset.disciplineId !== discipline; });
    fillDay();
  }

  function fillDay() {
    const date = app.dates.parse(selected);
    if (!date) return;
    for (const selector of [SELECTOR.dayTitle, SELECTOR.emptyTitle]) {
      const time = document.querySelector(selector);
      time.dateTime = selected;
      time.textContent = longDate(date);
    }
    const tasks = tasksOn(selected);
    const weekday = new Intl.DateTimeFormat('uk', { weekday: 'long' }).format(date);
    document.querySelector(SELECTOR.subtitle).textContent = `${weekday} · завдань: ${tasks.length}`;
    const cards = document.querySelector(SELECTOR.cards);
    cards.replaceChildren(...tasks.map(task => app.render.card(task, true)));
    if (!tasks.length && location.hash === `#${TARGET.day}`) app.modals.open(TARGET.empty);
    return tasks;
  }

  function openDay(iso, source) {
    selected = iso;
    render();
    const replacement = [...document.querySelectorAll(SELECTOR.cell)].find(cell => cell.dataset.date === iso);
    app.modals.open(tasksOn(iso).length ? TARGET.day : TARGET.empty, replacement || source);
  }

  function shift(amount) {
    month = new Date(month.getFullYear(), month.getMonth() + amount, 1, 12);
    render();
  }

  function init() {
    const date = app.dates.today();
    month = new Date(date.getFullYear(), date.getMonth(), 1, 12);
    selected = app.dates.toISO(date);
    // One delegated listener covers every date even after rebuilding the month grid
    document.querySelector(SELECTOR.grid).addEventListener('click', event => {
      const cell = event.target.closest(SELECTOR.cell);
      if (!cell) return;
      event.preventDefault();
      openDay(cell.dataset.date, cell);
    });
    document.querySelectorAll(SELECTOR.step).forEach(button => button.addEventListener('click', event => { event.preventDefault(); shift(Number(button.dataset.monthStep)); }));
    document.querySelector(SELECTOR.today).addEventListener('click', event => {
      event.preventDefault();
      const current = app.dates.today();
      month = new Date(current.getFullYear(), current.getMonth(), 1, 12);
      selected = app.dates.toISO(current);
      render();
    });
    document.querySelectorAll(SELECTOR.addDay).forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      app.forms.fill(null, selected);
      app.modals.open(TARGET.add, button);
    }));
    app.render.bind(document.querySelector(SELECTOR.cards));
    app.tasks.subscribe(render);
    render();
    const requested = app.dates.parse(new URLSearchParams(location.search).get('date'));
    const queryDate = requested ? app.dates.toISO(requested) : '';
    if (queryDate) selected = queryDate;
    if ([`#${TARGET.day}`, `#${TARGET.empty}`].includes(location.hash)) {
      const empty = app.dates.today();
      empty.setDate(empty.getDate() + 14);
      const tasks = app.tasks.all();
      const fallbackTask = tasks.find(task => task.id === 'seed-6') || tasks.find(task => !task.done);
      const fallback = location.hash === `#${TARGET.day}` ? fallbackTask?.deadline || selected : app.dates.toISO(empty);
      openDay(queryDate || fallback);
    } else if (location.hash === `#${TARGET.add}` && queryDate) app.forms.fill(null, selected);
  }

  app.calendar = { init, render, openDay };
})();

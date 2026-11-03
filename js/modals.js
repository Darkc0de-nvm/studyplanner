(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { modal: '.modal', panel: '.modal__panel', link: 'a[href^="#"]', close: 'a[href="#main"], a[href="#"]', title: '#task-details h3', description: '#task-details > p:last-child', tag: '#task-details .tag', time: '#task-details time', relative: '[data-relative]', deleteTitle: '.delete-dialog__task > p', deleteTag: '.delete-dialog__task > span', confirm: '[data-confirm-delete]', focusable: 'a[href], button, input, textarea, select, summary, [tabindex="0"]', background: '.planner-shell, .bottom-tabs', add: '.app-add, .calendar-add' };
  const TARGETS = { add: 'add-task', edit: 'edit-task', details: 'task-details', delete: 'delete-task' };
  const OPEN = 'modal--open';
  const ENHANCED = 'app-page--enhanced';
  const VARIANT = 'modal__variant--active';
  const VARIANT_SELECTOR = '.modal__variant';
  const LOCKED = 'app-page--modal';
  const MUTED = 'muted';
  const DATE_CELL = '[data-date]';
  let active = null;
  let trigger = null;
  let selectedId = null;
  let activeId = '';
  let initialHash = '';
  let keyboard = false;
  let returnKeyboard = false;

  function focusable() {
    return [...active.querySelectorAll(SELECTOR.focusable)].filter(item => !item.disabled && item.getClientRects().length && !item.closest('details:not([open]) .select__options'));
  }

  function sync() {
    const id = location.hash.slice(1);
    if (!id) return;
    if (id === 'add-task-date') {
      app.forms.fill();
      open(TARGETS.add);
      app.datepicker.open(document.querySelector('[data-task-form="add"] [name="deadline"]'));
    } else if (document.getElementById(id)?.closest(SELECTOR.modal)) {
      const action = id === 'task-delete' ? 'delete' : Object.keys(TARGETS).find(key => TARGETS[key] === id);
      const task = app.tasks.all().find(item => item.id === selectedId) || app.tasks.all()[0];
      if (action === 'add') { app.forms.fill(); open(id); }
      else if (action && task) showTask(action, task);
      else open(id);
    }
    else return;
    // replaceState consumes deep links without navigating to a page anchor
    history.replaceState(null, '', location.pathname + location.search);
  }

  function deactivate() {
    if (!active) return;
    active.classList.remove(OPEN);
    active.removeAttribute('aria-modal');
    active.querySelectorAll(VARIANT_SELECTOR).forEach(element => element.classList.remove(VARIANT));
    active.querySelectorAll('[data-task-form]').forEach(app.forms.clear);
    app.datepicker?.close(false);
  }

  function open(id, source) {
    const target = document.getElementById(id);
    const next = target?.closest(SELECTOR.modal);
    if (!next || (active === next && activeId === id)) return;
    if (!active) {
      trigger = source || document.activeElement;
      returnKeyboard = keyboard;
    }
    app.selects.close();
    deactivate();
    active = next;
    activeId = id;
    active.classList.add(OPEN);
    if (target.matches(VARIANT_SELECTOR)) target.classList.add(VARIANT);
    document.body.classList.add(LOCKED);
    document.querySelectorAll(SELECTOR.background).forEach(element => { element.inert = true; });
    active.setAttribute('aria-modal', 'true');
    (focusable().find(element => element.matches('input:not([type="radio"]), textarea')) || active.querySelector(SELECTOR.panel)).focus({ preventScroll: true });
  }

  function close() {
    if (!active) return;
    app.selects.close();
    deactivate();
    active = null;
    activeId = '';
    document.body.classList.remove(LOCKED);
    document.querySelectorAll(SELECTOR.background).forEach(element => { element.inert = false; });
    const date = trigger?.closest(DATE_CELL)?.dataset.date;
    const calendarTrigger = [...document.querySelectorAll(DATE_CELL)].find(cell => cell.dataset.date === date);
    const fallback = calendarTrigger || document.querySelector(SELECTOR.add);
    (trigger?.isConnected ? trigger : fallback)?.focus({ preventScroll: true, focusVisible: returnKeyboard });
    trigger = null;
  }

  function showTask(action, task, source) {
    selectedId = task.id;
    if (action === 'edit') app.forms.fill(task);
    if (action === 'details') {
      const details = document.getElementById(TARGETS.details);
      const state = app.tasks.getTaskState(task);
      if (details.dataset.taskState) details.classList.remove(`task-card--${details.dataset.taskState}`);
      details.dataset.taskState = state;
      details.classList.add(`task-card--${state}`);
      document.querySelector(SELECTOR.title).textContent = task.title;
      document.querySelector(SELECTOR.description).textContent = task.description || 'Опис не додано';
      document.querySelector(SELECTOR.description).classList.toggle(MUTED, !task.description);
      const tag = document.querySelector(SELECTOR.tag);
      tag.className = `tag tag--${task.disciplineId}`;
      tag.textContent = app.tasks.disciplines[task.disciplineId];
      const time = document.querySelector(SELECTOR.time);
      time.dateTime = task.deadline;
      time.textContent = app.dates.format(task.deadline);
      document.querySelector(SELECTOR.relative).textContent = ` · ${app.dates.relative(task.deadline)}`;
    }
    if (action === 'delete') {
      document.querySelector(SELECTOR.deleteTitle).textContent = task.title;
      document.querySelector(SELECTOR.deleteTag).textContent = app.tasks.disciplines[task.disciplineId];
    }
    open(TARGETS[action], source);
  }

  function init(initialTask) {
    initialHash = location.hash;
    document.body.classList.add(ENHANCED);
    document.addEventListener('pointerdown', () => { keyboard = false; }, true);
    document.addEventListener('keydown', () => { keyboard = true; }, true);
    document.addEventListener('click', event => {
      if (event.defaultPrevented) return;
      const link = event.target.closest(SELECTOR.link);
      if (!link) return;
      if (active && link.matches(SELECTOR.close)) {
        event.preventDefault();
        close();
        return;
      }
      const picker = link.hash === '#add-task-date';
      const id = picker ? TARGETS.add : link.hash.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target?.closest(SELECTOR.modal)) return;
      event.preventDefault();
      if (id === TARGETS.add) app.forms.fill();
      open(id, link);
      if (picker) app.datepicker.open(document.querySelector(SELECTOR.modal + ' [name="deadline"]'));
    });
    document.querySelector(SELECTOR.confirm).addEventListener('click', () => {
      if (selectedId) app.tasks.remove(selectedId);
      close();
    });
    document.addEventListener('keydown', event => {
      if (!active || event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      // Cycle focus inside the dialog, including when its panel initially has focus
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    });
    window.addEventListener('hashchange', sync);
    app.tasks.subscribe(() => {
      if (![TARGETS.details, TARGETS.delete].includes(activeId)) return;
      const selected = app.tasks.all().find(task => task.id === selectedId);
      if (!selected) close();
      else showTask(activeId === TARGETS.details ? 'details' : 'delete', selected);
    });
    const target = location.hash.slice(1);
    if (target === 'add-task-date') {
      app.forms.fill();
      open(TARGETS.add);
      app.datepicker.open(document.querySelector('[data-task-form="add"] [name="deadline"]'));
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    const task = initialTask || app.tasks.all()[0];
    const action = target === 'task-delete' ? 'delete' : Object.keys(TARGETS).find(key => TARGETS[key] === target);
    if (action === 'add') app.forms.fill();
    else if (action && task) showTask(action, task);
    sync();
  }

  app.modals = { init, open, close, showTask, current: () => activeId, initialHash: () => initialHash };
})();

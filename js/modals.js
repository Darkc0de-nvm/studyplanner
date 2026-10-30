(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { modal: '.modal', panel: '.modal__panel', link: 'a[href^="#"]', close: 'a[href="#main"]', title: '#task-details h3', description: '#task-details > p:last-child', tag: '#task-details .tag', time: '#task-details time', relative: '[data-relative]', deleteTitle: '.delete-dialog__task > p', deleteTag: '.delete-dialog__task > span', confirm: '[data-confirm-delete]', focusable: 'a[href], button, input, textarea, select, summary, [tabindex="0"]', background: '.planner-shell, .bottom-tabs', add: '.app-add' };
  const TARGETS = { add: 'add-task', edit: 'edit-task', details: 'task-details', delete: 'delete-task' };
  const LOCKED = 'app-page--modal';
  const MUTED = 'muted';
  let active = null;
  let trigger = null;
  let selectedId = null;
  let baseHash = '';

  function focusable() {
    return [...active.querySelectorAll(SELECTOR.focusable)].filter(item => !item.disabled && item.getClientRects().length && !item.closest('details:not([open]) .select__options'));
  }

  function sync() {
    const target = document.getElementById(location.hash.slice(1));
    const next = target?.closest(SELECTOR.modal) || null;
    if (active === next) return;
    if (active) active.removeAttribute('aria-modal');
    active = next;
    document.body.classList.toggle(LOCKED, Boolean(active));
    document.querySelectorAll(SELECTOR.background).forEach(element => { element.inert = Boolean(active); });
    if (active) {
      active.setAttribute('aria-modal', 'true');
      (focusable().find(element => element.matches('input:not([type="radio"]), textarea')) || active.querySelector(SELECTOR.panel)).focus({ preventScroll: true });
    } else {
      const fallback = document.querySelector(SELECTOR.add);
      (trigger?.isConnected ? trigger : fallback)?.focus({ preventScroll: true });
      trigger = null;
    }
  }

  function open(id, source) {
    if (!active) {
      baseHash = location.hash && !document.getElementById(location.hash.slice(1))?.closest(SELECTOR.modal) ? location.hash : '';
      trigger = source || document.activeElement;
    }
    app.selects.close();
    // Keep :target animations while replacing the transient hash history entry
    if (active) history.replaceState(null, '', location.pathname + location.search + baseHash);
    location.hash = id;
    sync();
  }

  function close() {
    app.selects.close();
    // replaceState alone leaves the browser's :target styling on the old element
    location.replace(baseHash || '#main');
    history.replaceState(null, '', location.pathname + location.search + baseHash);
    sync();
  }

  function showTask(action, task, source) {
    selectedId = task.id;
    if (action === 'edit') app.forms.fill(task);
    if (action === 'details') {
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
    document.addEventListener('click', event => {
      const link = event.target.closest(SELECTOR.link);
      if (!link) return;
      if (active && link.matches(SELECTOR.close)) {
        event.preventDefault();
        close();
        return;
      }
      const id = link.hash.slice(1);
      const target = document.getElementById(id);
      if (!target?.closest(SELECTOR.modal)) return;
      event.preventDefault();
      if (id === TARGETS.add) app.forms.fill();
      open(id, link);
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
    const target = location.hash.slice(1);
    const task = initialTask || app.tasks.all()[0];
    const action = Object.keys(TARGETS).find(key => TARGETS[key] === target);
    if (action === 'add') app.forms.fill();
    else if (action && task) showTask(action, task);
    sync();
  }

  app.modals = { init, open, close, showTask };
})();

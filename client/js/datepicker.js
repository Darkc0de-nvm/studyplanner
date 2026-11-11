(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { input: '[name="deadline"]', field: '.field__date', toggle: '[data-date-toggle]', panel: '.datepicker', title: '.datepicker__title', grid: '.datepicker__grid', day: '[data-picker-date]', step: '[data-picker-step]', modal: '.modal__panel' };
  const CLASS = { above: 'datepicker--above', compact: 'datepicker--compact', outside: 'datepicker__day--outside', today: 'datepicker__day--today' };
  const TEMPLATE = { panel: 'datepicker-template', day: 'datepicker-day-template', row: 'datepicker-row-template' };
  const WEEK = 7;
  const DESKTOP = '(min-width: 48rem)';
  let input = null;
  let panel = null;
  let month;
  let focused;

  function clone(id) {
    return document.getElementById(id).content.cloneNode(true);
  }

  function label(date, options) {
    return new Intl.DateTimeFormat('uk', options).format(date).replace(/ р\.$/, '');
  }

  function place() {
    panel.classList.remove(CLASS.compact);
    const bounds = input.closest(SELECTOR.modal).getBoundingClientRect();
    const field = input.getBoundingClientRect();
    const desktop = window.matchMedia(DESKTOP).matches;
    const below = (desktop ? window.innerHeight : Math.min(window.innerHeight, bounds.bottom)) - field.bottom;
    const above = field.top - (desktop ? 0 : Math.max(0, bounds.top));
    panel.classList.toggle(CLASS.compact, Math.max(above, below) <= panel.getBoundingClientRect().height);
    panel.classList.toggle(CLASS.above, below <= panel.getBoundingClientRect().height && above > below);
  }

  function render(focus = false) {
    const title = label(month, { month: 'long', year: 'numeric' });
    panel.querySelector(SELECTOR.title).textContent = title[0].toLocaleUpperCase('uk') + title.slice(1);
    const start = new Date(month);
    const offset = (month.getDay() + 6) % WEEK;
    start.setDate(1 - offset);
    const count = Math.max(35, Math.ceil((offset + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / WEEK) * WEEK);
    const content = document.createDocumentFragment();
    const selected = app.dates.parse(input.value);
    for (let index = 0; index < count; index += WEEK) {
      const row = clone(TEMPLATE.row).firstElementChild;
      for (let column = 0; column < WEEK; column += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + index + column);
        const cell = clone(TEMPLATE.day).firstElementChild;
        const button = cell.querySelector('button');
        const iso = app.dates.toISO(date);
        cell.setAttribute('aria-selected', String(Boolean(selected && iso === app.dates.toISO(selected))));
        button.dataset.pickerDate = iso;
        button.textContent = date.getDate();
        button.tabIndex = iso === app.dates.toISO(focused) ? 0 : -1;
        button.classList.toggle(CLASS.outside, date.getMonth() !== month.getMonth());
        button.classList.toggle(CLASS.today, iso === app.dates.toISO(app.dates.today()));
        button.setAttribute('aria-label', label(date, { day: 'numeric', month: 'long', year: 'numeric' }));
        row.append(cell);
      }
      content.append(row);
    }
    panel.querySelector(SELECTOR.grid).replaceChildren(content);
    place();
    if (focus) panel.querySelector('[tabindex="0"]').focus({ preventScroll: true });
  }

  function close(restore = true) {
    if (!panel) return;
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.closest(SELECTOR.field).querySelector(SELECTOR.toggle).setAttribute('aria-expanded', 'false');
    if (restore) input.focus({ preventScroll: true });
    panel = null;
    input = null;
  }

  function open(control) {
    if (input === control) return;
    close(false);
    input = control;
    panel = control.closest(SELECTOR.field).querySelector(SELECTOR.panel);
    focused = app.dates.parse(control.value) || app.dates.today();
    month = new Date(focused.getFullYear(), focused.getMonth(), 1, 12);
    panel.hidden = false;
    panel.classList.remove(CLASS.above);
    control.setAttribute('aria-expanded', 'true');
    control.closest(SELECTOR.field).querySelector(SELECTOR.toggle).setAttribute('aria-expanded', 'true');
    render();
  }

  function shift(amount) {
    const target = new Date(month.getFullYear(), month.getMonth() + amount, 1, 12);
    focused = new Date(target.getFullYear(), target.getMonth(), Math.min(focused.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()), 12);
    month = target;
    render(true);
  }

  function select(value) {
    const control = input;
    control.value = app.dates.format(value);
    close();
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('blur'));
  }

  function keydown(event) {
    if (!panel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    if (!event.target.closest(SELECTOR.panel) && event.target !== input) return;
    const offset = (focused.getDay() + 6) % WEEK;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -WEEK, ArrowDown: WEEK, Home: -offset, End: WEEK - 1 - offset };
    if (event.key in moves) {
      event.preventDefault();
      focused.setDate(focused.getDate() + moves[event.key]);
      month = new Date(focused.getFullYear(), focused.getMonth(), 1, 12);
      render(true);
    } else if (['PageUp', 'PageDown'].includes(event.key)) {
      event.preventDefault();
      shift(event.key === 'PageUp' ? -1 : 1);
    } else if (['Enter', ' '].includes(event.key) && event.target.matches(SELECTOR.day)) {
      event.preventDefault();
      select(event.target.dataset.pickerDate);
    }
  }

  function mask(event) {
    const control = event.target;
    const cursor = control.selectionStart;
    const digitsBefore = control.value.slice(0, cursor).replace(/\D/g, '').length;
    const digits = control.value.replace(/\D/g, '').slice(0, 8);
    control.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('.');
    const position = digitsBefore + (digitsBefore > 2 ? 1 : 0) + (digitsBefore > 4 ? 1 : 0);
    control.setSelectionRange(position, position);
  }

  function init() {
    document.querySelectorAll(SELECTOR.input).forEach(control => {
      const field = control.closest(SELECTOR.field);
      const fragment = clone(TEMPLATE.panel);
      const popup = fragment.firstElementChild;
      popup.id = `${control.id}-picker`;
      field.append(fragment);
      for (const trigger of [control, field.querySelector(SELECTOR.toggle)]) {
        trigger.setAttribute('aria-controls', popup.id);
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.addEventListener('click', () => open(control));
      }
      control.addEventListener('input', mask);
      // Delegation keeps the month grid interactive after each render
      popup.addEventListener('click', event => {
        const day = event.target.closest(SELECTOR.day);
        const step = event.target.closest(SELECTOR.step);
        if (day) select(day.dataset.pickerDate);
        else if (step) shift(Number(step.dataset.pickerStep));
      });
    });
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('pointerdown', event => {
      if (input && !input.closest(SELECTOR.field).contains(event.target)) close(false);
    });
  }

  app.datepicker = { init, open, close };
})();

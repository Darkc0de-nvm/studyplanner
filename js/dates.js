(() => {
  'use strict';

  // Set to null to use the local calendar date instead of the prototype date
  const DEMO_TODAY = '2026-10-06';
  const DAY_MS = 86400000;
  const app = window.StudyPlanner = window.StudyPlanner || {};

  function parse(value) {
    if (typeof value !== 'string') return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const display = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    if (!iso && !display) return null;
    const [year, month, day] = iso ? iso.slice(1).map(Number) : display.slice(1).reverse().map(Number);
    const date = new Date(year, month - 1, day, 12);
    return year >= 1000 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function today() {
    return DEMO_TODAY ? parse(DEMO_TODAY) : new Date();
  }

  function toISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function format(value) {
    const date = typeof value === 'string' ? parse(value) : value;
    return date ? toISO(date).split('-').reverse().join('.') : '';
  }

  function dayNumber(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
  }

  function distance(value) {
    return dayNumber(parse(value)) - dayNumber(today());
  }

  function relative(value) {
    const difference = distance(value);
    if (difference === 0) return 'сьогодні';
    const count = Math.abs(difference);
    const ending = count % 100 >= 11 && count % 100 <= 14 ? 'днів' : count % 10 === 1 ? 'день' : count % 10 >= 2 && count % 10 <= 4 ? 'дні' : 'днів';
    return difference < 0 ? `${count} ${ending} тому` : `через ${count} ${ending}`;
  }

  function group(value) {
    const difference = distance(value);
    if (difference < 0) return 'overdue';
    if (difference === 0) return 'today';
    return difference <= 6 - (today().getDay() + 6) % 7 ? 'week' : 'later';
  }

  app.dates = { parse, today, toISO, format, relative, group };
})();

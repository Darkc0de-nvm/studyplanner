(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { search: '#task-search', done: '#show-done', discipline: '.app-filter input', reset: '.filter-reset', clear: '.search-clear', form: '.app-search', select: '.app-filter' };
  const DELAY_MS = 180;
  let state = { query: '', discipline: '0', showDone: false };
  let timer;

  function changed() {
    app.storage.saveSettings(state);
    app.render.list();
  }

  function reset() {
    clearTimeout(timer);
    state = { query: '', discipline: '0', showDone: false };
    sync();
    changed();
  }

  function sync() {
    document.querySelector(SELECTOR.search).value = state.query;
    document.querySelector(SELECTOR.done).checked = state.showDone;
    document.querySelectorAll(SELECTOR.discipline).forEach(radio => { radio.checked = radio.value === state.discipline; });
    app.selects.sync(document.querySelector(SELECTOR.select));
  }

  function matches(task) {
    return (state.showDone || !task.done) && (state.discipline === '0' || task.disciplineId === state.discipline) &&
      `${task.title} ${task.description}`.toLocaleLowerCase('uk').includes(state.query.trim().toLocaleLowerCase('uk'));
  }

  function init(preview) {
    state = { ...state, ...app.storage.loadSettings() };
    if (preview === 'search') state.query = 'звіт';
    if (preview === 'no-results') state.query = 'Квантова фізика';
    sync();
    const search = document.querySelector(SELECTOR.search);
    function searchNow() {
      clearTimeout(timer);
      state.query = search.value;
      changed();
    }
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(searchNow, DELAY_MS);
    });
    document.querySelector(SELECTOR.form).addEventListener('submit', event => { event.preventDefault(); searchNow(); });
    document.querySelector(SELECTOR.clear).addEventListener('click', event => {
      event.preventDefault();
      search.value = '';
      searchNow();
      search.focus();
    });
    document.querySelector(SELECTOR.done).addEventListener('change', event => { state.showDone = event.target.checked; changed(); });
    document.querySelector(SELECTOR.select).addEventListener('change', event => { state.discipline = event.target.value; changed(); });
    document.querySelector(SELECTOR.reset).addEventListener('click', event => { event.preventDefault(); reset(); search.focus(); });
  }

  app.filters = { init, reset, matches, current: () => ({ ...state }) };
})();

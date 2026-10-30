(() => {
  'use strict';

  const app = window.StudyPlanner;
  const KEYS = { tasks: 'studyplanner.tasks.v1', settings: 'studyplanner.settings.v1' };
  const STATUS = '[data-storage-status]';
  const SEED = [
  {
    "id": "seed-1",
    "title": "Оформити звіт з лабораторної роботи №3",
    "description": "Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.",
    "disciplineId": "1",
    "deadline": "2026-10-04",
    "done": false
  },
  {
    "id": "seed-2",
    "title": "Додати інтерактивні елементи на головну сторінку",
    "description": "Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.",
    "disciplineId": "2",
    "deadline": "2026-10-03",
    "done": false
  },
  {
    "id": "seed-3",
    "title": "Скласти конспект за темою «Кеш-пам’ять»",
    "description": "Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.",
    "disciplineId": "1",
    "deadline": "2026-10-02",
    "done": true
  },
  {
    "id": "seed-4",
    "title": "Виконати нормоконтроль лекційного матеріалу",
    "description": "",
    "disciplineId": "3",
    "deadline": "2026-10-06",
    "done": false
  },
  {
    "id": "seed-5",
    "title": "Підготувати презентацію до захисту проєкту",
    "description": "Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.",
    "disciplineId": "1",
    "deadline": "2026-10-08",
    "done": false
  },
  {
    "id": "seed-6",
    "title": "Оновити базу даних для фінального проєкту",
    "description": "Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.",
    "disciplineId": "3",
    "deadline": "2026-10-15",
    "done": false
  },
  {
    "id": "seed-7",
    "title": "Підготувати підсумковий звіт за курсовий проєкт",
    "description": "Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.",
    "disciplineId": "1",
    "deadline": "2026-10-18",
    "done": false
  }
];
  let preview = false;
  let previewTasks = [];
  let previewSettings = {};

  function warn() {
    const status = document.querySelector(STATUS);
    if (status) status.textContent = 'Сховище браузера недоступне. Зміни працюють лише до закриття сторінки.';
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      warn();
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      warn();
    }
  }

  function seed() {
    return SEED.map(task => ({ ...task }));
  }

  function loadTasks() {
    if (preview) return previewTasks;
    const saved = read(KEYS.tasks, null);
    if (Array.isArray(saved) && saved.every(app.tasks.isTask) && new Set(saved.map(task => task.id)).size === saved.length) return saved;
    const initial = seed();
    write(KEYS.tasks, initial);
    return initial;
  }

  function saveTasks(tasks) {
    if (preview) previewTasks = tasks;
    else write(KEYS.tasks, tasks);
  }

  function loadSettings() {
    const saved = preview ? previewSettings : read(KEYS.settings, {});
    return {
      discipline: saved && Object.hasOwn(app.tasks.disciplines, saved.discipline) ? saved.discipline : '0',
      showDone: Boolean(saved && saved.showDone === true)
    };
  }

  function saveSettings(settings) {
    if (preview) previewSettings = settings;
    else write(KEYS.settings, settings);
  }

  function reset() {
    saveSettings({});
    app.tasks.replace(seed());
    if (app.filters) app.filters.reset();
  }

  function setPreview(state) {
    if (!state) return;
    preview = true;
    previewTasks = state === 'first-run' ? [] : seed();
    if (state === 'empty-group') previewTasks = previewTasks.filter(task => app.dates.group(task.deadline) !== 'week');
    previewSettings = { discipline: state === 'filter' ? '3' : '0', showDone: state === 'done' };
  }

  app.storage = { loadTasks, saveTasks, loadSettings, saveSettings, reset, setPreview, seed };
})();

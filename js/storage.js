(() => {
  'use strict';

  const app = window.StudyPlanner;
  const KEYS = { tasks: 'studyplanner.tasks', settings: 'studyplanner.settings.v1', user: 'studyplanner.user.v1' };
  const LEGACY_KEYS = ['studyplanner.tasks.v2', 'studyplanner.tasks.v1'];
  const VERSION = 3;
  const CONTENT_FIELDS = ['title', 'description', 'disciplineId', 'done'];
  let record = null;
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
  let previewSettings = null;

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
      return true;
    } catch {
      warn();
      return false;
    }
  }

  function seed(base = app.dates.today(), demo = app.dates.useDemoDate) {
    const offsets = [-2, -3, -4, 0, Math.min(2, 7 - (base.getDay() || 7)), 9, 12];
    return SEED.map((task, index) => {
      const date = new Date(base);
      date.setDate(date.getDate() + offsets[index]);
      return { ...task, deadline: demo ? task.deadline : app.dates.toISO(date), seed: true };
    });
  }

  function sameContent(task, original) {
    return original && CONTENT_FIELDS.every(field => task[field] === original[field]);
  }

  function adopt(tasks) {
    const valid = tasks.filter(app.tasks.isTask);
    const anchor = valid.find(task => task.id === 'seed-4' && sameContent(task, SEED[3]));
    const base = anchor && app.dates.parse(anchor.deadline);
    const candidate = base ? seed(base, false) : [];
    const matches = candidate.filter(original => valid.some(task => task.id === original.id && sameContent(task, original) && task.deadline === original.deadline));
    const previousSeed = matches.length >= 2 ? candidate : [];
    return valid.map(task => {
      if (typeof task.seed === 'boolean') return { ...task };
      const original = SEED.find(item => item.id === task.id);
      const relative = previousSeed.find(item => item.id === task.id);
      const untouched = sameContent(task, original) && (task.deadline === original.deadline || task.deadline === relative?.deadline);
      return { ...task, seed: Boolean(untouched) };
    });
  }

  function migrate(saved, legacy) {
    const current = saved && Array.isArray(saved.tasks) ? saved : null;
    const primary = current?.tasks || (Array.isArray(saved) ? saved : legacy.find(Array.isArray));
    const tasks = primary ? adopt(primary) : seed();
    const merged = new Map(tasks.map(task => [task.id, task]));
    // Older snapshots may contain user tasks missing from a newer seed-only snapshot
    legacy.filter(Array.isArray).forEach(items => adopt(items).forEach(task => {
      const existing = merged.get(task.id);
      if (!task.seed && (!existing || existing.seed)) merged.set(task.id, task);
    }));
    const baseDate = app.dates.toISO(app.dates.today());
    const regenerate = !current || !Number.isInteger(current.version) || current.version < VERSION || current.seedBaseDate !== baseDate;
    const generated = new Map(seed().map(task => [task.id, task]));
    return {
      version: VERSION,
      seedBaseDate: baseDate,
      tasks: [...merged.values()].map(task => regenerate && task.seed && generated.has(task.id) ? generated.get(task.id) : task)
    };
  }

  function loadTasks() {
    const saved = read(KEYS.tasks, record);
    const legacy = LEGACY_KEYS.map(key => read(key, null));
    record = migrate(saved, legacy);
    const unchanged = JSON.stringify(saved) === JSON.stringify(record);
    if (unchanged || write(KEYS.tasks, record)) {
      LEGACY_KEYS.forEach((key, index) => {
        if (legacy[index] === null) return;
        try { localStorage.removeItem(key); } catch { warn(); }
      });
    }
    return record.tasks.map(task => ({ ...task }));
  }

  function saveTasks(tasks) {
    record = { version: VERSION, seedBaseDate: app.dates.toISO(app.dates.today()), tasks: tasks.map(task => ({ ...task })) };
    write(KEYS.tasks, record);
  }

  function isTaskChange(event) {
    return event.key === null || event.key === KEYS.tasks || LEGACY_KEYS.includes(event.key);
  }

  function isSettingsChange(event) {
    return event.key === null || event.key === KEYS.settings;
  }

  function loadSettings() {
    const saved = previewSettings || read(KEYS.settings, {});
    return {
      discipline: saved && Object.hasOwn(app.tasks.disciplines, saved.discipline) ? saved.discipline : '0',
      showDone: Boolean(saved && saved.showDone === true)
    };
  }

  function saveSettings(settings) {
    if (previewSettings) previewSettings = settings;
    else write(KEYS.settings, settings);
  }

  function reset() {
    saveSettings({});
    app.tasks.replace(seed());
    if (app.filters) app.filters.reset();
  }

  function setPreview(state, discipline = '3') {
    if (!state) return;
    previewSettings = { discipline: state === 'filter' ? discipline : '0', showDone: state === 'done' };
  }

  function loadUser() {
    const user = read(KEYS.user, null);
    return user && typeof user.name === 'string' && user.name.trim() && typeof user.email === 'string' && typeof user.passwordDigest === 'string' ? user : null;
  }

  function saveUser(user) {
    write(KEYS.user, user);
  }

  app.storage = { loadTasks, saveTasks, loadSettings, saveSettings, reset, setPreview, seed, loadUser, saveUser, isTaskChange, isSettingsChange };
})();

(() => {
  'use strict';

  const app = window.StudyPlanner;
  const MAX_TITLE = 100;
  const MAX_DESCRIPTION = 500;
  let tasks = [];
  const listeners = new Set();
  const disciplines = Object.freeze({ '1': 'Архітектура комп’ютера', '2': 'Web-дизайн', '3': 'Бази даних' });

  function isTask(task) {
    return task && typeof task.id === 'string' && typeof task.title === 'string' &&
      task.title.trim().length >= 3 && task.title.length <= MAX_TITLE &&
      typeof task.description === 'string' && task.description.length <= MAX_DESCRIPTION &&
      Object.hasOwn(disciplines, task.disciplineId) && Boolean(app.dates.parse(task.deadline)) &&
      typeof task.done === 'boolean';
  }

  function all() {
    return tasks.map(task => ({ ...task }));
  }

  function publish() {
    app.storage.saveTasks(tasks);
    listeners.forEach(listener => listener(all()));
  }

  function init() {
    tasks = app.storage.loadTasks();
  }

  function add(values) {
    const task = { ...values, id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`, done: false };
    if (!isTask(task)) return false;
    tasks.push(task);
    publish();
    return task.id;
  }

  function update(id, values) {
    const index = tasks.findIndex(task => task.id === id);
    if (index < 0) return false;
    const task = { ...tasks[index], ...values, id };
    if (!isTask(task)) return false;
    tasks[index] = task;
    publish();
    return true;
  }

  function remove(id) {
    tasks = tasks.filter(task => task.id !== id);
    publish();
  }

  function toggle(id) {
    const task = tasks.find(item => item.id === id);
    if (task) update(id, { done: !task.done });
  }

  function replace(values) {
    if (!Array.isArray(values) || !values.every(isTask)) return;
    tasks = values.map(task => ({ ...task }));
    publish();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  app.tasks = { init, all, add, update, remove, toggle, replace, subscribe, isTask, disciplines };
})();

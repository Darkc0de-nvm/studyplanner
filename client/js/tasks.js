(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  const MAX_TITLE = 100;
  const LIMIT_TITLE_MIN = 3;
  const MAX_DESCRIPTION = 500;
  const COLOR_CLASS_COUNT = 3;

  let tasks = [];
  let disciplines = [];
  // Populated from GET /api/disciplines; no hardcoded demo disciplines.
  const disciplinesMap = Object.create(null);
  const disciplinesColorsMap = Object.create(null);

  const listeners = new Set();
  const busy = new Set();
  let isRevalidating = false;
  // Mutations in flight own the local snapshot; a focus revalidation must not
  // replace optimistic entries with data that predates them.
  let activeMutations = 0;
  let revision = 0;

  // CSS only defines colour modifiers 1..3. Server colour indexes 4 and 5
  // are mapped cyclically until the full palette is implemented.
  function getColorClass(colorIndex) {
    const value = Number(colorIndex);
    if (!Number.isInteger(value) || value < 1) return 1;
    return ((value - 1) % COLOR_CLASS_COUNT) + 1;
  }

  // Disciplines proxy/object for backwards-compatibility with app.tasks.disciplines[id]
  const disciplinesProxy = new Proxy(disciplinesMap, {
    get(target, prop) {
      if (typeof prop === 'string') {
        if (target[prop]) return target[prop];
        const found = disciplines.find(d => d.id === prop);
        if (found) return found.name;
      }
      return target[prop];
    },
  });

  function setDisciplines(list) {
    if (!Array.isArray(list)) return;
    disciplines = list.slice();
    Object.keys(disciplinesMap).forEach(id => { delete disciplinesMap[id]; });
    Object.keys(disciplinesColorsMap).forEach(id => { delete disciplinesColorsMap[id]; });
    disciplines.forEach(d => {
      disciplinesMap[d.id] = d.name;
      disciplinesColorsMap[d.id] = getColorClass(d.colorIndex);
    });
    if (app.selects && typeof app.selects.updateDisciplines === 'function') {
      app.selects.updateDisciplines(disciplines);
    }
    if (app.filters && typeof app.filters.reconcile === 'function') {
      app.filters.reconcile(disciplines.map(d => String(d.id)));
    }
  }

  function getDisciplineName(id) {
    if (disciplinesMap[id]) return disciplinesMap[id];
    const found = disciplines.find(d => d.id === id);
    return found ? found.name : 'Дисципліна';
  }

  function getDisciplineColor(id) {
    if (disciplinesColorsMap[id]) return disciplinesColorsMap[id];
    const found = disciplines.find(d => d.id === id);
    if (found) return getColorClass(found.colorIndex);
    return getColorClass(id);
  }

  function getDisciplinesList() {
    return disciplines.slice();
  }

  function isTask(task) {
    return (
      task &&
      typeof task.id === 'string' &&
      typeof task.title === 'string' &&
      task.title.trim().length >= LIMIT_TITLE_MIN &&
      task.title.length <= MAX_TITLE &&
      typeof task.description === 'string' &&
      task.description.length <= MAX_DESCRIPTION &&
      Boolean(task.disciplineId) &&
      Boolean(app.dates ? app.dates.parse(task.deadline) : task.deadline) &&
      typeof task.done === 'boolean'
    );
  }

  function normalizeTask(raw) {
    return {
      id: String(raw.id),
      disciplineId: String(raw.disciplineId),
      title: String(raw.title || ''),
      description: String(raw.description || ''),
      deadline: String(raw.deadline || ''),
      done: Boolean(raw.done),
      completedAt: raw.completedAt || null,
      seed: Boolean(raw.seed),
      pending: Boolean(raw.pending),
    };
  }

  function all() {
    return tasks.map(task => ({ ...task }));
  }

  function publish() {
    const snapshot = all();
    listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Listener notification error:', err);
      }
    });
  }

  function notifyStatus(message, isError = false) {
    const status = document.querySelector('[data-storage-status]');
    if (status) {
      status.textContent = message;
    }
    // The visible API banner reports failures; any successful action clears it
    // so a stale error does not outlive the operation it described.
    const banner = document.querySelector('[data-api-error]');
    if (!banner) return;
    if (isError) {
      banner.textContent = message;
      banner.hidden = false;
    } else {
      banner.textContent = '';
      banner.hidden = true;
    }
  }

  async function revalidate() {
    if (isRevalidating || activeMutations > 0) return;
    // Don't revalidate during preview modes
    if (new URLSearchParams(location.search).get('state')) return;

    const startedAt = revision;
    isRevalidating = true;
    try {
      const [discList, taskList] = await Promise.all([
        app.api.disciplines.list(),
        app.api.tasks.list(),
      ]);
      // A mutation started or finished while the request was in flight; its
      // response is older than the optimistic state.
      if (startedAt !== revision || activeMutations > 0) return;
      setDisciplines(discList);
      tasks = taskList.map(normalizeTask);
      publish();
    } catch {
      // Revalidation silently fails on transient network drops
    } finally {
      isRevalidating = false;
    }
  }

  async function init() {
    const requested = new URLSearchParams(location.search).get('state');
    if (requested === 'first-run') {
      // Even an empty preview needs real discipline ids for its add form.
      try {
        setDisciplines(await app.api.disciplines.list());
      } catch (err) {
        notifyStatus(err.message || 'Не вдалося завантажити дисципліни.', true);
      }
      tasks = [];
      publish();
      return;
    }

    try {
      const [discList, taskList] = await Promise.all([
        app.api.disciplines.list(),
        app.api.tasks.list(),
      ]);
      setDisciplines(discList);
      tasks = taskList.map(normalizeTask);
      publish();
    } catch (err) {
      // No local demo fallback: the server is the only source of truth.
      notifyStatus(
        err.isOffline
          ? 'Відсутнє підключення до мережі. Перевірте зв’язок.'
          : (err.message || 'Не вдалося завантажити дані із сервера.'),
        true
      );
    }

    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') revalidate();
    });
  }

  function beginMutation() {
    activeMutations += 1;
    revision += 1;
  }

  function endMutation() {
    activeMutations = Math.max(0, activeMutations - 1);
    revision += 1;
  }

  function upsert(raw) {
    const next = normalizeTask(raw);
    const idx = tasks.findIndex(t => t.id === next.id);
    if (idx === -1) tasks.push(next);
    else tasks[idx] = next;
    return next;
  }

  function isBusy(id) {
    return busy.has(id);
  }

  async function add(values) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tempTask = normalizeTask({
      id: tempId,
      title: values.title,
      description: values.description || '',
      disciplineId: values.disciplineId,
      deadline: values.deadline,
      done: false,
      completedAt: null,
      pending: true,
    });

    tasks.push(tempTask);
    publish();

    beginMutation();
    try {
      const created = await app.api.tasks.create({
        title: values.title,
        description: values.description || null,
        disciplineId: values.disciplineId,
        deadline: values.deadline,
      });

      app.render?.remap?.(tempId, created.id);
      tasks = tasks.filter(t => t.id !== tempId);
      upsert(created);
      publish();
      notifyStatus('Завдання успішно додано.');
      return created.id;
    } catch (err) {
      // Rollback optimistic add
      tasks = tasks.filter(t => t.id !== tempId);
      publish();
      notifyStatus(`Не вдалося додати завдання: ${err.message || 'помилка сервера'}`, true);
      throw err;
    } finally {
      endMutation();
    }
  }

  async function update(id, values) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return false;

    const previous = { ...tasks[idx] };
    tasks[idx] = { ...previous, ...values };
    busy.add(id);
    publish();

    beginMutation();
    try {
      const updated = await app.api.tasks.update(id, {
        title: values.title !== undefined ? values.title : undefined,
        description: values.description !== undefined ? (values.description || null) : undefined,
        disciplineId: values.disciplineId !== undefined ? values.disciplineId : undefined,
        deadline: values.deadline !== undefined ? values.deadline : undefined,
        done: values.done !== undefined ? values.done : undefined,
      });

      busy.delete(id);
      upsert(updated);
      publish();
      notifyStatus('Зміни збережено.');
      return true;
    } catch (err) {
      // Rollback optimistic update
      busy.delete(id);
      const currentIdx = tasks.findIndex(t => t.id === id);
      if (currentIdx !== -1) {
        tasks[currentIdx] = previous;
      }
      publish();
      notifyStatus(`Не вдалося зберегти зміни: ${err.message || 'помилка сервера'}`, true);
      throw err;
    } finally {
      endMutation();
    }
  }

  async function remove(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    beginMutation();
    const removalAnimation = app.render?.animateRemoval?.(id) || Promise.resolve();
    try {
      await Promise.all([app.api.tasks.remove(id), removalAnimation]);
      tasks = tasks.filter(t => t.id !== id);
      app.render?.finalizeRemoval?.(id);
      publish();
      notifyStatus('Завдання видалено.');
    } catch (err) {
      // Keep the task and restore its card if the delete request failed.
      app.render?.cancelRemoval?.(id);
      publish();
      notifyStatus(`Не вдалося видалити завдання: ${err.message || 'помилка сервера'}`, true);
      throw err;
    } finally {
      endMutation();
    }
  }

  async function toggle(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const previousDone = task.done;
    const previousCompleted = task.completedAt;
    const nextDone = !previousDone;

    task.done = nextDone;
    task.completedAt = nextDone ? new Date().toISOString() : null;
    busy.add(id);
    publish();

    beginMutation();
    try {
      const updated = await app.api.tasks.update(id, { done: nextDone });
      busy.delete(id);
      const current = tasks.find(t => t.id === id);
      if (current) {
        current.done = updated.done;
        current.completedAt = updated.completedAt;
      }
      publish();
    } catch (err) {
      // Rollback optimistic toggle
      busy.delete(id);
      const current = tasks.find(t => t.id === id);
      if (current) {
        current.done = previousDone;
        current.completedAt = previousCompleted;
      }
      if (app.render && typeof app.render.cancel === 'function') {
        app.render.cancel(id);
      }
      publish();
      notifyStatus(`Не вдалося оновити статус завдання: ${err.message || 'помилка сервера'}`, true);
    } finally {
      endMutation();
    }
  }

  async function createDiscipline(name, colorIndex) {
    const created = await app.api.disciplines.create({ name, colorIndex });
    disciplines.push(created);
    disciplinesMap[created.id] = created.name;
    disciplinesColorsMap[created.id] = getColorClass(created.colorIndex);
    if (app.selects && typeof app.selects.updateDisciplines === 'function') {
      app.selects.updateDisciplines(disciplines);
    }
    return created;
  }

  function replace(values) {
    if (!Array.isArray(values)) return;
    tasks = values.map(normalizeTask);
    publish();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getTaskState(task, today = (app.dates ? app.dates.today() : new Date())) {
    if (task.done) return 'done';
    const group = app.dates ? app.dates.group(task.deadline, today) : 'later';
    return group === 'week' ? 'soon' : group;
  }

  app.tasks = {
    init,
    all,
    add,
    update,
    remove,
    toggle,
    replace,
    subscribe,
    isTask,
    isBusy,
    disciplines: disciplinesProxy,
    getDisciplineName,
    getDisciplineColor,
    getColorClass,
    getDisciplinesList,
    setDisciplines,
    createDiscipline,
    getTaskState,
  };
})();

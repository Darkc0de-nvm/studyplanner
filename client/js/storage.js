(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  // The only persisted client preference. Tasks, users and credentials live
  // on the server and are never mirrored into localStorage.
  const UI_KEY = 'studyplanner.ui.v1';
  const LEGACY_KEYS = [
    'studyplanner.tasks',
    'studyplanner.tasks.v2',
    'studyplanner.tasks.v1',
    'studyplanner.settings.v1',
    'studyplanner.user.v1',
  ];

  // Visual QA states are read-only overrides; they must not overwrite the
  // preference of a real user browsing the app.
  let preview = null;

  try {
    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  } catch {
    // localStorage can be unavailable (private mode, blocked cookies).
  }

  function readStored() {
    try {
      const raw = localStorage.getItem(UI_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return { showDone: Boolean(parsed && parsed.showDone === true) };
    } catch {
      return { showDone: false };
    }
  }

  function loadSettings() {
    const stored = readStored();
    return {
      discipline: preview ? preview.discipline : '0',
      showDone: preview ? preview.showDone : stored.showDone,
    };
  }

  function saveSettings(settings) {
    if (preview) return false;
    const next = { showDone: Boolean(settings && settings.showDone === true) };
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  function setPreview(state, discipline = '3') {
    if (!state) return;
    preview = {
      discipline: state === 'filter' ? String(discipline) : '0',
      showDone: state === 'done',
    };
  }

  function isSettingsChange(event) {
    return event.key === null || event.key === UI_KEY;
  }

  function reset() {
    saveSettings({});
    if (app.filters) app.filters.reset();
  }

  app.storage = {
    loadSettings,
    saveSettings,
    setPreview,
    isSettingsChange,
    reset,
  };
})();

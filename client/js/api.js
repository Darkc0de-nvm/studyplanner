(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  const BASE_URL = '/api';
  const TIMEOUT_MS = 15000;

  class ApiError extends Error {
    constructor(status, code, message, fields) {
      super(message || 'Помилка взаємодії з сервером.');
      this.name = 'ApiError';
      this.status = status;
      this.code = code || 'API_ERROR';
      this.fields = fields || null;
      this.isOffline = code === 'OFFLINE' || status === 0;
    }
  }

  function getSafeNextPath() {
    const path = location.pathname + location.search + location.hash;
    // Same-origin absolute path only; schemes and protocol-relative URLs
    // cannot be produced because the value must start with a single slash.
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      return '/tasks.html';
    }
    return path;
  }

  async function request(path, options = {}) {
    const url = path.startsWith('/api') ? path : `${BASE_URL}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || TIMEOUT_MS);

    const headers = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    let body = options.body;
    if (body !== undefined && typeof body !== 'string' && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    } else if (body && typeof body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body,
        credentials: 'same-origin',
        signal: controller.signal,
      });

      clearTimeout(timer);

      // 204 No Content
      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text };
      }

      if (!response.ok) {
        const errObj = (data && data.error) ? data.error : (data || {});
        const code = errObj.code || `HTTP_${response.status}`;
        const message = errObj.message || (response.status === 500
          ? 'Внутрішня помилка сервера. Спробуйте пізніше.'
          : 'Помилка запиту до сервера.');
        const fields = errObj.fields || null;

        // Auto-redirect to login on 401 when on protected pages
        if (response.status === 401 && !options.skipAuthRedirect) {
          const currentPage = (document.body && document.body.dataset.page) || '';
          if (currentPage === 'tasks' || currentPage === 'calendar') {
            const next = encodeURIComponent(getSafeNextPath());
            location.replace(`login.html?next=${next}`);
          }
        }

        throw new ApiError(response.status, code, message, fields);
      }

      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ApiError) throw err;

      if (err.name === 'AbortError') {
        throw new ApiError(0, 'TIMEOUT', 'Час очікування відповіді сервера вичерпано. Перевірте з’єднання.');
      }

      const isNetwork = !navigator.onLine || err.message === 'Failed to fetch' || err.name === 'TypeError';
      if (isNetwork) {
        throw new ApiError(0, 'OFFLINE', 'Відсутнє підключення до мережі. Перевірте зв’язок.');
      }

      throw new ApiError(0, 'CLIENT_ERROR', err.message || 'Не вдалося виконати запит.');
    }
  }

  const api = {
    request,
    ApiError,

    auth: {
      async me() {
        const data = await request('/auth/me', { skipAuthRedirect: true });
        return data.user;
      },
      async login(credentials) {
        const data = await request('/auth/login', {
          method: 'POST',
          body: credentials,
          skipAuthRedirect: true,
        });
        return data.user;
      },
      async register(userData) {
        const data = await request('/auth/register', {
          method: 'POST',
          body: userData,
          skipAuthRedirect: true,
        });
        return data.user;
      },
      async logout() {
        await request('/auth/logout', {
          method: 'POST',
          body: {},
          skipAuthRedirect: true,
        });
      },
    },

    tasks: {
      async list(filters = {}) {
        const params = new URLSearchParams();
        if (filters.q) params.set('q', filters.q);
        if (filters.discipline && filters.discipline !== '0') params.set('discipline', filters.discipline);
        if (filters.done !== undefined && filters.done !== null) params.set('done', String(filters.done));
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);

        const qs = params.toString();
        const data = await request(`/tasks${qs ? `?${qs}` : ''}`);
        return data.tasks || [];
      },
      async get(id) {
        const data = await request(`/tasks/${id}`);
        return data.task;
      },
      async create(taskData) {
        const data = await request('/tasks', {
          method: 'POST',
          body: taskData,
        });
        return data.task;
      },
      async update(id, taskData) {
        const data = await request(`/tasks/${id}`, {
          method: 'PATCH',
          body: taskData,
        });
        return data.task;
      },
      async remove(id) {
        await request(`/tasks/${id}`, {
          method: 'DELETE',
          body: {},
        });
      },
    },

    disciplines: {
      async list() {
        const data = await request('/disciplines');
        return data.disciplines || [];
      },
      async create(disciplineData) {
        const data = await request('/disciplines', {
          method: 'POST',
          body: disciplineData,
        });
        return data.discipline;
      },
      async remove(id) {
        await request(`/disciplines/${id}`, {
          method: 'DELETE',
          body: {},
        });
      },
    },

    account: {
      async deleteAccount(password) {
        await request('/account/delete', {
          method: 'POST',
          body: { password },
          skipAuthRedirect: true,
        });
      },
      async changePassword(currentPassword, newPassword) {
        await request('/account/password', {
          method: 'POST',
          body: { currentPassword, newPassword },
          skipAuthRedirect: true,
        });
      },
    },

    health: {
      async check() {
        return request('/health', { skipAuthRedirect: true });
      },
    },
  };

  app.api = api;
})();

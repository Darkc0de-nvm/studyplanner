(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  const SELECTOR = {
    form: '[data-auth-form]',
    toggle: '[data-password-toggle]',
    error: '[data-auth-error]',
    status: '[data-form-status]',
    submit: 'button[type="submit"]',
    name: '.user-menu strong',
    email: '.user-menu .muted',
    avatar: '.user-menu .avatar',
    logout: '[data-action="logout"], .user-menu a[href="login.html"], .user-menu a[href="#logout"]',
  };

  const CLASS = {
    error: 'field--error',
  };

  function normalizeNext(candidate) {
    if (!candidate || candidate.includes('\\')) return '';
    try {
      const url = new URL(candidate, location.origin);
      if (url.origin !== location.origin) return '';
      return url.pathname + url.search + url.hash;
    } catch {
      return '';
    }
  }

  function isAuthPage(value) {
    const name = value.split(/[?#]/)[0].split('/').pop() || '';
    return name.startsWith('login') || name.startsWith('register');
  }

  function getSafeNextPath() {
    const requested = normalizeNext(new URLSearchParams(location.search).get('next'));
    if (requested && !isAuthPage(requested)) return requested;
    const filename = location.pathname.split('/').pop() || 'tasks.html';
    if (isAuthPage(filename)) return 'tasks.html';
    return normalizeNext(filename + location.search + location.hash) || 'tasks.html';
  }

  function showFieldError(form, fieldName, message) {
    const input = form.querySelector(`#${fieldName}`) || form.elements[fieldName];
    if (!input) return;
    const field = input.closest('.field');
    if (field) {
      field.classList.add(CLASS.error);
      const feedback = field.querySelector('.field__error');
      if (feedback) {
        feedback.textContent = message;
        feedback.setAttribute('aria-live', 'polite');
      }
    }
    input.setAttribute('aria-invalid', 'true');
    input.setCustomValidity(message);
  }

  async function submit(form) {
    const button = form.querySelector(SELECTOR.submit);
    if (!button || button.disabled) return;
    const isRegister = form.dataset.authForm === 'register';
    const acceptedTerms = form.querySelector('#acceptedTerms');
    if (isRegister && acceptedTerms && !acceptedTerms.checked) {
      const field = acceptedTerms.closest('.field');
      const feedback = field?.querySelector('.field__error');
      field?.classList.add(CLASS.error);
      if (feedback) feedback.textContent = 'Щоб створити акаунт, потрібно погодитися з умовами';
      acceptedTerms.setAttribute('aria-invalid', 'true');
      acceptedTerms.focus();
      return;
    }
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Зачекайте...';

    const status = form.querySelector(SELECTOR.status);
    const errorBanner = document.querySelector(SELECTOR.error);
    if (errorBanner) errorBanner.hidden = true;

    try {
      const email = form.querySelector('#email').value.trim().toLowerCase();
      const password = form.querySelector('#password').value;

      if (isRegister) {
        const name = form.querySelector('#name').value.trim();
        await app.api.auth.register({ name, email, password, acceptedTerms: acceptedTerms.checked });
      } else {
        await app.api.auth.login({ email, password });
      }

      if (status) status.textContent = 'Успішно! Переходимо до завдань...';
      location.replace(getSafeNextPath());
    } catch (err) {
      button.disabled = false;
      button.textContent = originalText;

      if (err.status === 401 || err.code === 'INVALID_CREDENTIALS') {
        if (errorBanner) {
          errorBanner.hidden = false;
          const p = errorBanner.querySelector('p');
          if (p) p.textContent = 'Невірна пошта або пароль';
        }
        if (status) status.textContent = 'Не вдалося увійти. Перевірте дані та спробуйте ще раз.';
        const emailInput = form.querySelector('#email');
        if (emailInput) emailInput.focus();
      } else if (err.status === 409 || err.code === 'EMAIL_EXISTS') {
        showFieldError(form, 'email', err.message || 'Користувач із цією поштою вже існує');
        if (status) status.textContent = 'Користувач із цією поштою вже існує';
        const emailInput = form.querySelector('#email');
        if (emailInput) emailInput.focus();
      } else if (err.fields) {
        Object.entries(err.fields).forEach(([fName, fMsg]) => {
          if (fName === 'acceptedTerms') {
            const checkbox = form.querySelector('#acceptedTerms');
            const field = checkbox?.closest('.field');
            const feedback = field?.querySelector('.field__error');
            field?.classList.add(CLASS.error);
            if (feedback) feedback.textContent = fMsg;
            if (checkbox) {
              checkbox.setAttribute('aria-invalid', 'true');
              checkbox.focus();
            }
            return;
          }
          showFieldError(form, fName, fMsg);
        });
        if (status) status.textContent = 'Перевірте позначені поля';
        const first = form.querySelector('.field--error input, .field--error textarea');
        if (first) first.focus();
      } else {
        const msg = err.message || 'Помилка взаємодії з сервером. Спробуйте пізніше.';
        if (status) status.textContent = msg;
        if (errorBanner) {
          errorBanner.hidden = false;
          const p = errorBanner.querySelector('p');
          if (p) p.textContent = msg;
        }
      }
    }
  }

  function init(preview) {
    const consent = document.getElementById('acceptedTerms');
    if (consent) {
      consent.addEventListener('change', () => {
        const field = consent.closest('.field');
        const feedback = field?.querySelector('.field__error');
        if (consent.checked) {
          if (feedback) feedback.textContent = '';
          field?.classList.remove(CLASS.error);
          consent.removeAttribute('aria-invalid');
        }
      });
      consent.closest('label')?.addEventListener('click', event => {
        if (event.target.closest('a')) event.stopPropagation();
      });
    }
    // Auth pages are also reachable while a session is active. The brand
    // should take signed-in users back to their planner, while guests go home.
    document.querySelectorAll('.brand').forEach(brand => {
      brand.addEventListener('click', async event => {
        event.preventDefault();
        try {
          await app.api.auth.me();
          location.assign('tasks.html');
        } catch {
          location.assign('index.html');
        }
      });
    });

    document.querySelectorAll(SELECTOR.toggle).forEach(button => {
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => {
        const input = document.getElementById(button.getAttribute('aria-controls'));
        if (!input) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(visible));
        button.setAttribute('aria-label', visible ? 'Сховати пароль' : 'Показати пароль');
        const iconUse = button.querySelector('use');
        if (iconUse) {
          iconUse.setAttribute('href', visible ? '#icon-eye-off' : '#icon-eye');
        }
        input.focus({ preventScroll: true });
        input.setSelectionRange(start, end);
      });
    });

    if (preview === 'error') {
      const form = document.querySelector(SELECTOR.form);
      if (!form) return;
      if (form.dataset.authForm === 'login') {
        const emailEl = form.querySelector('#email');
        const passEl = form.querySelector('#password');
        if (emailEl) emailEl.value = 'student@example.com';
        if (passEl) passEl.value = 'example123';
        const err = document.querySelector(SELECTOR.error);
        if (err) err.hidden = false;
      } else {
        const emailEl = form.querySelector('#email');
        if (emailEl) emailEl.value = 'student@example';
        if (app.forms && typeof app.forms.validate === 'function') {
          app.forms.validate(form, false);
        }
      }
    }
  }

  function profile(user) {
    if (!user) return;
    const menu = document.querySelector('.user-menu');
    const nameEl = document.querySelector(SELECTOR.name);
    const emailEl = document.querySelector(SELECTOR.email);
    const avatarEl = document.querySelector(SELECTOR.avatar);

    if (nameEl && user.name) nameEl.textContent = user.name;
    if (emailEl && user.email) emailEl.textContent = user.email;
    if (avatarEl && user.name) {
      const initials = user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toLocaleUpperCase('uk');
      avatarEl.textContent = initials || 'СП';
    }
    if (menu) menu.hidden = false;

    // Attach real logout
    const logoutElements = document.querySelectorAll(SELECTOR.logout);
    logoutElements.forEach(element => {
      if (element.dataset.boundLogout) return;
      element.dataset.boundLogout = 'true';
      element.addEventListener('click', async event => {
        event.preventDefault();
        try {
          await app.api.auth.logout();
        } catch {
          // Ignore logout error and redirect anyway
        }
        location.replace('index.html');
      });
    });
  }

  async function requireAuth() {
    try {
      const user = await app.api.auth.me();
      profile(user);
      return user;
    } catch (err) {
      // A network failure is not an authentication failure: keep the shell
      // on screen and let the offline banner explain what happened.
      if (err && (err.isOffline || err.status === 0)) throw err;
      const current = encodeURIComponent(getSafeNextPath());
      location.replace(`login.html?next=${current}`);
      throw err;
    }
  }

  app.auth = {
    init,
    submit,
    profile,
    requireAuth,
    getSafeNextPath,
  };
})();

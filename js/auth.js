(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { form: '[data-auth-form]', toggle: '[data-password-toggle]', error: '[data-auth-error]', status: '[data-form-status]', submit: 'button[type="submit"]', name: '.user-menu strong', email: '.user-menu .muted', avatar: '.user-menu .avatar' };
  const DEMO = { name: 'Олена Коваль', email: 'olena.koval@example.com', password: 'Study2026!' };

  async function digest(value) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function submit(form) {
    const button = form.querySelector(SELECTOR.submit);
    if (button.disabled) return;
    button.disabled = true;
    const status = form.querySelector(SELECTOR.status);
    try {
      const email = form.querySelector('#email').value.trim().toLocaleLowerCase('uk');
      const passwordDigest = await digest(form.querySelector('#password').value);
      let user;
      if (form.dataset.authForm === 'register') user = { name: form.querySelector('#name').value.trim(), email, passwordDigest };
      else {
        const stored = app.storage.loadUser();
        const demo = { name: DEMO.name, email: DEMO.email, passwordDigest: await digest(DEMO.password) };
        user = [stored, demo].find(candidate => candidate && candidate.email === email && candidate.passwordDigest === passwordDigest);
        if (!user) {
          document.querySelector(SELECTOR.error).hidden = false;
          status.textContent = 'Не вдалося увійти. Перевірте дані та спробуйте ще раз.';
          form.querySelector('#email').focus();
          return;
        }
      }
      app.storage.saveUser(user);
      status.textContent = 'Успішно! Відкриваємо завдання';
      location.href = 'tasks.html';
    } catch {
      status.textContent = 'Не вдалося завершити вхід. Спробуйте ще раз';
    } finally {
      button.disabled = false;
    }
  }

  function init(preview) {
    document.querySelectorAll(SELECTOR.toggle).forEach(button => button.addEventListener('click', () => {
      const input = document.getElementById(button.getAttribute('aria-controls'));
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', visible ? 'Приховати пароль' : 'Показати пароль');
    }));
    if (preview !== 'error') return;
    const form = document.querySelector(SELECTOR.form);
    if (form.dataset.authForm === 'login') {
      form.querySelector('#email').value = 'student@example.com';
      form.querySelector('#password').value = 'example123';
      document.querySelector(SELECTOR.error).hidden = false;
    } else {
      form.querySelector('#email').value = 'student@example';
      app.forms.validate(form, false);
    }
  }

  function profile() {
    const user = app.storage.loadUser();
    if (!user || !document.querySelector(SELECTOR.name)) return;
    document.querySelector(SELECTOR.name).textContent = user.name;
    document.querySelector(SELECTOR.email).textContent = user.email;
    document.querySelector(SELECTOR.avatar).textContent = user.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('uk');
  }

  app.auth = { init, submit, profile };
})();

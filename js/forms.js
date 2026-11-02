(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { forms: '[data-task-form], [data-auth-form]', add: '[data-task-form="add"]', edit: '[data-task-form="edit"]', select: '.form-select', field: '.field', error: '.field__error', control: 'input, textarea', radio: 'input[type="radio"]', counter: '[data-description-counter]', status: '[data-form-status]' };
  const CLASS = { error: 'field--error', controlError: 'field__control--error', hidden: 'visually-hidden' };
  const LIMIT = { titleMin: 3, titleMax: 100, description: 500, password: 8, name: 2 };
  const touched = new WeakSet();
  let editingId = null;

  function controls(form) {
    return [...form.querySelectorAll(SELECTOR.control)];
  }

  function message(control) {
    const value = control.value;
    if (control.name === 'disciplineId') return control.form.elements.disciplineId.value ? '' : 'Оберіть дисципліну у списку';
    if (control.name === 'title') {
      if (!value.trim()) return 'Вкажіть назву завдання';
      if (value.trim().length < LIMIT.titleMin) return 'Введіть назву від 3 до 100 символів';
      if (value.length > LIMIT.titleMax) return 'Назва має містити не більше 100 символів';
    }
    if (control.name === 'deadline' && !app.dates.parse(value)) return 'Вкажіть коректний дедлайн';
    if (control.name === 'description' && value.length > LIMIT.description) return 'Опис має містити не більше 500 символів';
    if (control.id === 'email' && (!value || control.validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return 'Вкажіть коректну адресу email';
    if (control.id === 'name') {
      if (!value.trim()) return 'Вкажіть ім’я';
      if (value.trim().length < LIMIT.name) return 'Ім’я має містити щонайменше 2 символи';
    }
    if (control.id === 'password' && value.length < LIMIT.password) return 'Пароль має містити щонайменше 8 символів.';
    if (control.id === 'password-repeat') {
      if (!value || value !== control.form.querySelector('#password').value) return 'Паролі не збігаються';
      if (value.length < LIMIT.password) return 'Пароль має містити щонайменше 8 символів.';
    }
    if (control.required && !value.trim()) return 'Заповніть це поле';
    return '';
  }

  function validateControl(control, reveal) {
    control.setCustomValidity('');
    const error = message(control);
    control.setCustomValidity(error);
    if (reveal) {
      const field = control.closest(SELECTOR.field);
      const feedback = field.querySelector(SELECTOR.error);
      field.classList.toggle(CLASS.error, Boolean(error));
      control.classList.remove(CLASS.controlError);
      control.setAttribute('aria-invalid', String(Boolean(error)));
      feedback.textContent = error;
      feedback.setAttribute('aria-live', 'polite');
    }
    return !error;
  }

  function counter(form) {
    const output = form.querySelector(SELECTOR.counter);
    if (!output) return;
    const length = form.elements.description.value.length;
    output.textContent = `${length} / ${LIMIT.description}`;
    output.classList.toggle(CLASS.hidden, length === 0);
  }

  function validate(form, focus = true) {
    controls(form).forEach(control => { touched.add(control); validateControl(control, true); });
    const valid = form.checkValidity();
    form.querySelector(SELECTOR.status).textContent = valid ? '' : 'Перевірте позначені поля';
    if (!valid && focus) {
      const first = controls(form).find(control => !control.validity.valid);
      if (first.type === 'radio') {
        const select = first.closest(SELECTOR.select);
        select.open = true;
        app.selects.sync(select);
      }
      first.focus();
    }
    return valid;
  }

  function clear(form) {
    controls(form).forEach(control => {
      touched.delete(control);
      control.setCustomValidity('');
      control.removeAttribute('aria-invalid');
      control.classList.remove(CLASS.controlError);
    });
    form.querySelectorAll(SELECTOR.field).forEach(field => field.classList.remove(CLASS.error));
    form.querySelector(SELECTOR.status).textContent = '';
  }

  function fill(task, deadline = '') {
    const form = document.querySelector(task ? SELECTOR.edit : SELECTOR.add);
    editingId = task?.id || null;
    form.reset();
    clear(form);
    form.elements.title.value = task?.title || '';
    form.elements.description.value = task?.description || '';
    form.elements.deadline.value = task?.deadline || deadline;
    form.querySelectorAll(SELECTOR.radio).forEach(radio => { radio.checked = radio.value === task?.disciplineId; });
    app.selects.sync(form.querySelector(SELECTOR.select));
    counter(form);
  }

  function saveTask(form) {
    const values = { title: form.elements.title.value.trim(), description: form.elements.description.value.trim(), disciplineId: form.elements.disciplineId.value, deadline: form.elements.deadline.value };
    const saved = form.dataset.taskForm === 'edit' ? app.tasks.update(editingId, values) : app.tasks.add(values);
    if (saved) app.modals.close();
  }

  function changed(event) {
    const control = event.target;
    if (!control.matches(SELECTOR.control)) return;
    if (control.type === 'radio') control.form.querySelectorAll(SELECTOR.radio).forEach(radio => validateControl(radio, touched.has(radio)));
    else validateControl(control, touched.has(control));
    const repeat = control.form.querySelector('#password-repeat');
    if (control.id === 'password' && repeat) validateControl(repeat, touched.has(repeat));
    counter(control.form);
  }

  function init() {
    document.querySelectorAll(SELECTOR.forms).forEach(form => {
      form.noValidate = true;
      form.addEventListener('input', changed);
      form.addEventListener('change', changed);
      form.addEventListener('blur', event => {
        if (!event.target.matches(SELECTOR.control)) return;
        touched.add(event.target);
        validateControl(event.target, true);
      }, true);
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!validate(form)) return;
        if (form.dataset.taskForm) saveTask(form);
        else app.auth.submit(form);
      });
      counter(form);
    });
  }

  app.forms = { init, fill, validate };
})();

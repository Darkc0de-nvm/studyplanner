(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  const SELECTOR = {
    forms: '[data-task-form], [data-auth-form], [data-discipline-form]',
    add: '[data-task-form="add"]',
    edit: '[data-task-form="edit"]',
    disciplineForm: '[data-discipline-form]',
    select: '.form-select',
    field: '.field',
    error: '.field__error',
    control: 'input, textarea',
    radio: 'input[type="radio"]',
    counter: '[data-description-counter]',
    status: '[data-form-status]',
  };

  const CLASS = {
    error: 'field--error',
    controlError: 'field__control--error',
    hidden: 'visually-hidden',
  };

  const LIMIT = {
    titleMin: 3,
    titleMax: 100,
    description: 500,
    password: 8,
    name: 2,
    disciplineMin: 2,
    disciplineMax: 100,
  };

  const touched = new WeakSet();
  const dirty = new WeakSet();
  let editingId = null;

  function controls(form) {
    return [...form.querySelectorAll(SELECTOR.control)];
  }

  function message(control) {
    const value = control.value;
    if (control.name === 'disciplineId') {
      return control.form.elements.disciplineId.value
        ? ''
        : 'Оберіть дисципліну у списку';
    }
    if (control.name === 'title') {
      if (!value.trim()) return 'Вкажіть назву завдання';
      if (value.trim().length < LIMIT.titleMin)
        return 'Введіть назву від 3 до 100 символів';
      if (value.length > LIMIT.titleMax)
        return 'Назва має містити не більше 100 символів';
    }
    if (control.name === 'deadline' && (!app.dates || !app.dates.parse(value))) {
      return 'Вкажіть коректний дедлайн';
    }
    if (control.name === 'description' && value.length > LIMIT.description) {
      return 'Опис має містити не більше 500 символів';
    }
    if (
      control.id === 'email' &&
      (!value ||
        control.validity.typeMismatch ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    ) {
      return 'Вкажіть коректну адресу email';
    }
    if (control.id === 'name') {
      if (!value.trim()) return 'Вкажіть ім’я';
      if (value.trim().length < LIMIT.name)
        return 'Ім’я має містити щонайменше 2 символи';
    }
    if (control.id === 'password' && value.length < LIMIT.password) {
      return 'Пароль має містити щонайменше 8 символів';
    }
    if (control.id === 'password-repeat') {
      const mainPass = control.form.querySelector('#password');
      if (!value || (mainPass && value !== mainPass.value))
        return 'Паролі не збігаються';
      if (value.length < LIMIT.password)
        return 'Пароль має містити щонайменше 8 символів';
    }
    if (control.name === 'disciplineName' || control.id === 'new-discipline-name') {
      if (!value.trim()) return 'Вкажіть назву дисципліни';
      if (value.trim().length < LIMIT.disciplineMin)
        return 'Назва дисципліни має містити щонайменше 2 символи';
      if (value.length > LIMIT.disciplineMax)
        return 'Назва дисципліни має містити не більше 100 символів';
    }
    if (control.required && !value.trim()) return 'Заповніть це поле';
    return '';
  }

  function validateControl(control, reveal) {
    control.setCustomValidity('');
    const error = message(control);
    control.setCustomValidity(error);
    if (reveal) {
      if (error) touched.add(control);
      const field = control.closest(SELECTOR.field);
      if (field) {
        const feedback = field.querySelector(SELECTOR.error);
        field.classList.toggle(CLASS.error, Boolean(error));
        control.classList.remove(CLASS.controlError);
        control.setAttribute('aria-invalid', String(Boolean(error)));
        if (feedback) {
          feedback.textContent = error;
          feedback.setAttribute('aria-live', 'polite');
        }
      }
    }
    return !error;
  }

  function counter(form) {
    const output = form.querySelector(SELECTOR.counter);
    if (!output || !form.elements.description) return;
    const length = form.elements.description.value.length;
    output.textContent = `${length} / ${LIMIT.description}`;
    output.classList.toggle(CLASS.hidden, length === 0);
  }

  function validate(form, focus = true) {
    controls(form).forEach(control => validateControl(control, true));
    const valid = form.checkValidity();
    const status = form.querySelector(SELECTOR.status);
    if (status) {
      status.textContent = valid ? '' : 'Перевірте позначені поля';
    }
    if (!valid && focus) {
      const first = controls(form).find(control => !control.validity.valid);
      if (first) {
        if (first.type === 'radio') {
          const select = first.closest(SELECTOR.select);
          if (select) {
            select.open = true;
            if (app.selects) app.selects.sync(select);
          }
        }
        first.focus();
      }
    }
    return valid;
  }

  function clear(form) {
    controls(form).forEach(control => {
      touched.delete(control);
      dirty.delete(control);
      control.setCustomValidity('');
      control.removeAttribute('aria-invalid');
      control.classList.remove(CLASS.controlError);
    });
    form.querySelectorAll(SELECTOR.field).forEach(field => field.classList.remove(CLASS.error));
    form.querySelectorAll(SELECTOR.error).forEach(error => {
      error.textContent = '';
    });
    const status = form.querySelector(SELECTOR.status);
    if (status) status.textContent = '';
  }

  function fill(task, deadline = '') {
    const form = document.querySelector(task ? SELECTOR.edit : SELECTOR.add);
    if (!form) return;
    editingId = task?.id || null;
    form.reset();
    clear(form);
    if (form.elements.title) form.elements.title.value = task?.title || '';
    if (form.elements.description) form.elements.description.value = task?.description || '';
    if (form.elements.deadline && app.dates) {
      form.elements.deadline.value = app.dates.format(task?.deadline || deadline);
    }
    form.querySelectorAll(SELECTOR.radio).forEach(radio => {
      radio.checked = radio.value === String(task?.disciplineId);
    });
    if (app.selects) app.selects.sync(form.querySelector(SELECTOR.select));
    counter(form);
  }

  async function saveTask(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Збереження...';
    }

    const values = {
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      disciplineId: form.elements.disciplineId.value,
      deadline: app.dates ? app.dates.toISO(app.dates.parse(form.elements.deadline.value)) : form.elements.deadline.value,
    };

    try {
      if (form.dataset.taskForm === 'edit') {
        await app.tasks.update(editingId, values);
      } else {
        await app.tasks.add(values);
      }
      if (app.modals) app.modals.close();
    } catch (err) {
      if (err.fields) {
        Object.entries(err.fields).forEach(([f, msg]) => {
          const control = form.elements[f];
          if (control) {
            const field = control.closest(SELECTOR.field);
            if (field) {
              field.classList.add(CLASS.error);
              const fb = field.querySelector(SELECTOR.error);
              if (fb) fb.textContent = msg;
            }
            control.setAttribute('aria-invalid', 'true');
          }
        });
      }
      const status = form.querySelector(SELECTOR.status);
      if (status) status.textContent = err.message || 'Не вдалося зберегти завдання.';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  async function saveDiscipline(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Створення...';
    }

    const input = form.querySelector('#new-discipline-name') || form.elements.disciplineName;
    const name = input ? input.value.trim() : '';

    try {
      const created = await app.tasks.createDiscipline(name);
      form.reset();
      clear(form);
      if (app.modals) app.modals.close();

      // Automatically select newly created discipline in open task form
      const openModal = document.querySelector('.modal--open');
      if (openModal) {
        const radio = openModal.querySelector(`input[name="disciplineId"][value="${created.id}"]`);
        if (radio) {
          radio.checked = true;
          if (app.selects) app.selects.sync(radio.closest(SELECTOR.select));
        }
      }
    } catch (err) {
      const status = form.querySelector(SELECTOR.status);
      const errorEl = form.querySelector('#new-discipline-name-error') || form.querySelector(SELECTOR.error);
      const msg = err.message || 'Не вдалося створити дисципліну.';
      if (errorEl) errorEl.textContent = msg;
      if (status) status.textContent = msg;
      const field = input?.closest(SELECTOR.field);
      if (field) field.classList.add(CLASS.error);
      if (input) input.setAttribute('aria-invalid', 'true');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  function changed(event) {
    const control = event.target;
    if (!control.matches(SELECTOR.control)) return;
    dirty.add(control);
    if (control.type === 'radio') {
      control.form
        .querySelectorAll(SELECTOR.radio)
        .forEach(radio => validateControl(radio, touched.has(radio)));
    } else {
      validateControl(control, touched.has(control));
    }
    const repeat = control.form.querySelector('#password-repeat');
    if (
      control.id === 'password' &&
      repeat &&
      (dirty.has(repeat) || touched.has(repeat))
    ) {
      validateControl(repeat, true);
    }
    counter(control.form);
  }

  function init() {
    document.querySelectorAll(SELECTOR.forms).forEach(form => {
      form.noValidate = true;
      form.addEventListener('input', changed);
      form.addEventListener('change', changed);
      form.addEventListener(
        'blur',
        event => {
          if (!event.target.matches(SELECTOR.control)) return;
          if (
            !touched.has(event.target) &&
            (!dirty.has(event.target) || !event.target.value.trim())
          )
            return;
          validateControl(event.target, true);
        },
        true
      );
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!validate(form)) return;
        if (form.dataset.taskForm) saveTask(form);
        else if (form.dataset.disciplineForm !== undefined) saveDiscipline(form);
        else if (app.auth) app.auth.submit(form);
      });
      counter(form);
    });
  }

  app.forms = {
    init,
    fill,
    validate,
    clear,
  };
})();

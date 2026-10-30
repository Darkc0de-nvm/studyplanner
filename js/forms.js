(() => {
  'use strict';

  const app = window.StudyPlanner;
  const SELECTOR = { form: '[data-task-form]', add: '[data-task-form="add"]', edit: '[data-task-form="edit"]', select: '.form-select', field: '.field', error: '.field__error', control: 'input, textarea', radio: 'input[type="radio"]' };
  const ERROR_CLASS = 'field--error';
  let editingId = null;

  function values(form) {
    return {
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      disciplineId: form.elements.disciplineId.value,
      deadline: form.elements.deadline.value
    };
  }

  function validate(form) {
    const title = form.elements.title;
    title.setCustomValidity(title.value.trim().length < 3 ? 'Введіть назву від 3 до 100 символів' : title.value.length > 100 ? 'Назва має містити не більше 100 символів' : '');
    const date = form.elements.deadline;
    date.setCustomValidity(app.dates.parse(date.value) ? '' : 'Вкажіть коректний дедлайн');
    const description = form.elements.description;
    description.setCustomValidity(description.value.length > 500 ? 'Опис має містити не більше 500 символів' : '');
    return form.checkValidity();
  }

  function fill(task, deadline = '') {
    const form = document.querySelector(task ? SELECTOR.edit : SELECTOR.add);
    editingId = task?.id || null;
    form.reset();
    form.querySelectorAll(SELECTOR.control).forEach(control => control.setCustomValidity(''));
    form.querySelectorAll(SELECTOR.field).forEach(field => field.classList.remove(ERROR_CLASS));
    form.elements.title.value = task?.title || '';
    form.elements.description.value = task?.description || '';
    form.elements.deadline.value = task?.deadline || deadline;
    form.querySelectorAll(SELECTOR.radio).forEach(radio => { radio.checked = radio.value === task?.disciplineId; });
    app.selects.sync(form.querySelector(SELECTOR.select));
  }

  function init() {
    document.querySelectorAll(SELECTOR.form).forEach(form => {
      form.noValidate = true;
      form.addEventListener('input', () => {
        form.querySelectorAll(SELECTOR.control).forEach(control => control.setCustomValidity(''));
      });
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!validate(form)) {
          const invalid = [...form.elements].find(control => control.willValidate && !control.validity.valid);
          if (invalid.type === 'radio') {
            const select = invalid.closest(SELECTOR.select);
            select.open = true;
            app.selects.sync(select);
          }
          invalid.focus();
          invalid.reportValidity();
          return;
        }
        const saved = form.dataset.taskForm === 'edit' ? app.tasks.update(editingId, values(form)) : app.tasks.add(values(form));
        if (saved) app.modals.close();
      });
    });
  }

  app.forms = { init, fill };
})();

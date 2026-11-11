(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  const SELECTOR = {
    menu: '.select, .user-menu',
    radio: 'input[type="radio"]',
    value: '[data-select-value]',
    summary: 'summary',
    filterSelect: '.app-filter .select__options',
    addSelect: '[data-task-form="add"] .select__options',
    editSelect: '[data-task-form="edit"] .select__options',
    legend: '.calendar-legend',
  };
  const EXPANDED = 'aria-expanded';

  function sync(menu) {
    if (!menu) return;
    const summary = menu.querySelector(SELECTOR.summary);
    if (summary) {
      summary.setAttribute(EXPANDED, String(menu.open));
    }
    const value = menu.querySelector(SELECTOR.value);
    if (!value) return;
    const selected = menu.querySelector(`${SELECTOR.radio}:checked`);
    if (selected && selected.labels && selected.labels[0]) {
      const span = selected.labels[0].querySelector('span');
      value.textContent = span ? span.textContent : 'Оберіть дисципліну';
    } else {
      value.textContent = 'Оберіть дисципліну';
    }
  }

  function close(except) {
    document.querySelectorAll(SELECTOR.menu).forEach(menu => {
      if (menu !== except) {
        menu.open = false;
        sync(menu);
      }
    });
  }

  function renderRadioOption(name, id, labelText, value, required = false, describedby = '') {
    const wrapper = document.createDocumentFragment();
    const input = document.createElement('input');
    input.type = 'radio';
    input.className = 'visually-hidden select__radio';
    input.name = name;
    input.value = value;
    input.id = id;
    if (required) input.required = true;
    if (describedby) input.setAttribute('aria-describedby', describedby);

    const label = document.createElement('label');
    label.className = 'select__option';
    label.htmlFor = id;

    const span = document.createElement('span');
    span.textContent = labelText;
    label.appendChild(span);

    // SVG check icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon select__check');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-check');
    svg.appendChild(use);
    label.appendChild(svg);

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    return wrapper;
  }

  function updateDisciplines(disciplinesList) {
    if (!Array.isArray(disciplinesList) || !disciplinesList.length) return;

    // 1. Filter dropdown
    const filterContainer = document.querySelector(SELECTOR.filterSelect);
    if (filterContainer) {
      const currentChecked = filterContainer.querySelector('input[type="radio"]:checked')?.value || '0';
      filterContainer.replaceChildren();

      // "All disciplines" option
      const allOption = renderRadioOption('discipline-filter', 'discipline-filter-all', 'Усі дисципліни', '0');
      filterContainer.appendChild(allOption);

      disciplinesList.forEach((d, idx) => {
        const option = renderRadioOption(
          'discipline-filter',
          `discipline-filter-${d.id || idx}`,
          d.name,
          String(d.id)
        );
        filterContainer.appendChild(option);
      });

      const toCheck = filterContainer.querySelector(`input[value="${currentChecked}"]`) || filterContainer.querySelector('input[value="0"]');
      if (toCheck) toCheck.checked = true;
      sync(filterContainer.closest('.select'));
    }

    // 2. Add task dropdown
    const addContainer = document.querySelector(SELECTOR.addSelect);
    if (addContainer) {
      const currentChecked = addContainer.querySelector('input[type="radio"]:checked')?.value;
      addContainer.replaceChildren();

      disciplinesList.forEach((d, idx) => {
        const option = renderRadioOption(
          'disciplineId',
          `add-task-discipline-${d.id || idx}`,
          d.name,
          String(d.id),
          true,
          'add-task-discipline-error'
        );
        addContainer.appendChild(option);
      });

      const newDisciplineLink = document.createElement('a');
      newDisciplineLink.className = 'select__option muted';
      newDisciplineLink.href = '#new-discipline';
      newDisciplineLink.textContent = '+ Нова дисципліна...';
      addContainer.appendChild(newDisciplineLink);

      if (currentChecked) {
        const toCheck = addContainer.querySelector(`input[value="${currentChecked}"]`);
        if (toCheck) toCheck.checked = true;
      }
      sync(addContainer.closest('.select'));
    }

    // 3. Edit task dropdown
    const editContainer = document.querySelector(SELECTOR.editSelect);
    if (editContainer) {
      const currentChecked = editContainer.querySelector('input[type="radio"]:checked')?.value;
      editContainer.replaceChildren();

      disciplinesList.forEach((d, idx) => {
        const option = renderRadioOption(
          'disciplineId',
          `edit-task-discipline-${d.id || idx}`,
          d.name,
          String(d.id),
          true,
          'edit-task-discipline-error'
        );
        editContainer.appendChild(option);
      });

      const newDisciplineLink = document.createElement('a');
      newDisciplineLink.className = 'select__option muted';
      newDisciplineLink.href = '#new-discipline';
      newDisciplineLink.textContent = '+ Нова дисципліна...';
      editContainer.appendChild(newDisciplineLink);

      if (currentChecked) {
        const toCheck = editContainer.querySelector(`input[value="${currentChecked}"]`);
        if (toCheck) toCheck.checked = true;
      }
      sync(editContainer.closest('.select'));
    }

    // 4. Calendar legend
    const legend = document.querySelector(SELECTOR.legend);
    if (legend) {
      legend.replaceChildren();
      disciplinesList.forEach(d => {
        const li = document.createElement('li');
        li.dataset.disciplineId = String(d.id);
        const dot = document.createElement('span');
        const color = app.tasks && app.tasks.getColorClass ? app.tasks.getColorClass(d.colorIndex) : 1;
        dot.className = `calendar-cell__dot calendar-cell__dot--${color}`;
        dot.textContent = ' ';
        li.appendChild(dot);
        li.appendChild(document.createTextNode(d.name));
        legend.appendChild(li);
      });
    }
  }

  function init() {
    document.querySelectorAll(SELECTOR.menu).forEach(menu => {
      sync(menu);
      menu.addEventListener('toggle', () => {
        if (menu.open) close(menu);
        sync(menu);
      });
      menu.addEventListener('change', event => {
        if (!event.target.matches(SELECTOR.radio)) return;
        menu.open = false;
        sync(menu);
        const summary = menu.querySelector(SELECTOR.summary);
        if (summary) summary.focus({ preventScroll: true });
      });
      menu.addEventListener('click', event => {
        if (event.target.closest('label') && event.target.closest('label').control?.checked) {
          menu.open = false;
          sync(menu);
        }
      });
    });

    document.addEventListener('click', event => close(event.target.closest(SELECTOR.menu)));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const opened = [...document.querySelectorAll(SELECTOR.menu)].find(menu => menu.open);
      if (!opened) return;
      event.preventDefault();
      close();
      const summary = opened.querySelector(SELECTOR.summary);
      if (summary) summary.focus({ preventScroll: true });
    });
  }

  app.selects = {
    init,
    sync,
    close,
    updateDisciplines,
  };
})();

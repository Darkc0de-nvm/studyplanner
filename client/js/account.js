(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  function init() {
    const deleteDialog = document.getElementById('delete-account-dialog');
    const deleteOpen = document.getElementById('btn-open-delete-modal');
    const deletePassword = document.getElementById('del-password');
    const deleteCancel = document.getElementById('del-cancel');
    const deleteConfirm = document.getElementById('del-confirm');
    const deleteError = document.getElementById('del-password-error');
    const changeDialog = document.getElementById('change-password-dialog');
    const changeOpen = document.getElementById('btn-open-password-modal');
    const changeForm = document.getElementById('change-password-form');
    const changeCancel = document.getElementById('password-cancel');
    const changeSave = document.getElementById('password-save');
    const changeError = document.getElementById('password-change-error');
    const currentPassword = document.getElementById('current-password');
    const newPassword = document.getElementById('new-password');
    const repeatPassword = document.getElementById('repeat-new-password');
    const accountCard = document.getElementById('account-data-card');
    const status = document.getElementById('delete-status');
    if (!deleteDialog || !deleteOpen || !changeDialog || !changeOpen) return;

    let busy = false;

    if (accountCard) accountCard.hidden = false;

    function setStatus(message, isError = false) {
      if (!status) return;
      status.textContent = message;
      status.hidden = !message;
      status.dataset.error = String(isError);
    }

    function setError(element, message) {
      if (element) element.textContent = message;
    }

    function resetDeleteDialog() {
      busy = false;
      deletePassword.value = '';
      deletePassword.type = 'password';
      deletePassword.closest('.field')?.classList.remove('field--error');
      deletePassword.removeAttribute('aria-invalid');
      setError(deleteError, '');
      deleteDialog.querySelectorAll('[data-password-toggle]').forEach(button => {
        button.disabled = false;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', 'Показати пароль');
        button.querySelector('use')?.setAttribute('href', '#icon-eye');
      });
      deleteDialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
      deleteConfirm.disabled = true;
      deleteConfirm.textContent = 'Видалити назавжди';
      deleteCancel.disabled = false;
    }

    function resetChangeDialog() {
      busy = false;
      [currentPassword, newPassword, repeatPassword].forEach(input => {
        input.value = '';
        input.type = 'password';
        input.disabled = false;
        input.removeAttribute('aria-invalid');
      });
      changeDialog.querySelectorAll('[data-password-toggle]').forEach(button => {
        button.disabled = false;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', 'Показати пароль');
        button.querySelector('use')?.setAttribute('href', '#icon-eye');
      });
      changeForm.querySelectorAll('.field--error').forEach(field => field.classList.remove('field--error'));
      setError(changeError, '');
      changeSave.disabled = true;
      changeSave.textContent = 'Зберегти';
      changeCancel.disabled = false;
    }

    function updateChangeValidity() {
      const valid = currentPassword.value.length > 0
        && newPassword.value.length >= 8
        && newPassword.value.length <= 128
        && repeatPassword.value.length > 0
        && newPassword.value === repeatPassword.value
        && newPassword.value !== currentPassword.value;
      changeSave.disabled = !valid || busy;
    }

    function bindPasswordToggles(dialog) {
      dialog.querySelectorAll('[data-password-toggle]').forEach(button => {
        button.addEventListener('click', () => {
          const input = document.getElementById(button.getAttribute('aria-controls'));
          if (!input) return;
          const visible = input.type === 'password';
          input.type = visible ? 'text' : 'password';
          button.setAttribute('aria-pressed', String(visible));
          button.setAttribute('aria-label', visible ? 'Сховати пароль' : 'Показати пароль');
          button.querySelector('use')?.setAttribute('href', visible ? '#icon-eye-off' : '#icon-eye');
          input.focus({ preventScroll: true });
        });
      });
    }

    deleteOpen.addEventListener('click', async () => {
      try {
        await app.api.auth.me();
        setStatus('');
        resetDeleteDialog();
        deleteDialog.showModal();
        deletePassword.focus();
      } catch {
        setStatus('Ви не авторизовані. Увійдіть в акаунт перед видаленням.', true);
      }
    });

    deletePassword.addEventListener('input', () => {
      deleteConfirm.disabled = !deletePassword.value.trim() || busy;
      deletePassword.closest('.field')?.classList.remove('field--error');
      deletePassword.removeAttribute('aria-invalid');
      setError(deleteError, '');
    });
    deletePassword.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !deleteConfirm.disabled) {
        event.preventDefault();
        deleteConfirm.click();
      }
    });
    deleteCancel.addEventListener('click', () => deleteDialog.close());
    deleteDialog.addEventListener('close', () => {
      resetDeleteDialog();
      deleteOpen.focus();
    });
    deleteDialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    deleteDialog.addEventListener('click', event => {
      if (event.target === deleteDialog && !busy) deleteDialog.close();
    });
    deleteConfirm.addEventListener('click', async () => {
      if (deleteConfirm.disabled || busy) return;
      busy = true;
      deleteConfirm.disabled = true;
      deleteConfirm.textContent = 'Перевіряємо…';
      deleteDialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
      deletePassword.disabled = true;
      try {
        await app.api.account.deleteAccount(deletePassword.value);
        location.replace('index.html?deleted=1');
      } catch (err) {
        busy = false;
        deletePassword.disabled = false;
        deleteDialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
        if (err.status === 403) {
          deletePassword.value = '';
          deletePassword.closest('.field')?.classList.add('field--error');
          deletePassword.setAttribute('aria-invalid', 'true');
          setError(deleteError, 'Невірний пароль');
          deleteConfirm.textContent = 'Видалити назавжди';
          deleteConfirm.disabled = true;
          deletePassword.focus();
          return;
        }
        deleteDialog.close();
        setStatus(`Не вдалося видалити дані: ${err.message || 'помилка сервера'}`, true);
      }
    });

    changeOpen.addEventListener('click', () => {
      setStatus('');
      resetChangeDialog();
      changeDialog.showModal();
      currentPassword.focus();
    });
    [currentPassword, newPassword, repeatPassword].forEach(input => {
      input.addEventListener('input', () => {
        input.removeAttribute('aria-invalid');
        input.closest('.field')?.classList.remove('field--error');
        setError(changeError, '');
        updateChangeValidity();
      });
    });
    changeCancel.addEventListener('click', () => changeDialog.close());
    changeDialog.addEventListener('close', () => {
      resetChangeDialog();
      changeOpen.focus();
    });
    changeDialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    changeDialog.addEventListener('click', event => {
      if (event.target === changeDialog && !busy) changeDialog.close();
    });
    changeForm.addEventListener('submit', async event => {
      event.preventDefault();
      updateChangeValidity();
      if (changeSave.disabled || busy) return;
      busy = true;
      changeSave.disabled = true;
      changeSave.textContent = 'Зберігаємо…';
      changeCancel.disabled = true;
      changeForm.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
      try {
        await app.api.account.changePassword(currentPassword.value, newPassword.value);
        changeDialog.close();
        setStatus('Пароль змінено');
      } catch (err) {
        busy = false;
        changeForm.querySelectorAll('input, button').forEach(control => { control.disabled = false; });
        changeCancel.disabled = false;
        changeSave.textContent = 'Зберегти';
        if (err.status === 403) {
          currentPassword.value = '';
          currentPassword.setAttribute('aria-invalid', 'true');
          currentPassword.closest('.field')?.classList.add('field--error');
          setError(changeError, 'Невірний поточний пароль');
          currentPassword.focus();
          updateChangeValidity();
        } else {
          setError(changeError, err.fields?.newPassword || err.message || 'Не вдалося змінити пароль.');
          updateChangeValidity();
        }
      }
    });

    bindPasswordToggles(deleteDialog);
    bindPasswordToggles(changeDialog);
  }

  app.account = { init };
})();

(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  const ID = {
    modal: 'delete-account-dialog',
    open: 'btn-open-delete-modal',
    close: 'del-close',
    cancel: 'del-cancel',
    confirm: 'del-confirm',
    backdrop: 'del-backdrop',
    status: 'delete-status',
  };
  const CLASS = { open: 'modal--open', error: 'legal-status--error' };

  function init() {
    const modal = document.getElementById(ID.modal);
    const openButton = document.getElementById(ID.open);
    if (!modal || !openButton) return;

    const closeButton = document.getElementById(ID.close);
    const cancelButton = document.getElementById(ID.cancel);
    const confirmButton = document.getElementById(ID.confirm);
    const backdrop = document.getElementById(ID.backdrop);
    const status = document.getElementById(ID.status);

    function setStatus(message, isError = false) {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle(CLASS.error, isError);
    }

    function openModal() {
      modal.hidden = false;
      modal.classList.add(CLASS.open);
      if (confirmButton) confirmButton.focus();
    }

    function closeModal() {
      modal.classList.remove(CLASS.open);
      modal.hidden = true;
      openButton.focus();
    }

    openButton.addEventListener('click', async () => {
      try {
        await app.api.auth.me();
        openModal();
      } catch {
        setStatus('Ви не авторизовані. Увійдіть в акаунт перед видаленням.', true);
      }
    });

    closeButton?.addEventListener('click', closeModal);
    cancelButton?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal.classList.contains(CLASS.open)) {
        event.preventDefault();
        closeModal();
      }
    });

    confirmButton?.addEventListener('click', async () => {
      confirmButton.disabled = true;
      confirmButton.textContent = 'Видалення...';
      try {
        await app.api.account.deleteAccount();
        location.replace('index.html?deleted=1');
      } catch (err) {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Так, видалити назавжди';
        closeModal();
        setStatus(`Не вдалося видалити дані: ${err.message || 'помилка сервера'}`, true);
      }
    });
  }

  app.account = { init };
})();

(() => {
  'use strict';

  window.StudyPlanner = window.StudyPlanner || {};
  const app = window.StudyPlanner;

  const ID = {
    modal: 'delete-account-dialog',
    open: 'btn-open-delete-modal',
    cancel: 'del-cancel',
    confirm: 'del-confirm',
    ack: 'del-ack',
    status: 'delete-status',
  };

  function init() {
    const modal = document.getElementById(ID.modal);
    const openButton = document.getElementById(ID.open);
    if (!modal || !openButton) return;
    const accountCard = document.getElementById('account-data-card');

    const cancelButton = document.getElementById(ID.cancel);
    const confirmButton = document.getElementById(ID.confirm);
    const ackCheckbox = document.getElementById(ID.ack);
    const status = document.getElementById(ID.status);
    let deleting = false;

    app.api.auth
      .me()
      .then(() => {
        if (accountCard) accountCard.hidden = false;
      })
      .catch(() => {
        if (accountCard) accountCard.hidden = true;
      });

    function setStatus(message, isError = false) {
      if (!status) return;
      status.textContent = message;
      status.hidden = !message;
      status.dataset.error = String(isError);
    }

    function resetDialog() {
      deleting = false;
      if (ackCheckbox) {
        ackCheckbox.checked = false;
        ackCheckbox.disabled = false;
      }
      if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Видалити назавжди';
      }
      if (cancelButton) cancelButton.disabled = false;
    }

    ackCheckbox?.addEventListener('change', () => {
      if (confirmButton) confirmButton.disabled = !ackCheckbox.checked;
    });

    openButton.addEventListener('click', async () => {
      try {
        await app.api.auth.me();
        setStatus('');
        modal.showModal();
        cancelButton?.focus();
      } catch {
        setStatus(
          'Ви не авторизовані. Увійдіть в акаунт перед видаленням.',
          true,
        );
      }
    });

    cancelButton?.addEventListener('click', () => modal.close());
    modal.addEventListener('close', () => {
      resetDialog();
      openButton.focus();
    });
    modal.addEventListener('cancel', event => {
      if (deleting) event.preventDefault();
    });
    modal.addEventListener('click', event => {
      if (event.target === modal && !deleting) modal.close();
    });

    confirmButton?.addEventListener('click', async () => {
      if (confirmButton.disabled || !ackCheckbox?.checked) return;
      deleting = true;
      confirmButton.disabled = true;
      confirmButton.textContent = 'Видаляємо…';
      if (cancelButton) cancelButton.disabled = true;
      if (ackCheckbox) ackCheckbox.disabled = true;
      try {
        await app.api.account.deleteAccount();
        location.replace('index.html?deleted=1');
      } catch (err) {
        modal.close();
        setStatus(
          `Не вдалося видалити дані: ${err.message || 'помилка сервера'}`,
          true,
        );
      }
    });
  }

  app.account = { init };
})();

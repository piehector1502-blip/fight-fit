// Small UI helpers shared by several pages.

/**
 * Delete buttons that need two taps: the first tap asks "Elimina?",
 * the second (within 3 s) runs onConfirm. Avoids deleting by mistake
 * without using blocking confirm() dialogs.
 */
export function twoTapDelete(button, onConfirm) {
  const original = button.textContent;
  button.addEventListener('click', async () => {
    if (!button.classList.contains('confirm')) {
      button.classList.add('confirm');
      button.textContent = 'Elimina?';
      setTimeout(() => {
        button.classList.remove('confirm');
        button.textContent = original;
      }, 3000);
      return;
    }
    await onConfirm();
  });
}

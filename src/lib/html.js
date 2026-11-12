/**
 * Escape user-typed text before putting it into innerHTML.
 * Without this, a note like "<img onerror=...>" would run as code.
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

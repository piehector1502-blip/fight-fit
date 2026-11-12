// Date helpers. We store days as 'YYYY-MM-DD' strings in LOCAL time:
// easy to compare/sort as text, and no timezone surprises
// (toISOString() would use UTC and could give "yesterday" after midnight).

/** Date -> 'YYYY-MM-DD' (local time). */
export function toISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' that is `days` days before `date`. */
export function daysAgo(days, date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

/** '2026-11-12' -> 'gio 12 nov' (or 'Oggi' / 'Ieri'). */
export function formatDay(iso, today = new Date()) {
  if (iso === toISODate(today)) return 'Oggi';
  if (iso === daysAgo(1, today)) return 'Ieri';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('it-CH', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

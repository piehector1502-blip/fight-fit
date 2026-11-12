// Workouts log: add a session (type, date, duration, intensity) with a
// calorie estimate from MET values, list past sessions, weekly totals.
import { db } from '../db.js';
import { WORKOUT_TYPES, INTENSITIES, estimateKcal } from '../lib/met.js';
import { toISODate, daysAgo, formatDay } from '../lib/dates.js';
import { escapeHtml } from '../lib/html.js';

// A pre-filled form coming from another page (e.g. the timer's
// "Salva come allenamento"). Used once, then cleared.
let draft = null;
export function setWorkoutDraft(d) {
  draft = d;
}

const HISTORY_DAYS = 60;
const round = (n) => Math.round(n).toLocaleString('it-CH');

export async function renderWorkouts(container) {
  const profile = await db.profile.get('me');
  const weightKg = profile.weightKg;

  const initial = {
    type: 'kumite', intensity: 'medium', durationMin: 60, notes: '', source: 'manual',
    ...draft, // values from the timer override the defaults
  };
  const fromTimer = draft != null;
  let source = initial.source; // 'timer' only for the first save after the timer
  draft = null;

  container.innerHTML = `
    <form id="workout-form" class="card form" novalidate>
      <h2>${fromTimer ? 'Salva la sessione del timer' : 'Nuovo allenamento'}</h2>
      <label>Tipo
        <select name="type">
          ${Object.entries(WORKOUT_TYPES)
            .map(([key, t]) => `<option value="${key}">${t.icon} ${t.label}</option>`).join('')}
        </select>
      </label>
      <div class="row">
        <label>Data<input type="date" name="date" max="${toISODate()}"></label>
        <label>Durata (min)<input type="number" name="durationMin" min="1" max="600" inputmode="numeric"></label>
      </div>
      <fieldset>
        <legend>Intensità</legend>
        <div class="segmented">
          ${Object.entries(INTENSITIES).map(([key, label]) => `
            <input type="radio" name="intensity" id="int-${key}" value="${key}">
            <label for="int-${key}">${label}</label>`).join('')}
        </div>
      </fieldset>
      <label>Note <span class="muted small">(facoltativo)</span>
        <input type="text" name="notes" maxlength="200" placeholder="es. sparring con Marco">
      </label>
      <p id="estimate" class="estimate"></p>
      <button type="submit" class="btn">Salva allenamento</button>
      <p id="status" class="muted small" aria-live="polite"></p>
    </form>

    <section class="card" id="week"></section>
    <section id="history"></section>
  `;

  const form = container.querySelector('#workout-form');
  const f = form.elements;
  f.type.value = initial.type;
  f.date.value = toISODate();
  f.durationMin.value = initial.durationMin;
  f.intensity.value = initial.intensity;
  f.notes.value = initial.notes;

  const read = () => ({
    type: f.type.value,
    date: f.date.value,
    durationMin: Number(f.durationMin.value),
    intensity: f.intensity.value,
    notes: f.notes.value.trim(),
  });

  const showEstimate = () => {
    const w = read();
    const el = container.querySelector('#estimate');
    if (!(w.durationMin > 0)) { el.textContent = ''; return; }
    const e = estimateKcal({ ...w, weightKg });
    el.innerHTML = `≈ <strong>${round(e.kcal)} kcal</strong>
      <span class="badge">stima</span>
      <span class="muted small">MET ${e.met} × ${weightKg} kg × ${(w.durationMin / 60).toFixed(2)} h</span>`;
  };
  form.addEventListener('input', showEstimate);
  showEstimate();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const w = read();
    const status = container.querySelector('#status');
    if (!w.date || w.date > toISODate()) { status.textContent = '⚠️ Data non valida.'; return; }
    if (!(w.durationMin >= 1 && w.durationMin <= 600)) { status.textContent = '⚠️ Durata tra 1 e 600 minuti.'; return; }

    // Save the estimate too: if your weight changes later, past sessions keep their value
    const est = estimateKcal({ ...w, weightKg });
    await db.workouts.add({
      ...w,
      met: est.met,
      weightKg,
      kcal: Math.round(est.kcal),
      netKcal: Math.round(est.netKcal),
      source,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    status.textContent = '✓ Salvato';
    f.notes.value = '';
    // Next saves from this form are normal manual entries
    source = 'manual';
    form.querySelector('h2').textContent = 'Nuovo allenamento';
    await showHistory(container);
  });

  await showHistory(container);
}

// --- History and weekly totals ----------------------------------------

async function showHistory(container) {
  // 'date' is indexed, so this query is fast
  const sessions = await db.workouts.where('date').aboveOrEqual(daysAgo(HISTORY_DAYS)).toArray();
  // Newest day first; inside a day, the last one added first
  sessions.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  // Last 7 days = today and the 6 days before
  const weekStart = daysAgo(6);
  const week = sessions.filter((s) => s.date >= weekStart);
  const sum = (arr, key) => arr.reduce((acc, s) => acc + s[key], 0);

  container.querySelector('#week').innerHTML = `
    <h2>Ultimi 7 giorni</h2>
    <div class="stats">
      <div><span class="stat">${week.length}</span><span class="muted small">sessioni</span></div>
      <div><span class="stat">${round(sum(week, 'durationMin'))}</span><span class="muted small">minuti</span></div>
      <div><span class="stat accent">${round(sum(week, 'kcal'))}</span><span class="muted small">kcal (stima)</span></div>
    </div>
  `;

  const history = container.querySelector('#history');
  if (sessions.length === 0) {
    history.innerHTML = `<section class="card"><p class="muted">Nessun allenamento registrato.</p></section>`;
    return;
  }

  // Group sessions by day: { '2026-11-12': [...], '2026-11-11': [...] }
  const byDay = {};
  for (const s of sessions) (byDay[s.date] ??= []).push(s);

  history.innerHTML = Object.entries(byDay).map(([day, list]) => `
    <section class="card">
      <h2 class="day-title">${formatDay(day)}
        <span class="muted small">${round(sum(list, 'kcal'))} kcal</span></h2>
      <ul class="sessions">
        ${list.map((s) => {
          const t = WORKOUT_TYPES[s.type] ?? { icon: '❓', label: s.type };
          return `
          <li>
            <span class="session-icon">${t.icon}</span>
            <div class="session-main">
              <strong>${t.label}</strong>
              <span class="muted small">${s.durationMin} min · ${INTENSITIES[s.intensity]} · ${s.kcal} kcal
                ${s.source === 'timer' ? ' · ⏱' : ''}</span>
              ${s.notes ? `<span class="small">${escapeHtml(s.notes)}</span>` : ''}
            </div>
            <button type="button" class="icon-btn" data-delete="${s.id}" aria-label="Elimina">✕</button>
          </li>`;
        }).join('')}
      </ul>
    </section>`).join('');

  // Delete needs two taps: the first one asks for confirmation
  history.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!btn.classList.contains('confirm')) {
        btn.classList.add('confirm');
        btn.textContent = 'Elimina?';
        setTimeout(() => { btn.classList.remove('confirm'); btn.textContent = '✕'; }, 3000);
        return;
      }
      await db.workouts.delete(Number(btn.dataset.delete));
      await showHistory(container);
    });
  });
}

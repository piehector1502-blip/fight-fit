// Round timer page: preset list + settings, then a full-screen run view.
import { db } from '../db.js';
import { buildPhases, totalMs, stateAt, cuesBetween, formatMs } from '../lib/timer.js';
import { unlockAudio, playCue, keepScreenOn, releaseScreen } from '../lib/feedback.js';

const DEFAULT_PRESETS = [
  { name: 'Kumite 3x2min', prepSec: 10, roundSec: 120, restSec: 60, rounds: 3 },
  { name: 'Sacco 5x3min',  prepSec: 10, roundSec: 180, restSec: 60, rounds: 5 },
  { name: 'Tabata 8x20s',  prepSec: 10, roundSec: 20,  restSec: 10, rounds: 8 },
];

const PHASE_LABELS = { prep: 'PREPARATI', round: 'ROUND', rest: 'PAUSA' };

// The running timer lives here (module scope), so leaving the page can stop it.
let run = null;

export async function renderTimer(container) {
  stopRun(); // if we come back to the page, never leave an old timer running

  // First time: add the default presets
  if ((await db.presets.count()) === 0) {
    const now = Date.now();
    await db.presets.bulkAdd(DEFAULT_PRESETS.map((p) => ({ ...p, updatedAt: now })));
  }
  const presets = await db.presets.orderBy('name').toArray();

  container.innerHTML = `
    <section class="card">
      <h2>Preset</h2>
      <div class="chips" id="presets">
        ${presets.map((p) => `
          <button type="button" class="chip" data-id="${p.id}">${escapeHtml(p.name)}</button>`).join('')}
      </div>
    </section>

    <form id="timer-form" class="card form" novalidate>
      <div class="row">
        <label>Round (min)<input type="number" name="roundMin" min="0" max="30" inputmode="numeric"></label>
        <label>Round (sec)<input type="number" name="roundS" min="0" max="59" inputmode="numeric"></label>
      </div>
      <div class="row">
        <label>Pausa (min)<input type="number" name="restMin" min="0" max="30" inputmode="numeric"></label>
        <label>Pausa (sec)<input type="number" name="restS" min="0" max="59" inputmode="numeric"></label>
      </div>
      <div class="row">
        <label>N° round<input type="number" name="rounds" min="1" max="50" inputmode="numeric"></label>
        <label>Preparazione (sec)<input type="number" name="prepSec" min="0" max="120" inputmode="numeric"></label>
      </div>
      <p id="total" class="muted small"></p>
      <button type="submit" class="btn btn-big">▶ Start</button>

      <details>
        <summary class="muted">Salva / elimina preset</summary>
        <div class="row" style="margin-top:10px">
          <input type="text" name="presetName" placeholder="Nome preset (es. Kumite 2x3min)">
          <button type="button" class="btn" id="save-preset">Salva</button>
        </div>
        <button type="button" class="btn btn-ghost" id="delete-preset" hidden>Elimina preset selezionato</button>
        <p id="preset-status" class="muted small" aria-live="polite"></p>
      </details>
    </form>
  `;

  const form = container.querySelector('#timer-form');
  let selectedId = null;

  const selectPreset = (p) => {
    selectedId = p.id;
    setConfig(form, p);
    form.elements.presetName.value = p.name;
    container.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', Number(c.dataset.id) === p.id));
    container.querySelector('#delete-preset').hidden = false;
    updateTotal(form);
  };
  selectPreset(presets[0]);

  container.querySelector('#presets').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) selectPreset(presets.find((p) => p.id === Number(chip.dataset.id)));
  });

  form.addEventListener('input', () => updateTotal(form));

  container.querySelector('#save-preset').addEventListener('click', async () => {
    const name = form.elements.presetName.value.trim();
    const status = container.querySelector('#preset-status');
    if (!name) { status.textContent = 'Scrivi un nome per il preset.'; return; }
    const cfg = getConfig(form);
    if (!isValid(cfg)) { status.textContent = 'Controlla i valori del timer.'; return; }
    // Same name = update that preset, otherwise create a new one
    const existing = await db.presets.where('name').equals(name).first();
    const preset = { ...cfg, name, updatedAt: Date.now() };
    if (existing) preset.id = existing.id; // keep the id -> put() replaces it
    await db.presets.put(preset);
    renderTimer(container); // redraw with the new list
  });

  container.querySelector('#delete-preset').addEventListener('click', async () => {
    if (selectedId == null) return;
    await db.presets.delete(selectedId);
    renderTimer(container);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cfg = getConfig(form);
    if (!isValid(cfg)) { container.querySelector('#total').textContent = '⚠️ Controlla i valori.'; return; }
    unlockAudio(); // must happen inside the tap, or the browser blocks sound
    startRun(container, cfg);
  });
}

// --- Config helpers ----------------------------------------------------

function setConfig(form, p) {
  const f = form.elements;
  f.roundMin.value = Math.floor(p.roundSec / 60);
  f.roundS.value = p.roundSec % 60;
  f.restMin.value = Math.floor(p.restSec / 60);
  f.restS.value = p.restSec % 60;
  f.rounds.value = p.rounds;
  f.prepSec.value = p.prepSec;
}

function getConfig(form) {
  const n = (name) => Number(form.elements[name].value) || 0;
  return {
    roundSec: n('roundMin') * 60 + n('roundS'),
    restSec: n('restMin') * 60 + n('restS'),
    rounds: n('rounds'),
    prepSec: n('prepSec'),
  };
}

const isValid = (c) => c.roundSec >= 5 && c.rounds >= 1 && c.rounds <= 50 && c.restSec >= 0 && c.prepSec >= 0;

function updateTotal(form) {
  const cfg = getConfig(form);
  form.querySelector('#total').textContent = isValid(cfg)
    ? `Durata totale: ${formatMs(totalMs(buildPhases(cfg)))}`
    : '';
}

// --- Running -----------------------------------------------------------

function startRun(container, cfg) {
  const phases = buildPhases(cfg);
  run = {
    phases,
    rounds: cfg.rounds,
    accumulatedMs: 0,           // time counted before the last pause
    startedAt: performance.now(), // when the current running stretch began
    paused: false,
    lastElapsed: -1,            // -1 so a round starting at 0 still beeps
    intervalId: null,
    container,
  };

  document.body.classList.add('timer-running'); // hides the tab bar
  container.innerHTML = `
    <section class="runner" id="runner">
      <div class="phase" id="phase"></div>
      <div class="clock" id="clock"></div>
      <div class="progress"><div id="bar"></div></div>
      <div class="muted" id="remaining"></div>
      <div class="row runner-buttons">
        <button type="button" class="btn btn-ghost" id="stop">■ Stop</button>
        <button type="button" class="btn" id="pause">❚❚ Pausa</button>
      </div>
    </section>
  `;

  container.querySelector('#pause').addEventListener('click', togglePause);
  container.querySelector('#stop').addEventListener('click', () => renderTimer(container));

  keepScreenOn();
  document.addEventListener('visibilitychange', onVisibility);
  // 100 ms is smooth enough; the real time comes from performance.now()
  run.intervalId = setInterval(tick, 100);
  tick();
}

function elapsedMs() {
  return run.accumulatedMs + (run.paused ? 0 : performance.now() - run.startedAt);
}

function tick() {
  if (!run) return;
  const now = elapsedMs();

  // Play every cue between the previous tick and now
  for (const cue of cuesBetween(run.phases, run.lastElapsed, now)) playCue(cue.type);
  run.lastElapsed = now;

  const s = stateAt(run.phases, now);
  const el = (id) => run.container.querySelector('#' + id);
  const runner = el('runner');

  if (s.done) {
    runner.dataset.phase = 'done';
    el('phase').textContent = 'FINITO 💪';
    el('clock').textContent = '0:00';
    el('bar').style.width = '100%';
    el('remaining').textContent = '';
    el('pause').hidden = true;
    el('stop').textContent = '↩ Indietro';
    clearInterval(run.intervalId);
    releaseScreen();
    return;
  }

  const { phase } = s;
  runner.dataset.phase = phase.type; // CSS changes colour per phase
  runner.classList.toggle('last10', phase.type === 'round' && s.remainingMs <= 10_000);
  el('phase').textContent =
    phase.type === 'round' ? `ROUND ${phase.round}/${run.rounds}`
    : phase.type === 'rest' ? `PAUSA · prossimo round ${phase.round + 1}/${run.rounds}`
    : PHASE_LABELS.prep;
  el('clock').textContent = formatMs(s.remainingMs);
  el('bar').style.width = `${(1 - s.remainingMs / phase.durationMs) * 100}%`;
  el('remaining').textContent = `Totale rimanente ${formatMs(s.totalRemainingMs)}`;
}

function togglePause() {
  const btn = run.container.querySelector('#pause');
  if (run.paused) {
    run.startedAt = performance.now();
    run.paused = false;
    btn.textContent = '❚❚ Pausa';
    keepScreenOn();
  } else {
    run.accumulatedMs = elapsedMs();
    run.paused = true;
    btn.textContent = '▶ Riprendi';
    releaseScreen();
  }
  tick();
}

/** The browser drops the wake lock when the app goes to background. */
function onVisibility() {
  if (run && !run.paused && document.visibilityState === 'visible') keepScreenOn();
}

/** Stop and clean up (also called by the router when you change tab). */
export function stopRun() {
  if (!run) return;
  clearInterval(run.intervalId);
  document.removeEventListener('visibilitychange', onVisibility);
  document.body.classList.remove('timer-running');
  releaseScreen();
  run = null;
}

/** Preset names are typed by the user: never put raw text into innerHTML. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

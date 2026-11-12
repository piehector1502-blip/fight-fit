// Profile page: form + live results (BMR, TDEE, calorie target).
import { db } from '../db.js';
import { ACTIVITY_LEVELS, PACES, computeProfile, ageFromBirthDate } from '../lib/calc.js';

const DEFAULTS = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  sex: 'male',
  birthDate: '',
  heightCm: '',
  weightKg: '',
  activity: 'moderate',
  goal: 'maintain',
  paceKgPerWeek: 0,
};

const GOAL_LABELS = { lose: 'Dimagrire', maintain: 'Mantenere', gain: 'Massa' };

/**
 * @param {HTMLElement} container
 * @param {{ onboarding?: boolean, onSaved?: () => void }} [options]
 *   onboarding: first launch (welcome text, "Inizia" button)
 *   onSaved: called after a successful save
 */
export async function renderProfile(container, { onboarding = false, onSaved } = {}) {
  // Load the saved profile (or defaults the first time).
  // Spread DEFAULTS first so profiles saved before new fields existed still work.
  const saved = { ...DEFAULTS, ...(await db.profile.get('me')) };

  container.innerHTML = `
    ${onboarding ? `
      <section class="card">
        <h2>Benvenuto in FightFit 👋</h2>
        <p class="muted">Inserisci i tuoi dati: servono per calcolare quante calorie ti servono
        ogni giorno. Restano salvati sul tuo telefono e puoi cambiarli quando vuoi dal tab Profilo.</p>
      </section>` : ''}

    <form id="profile-form" class="card form" novalidate>
      <h2>Account</h2>
      <div class="row">
        <label>Nome
          <input type="text" name="firstName" autocomplete="given-name" required>
        </label>
        <label>Cognome
          <input type="text" name="lastName" autocomplete="family-name" required>
        </label>
      </div>
      <label>Email
        <input type="email" name="email" autocomplete="email" inputmode="email" required>
      </label>
      <label>Telefono <span class="muted small">(facoltativo)</span>
        <input type="tel" name="phone" autocomplete="tel" inputmode="tel">
      </label>

      <h2>Dati fisici</h2>
      <fieldset>
        <legend>Sesso <span class="muted small">(per la formula)</span></legend>
        <div class="segmented">
          <input type="radio" name="sex" id="sex-m" value="male"><label for="sex-m">Uomo</label>
          <input type="radio" name="sex" id="sex-f" value="female"><label for="sex-f">Donna</label>
        </div>
      </fieldset>

      <label>Data di nascita
        <input type="date" name="birthDate" required>
      </label>

      <div class="row">
        <label>Altezza (cm)
          <input type="number" name="heightCm" inputmode="numeric" min="120" max="230" required>
        </label>
        <label>Peso (kg)
          <input type="number" name="weightKg" inputmode="decimal" step="0.1" min="30" max="250" required>
        </label>
      </div>

      <label>Livello di attività
        <select name="activity">
          ${Object.entries(ACTIVITY_LEVELS)
            .map(([key, l]) => `<option value="${key}">${l.label} – ${l.hint}</option>`)
            .join('')}
        </select>
      </label>

      <fieldset>
        <legend>Obiettivo</legend>
        <div class="segmented">
          ${Object.entries(GOAL_LABELS)
            .map(([key, label]) => `
              <input type="radio" name="goal" id="goal-${key}" value="${key}">
              <label for="goal-${key}">${label}</label>`)
            .join('')}
        </div>
      </fieldset>

      <label id="pace-field">Ritmo
        <select name="paceKgPerWeek"></select>
      </label>

      <button type="submit" class="btn">${onboarding ? 'Inizia' : 'Salva profilo'}</button>
      <p id="save-status" class="muted small" aria-live="polite"></p>
    </form>

    <section id="results" class="card"></section>
  `;

  const form = container.querySelector('#profile-form');
  fillForm(form, saved);

  // Recalculate on every change, so you see the effect immediately
  form.addEventListener('input', (e) => {
    if (e.target.name === 'goal') updatePaceOptions(form);
    showResults(container, readForm(form));
    container.querySelector('#save-status').textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const profile = readForm(form);
    const error = validate(profile);
    const status = container.querySelector('#save-status');
    if (error) {
      status.textContent = '⚠️ ' + error;
      return;
    }
    // put() = insert or replace the row with id 'me'
    await db.profile.put({ id: 'me', ...profile, updatedAt: Date.now() });
    status.textContent = '✓ Salvato sul telefono';
    onSaved?.(); // ?. = call it only if it was passed
  });

  showResults(container, readForm(form));
}

// --- Form helpers ------------------------------------------------------

function fillForm(form, p) {
  form.elements.firstName.value = p.firstName;
  form.elements.lastName.value = p.lastName;
  form.elements.email.value = p.email;
  form.elements.phone.value = p.phone;
  form.elements.sex.value = p.sex;
  form.elements.birthDate.value = p.birthDate;
  form.elements.heightCm.value = p.heightCm;
  form.elements.weightKg.value = p.weightKg;
  form.elements.activity.value = p.activity;
  form.elements.goal.value = p.goal;
  updatePaceOptions(form, p.paceKgPerWeek);
}

/** The pace list depends on the goal (no pace for "maintain"). */
function updatePaceOptions(form, selected) {
  const goal = form.elements.goal.value;
  const select = form.elements.paceKgPerWeek;
  const paces = PACES[goal];
  const sign = goal === 'lose' ? '−' : '+';

  select.innerHTML = paces
    .map((p) => `<option value="${p}">${sign}${p} kg / settimana</option>`)
    .join('');
  // Keep the previous choice if still valid, otherwise use the gentlest pace
  select.value = paces.includes(Number(selected)) ? selected : paces[0];
  form.querySelector('#pace-field').hidden = goal === 'maintain';
}

/** Form -> plain object with proper number types. */
function readForm(form) {
  const f = form.elements;
  return {
    firstName: f.firstName.value.trim(),
    lastName: f.lastName.value.trim(),
    email: f.email.value.trim().toLowerCase(),
    phone: f.phone.value.trim(),
    sex: f.sex.value,
    birthDate: f.birthDate.value,
    heightCm: Number(f.heightCm.value),
    weightKg: Number(f.weightKg.value),
    activity: f.activity.value,
    goal: f.goal.value,
    paceKgPerWeek: Number(f.paceKgPerWeek.value),
  };
}

/** Returns an error message, or null if everything is fine. */
function validate(p) {
  if (!p.firstName || !p.lastName) return 'Inserisci nome e cognome.';
  // Simple check: something@something.something
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return 'Email non valida.';
  if (p.phone && !/^\+?[0-9 ()-]{6,20}$/.test(p.phone)) return 'Numero di telefono non valido.';
  return validateBody(p);
}

/** Only the fields needed by the formulas (used for the live results). */
function validateBody(p) {
  if (!p.birthDate) return 'Inserisci la data di nascita.';
  const age = ageFromBirthDate(p.birthDate);
  if (age < 14 || age > 100) return "L'età deve essere tra 14 e 100 anni.";
  if (!(p.heightCm >= 120 && p.heightCm <= 230)) return 'Altezza tra 120 e 230 cm.';
  if (!(p.weightKg >= 30 && p.weightKg <= 250)) return 'Peso tra 30 e 250 kg.';
  return null;
}

// --- Results -----------------------------------------------------------

function showResults(container, profile) {
  const box = container.querySelector('#results');
  const error = validateBody(profile);
  if (error) {
    box.innerHTML = `<p class="muted">Compila i dati per vedere il tuo fabbisogno.</p>`;
    return;
  }

  const r = computeProfile(profile);
  const round = (n) => Math.round(n).toLocaleString('it-CH');
  const deltaText =
    r.delta === 0 ? 'nessun deficit/surplus'
    : `${r.delta < 0 ? 'deficit' : 'surplus'} di ${round(Math.abs(r.delta))} kcal/giorno`;
  const weekly = r.weeklyChangeKg === 0 ? ''
    : ` → circa ${r.weeklyChangeKg > 0 ? '+' : '−'}${Math.abs(r.weeklyChangeKg).toFixed(2)} kg/settimana`;

  box.innerHTML = `
    <h2>Il tuo fabbisogno <span class="badge">stima</span></h2>
    <div class="stats">
      <div><span class="stat">${round(r.bmr)}</span><span class="muted small">BMR<br>a riposo</span></div>
      <div><span class="stat">${round(r.tdee)}</span><span class="muted small">TDEE<br>con attività</span></div>
      <div><span class="stat accent">${round(r.target)}</span><span class="muted small">Obiettivo<br>kcal/giorno</span></div>
    </div>
    <p>${deltaText}${weekly}</p>
    ${r.warnings.map((w) => `<p class="warning">⚠️ ${w}</p>`).join('')}
    <p class="muted small">
      Età ${r.age} anni. Formula Mifflin-St Jeor: è una stima media, il tuo metabolismo
      reale può differire del ±10%. Confronta con l'andamento del peso nelle prossime settimane.
    </p>
  `;
}

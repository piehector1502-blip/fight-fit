// Pure calculation functions: no DOM, no database.
// Keeping them separate makes them easy to test (see calc.test.js)
// and reusable by every page (dashboard, diet, weight...).

/** Energy stored in ~1 kg of body weight (rough, widely used estimate). */
export const KCAL_PER_KG = 7700;

/** Safety limits for the daily calorie target. */
export const MAX_DEFICIT = 750; // kcal/day
export const MAX_SURPLUS = 500; // kcal/day

/** Activity multipliers for TDEE (standard values). */
export const ACTIVITY_LEVELS = {
  sedentary:  { factor: 1.2,   label: 'Sedentario',   hint: 'Studio/lavoro seduto, nessun allenamento' },
  light:      { factor: 1.375, label: 'Leggero',      hint: '1–3 allenamenti a settimana' },
  moderate:   { factor: 1.55,  label: 'Moderato',     hint: '3–5 allenamenti a settimana' },
  active:     { factor: 1.725, label: 'Attivo',       hint: '6–7 allenamenti a settimana' },
  veryActive: { factor: 1.9,   label: 'Molto attivo', hint: 'Due sessioni al giorno o lavoro fisico' },
};

/** Allowed paces (kg per week) for each goal. */
export const PACES = {
  lose:     [0.25, 0.5, 0.75],
  maintain: [0],
  gain:     [0.25, 0.5],
};

/**
 * Age in whole years on a given day.
 * @param {string} birthDate ISO date 'YYYY-MM-DD'
 * @param {Date} [today]
 */
export function ageFromBirthDate(birthDate, today = new Date()) {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = today.getFullYear() - y;
  // Birthday not reached yet this year? (months in JS Date are 0-based)
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age--;
  return age;
}

/**
 * Basal Metabolic Rate, Mifflin-St Jeor equation (kcal/day).
 * men:   10*kg + 6.25*cm - 5*age + 5
 * women: 10*kg + 6.25*cm - 5*age - 161
 */
export function bmr({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Total Daily Energy Expenditure = BMR * activity factor. */
export function tdee(bmrValue, activity) {
  const level = ACTIVITY_LEVELS[activity];
  if (!level) throw new Error(`Unknown activity level: ${activity}`);
  return bmrValue * level.factor;
}

/**
 * Daily calorie target from goal and pace, with safety limits:
 * - deficit capped at MAX_DEFICIT, surplus capped at MAX_SURPLUS
 * - target never below BMR
 *
 * @returns {{ target: number, delta: number, requestedDelta: number,
 *             weeklyChangeKg: number, warnings: string[] }}
 *   delta is negative for a deficit, positive for a surplus.
 */
export function calorieTarget({ bmr: bmrValue, tdee: tdeeValue, goal, paceKgPerWeek }) {
  const warnings = [];
  const pace = goal === 'maintain' ? 0 : paceKgPerWeek;

  // kg/week -> kcal/day: 0.5 kg * 7700 / 7 = 550 kcal/day
  const requestedDelta = (pace * KCAL_PER_KG) / 7;
  let delta = 0;

  if (goal === 'lose') {
    delta = -Math.min(requestedDelta, MAX_DEFICIT);
    if (requestedDelta > MAX_DEFICIT) {
      warnings.push(`Deficit limitato a ${MAX_DEFICIT} kcal/giorno per sicurezza.`);
    }
    // Never eat less than BMR
    if (tdeeValue + delta < bmrValue) {
      delta = bmrValue - tdeeValue;
      warnings.push('Obiettivo alzato al BMR: non scendere sotto il metabolismo basale.');
    }
  } else if (goal === 'gain') {
    delta = Math.min(requestedDelta, MAX_SURPLUS);
    if (requestedDelta > MAX_SURPLUS) {
      warnings.push(`Surplus limitato a ${MAX_SURPLUS} kcal/giorno.`);
    }
  }

  return {
    target: tdeeValue + delta,
    delta,
    requestedDelta: goal === 'lose' ? -requestedDelta : requestedDelta,
    weeklyChangeKg: (delta * 7) / KCAL_PER_KG, // what the capped delta really gives
    warnings,
  };
}

/** Convenience: everything the profile page needs, from a saved profile. */
export function computeProfile(profile, today = new Date()) {
  const age = ageFromBirthDate(profile.birthDate, today);
  const b = bmr({ sex: profile.sex, weightKg: profile.weightKg, heightCm: profile.heightCm, age });
  const t = tdee(b, profile.activity);
  const c = calorieTarget({ bmr: b, tdee: t, goal: profile.goal, paceKgPerWeek: profile.paceKgPerWeek });
  return { age, bmr: b, tdee: t, ...c };
}

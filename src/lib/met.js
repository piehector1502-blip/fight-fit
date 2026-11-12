// Calorie estimate for workouts using MET values.
//
// MET (Metabolic Equivalent of Task) = how many times more energy an activity
// burns compared to sitting still. 1 MET ≈ 1 kcal per kg of body weight per hour.
//
//   kcal = MET × weight (kg) × hours
//
// Values are approximate, based on the Compendium of Physical Activities
// (e.g. martial arts at moderate pace ≈ 10.3, slower pace / practice ≈ 5.3,
// boxing sparring ≈ 7.8, boxing in the ring ≈ 12.8). Low/high levels for each
// type are reasonable ranges around those references: ESTIMATES, not truth.

export const WORKOUT_TYPES = {
  kumite:     { label: 'Kumite / sparring', icon: '🥋', met: { low: 7.8, medium: 10.3, high: 12.8 } },
  kata:       { label: 'Kata / kihon',      icon: '🥋', met: { low: 4.0, medium: 5.3,  high: 7.8 } },
  bag:        { label: 'Sacco / pao',       icon: '🥊', met: { low: 5.5, medium: 7.8,  high: 10.3 } },
  running:    { label: 'Corsa',             icon: '🏃', met: { low: 7.0, medium: 9.8,  high: 11.5 } },
  weights:    { label: 'Pesi / forza',      icon: '🏋️', met: { low: 3.5, medium: 5.0,  high: 6.0 } },
  circuit:    { label: 'Circuito / HIIT',   icon: '🔥', met: { low: 4.3, medium: 8.0,  high: 10.0 } },
  jumpRope:   { label: 'Corda',             icon: '🪢', met: { low: 8.8, medium: 11.8, high: 12.3 } },
  cycling:    { label: 'Bici',              icon: '🚴', met: { low: 4.0, medium: 6.8,  high: 10.0 } },
  walking:    { label: 'Camminata',         icon: '🚶', met: { low: 2.8, medium: 3.5,  high: 5.0 } },
  stretching: { label: 'Stretching / yoga', icon: '🧘', met: { low: 2.3, medium: 2.5,  high: 3.0 } },
};

export const INTENSITIES = {
  low:    'Bassa',
  medium: 'Media',
  high:   'Alta',
};

export function metFor(type, intensity) {
  const t = WORKOUT_TYPES[type];
  if (!t) throw new Error(`Unknown workout type: ${type}`);
  const met = t.met[intensity];
  if (met == null) throw new Error(`Unknown intensity: ${intensity}`);
  return met;
}

/**
 * @returns {{ met: number, kcal: number, netKcal: number }}
 *   kcal    = total energy during the workout
 *   netKcal = extra energy above resting ((MET − 1) × kg × h).
 *             Useful later for the weight balance, because resting
 *             energy is already counted in the BMR/TDEE.
 */
export function estimateKcal({ type, intensity, durationMin, weightKg }) {
  const met = metFor(type, intensity);
  const hours = durationMin / 60;
  return {
    met,
    kcal: met * weightKg * hours,
    netKcal: Math.max(0, met - 1) * weightKg * hours,
  };
}

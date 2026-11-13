// Nutrition helpers: pure functions, no DOM, no network.

const KJ_PER_KCAL = 4.184;
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Turn an Open Food Facts product (legacy API or Search-a-licious) into
 * our simple format. Returns null if it has no usable calories.
 *
 * @returns {{ barcode: string|null, name: string, brand: string,
 *             per100: {kcal:number, protein:number, carbs:number, fat:number},
 *             servingG: number|null, source: 'off' } | null}
 */
export function normalizeOffProduct(raw) {
  const n = raw?.nutriments ?? {};
  // Calories per 100 g; if only kJ is available, convert
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n.energy_100g);
    if (kj != null) kcal = kj / KJ_PER_KCAL;
  }
  if (kcal == null) return null;

  const name = (raw.product_name_it || raw.product_name || raw.generic_name || '').trim();
  if (!name) return null;

  // Search-a-licious returns brands as an array, the legacy API as "A, B"
  const brands = Array.isArray(raw.brands) ? raw.brands : String(raw.brands ?? '').split(',');
  const brand = (brands[0] ?? '').trim();

  return {
    barcode: raw.code ? String(raw.code) : null,
    name,
    brand,
    per100: {
      kcal: Math.round(kcal),
      protein: round1(num(n.proteins_100g) ?? 0),
      carbs: round1(num(n.carbohydrates_100g) ?? 0),
      fat: round1(num(n.fat_100g) ?? 0),
    },
    servingG: num(raw.serving_quantity),
    source: 'off',
  };
}

/** Values for `grams` of a food, given its values per 100 g. */
export function scale(per100, grams) {
  const f = grams / 100;
  return {
    kcal: Math.round(per100.kcal * f),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
  };
}

/** Sum kcal and macros of a list of entries. */
export function sumEntries(entries) {
  const t = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

/**
 * Indicative daily macro targets (grams).
 * - protein: g per kg of body weight (higher in a deficit to protect muscle)
 * - fat: 25% of calories
 * - carbs: whatever calories remain (fuel for training)
 */
export function macroTargets({ targetKcal, weightKg, goal }) {
  const proteinPerKg = goal === 'lose' ? 2.0 : 1.8;
  const protein = Math.round(weightKg * proteinPerKg);
  const fat = Math.round((targetKcal * 0.25) / KCAL_PER_G.fat);
  const carbKcal = targetKcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat;
  const carbs = Math.max(0, Math.round(carbKcal / KCAL_PER_G.carbs));
  return { protein, carbs, fat };
}

/** Validate a manually entered food (values per 100 g). Returns error text or null. */
export function validatePer100({ kcal, protein, carbs, fat }) {
  if (![kcal, protein, carbs, fat].every((v) => Number.isFinite(v) && v >= 0)) {
    return 'Valori non validi.';
  }
  if (kcal > 900) return 'Massimo 900 kcal per 100 g (il grasso puro ne ha ~900).';
  if (protein + carbs + fat > 100) return 'Proteine + carboidrati + grassi non possono superare 100 g.';
  return null;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

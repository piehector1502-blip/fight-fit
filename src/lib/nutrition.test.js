import { describe, it, expect } from 'vitest';
import { normalizeOffProduct, scale, sumEntries, macroTargets, validatePer100 } from './nutrition.js';

describe('normalizeOffProduct', () => {
  it('reads the legacy API format (brands as text)', () => {
    const p = normalizeOffProduct({
      code: '3017620422003',
      product_name: 'Nutella',
      brands: 'Ferrero, Nutella',
      serving_quantity: '15',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
    });
    expect(p).toEqual({
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      per100: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
      servingG: 15,
      source: 'off',
    });
  });

  it('reads Search-a-licious (brands as array) and prefers the Italian name', () => {
    const p = normalizeOffProduct({
      code: '123', product_name: 'Oat flakes', product_name_it: "Fiocchi d'avena",
      brands: ['Migros'], nutriments: { 'energy-kcal_100g': 372 },
    });
    expect(p.name).toBe("Fiocchi d'avena");
    expect(p.brand).toBe('Migros');
    expect(p.per100.protein).toBe(0); // missing macros become 0
  });

  it('converts kJ to kcal when kcal is missing: 1674 / 4.184 ≈ 400', () => {
    const p = normalizeOffProduct({ product_name: 'X', nutriments: { 'energy-kj_100g': 1674 } });
    expect(p.per100.kcal).toBe(400);
  });

  it('returns null without calories or without a name', () => {
    expect(normalizeOffProduct({ product_name: 'X', nutriments: {} })).toBeNull();
    expect(normalizeOffProduct({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
  });
});

describe('scale', () => {
  it('40 g of oats (372 kcal, 13.5 P per 100 g) = 149 kcal, 5.4 g P', () => {
    const r = scale({ kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 }, 40);
    expect(r).toEqual({ kcal: 149, protein: 5.4, carbs: 23.5, fat: 2.8 });
  });
});

describe('sumEntries', () => {
  it('adds everything up', () => {
    const t = sumEntries([
      { kcal: 149, protein: 5.4, carbs: 23.5, fat: 2.8 },
      { kcal: 81, protein: 1, carbs: 0.5, fat: 4.6 },
    ]);
    expect(t).toEqual({ kcal: 230, protein: 6.4, carbs: 24, fat: 7.4 });
  });
  it('empty day = zeros', () => {
    expect(sumEntries([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('macroTargets', () => {
  it('2000 kcal, 70 kg, lose: P 140 g, F 56 g, C = (2000-560-504)/4 = 234 g', () => {
    expect(macroTargets({ targetKcal: 2000, weightKg: 70, goal: 'lose' }))
      .toEqual({ protein: 140, fat: 56, carbs: 234 });
  });
  it('maintain uses 1.8 g/kg of protein', () => {
    expect(macroTargets({ targetKcal: 2600, weightKg: 70, goal: 'maintain' }).protein).toBe(126);
  });
});

describe('validatePer100', () => {
  it('accepts a normal label', () => {
    expect(validatePer100({ kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 })).toBeNull();
  });
  it('rejects impossible values', () => {
    expect(validatePer100({ kcal: 1200, protein: 0, carbs: 0, fat: 0 })).not.toBeNull();
    expect(validatePer100({ kcal: 300, protein: 60, carbs: 50, fat: 10 })).not.toBeNull();
    expect(validatePer100({ kcal: -1, protein: 0, carbs: 0, fat: 0 })).not.toBeNull();
  });
});

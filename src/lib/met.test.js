import { describe, it, expect } from 'vitest';
import { metFor, estimateKcal, WORKOUT_TYPES, INTENSITIES } from './met.js';

describe('metFor', () => {
  it('kumite at medium intensity = 10.3', () => {
    expect(metFor('kumite', 'medium')).toBe(10.3);
  });
  it('every type has low <= medium <= high', () => {
    for (const t of Object.values(WORKOUT_TYPES)) {
      expect(t.met.low).toBeLessThanOrEqual(t.met.medium);
      expect(t.met.medium).toBeLessThanOrEqual(t.met.high);
    }
  });
  it('every type has all intensities', () => {
    for (const t of Object.values(WORKOUT_TYPES)) {
      expect(Object.keys(t.met).sort()).toEqual(Object.keys(INTENSITIES).sort());
    }
  });
  it('rejects unknown values', () => {
    expect(() => metFor('chess', 'medium')).toThrow();
    expect(() => metFor('kumite', 'extreme')).toThrow();
  });
});

describe('estimateKcal', () => {
  it('kumite medium, 60 min, 70 kg: 10.3 × 70 × 1 = 721 kcal', () => {
    const r = estimateKcal({ type: 'kumite', intensity: 'medium', durationMin: 60, weightKg: 70 });
    expect(r.kcal).toBeCloseTo(721);
  });
  it('net kcal removes resting energy: (10.3 − 1) × 70 × 1 = 651', () => {
    const r = estimateKcal({ type: 'kumite', intensity: 'medium', durationMin: 60, weightKg: 70 });
    expect(r.netKcal).toBeCloseTo(651);
  });
  it('30 min is half of 60 min', () => {
    const a = estimateKcal({ type: 'running', intensity: 'high', durationMin: 30, weightKg: 80 });
    const b = estimateKcal({ type: 'running', intensity: 'high', durationMin: 60, weightKg: 80 });
    expect(a.kcal * 2).toBeCloseTo(b.kcal);
  });
});

// Unit tests for the formulas. Run with: npm test
// Expected numbers are computed by hand in the comments.
import { describe, it, expect } from 'vitest';
import { ageFromBirthDate, bmr, tdee, calorieTarget, computeProfile } from './calc.js';

describe('ageFromBirthDate', () => {
  const today = new Date(2026, 10, 12); // 12 Nov 2026 (month is 0-based)

  it('counts a birthday already passed this year', () => {
    expect(ageFromBirthDate('2006-03-01', today)).toBe(20);
  });
  it('does not count a birthday still to come', () => {
    expect(ageFromBirthDate('2006-12-25', today)).toBe(19);
  });
  it('counts the birthday on the day itself', () => {
    expect(ageFromBirthDate('2006-11-12', today)).toBe(20);
  });
});

describe('bmr (Mifflin-St Jeor)', () => {
  it('male: 10*70 + 6.25*175 - 5*20 + 5 = 1698.75', () => {
    expect(bmr({ sex: 'male', weightKg: 70, heightCm: 175, age: 20 })).toBeCloseTo(1698.75);
  });
  it('female: 10*60 + 6.25*165 - 5*25 - 161 = 1345.25', () => {
    expect(bmr({ sex: 'female', weightKg: 60, heightCm: 165, age: 25 })).toBeCloseTo(1345.25);
  });
});

describe('tdee', () => {
  it('moderate: 1698.75 * 1.55 = 2633.06', () => {
    expect(tdee(1698.75, 'moderate')).toBeCloseTo(2633.06, 1);
  });
  it('rejects unknown activity levels', () => {
    expect(() => tdee(1500, 'couch')).toThrow();
  });
});

describe('calorieTarget', () => {
  const base = { bmr: 1700, tdee: 2600 };

  it('maintain: target = TDEE', () => {
    const r = calorieTarget({ ...base, goal: 'maintain', paceKgPerWeek: 0.5 });
    expect(r.target).toBe(2600);
    expect(r.delta).toBe(0);
  });

  it('lose 0.5 kg/week: 0.5*7700/7 = 550 kcal deficit', () => {
    const r = calorieTarget({ ...base, goal: 'lose', paceKgPerWeek: 0.5 });
    expect(r.delta).toBeCloseTo(-550);
    expect(r.target).toBeCloseTo(2050);
    expect(r.warnings).toHaveLength(0);
  });

  it('lose 0.75 kg/week: 825 requested, capped at 750', () => {
    const r = calorieTarget({ ...base, goal: 'lose', paceKgPerWeek: 0.75 });
    expect(r.delta).toBe(-750);
    expect(r.target).toBe(1850);
    expect(r.warnings.length).toBe(1);
  });

  it('never goes below BMR', () => {
    // TDEE only 300 above BMR: a 550 deficit would go below BMR
    const r = calorieTarget({ bmr: 1500, tdee: 1800, goal: 'lose', paceKgPerWeek: 0.5 });
    expect(r.target).toBe(1500);
    expect(r.warnings.some((w) => w.includes('BMR'))).toBe(true);
  });

  it('gain 0.5 kg/week: 550 requested, capped at 500', () => {
    const r = calorieTarget({ ...base, goal: 'gain', paceKgPerWeek: 0.5 });
    expect(r.delta).toBe(500);
    expect(r.target).toBe(3100);
  });

  it('weeklyChangeKg reflects the capped delta: -750*7/7700 = -0.68', () => {
    const r = calorieTarget({ ...base, goal: 'lose', paceKgPerWeek: 0.75 });
    expect(r.weeklyChangeKg).toBeCloseTo(-0.68, 2);
  });
});

describe('computeProfile', () => {
  it('puts everything together', () => {
    const r = computeProfile(
      { sex: 'male', birthDate: '2006-03-01', heightCm: 175, weightKg: 70,
        activity: 'moderate', goal: 'lose', paceKgPerWeek: 0.5 },
      new Date(2026, 10, 12),
    );
    expect(r.age).toBe(20);
    expect(r.bmr).toBeCloseTo(1698.75);
    expect(r.target).toBeCloseTo(2633.06 - 550, 1);
  });
});

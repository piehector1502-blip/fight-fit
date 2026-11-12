import { describe, it, expect } from 'vitest';
import { toISODate, daysAgo, formatDay } from './dates.js';

const today = new Date(2026, 10, 12, 23, 30); // 12 Nov 2026, 23:30 local

describe('dates', () => {
  it('toISODate uses local time (late evening stays the same day)', () => {
    expect(toISODate(today)).toBe('2026-11-12');
  });
  it('daysAgo crosses month boundaries', () => {
    expect(daysAgo(12, today)).toBe('2026-10-31');
  });
  it('formatDay says Oggi / Ieri', () => {
    expect(formatDay('2026-11-12', today)).toBe('Oggi');
    expect(formatDay('2026-11-11', today)).toBe('Ieri');
  });
});

import { describe, it, expect } from 'vitest';
import { buildPhases, totalMs, stateAt, cuesBetween, formatMs } from './timer.js';

// "Kumite 3x2min": 10 s prep, 3 rounds of 120 s, 60 s rest
const kumite = buildPhases({ prepSec: 10, roundSec: 120, restSec: 60, rounds: 3 });

describe('buildPhases', () => {
  it('prep, round, rest, round, rest, round (no rest after the last round)', () => {
    expect(kumite.map((p) => p.type)).toEqual(['prep', 'round', 'rest', 'round', 'rest', 'round']);
  });
  it('total = 10 + 3*120 + 2*60 = 490 s', () => {
    expect(totalMs(kumite)).toBe(490_000);
  });
  it('skips the prep phase when prepSec is 0', () => {
    const p = buildPhases({ prepSec: 0, roundSec: 20, restSec: 10, rounds: 2 });
    expect(p[0].type).toBe('round');
    expect(p[0].startMs).toBe(0);
  });
});

describe('stateAt', () => {
  it('at 5 s we are in prep with 5 s left', () => {
    const s = stateAt(kumite, 5_000);
    expect(s.phase.type).toBe('prep');
    expect(s.remainingMs).toBe(5_000);
  });
  it('at 140 s we are in the first rest (round 1 ended at 130 s)', () => {
    const s = stateAt(kumite, 140_000);
    expect(s.phase.type).toBe('rest');
    expect(s.remainingMs).toBe(50_000);
  });
  it('at 200 s we are in round 2', () => {
    const s = stateAt(kumite, 200_000);
    expect(s.phase.type).toBe('round');
    expect(s.phase.round).toBe(2);
  });
  it('is done at the end', () => {
    expect(stateAt(kumite, 490_000).done).toBe(true);
  });
});

describe('cuesBetween', () => {
  const types = (from, to) => cuesBetween(kumite, from, to).map((c) => c.type);

  it('3-2-1 ticks before round 1 (at 7, 8, 9 s)', () => {
    expect(types(6_900, 9_100)).toEqual(['tick', 'tick', 'tick']);
  });
  it('round 1 starts at 10 s', () => {
    expect(types(9_900, 10_100)).toEqual(['roundStart']);
  });
  it('warning 10 s before the end of round 1 (at 120 s)', () => {
    expect(types(119_900, 120_100)).toEqual(['warning']);
  });
  it('round 1 ends at 130 s', () => {
    expect(types(129_900, 130_100)).toEqual(['roundEnd']);
  });
  it('the last round ends with "finish", not "roundEnd"', () => {
    expect(types(489_900, 490_100)).toEqual(['finish']);
  });
  it('a late tick still catches every cue in between', () => {
    // jump from 118 s to 131 s: warning + roundEnd
    expect(types(118_000, 131_000)).toEqual(['warning', 'roundEnd']);
  });
  it('no cues in a quiet moment', () => {
    expect(types(50_000, 51_000)).toEqual([]);
  });
  it('without prep, round 1 starts at time 0', () => {
    const p = buildPhases({ prepSec: 0, roundSec: 20, restSec: 10, rounds: 1 });
    expect(cuesBetween(p, -1, 0).map((c) => c.type)).toEqual(['roundStart']);
  });
});

describe('formatMs', () => {
  it('formats minutes and seconds', () => {
    expect(formatMs(125_000)).toBe('2:05');
    expect(formatMs(9_000)).toBe('0:09');
  });
  it('rounds up partial seconds', () => {
    expect(formatMs(400)).toBe('0:01');
    expect(formatMs(0)).toBe('0:00');
  });
});

// Round timer logic: pure functions, no DOM, no sound.
//
// Idea: a workout is a list of "phases" (prep, round, rest, round, ...).
// Instead of decrementing a counter every second (which drifts when the
// phone is busy), we store how many milliseconds have elapsed and always
// compute "where are we?" from that number.

export const WARNING_SEC = 10;   // warning before the end of a round
export const COUNTDOWN_SEC = 3;  // 3-2-1 ticks before a round starts

/**
 * @param {{prepSec:number, roundSec:number, restSec:number, rounds:number}} cfg
 * @returns {{type:'prep'|'round'|'rest', round:number, durationMs:number, startMs:number}[]}
 */
export function buildPhases({ prepSec, roundSec, restSec, rounds }) {
  const phases = [];
  let t = 0;
  const add = (type, round, sec) => {
    if (sec <= 0) return; // skip empty phases (e.g. no preparation)
    phases.push({ type, round, durationMs: sec * 1000, startMs: t });
    t += sec * 1000;
  };

  add('prep', 1, prepSec);
  for (let r = 1; r <= rounds; r++) {
    add('round', r, roundSec);
    if (r < rounds) add('rest', r, restSec); // no rest after the last round
  }
  return phases;
}

export function totalMs(phases) {
  const last = phases.at(-1);
  return last ? last.startMs + last.durationMs : 0;
}

/**
 * Where are we after `elapsedMs`?
 * @returns {{ done: boolean, index: number, phase: object|null,
 *             remainingMs: number, totalRemainingMs: number }}
 */
export function stateAt(phases, elapsedMs) {
  const total = totalMs(phases);
  if (elapsedMs >= total) {
    return { done: true, index: phases.length, phase: null, remainingMs: 0, totalRemainingMs: 0 };
  }
  const index = phases.findIndex((p) => elapsedMs < p.startMs + p.durationMs);
  const phase = phases[index];
  return {
    done: false,
    index,
    phase,
    remainingMs: phase.startMs + phase.durationMs - elapsedMs,
    totalRemainingMs: total - elapsedMs,
  };
}

/**
 * Which sound/voice/vibration cues happen in the time window (fromMs, toMs]?
 * The page calls this on every tick with the previous and current elapsed
 * time, so no cue is missed even if a tick arrives late.
 *
 * Cue types:
 *  'prepStart'  – the preparation phase begins (at time 0)
 *  'tick'       – 3, 2, 1 seconds before a round starts   (n = 3|2|1)
 *  'roundStart' – a round begins                           (round = 1..N)
 *  'warning'    – WARNING_SEC before the end of a round
 *  'endTick'    – 3, 2, 1 seconds before a round ends      (n = 3|2|1)
 *  'roundEnd'   – a round ends and a rest follows
 *  'finish'     – the whole workout is over
 *
 * @returns {{type: string, atMs: number, round?: number, n?: number}[]}
 *   sorted by time
 */
export function cuesBetween(phases, fromMs, toMs) {
  const cues = [];
  const total = totalMs(phases);
  // Add a cue only if its moment falls inside the window
  const add = (atMs, cue) => {
    if (atMs > fromMs && atMs <= toMs) cues.push({ ...cue, atMs });
  };

  phases.forEach((p, i) => {
    const end = p.startMs + p.durationMs;

    if (p.type === 'prep') add(p.startMs, { type: 'prepStart' });
    if (p.type !== 'round') return;

    // 3-2-1 before the round, only if something (prep/rest) comes before it
    if (i > 0) {
      for (let n = COUNTDOWN_SEC; n >= 1; n--) add(p.startMs - n * 1000, { type: 'tick', n });
    }
    // For a round at t = 0 (no preparation) the page calls
    // cuesBetween(phases, -1, 0) when you press Start.
    add(p.startMs, { type: 'roundStart', round: p.round });

    // Warning only for rounds longer than the warning itself
    if (p.durationMs > WARNING_SEC * 1000) add(end - WARNING_SEC * 1000, { type: 'warning' });

    // 3-2-1 before the end of the round
    if (p.durationMs > COUNTDOWN_SEC * 1000) {
      for (let n = COUNTDOWN_SEC; n >= 1; n--) add(end - n * 1000, { type: 'endTick', n });
    }
    // Last round: the end is 'finish', not 'roundEnd'
    if (end < total) add(end, { type: 'roundEnd', round: p.round });
  });

  add(total, { type: 'finish' });
  return cues.sort((a, b) => a.atMs - b.atMs);
}

/** 125000 -> "2:05" (rounds up, so the display shows 0:01 until the very end). */
export function formatMs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

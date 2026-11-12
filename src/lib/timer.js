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
 * Which sound/vibration cues happen in the time window (fromMs, toMs]?
 * The page calls this on every tick with the previous and current elapsed
 * time, so no cue is missed even if a tick arrives late.
 *
 * Cue types:
 *  'roundStart' – a round begins
 *  'roundEnd'   – a round ends (rest or finish follows)
 *  'warning'    – WARNING_SEC before the end of a round
 *  'tick'       – 3, 2, 1 seconds before a round starts
 *  'finish'     – the whole workout is over
 */
export function cuesBetween(phases, fromMs, toMs) {
  const cues = [];
  const inWindow = (t) => t > fromMs && t <= toMs;
  const total = totalMs(phases);

  phases.forEach((p, i) => {
    if (p.type !== 'round') return;
    const end = p.startMs + p.durationMs;

    // Start of the round. For a round at t = 0 (no preparation) the page
    // calls cuesBetween(phases, -1, 0) when you press Start.
    if (inWindow(p.startMs)) {
      cues.push({ type: 'roundStart', round: p.round });
    }
    // Countdown ticks before the round, only if something comes before it
    if (i > 0) {
      for (let s = COUNTDOWN_SEC; s >= 1; s--) {
        if (inWindow(p.startMs - s * 1000)) cues.push({ type: 'tick', round: p.round });
      }
    }
    // Warning before the end (only for rounds longer than the warning itself)
    if (p.durationMs > WARNING_SEC * 1000 && inWindow(end - WARNING_SEC * 1000)) {
      cues.push({ type: 'warning', round: p.round });
    }
    if (inWindow(end) && end < total) cues.push({ type: 'roundEnd', round: p.round });
  });

  if (inWindow(total)) cues.push({ type: 'finish' });
  return cues;
}

/** 125000 -> "2:05" (rounds up, so the display shows 0:01 until the very end). */
export function formatMs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

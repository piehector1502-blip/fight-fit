// Sound (Web Audio API), vibration and "keep the screen on".
// No audio files needed: beeps are generated with an oscillator.

let audio = null;

/**
 * Browsers only allow sound after a user gesture (tap/click).
 * Call this from the Start button handler.
 */
export function unlockAudio() {
  audio ??= new AudioContext(); // ??= : create it only the first time
  if (audio.state === 'suspended') audio.resume();
}

/**
 * Play `count` beeps.
 * @param {number} freq    pitch in Hz (higher = sharper)
 * @param {number} ms      length of each beep
 * @param {number} count   how many beeps
 * @param {number} gapMs   silence between beeps
 */
function beep(freq, ms, count = 1, gapMs = 120) {
  if (!audio) return;
  const t0 = audio.currentTime;
  for (let i = 0; i < count; i++) {
    const start = t0 + (i * (ms + gapMs)) / 1000;
    const end = start + ms / 1000;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square'; // harsh sound, easy to hear in a noisy dojo
    osc.frequency.value = freq;
    // Short fade in/out avoids "clicks"
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.01);
    gain.gain.setValueAtTime(0.3, end - 0.02);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(end);
  }
}

/** navigator.vibrate exists on Android; iPhone ignores it. */
function vibrate(pattern) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

/** One place that decides how each timer cue sounds and feels. */
export function playCue(type) {
  switch (type) {
    case 'roundStart': beep(1000, 250, 2); vibrate([300, 100, 300]); break;
    case 'roundEnd':   beep(600, 900);     vibrate([800]); break;
    case 'warning':    beep(1400, 120, 3, 80); vibrate([100, 80, 100, 80, 100]); break;
    case 'tick':       beep(800, 100); break;
    case 'finish':     beep(600, 400, 3, 150); vibrate([500, 200, 500, 200, 500]); break;
  }
}

// --- Screen Wake Lock: keep the display on while the timer runs ---------
let wakeLock = null;

export async function keepScreenOn() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    // Not supported or refused (e.g. battery saver): the timer still works.
  }
}

export function releaseScreen() {
  wakeLock?.release();
  wakeLock = null;
}

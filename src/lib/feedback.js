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

// --- Voice (Web Speech API) ------------------------------------------
// Uses the phone's own text-to-speech; works offline if an Italian voice
// is installed (Android: Settings > Text-to-speech).

const VOICE_KEY = 'fightfit.voice';
let italianVoice = null;

function pickItalianVoice() {
  if (!('speechSynthesis' in window)) return;
  italianVoice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('it')) ?? null;
}
if ('speechSynthesis' in window) {
  pickItalianVoice();
  // The voice list often loads a moment after the page
  speechSynthesis.addEventListener('voiceschanged', pickItalianVoice);
}

/** Voice on/off, remembered on this device (default: on). */
export function isVoiceEnabled() {
  try { return localStorage.getItem(VOICE_KEY) !== 'off'; } catch { return true; }
}
export function setVoiceEnabled(on) {
  try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}
export const voiceSupported = () => 'speechSynthesis' in window;

function speak(text) {
  if (!voiceSupported()) return;
  speechSynthesis.cancel(); // drop anything still queued: timing matters more
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'it-IT';
  if (italianVoice) u.voice = italianVoice;
  u.rate = 1.15; // a bit faster, so "tre, due, uno" fits in 3 seconds
  speechSynthesis.speak(u);
}

const NUMBERS = { 3: 'tre', 2: 'due', 1: 'uno' };

/** What the voice says for each cue. */
function voiceText(cue) {
  switch (cue.type) {
    case 'prepStart':  return 'Preparazione';
    case 'tick':
    case 'endTick':    return NUMBERS[cue.n];
    case 'roundStart': return cue.round === 1 ? 'Start' : `Round ${cue.round}`;
    case 'warning':    return '10 secondi';
    case 'roundEnd':   return 'Pausa';
    case 'finish':     return 'Fine. Ottimo lavoro!';
  }
  return null;
}

/**
 * One place that decides how each timer cue sounds, speaks and vibrates.
 * @param {{type: string, round?: number, n?: number}} cue
 */
export function playCue(cue) {
  const voice = isVoiceEnabled() && voiceSupported();
  if (voice) {
    const text = voiceText(cue);
    if (text) speak(text);
  }

  switch (cue.type) {
    case 'roundStart': beep(1000, 250, 2); vibrate([300, 100, 300]); break;
    case 'roundEnd':   beep(600, 900);     vibrate([800]); break;
    case 'finish':     beep(600, 400, 3, 150); vibrate([500, 200, 500, 200, 500]); break;
    // With the voice on, these are spoken instead of beeped
    case 'warning':    if (!voice) beep(1400, 120, 3, 80); vibrate([100, 80, 100, 80, 100]); break;
    case 'tick':       if (!voice) beep(800, 100); break;
    case 'endTick':    if (!voice) beep(900, 100); break;
  }
}

/** Stop talking immediately (Stop button / leaving the page). */
export function stopVoice() {
  if (voiceSupported()) speechSynthesis.cancel();
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

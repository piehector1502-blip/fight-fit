# FightFit — PROGRESS

Personal PWA for combat-sport training (karate / kumite) and diet.

## Status

| # | Feature | Status |
|---|---------|--------|
| 0 | Project skeleton (PWA, offline, DB, navigation, deploy) | ✅ done |
| 1 | Profile + BMR / TDEE / calorie target | ✅ done |
| 1b | Onboarding (first launch) + account fields | ✅ done |
| 2 | Round timer (sound, vibration, presets) | ✅ done |
| 2b | Timer voice announcements | ✅ done |
| 3 | Workouts log + kcal estimate (MET) | ✅ done |
| 4 | Diet log + Open Food Facts product search | ✅ done (online search to verify on device) |
| 5 | Weight log + chart + estimated vs real weight | ⏳ next |
| 6 | Dashboard (day / week) | ⬜ |
| 7 | Account + Java server + sync (phase 2) | ⬜ |

## Done

### Step 0 — Skeleton (2026-11-12)
- Vite project, vanilla JavaScript (ES modules), no UI framework.
- `vite-plugin-pwa`: generates manifest + service worker → installable, works offline.
- `src/db.js`: IndexedDB via Dexie, tables: profile, presets, workouts, meals, foods, weights.
- `src/main.js`: hash router (`#/timer`, `#/diet`, …) + 6 placeholder pages + bottom tab bar.
- `shell.nix` for NixOS; GitHub Actions workflow (tests, builds, deploys to GitHub Pages) in `setup/deploy.yml` → move it to `.github/workflows/` (tools cannot write `.github`).

### Step 1 — Profile (2026-11-12)
- `src/lib/calc.js` (pure functions, no DOM): `ageFromBirthDate`, `bmr` (Mifflin-St Jeor),
  `tdee` (activity factors 1.2–1.9), `calorieTarget` (pace kg/week × 7700 / 7),
  `computeProfile`. Constants: `KCAL_PER_KG`, `MAX_DEFICIT` 750, `MAX_SURPLUS` 500.
- `src/lib/calc.test.js`: 14 Vitest tests with hand-computed values.
- `src/pages/profile.js`: form (sex, birth date, height, weight, activity, goal, pace),
  live results card labeled "stima", warnings when limits kick in, saved in `db.profile` (id `'me'`).
- Validation: age 14–100, height 120–230 cm, weight 30–250 kg.

### Step 1b — Onboarding + account fields (2026-11-12)
- First launch (no `db.profile` row): welcome screen with the profile form, tab bar hidden;
  after "Inizia" → Home. Router in `main.js` checks the profile before every page.
- New profile fields: firstName, lastName, email (required, future account login), phone (optional).
- `src/pages/dashboard.js`: greeting by name + daily calorie target (full dashboard in step 6).

### Step 2 — Round timer (2026-11-12)
- `src/lib/timer.js` (pure): `buildPhases` (prep → round → rest …, no rest after last round),
  `stateAt` (where are we after X ms), `cuesBetween` (cues in a time window), `formatMs`.
  17 tests in `timer.test.js`.
- `src/lib/feedback.js`: beeps generated with Web Audio (no audio files), `navigator.vibrate`,
  Screen Wake Lock to keep the display on.
- Cues: round start (2 beeps + vibration), round end (long beep), warning 10 s before end
  of round (3 fast beeps), 3-2-1 ticks before each round, finish.
- `src/pages/timer.js`: presets (seeded: Kumite 3x2min, Sacco 5x3min, Tabata 8x20s),
  save/update by name, delete; full-screen run view coloured by phase (amber/red/green),
  pause/resume, stop. Changing tab stops the timer.

### Step 2b — Timer voice (2026-11-12)
- Web Speech API (`speechSynthesis`, it-IT): "Preparazione", "tre, due, uno", "Start" /
  "Round N", "10 secondi", "tre, due, uno", "Pausa", "Fine. Ottimo lavoro!".
- New cues in `cuesBetween`: `prepStart`, `endTick` (3-2-1 before round end); cues carry `n`
  and `round` and are returned sorted by time.
- Voice on/off switch in the timer, remembered in localStorage (`fightfit.voice`).
  With voice on, tick/warning beeps are replaced by speech; start/end beeps + vibration stay.

### Step 3 — Workouts log (2026-11-12)
- `src/lib/met.js`: 10 workout types × 3 intensities (low/medium/high) with MET values
  (approximate, based on the Compendium of Physical Activities, e.g. martial arts moderate 10.3).
  `estimateKcal` → kcal = MET × kg × h, and netKcal = (MET − 1) × kg × h.
- `src/lib/dates.js`: local 'YYYY-MM-DD' helpers (not toISOString, which is UTC).
- `src/lib/html.js`: `escapeHtml` for user text (notes, preset names).
- `src/pages/workouts.js`: form with live estimate, history of the last 60 days grouped by day,
  delete with two taps, totals of the last 7 days.
- Timer → "Salva come allenamento" pre-fills the form (type kumite, high intensity, duration).
- Saved per session: type, date, durationMin, intensity, notes, met, weightKg, kcal, netKcal,
  source ('manual' | 'timer'), createdAt, updatedAt.
- Tests: 44 in total.

### Step 4 — Diet (2026-11-13)
- `src/lib/nutrition.js` (pure, 11 tests): `normalizeOffProduct` (legacy + Search-a-licious
  formats, Italian name preferred, kJ→kcal ÷ 4.184), `scale` (per 100 g → grams),
  `sumEntries`, `macroTargets` (protein 2.0 g/kg when losing, 1.8 otherwise; fat 25% kcal;
  carbs = rest), `validatePer100` for manual products.
- `src/lib/off.js`: Open Food Facts search. Tries Search-a-licious
  (`search.openfoodfacts.org/search`), falls back to legacy `/cgi/search.pl`.
  Search only on button press + 3 s minimum gap (OFF limit ≈ 10 searches/min), 12 s timeout,
  clear Italian error messages (offline, no response).
- `src/pages/diet.js`: day navigation (no future days), kcal eaten / remaining / target with
  bar, macro bars, 4 meals (Colazione, Pranzo, Cena, Spuntini) with two-tap delete;
  add flow: saved products (filtered while typing, offline, most used first) → online search →
  portion (grams, default = serving size or 100 g, live kcal/macros) → saved;
  manual product from label values. Credit "Open Food Facts (ODbL)".
- `db.meals` entry: date, meal, name, brand, barcode, grams, per100 (copy), kcal, protein,
  carbs, fat, createdAt, updatedAt. `db.foods`: product + useCount, lastUsedAt, lastGrams.
- `src/lib/ui.js`: `twoTapDelete` shared by workouts and diet.
- Tested with mocked OFF responses (incl. fallback when Search-a-licious fails);
  real OFF could not be reached from the dev sandbox → verify on PC/phone.

## Decisions
- **Vanilla JS + Vite** instead of a framework: you can understand every line; Vite gives
  a modern build (modules, minification) and makes adding tests/TypeScript easy later.
- **Dexie (IndexedDB)** for local data: offline-first, data stays on the phone.
  Every record will carry `updatedAt` so a future server can sync changes.
- **Hash routing**: no server config needed → works on GitHub Pages and offline.
- **Phase 2 server in Java** (Spring Boot or Javalin + PostgreSQL), added only after
  the offline app works. The app will talk to it through one sync module.
- **Pure logic in separate modules** (e.g. `src/lib/calc.js`) tested with **Vitest**.
- **Food data**: Open Food Facts API (free, name/brand search, kcal & macros per 100 g).
- **Safety rules**: deficit max ~500–750 kcal/day, target never below BMR;
  all estimates labeled as estimates.
- **Birth date instead of age**: age is computed, so it stays correct over the years.
- **Paces**: lose 0.25/0.5/0.75 kg/week, gain 0.25/0.5. 0.75 → 825 kcal requested, capped to 750.
- **Timer uses elapsed time, not a countdown counter**: `performance.now()` differences, so it
  never drifts; cues are computed for the window between two ticks, so a late tick misses nothing.
- **kcal stored at save time** (with the weight used): changing weight later doesn't rewrite history.
- **Open decision for step 5**: TDEE (activity level) already includes training. To avoid
  counting workouts twice, use either "TDEE + nothing" or "sedentary TDEE + netKcal of workouts".
- **Meal entries copy the per-100 g values**: editing a saved product never changes past days.
- **Macros are indicative**, shown with the rule used; calories remain the main target.
- **Account data stays local for now**; it will be sent to the server only in phase 2.
- **Testing on phone**: GitHub Pages (HTTPS is required for PWA install/offline).

### Setup: Git + GitHub Pages (2026-11-12)
- Repo: https://github.com/piehector1502-blip/fight-fit (public, needed for free Pages).
- Live app: https://piehector1502-blip.github.io/fight-fit/
- Every `git push` to `main` → GitHub Actions runs tests, builds and deploys.
- NixOS: global git config is read-only (managed by dotfiles), so name, email (GitHub noreply)
  and credential helper (`gh auth git-credential`) are set **per repo** in `.git/config`.

## Missing / next
- Delete old `MyApp` GitHub repo (user confirmed).
- Phone install: Oppo default browser can't install PWAs; Opera made only a shortcut and
  offline didn't work. To do: install via Chrome, or build a real Android APK (Capacitor) later.
- Silence Actions warning "Node.js 20 is deprecated": bump action versions in deploy.yml.
- Optional: set git name/email in NixOS home-manager (`programs.git`) for all projects.
- Known limits of the timer as a PWA: sound/vibration stop if the screen is turned off or
  the app goes to background (a native APK can fix this). iPhone ignores vibration.
- Idea: the profile weight should follow the latest weigh-in once step 5 exists.
- Diet ideas for later: barcode scanner (camera), edit grams of an entry, copy yesterday's meal,
  manage/delete saved products.
- Step 5: weight log + chart; estimated weight from calorie balance (7700 kcal ≈ 1 kg) vs real.

## Publish a new version
```bash
git add .
git commit -m "describe the change"
git push          # ~1 min later the phone app updates on next open
```

## How to run
```bash
nix-shell          # Node.js environment
npm install        # first time only
npm run dev        # dev server → http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
npm run preview    # test the built app (service worker active) → http://localhost:4173
```

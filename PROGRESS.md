# FightFit — PROGRESS

Personal PWA for combat-sport training (karate / kumite) and diet.

## Status

| # | Feature | Status |
|---|---------|--------|
| 0 | Project skeleton (PWA, offline, DB, navigation, deploy) | ✅ done |
| 1 | Profile + BMR / TDEE / calorie target | ✅ done |
| 2 | Round timer (sound, vibration, presets) | ⏳ next |
| 3 | Workouts log + kcal estimate (MET) | ⬜ |
| 4 | Diet log + Open Food Facts product search | ⬜ |
| 5 | Weight log + chart + estimated vs real weight | ⬜ |
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
- Step 2: round timer (round/rest/rounds/prep, beep + vibration at start/end and 10 s before end,
  saved presets like "Kumite 3x2min").

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

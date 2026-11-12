# FightFit — PROGRESS

Personal PWA for combat-sport training (karate / kumite) and diet.

## Status

| # | Feature | Status |
|---|---------|--------|
| 0 | Project skeleton (PWA, offline, DB, navigation, deploy) | ✅ done |
| 1 | Profile + BMR / TDEE / calorie target | ⏳ next |
| 2 | Round timer (sound, vibration, presets) | ⬜ |
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
- **Testing on phone**: GitHub Pages (HTTPS is required for PWA install/offline).

## Missing / next
- Step 1: profile form, Mifflin-St Jeor BMR, TDEE by activity level, target by goal and pace,
  with unit tests for the formulas.

## How to run
```bash
nix-shell          # Node.js environment
npm install        # first time only
npm run dev        # dev server → http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
npm run preview    # test the built app (service worker active) → http://localhost:4173
```

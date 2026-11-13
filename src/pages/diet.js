// Diet page: daily kcal/macros vs target, meals of the day, add food
// (saved products, Open Food Facts search, or manual entry).
import { db } from '../db.js';
import { computeProfile } from '../lib/calc.js';
import { scale, sumEntries, macroTargets, validatePer100 } from '../lib/nutrition.js';
import { searchProducts } from '../lib/off.js';
import { toISODate, daysAgo, formatDay } from '../lib/dates.js';
import { escapeHtml } from '../lib/html.js';
import { twoTapDelete } from '../lib/ui.js';

const MEALS = {
  breakfast: 'Colazione',
  lunch: 'Pranzo',
  dinner: 'Cena',
  snack: 'Spuntini',
};

// The day shown (kept while you move between pages)
let currentDate = toISODate();

const fmt = (n) => Math.round(n).toLocaleString('it-CH');

export async function renderDiet(container) {
  // Never show a future day (e.g. app left open past midnight is fine, tomorrow is not)
  if (currentDate > toISODate()) currentDate = toISODate();
  await renderDay(container);
}

// =======================================================================
// Day view
// =======================================================================

async function renderDay(container) {
  const profile = await db.profile.get('me');
  const { target } = computeProfile(profile);
  const macros = macroTargets({ targetKcal: target, weightKg: profile.weightKg, goal: profile.goal });

  const entries = await db.meals.where('date').equals(currentDate).toArray();
  entries.sort((a, b) => a.createdAt - b.createdAt);
  const total = sumEntries(entries);
  const remaining = target - total.kcal;
  const isToday = currentDate === toISODate();

  container.innerHTML = `
    <div class="day-nav">
      <button type="button" class="icon-btn" id="prev" aria-label="Giorno prima">◀</button>
      <strong>${formatDay(currentDate)}</strong>
      <button type="button" class="icon-btn" id="next" aria-label="Giorno dopo" ${isToday ? 'disabled' : ''}>▶</button>
    </div>

    <section class="card">
      <div class="kcal-summary">
        <div><span class="stat">${fmt(total.kcal)}</span><span class="muted small">mangiate</span></div>
        <div><span class="stat ${remaining < 0 ? 'over' : 'accent'}">${fmt(Math.abs(remaining))}</span>
             <span class="muted small">${remaining < 0 ? 'oltre l’obiettivo' : 'rimanenti'}</span></div>
        <div><span class="stat">${fmt(target)}</span><span class="muted small">obiettivo <span class="badge">stima</span></span></div>
      </div>
      ${bar(total.kcal, target)}
      <div class="macros">
        ${macroRow('Proteine', total.protein, macros.protein)}
        ${macroRow('Carboidrati', total.carbs, macros.carbs)}
        ${macroRow('Grassi', total.fat, macros.fat)}
      </div>
      <p class="muted small">Macro indicativi: proteine ${profile.goal === 'lose' ? '2.0' : '1.8'} g/kg,
        grassi 25% delle kcal, carboidrati il resto.</p>
    </section>

    ${Object.entries(MEALS).map(([key, label]) => {
      const list = entries.filter((e) => e.meal === key);
      const sub = sumEntries(list);
      return `
      <section class="card">
        <h2 class="day-title">${label} <span class="muted small">${fmt(sub.kcal)} kcal</span></h2>
        <ul class="sessions">
          ${list.map((e) => `
            <li>
              <div class="session-main">
                <strong>${escapeHtml(e.name)}</strong>
                <span class="muted small">${escapeHtml(e.brand ? e.brand + ' · ' : '')}${e.grams} g ·
                  ${e.kcal} kcal · P ${e.protein} · C ${e.carbs} · G ${e.fat}</span>
              </div>
              <button type="button" class="icon-btn" data-delete="${e.id}" aria-label="Elimina">✕</button>
            </li>`).join('')}
        </ul>
        <button type="button" class="btn btn-ghost add-btn" data-meal="${key}">＋ Aggiungi</button>
      </section>`;
    }).join('')}

    <p class="muted small credit">Dati prodotti:
      <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> (ODbL)</p>
  `;

  container.querySelector('#prev').addEventListener('click', () => {
    currentDate = daysAgo(1, parseDate(currentDate));
    renderDay(container);
  });
  container.querySelector('#next').addEventListener('click', () => {
    currentDate = daysAgo(-1, parseDate(currentDate));
    renderDay(container);
  });
  container.querySelectorAll('[data-meal]').forEach((btn) =>
    btn.addEventListener('click', () => renderAdd(container, btn.dataset.meal)));
  container.querySelectorAll('[data-delete]').forEach((btn) =>
    twoTapDelete(btn, async () => {
      await db.meals.delete(Number(btn.dataset.delete));
      renderDay(container);
    }));
}

function bar(value, max) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return `<div class="bar ${value > max ? 'over' : ''}"><div style="width:${pct}%"></div></div>`;
}

function macroRow(label, value, targetG) {
  return `
    <div class="macro">
      <div class="macro-head"><span>${label}</span>
        <span class="muted small">${fmt(value)} / ${targetG} g</span></div>
      ${bar(value, targetG)}
    </div>`;
}

function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// =======================================================================
// Add food: search saved products / Open Food Facts, or manual entry
// =======================================================================

async function renderAdd(container, meal) {
  // Saved products: most used first, then most recent
  const saved = await db.foods.toArray();
  saved.sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0) || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));

  container.innerHTML = `
    <button type="button" class="link-btn" id="back">← ${MEALS[meal]} · ${formatDay(currentDate)}</button>
    <form id="search-form" class="card form" novalidate>
      <h2>Aggiungi a ${MEALS[meal]}</h2>
      <div class="row">
        <input type="search" name="q" placeholder="Nome e marca, es. yogurt greco migros" autocomplete="off">
        <button type="submit" class="btn">Cerca</button>
      </div>
      <p id="search-status" class="muted small" aria-live="polite"></p>
      <button type="button" class="btn btn-ghost" id="manual">✎ Inserisci a mano</button>
    </form>
    <section class="card" id="saved-box"></section>
    <section class="card" id="online-box" hidden></section>
  `;

  const back = () => renderDay(container);
  container.querySelector('#back').addEventListener('click', back);
  container.querySelector('#manual').addEventListener('click', () => renderManual(container, meal));

  const form = container.querySelector('#search-form');
  const status = container.querySelector('#search-status');
  const savedBox = container.querySelector('#saved-box');
  const onlineBox = container.querySelector('#online-box');

  // Typing filters your saved products instantly (offline)
  const showSaved = () => {
    const q = form.elements.q.value.trim().toLowerCase();
    const list = saved.filter((f) => `${f.name} ${f.brand}`.toLowerCase().includes(q)).slice(0, 30);
    savedBox.innerHTML = `
      <h2>I tuoi prodotti</h2>
      ${list.length ? productList(list, 'saved') : `<p class="muted small">${saved.length
        ? 'Nessun prodotto salvato con questo nome. Premi Cerca per cercare online.'
        : 'Qui compariranno i prodotti che aggiungi: così li ritrovi subito, anche offline.'}</p>`}`;
    bindPick(savedBox, list);
  };

  const bindPick = (box, list) => {
    box.querySelectorAll('[data-pick]').forEach((btn) =>
      btn.addEventListener('click', () => renderPortion(container, meal, list[Number(btn.dataset.pick)])));
  };

  form.elements.q.addEventListener('input', showSaved);
  showSaved();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = form.elements.q.value.trim();
    if (q.length < 2) { status.textContent = 'Scrivi almeno 2 lettere.'; return; }
    status.textContent = 'Cerco su Open Food Facts…';
    form.querySelector('button[type=submit]').disabled = true;
    try {
      const results = await searchProducts(q);
      status.textContent = results.length ? '' : 'Nessun prodotto trovato. Prova con altre parole o inseriscilo a mano.';
      onlineBox.hidden = results.length === 0;
      onlineBox.innerHTML = `<h2>Open Food Facts</h2>${productList(results, 'online')}`;
      bindPick(onlineBox, results);
    } catch (err) {
      status.textContent = '⚠️ ' + err.message;
    } finally {
      form.querySelector('button[type=submit]').disabled = false;
    }
  });

  form.elements.q.focus();
}

function productList(list) {
  return `<ul class="product-list">
    ${list.map((p, i) => `
      <li><button type="button" class="product" data-pick="${i}">
        <span class="session-main">
          <strong>${escapeHtml(p.name)}</strong>
          <span class="muted small">${escapeHtml(p.brand || '—')}</span>
        </span>
        <span class="muted small nowrap">${p.per100.kcal} kcal/100 g</span>
      </button></li>`).join('')}
  </ul>`;
}

// --- Portion: choose grams, see kcal/macros, add -----------------------

function renderPortion(container, meal, food) {
  const defaultGrams = food.servingG && food.servingG > 0 ? food.servingG : 100;

  container.innerHTML = `
    <button type="button" class="link-btn" id="back">← Indietro</button>
    <form id="portion-form" class="card form" novalidate>
      <div>
        <h2 id="food-name"></h2>
        <p class="muted small" id="food-brand"></p>
        <p class="muted small">Per 100 g: ${food.per100.kcal} kcal · P ${food.per100.protein} g ·
          C ${food.per100.carbs} g · G ${food.per100.fat} g</p>
      </div>
      <label>Quantità (g)
        <input type="number" name="grams" min="1" max="3000" step="1" inputmode="decimal" value="${defaultGrams}">
      </label>
      ${food.servingG ? `<p class="muted small">1 porzione = ${food.servingG} g</p>` : ''}
      <p class="estimate" id="portion-result"></p>
      <button type="submit" class="btn">Aggiungi a ${MEALS[meal]}</button>
      <p id="portion-status" class="muted small" aria-live="polite"></p>
    </form>
  `;
  // User/online text -> textContent, never innerHTML
  container.querySelector('#food-name').textContent = food.name;
  container.querySelector('#food-brand').textContent = food.brand || '';

  const form = container.querySelector('#portion-form');
  const result = container.querySelector('#portion-result');
  const grams = () => Number(form.elements.grams.value);

  const show = () => {
    const g = grams();
    if (!(g > 0)) { result.textContent = ''; return; }
    const v = scale(food.per100, g);
    result.innerHTML = `<strong>${v.kcal} kcal</strong>
      <span class="muted small">P ${v.protein} g · C ${v.carbs} g · G ${v.fat} g</span>`;
  };
  form.addEventListener('input', show);
  show();

  container.querySelector('#back').addEventListener('click', () => renderAdd(container, meal));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const g = grams();
    if (!(g >= 1 && g <= 3000)) {
      container.querySelector('#portion-status').textContent = '⚠️ Quantità tra 1 e 3000 g.';
      return;
    }
    const now = Date.now();
    await db.meals.add({
      date: currentDate,
      meal,
      name: food.name,
      brand: food.brand ?? '',
      barcode: food.barcode ?? null,
      grams: g,
      per100: food.per100, // copy: the entry stays correct even if the saved product changes
      ...scale(food.per100, g),
      createdAt: now,
      updatedAt: now,
    });
    await rememberFood(food, g);
    renderDay(container);
  });

  form.elements.grams.select();
}

/** Save (or update) the product in "I tuoi prodotti". */
async function rememberFood(food, grams) {
  const existing = food.barcode
    ? await db.foods.where('barcode').equals(food.barcode).first()
    : await db.foods.where('name').equals(food.name).filter((f) => (f.brand ?? '') === (food.brand ?? '')).first();

  const now = Date.now();
  await db.foods.put({
    ...(existing ?? {}),
    name: food.name,
    brand: food.brand ?? '',
    barcode: food.barcode ?? null,
    per100: food.per100,
    servingG: food.servingG ?? null,
    source: food.source ?? 'manual',
    lastGrams: grams,
    useCount: (existing?.useCount ?? 0) + 1,
    lastUsedAt: now,
    updatedAt: now,
  });
}

// --- Manual product ----------------------------------------------------

function renderManual(container, meal) {
  container.innerHTML = `
    <button type="button" class="link-btn" id="back">← Indietro</button>
    <form id="manual-form" class="card form" novalidate>
      <h2>Prodotto manuale</h2>
      <p class="muted small">Copia i valori <strong>per 100 g</strong> dalla tabella nutrizionale dell'etichetta.</p>
      <label>Nome<input type="text" name="name" maxlength="80" required></label>
      <label>Marca <span class="muted small">(facoltativo)</span><input type="text" name="brand" maxlength="60"></label>
      <div class="row">
        <label>kcal<input type="number" name="kcal" min="0" max="900" inputmode="decimal"></label>
        <label>Proteine (g)<input type="number" name="protein" min="0" max="100" step="0.1" inputmode="decimal"></label>
      </div>
      <div class="row">
        <label>Carboidrati (g)<input type="number" name="carbs" min="0" max="100" step="0.1" inputmode="decimal"></label>
        <label>Grassi (g)<input type="number" name="fat" min="0" max="100" step="0.1" inputmode="decimal"></label>
      </div>
      <button type="submit" class="btn">Avanti</button>
      <p id="manual-status" class="muted small" aria-live="polite"></p>
    </form>
  `;
  container.querySelector('#back').addEventListener('click', () => renderAdd(container, meal));

  const form = container.querySelector('#manual-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements;
    const name = f.name.value.trim();
    const n = (el) => (el.value === '' ? 0 : Number(el.value)); // empty macro = 0
    const per100 = { kcal: Number(f.kcal.value), protein: n(f.protein), carbs: n(f.carbs), fat: n(f.fat) };
    const status = container.querySelector('#manual-status');
    if (!name) { status.textContent = '⚠️ Inserisci il nome.'; return; }
    if (f.kcal.value === '') { status.textContent = '⚠️ Inserisci le kcal per 100 g.'; return; }
    const error = validatePer100(per100);
    if (error) { status.textContent = '⚠️ ' + error; return; }
    renderPortion(container, meal, {
      name, brand: f.brand.value.trim(), barcode: null, per100, servingG: null, source: 'manual',
    });
  });
}

// Product search on Open Food Facts (free, open database, no API key).
// Data licence: ODbL — the app shows a credit in the diet page.
//
// OFF allows about 10 search requests per minute, so:
// - we search only when the user presses "Cerca" (not on every key)
// - we keep a small minimum gap between searches
import { normalizeOffProduct } from './nutrition.js';

const FIELDS = 'code,product_name,product_name_it,generic_name,brands,nutriments,serving_quantity';
const PAGE_SIZE = 20;
const TIMEOUT_MS = 12_000;
const MIN_GAP_MS = 3_000;

let lastSearchAt = 0;

/** Search-a-licious: the new full-text search service of Open Food Facts. */
function searchaliciousUrl(query) {
  const p = new URLSearchParams({ q: query, page_size: PAGE_SIZE, fields: FIELDS, langs: 'it,en,fr,de' });
  return `https://search.openfoodfacts.org/search?${p}`;
}

/** Legacy full-text search (fallback if the new service fails). */
function legacyUrl(query) {
  const p = new URLSearchParams({
    search_terms: query, search_simple: 1, action: 'process', json: 1,
    page_size: PAGE_SIZE, fields: FIELDS,
  });
  return `https://world.openfoodfacts.org/cgi/search.pl?${p}`;
}

async function fetchJson(url) {
  // AbortController lets us give up if the server is too slow
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} query product name and/or brand, e.g. "yogurt greco migros"
 * @returns {Promise<ReturnType<typeof normalizeOffProduct>[]>} products with calories
 * @throws Error with an Italian message the page can show directly
 */
export async function searchProducts(query) {
  if (!navigator.onLine) throw new Error('Sei offline: puoi usare i prodotti salvati o inserirne uno a mano.');

  const wait = lastSearchAt + MIN_GAP_MS - Date.now();
  if (wait > 0) throw new Error(`Aspetta ${Math.ceil(wait / 1000)} s prima di una nuova ricerca.`);
  lastSearchAt = Date.now();

  let raw;
  try {
    const data = await fetchJson(searchaliciousUrl(query));
    raw = data.hits ?? [];
  } catch {
    try {
      const data = await fetchJson(legacyUrl(query));
      raw = data.products ?? [];
    } catch {
      throw new Error('Open Food Facts non risponde. Riprova tra poco o inserisci il prodotto a mano.');
    }
  }

  // Keep only products with calories, and drop duplicates (same barcode)
  const seen = new Set();
  const products = [];
  for (const item of raw) {
    const p = normalizeOffProduct(item);
    if (!p) continue;
    if (p.barcode) {
      if (seen.has(p.barcode)) continue;
      seen.add(p.barcode);
    }
    products.push(p);
  }
  return products;
}

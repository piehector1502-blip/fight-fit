// Home / dashboard. For now: greeting + daily calorie target.
// The full day/week summary comes in step 6.
import { db } from '../db.js';
import { computeProfile } from '../lib/calc.js';

export async function renderDashboard(container) {
  const profile = await db.profile.get('me');
  const r = computeProfile(profile);

  container.innerHTML = `
    <section class="card">
      <h2 id="greeting"></h2>
      <p class="muted">Obiettivo di oggi <span class="badge">stima</span></p>
      <p class="stat accent">${Math.round(r.target).toLocaleString('it-CH')} kcal</p>
    </section>
    <a class="card card-link" href="#/timer">
      <strong>⏱ Timer round</strong>
      <span class="muted small">Kumite, sacco, tabata</span>
    </a>
    <section class="card">
      <p class="muted small">Riepilogo di giorno e settimana: in costruzione.</p>
    </section>
  `;
  // textContent (not innerHTML) because the name is typed by the user
  container.querySelector('#greeting').textContent = `Ciao, ${profile.firstName || 'atleta'} 👋`;
}

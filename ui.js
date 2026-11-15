// Shared state, storage and UI helpers for every view.
import * as G from './game.js';

const SAVE_KEY = 'pokeforest.save';
const META_KEY = 'pokeforest.meta';
const SESSION_KEY = 'pokeforest.session';
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

export const app = {
  state: null,
  meta: { minutes: 25, mode: 'owned', strict: false, boxIndex: 0, pomodoroEnabled: false, pomodoro: { rounds: 4, focusMinutes: 25, breakMinutes: 5 }, tab: 'train', sub: {} },
  session: null,
  render: () => {},
};

export const $ = (selector, root = document) => root.querySelector(selector);
export const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const art = (id, shiny) => `${SPRITES}/other/official-artwork/${shiny ? 'shiny/' : ''}${id}.png`;
export const pixel = (id, shiny) => `${SPRITES}/${shiny ? 'shiny/' : ''}${id}.png`;
export const duration = (m) => (m < 60 ? `${m} Min` : `${Math.floor(m / 60)} Std${m % 60 ? ` ${m % 60} Min` : ''}`);
export const num = (n) => Number(n).toLocaleString('de-DE');
export const bar = (fraction, color) => `<div class="bar"><span style="width:${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%${color ? `;background:${color}` : ''}"></span></div>`;
export const segmented = (key, options) => {
  const current = app.meta.sub[key] ?? options[0][0];
  return `<div class="segmented" role="tablist">${options.map(([id, label]) => `<button role="tab" data-action="sub" data-key="${key}" data-value="${id}" aria-selected="${id === current}">${esc(label)}</button>`).join('')}</div>`;
};
export const sub = (key, fallback) => app.meta.sub[key] ?? fallback;

function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function write(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); }
  catch { toast('Speichern im Browser nicht möglich. Sichere deinen Stand im Bereich Sync.'); }
}
export function loadAll() {
  app.state = read(SAVE_KEY);
  app.meta = { ...app.meta, ...(read(META_KEY) || {}) };
  app.meta.sub ||= {};
  app.session = read(SESSION_KEY);
  if (app.state) G.prepareSave(app.state);
}
export function save() { app.meta.changedAt = Date.now(); write(SAVE_KEY, app.state); write(META_KEY, app.meta); }
export function saveMeta() { write(META_KEY, app.meta); }
export function saveSession() { write(SESSION_KEY, app.session); }
export function replaceState(state) { app.state = G.prepareSave(state); save(); }

export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3600);
}

export function openSheet(html, onClose) {
  const dialog = $('#sheet');
  dialog.innerHTML = `<div class="sheet-body">${html}</div>`;
  // A close event from a previous sheet can arrive after this one opened; ignore it while open.
  dialog.onclose = () => { if (dialog.open) return; dialog.innerHTML = ''; onClose?.(); };
  if (!dialog.open) dialog.showModal();
}
export function closeSheet() { const d = $('#sheet'); if (d.open) d.close(); }

const evolutionQueue = [];
export function queueEvolutions(events) { evolutionQueue.push(...events); }
export function playEvolutions() {
  const event = evolutionQueue.shift();
  if (!event) return;
  const dialog = $('#evolution');
  dialog.innerHTML = `<div class="evo-body"><h2 id="evo-title">Nanu?</h2>
    <div class="evo-stage" id="evo-stage"><img id="evo-img" src="${art(event.fromSpriteID, event.shiny)}" alt=""></div>
    <p id="evo-text">${esc(event.fromName)} entwickelt sich …</p>
    <button class="pill" id="evo-button">Überspringen</button></div>`;
  dialog.showModal();
  const img = $('#evo-img', dialog);
  let timer;
  const reveal = () => {
    clearTimeout(timer);
    img.src = art(event.toSpriteID, event.shiny);
    $('#evo-stage', dialog).classList.add('done');
    $('#evo-title', dialog).textContent = 'Glückwunsch!';
    $('#evo-text', dialog).textContent = `${event.fromName} hat sich zu ${event.toName} entwickelt!`;
    const button = $('#evo-button', dialog);
    button.textContent = 'Weiter';
    button.onclick = () => dialog.close();
  };
  const start = performance.now();
  const flicker = () => {
    const t = (performance.now() - start) / 4200;
    if (t >= 1) { reveal(); return; }
    img.src = art(Math.floor(t * (3 + 22 * t * t)) % 2 ? event.toSpriteID : event.fromSpriteID, event.shiny);
    timer = setTimeout(flicker, Math.max(60, 420 * (1 - t)));
  };
  $('#evo-button', dialog).onclick = reveal;
  dialog.onclose = () => { clearTimeout(timer); playEvolutions(); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) reveal(); else flicker();
}

/** Bottom sheet with a Pokémon's details and every action that applies to it. */
export function pokemonSheet(id) {
  const state = app.state;
  const p = G.findPokemon(state, id);
  if (!p) return;
  const d = G.describe(p);
  const running = !!app.session;
  const inTeam = state.teamPokemonIDs.includes(id);
  const trip = (state.expeditions || []).find((t) => t.pokemonID === id);
  const teamFull = state.teamPokemonIDs.length >= G.TEAM_SIZE;
  const where = inTeam ? (id === state.selectedPokemonID ? 'Trainingspartner im Team' : 'Im Team')
    : trip ? `Auf Expedition: ${G.EXPEDITIONS[trip.kind].title} (${trip.progressMinutes}/${G.EXPEDITIONS[trip.kind].goal} Min)` : `Im PC, ${state.pcBoxes[G.boxOf(state, id)]?.name ?? ''}`;
  let actions = '';
  if (!trip && id !== state.selectedPokemonID) actions += `<button class="pill" data-action="partner" data-id="${id}" ${running ? 'disabled' : ''}>Als Trainingspartner wählen</button>`;
  if (inTeam) actions += `<button class="pill quiet" data-action="to-pc" data-id="${id}" ${state.teamPokemonIDs.length <= 1 || (running && id === state.selectedPokemonID) ? 'disabled' : ''}>In den PC</button>`;
  else if (trip) actions += trip.progressMinutes >= G.EXPEDITIONS[trip.kind].goal ? `<button class="pill" data-action="claim-trip" data-id="${trip.id}">Fundstücke abholen</button>` : `<button class="pill quiet" data-action="recall" data-id="${trip.id}">Zurückrufen</button>`;
  else {
    actions += teamFull
      ? `<p class="small muted">Team voll. Tausche mit:</p><div class="mini-team">${state.teamPokemonIDs.filter((m) => !(running && m === state.selectedPokemonID)).map((m) => {
          const md = G.describe(G.findPokemon(state, m));
          return `<button data-action="swap" data-id="${id}" data-with="${m}" aria-label="Tauschen mit ${esc(md.name)}"><img src="${pixel(md.spriteID)}" alt=""><span>Lv.${md.level}</span></button>`;
        }).join('')}</div>`
      : `<button class="pill quiet" data-action="to-team" data-id="${id}">Ins Team holen</button>`;
    if ((state.expeditions || []).length < G.MAX_EXPEDITIONS) {
      actions += '<p class="small muted">Auf Expedition schicken:</p>' + Object.entries(G.EXPEDITIONS).map(([key, k]) => `<button class="pill quiet" data-action="expedition" data-id="${id}" data-kind="${key}">${k.icon} ${k.title}: ${k.goal} Min · ${k.coins} Münzen</button>`).join('');
    }
  }
  const legend = G.legendaryID(p.species) != null;
  openSheet(`
    <div class="sheet-head"><img src="${art(d.spriteID, p.isShiny)}" alt=""><div>
      <h2>${esc(d.name)}${p.isShiny ? ' <span class="note-sun">✦</span>' : ''}</h2>
      <p class="muted">Lv. ${d.level} · ${esc(p.species.displayName)} · #${d.spriteID}</p>
      <p class="small">${esc(where)}</p>
      ${bar(d.progress)}
      <p class="small muted">${d.maxLevel ? 'Level 100 erreicht.' : `Noch ${d.toNextLevel} Fokus-Min bis Lv. ${d.level + 1}.`}${d.nextEvolutionName ? ` Entwicklung zu ${esc(d.nextEvolutionName)} in ${duration(d.toNextEvolution)}.` : ''}</p>
      <p class="small muted">${p.trainingMinutes} Min gemeinsam · ${p.sessions} Trainings · +${d.raidBonus} % Raid-Bonus</p>
    </div></div>
    <form class="row" data-form="rename" data-id="${id}"><input name="nickname" maxlength="24" placeholder="Spitzname" value="${esc(p.nickname)}" aria-label="Spitzname"><button class="pill quiet">Speichern</button></form>
    <div class="actions">${actions}
      ${legend ? '' : `<button class="pill quiet" data-action="adopt" data-species="${esc(p.species.id)}">Weiteres Exemplar · ${G.copyPrice(state, p.species)} Münzen</button>`}
      <button class="pill danger" data-action="release" data-id="${id}" ${running || trip ? 'disabled' : ''}>Freilassen …</button>
      <button class="pill quiet" data-action="close">Schließen</button></div>`);
}

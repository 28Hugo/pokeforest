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
const defaultSprite = (id, shiny) => `${SPRITES}/${shiny ? 'shiny/' : ''}${id}.png`;
/** Every sprite in the app uses the DS look (see `ds`); forms above #1025 keep the default sprite. */
export const pixel = (id, shiny) => (id >= 1 && id <= 1025 ? ds(id, shiny) : defaultSprite(id, shiny));
export const art = pixel;
/** DS-era sprites for all 1025 Pokémon: Platin #1–493, Schwarz/Weiß style #494–1025; forms use the default sprite. */
export const ds = (id, shiny) => (id > 1025 || id < 1 ? defaultSprite(id, shiny)
  : `${SPRITES}/versions/${id <= 493 ? 'generation-iv/platinum' : 'generation-v/black-white'}/${shiny ? 'shiny/' : ''}${id}.png`);
/** Type badge in the handheld style. */
/** Short original 8-bit melodies (square wave), not taken from the games. */
const JINGLES = { levelUp: [[72, 2], [76, 2], [79, 2], [84, 6]], badge: [[67, 2], [72, 2], [76, 2], [79, 3], [76, 1], [79, 2], [84, 8]], hatch: [[76, 2], [74, 2], [76, 2], [79, 2], [0, 2], [81, 2], [84, 6]] };
let audio = null;
export function jingle(kind) {
  if (app.meta?.sound === false) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    let t = audio.currentTime + 0.05;
    for (const [note, len] of JINGLES[kind] || []) {
      const dur = len * 0.075;
      if (note) {
        const osc = audio.createOscillator(); const gain = audio.createGain();
        osc.type = 'square'; osc.frequency.value = 440 * 2 ** ((note - 69) / 12);
        gain.gain.setValueAtTime(0.06, t); gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain).connect(audio.destination); osc.start(t); osc.stop(t + dur);
      }
      t += dur;
    }
  } catch { /* no audio */ }
}
export const typeBadge = (n, small) => { const t = G.typeInfo(n); return `<span class="type ${small ? 'small' : ''} ${t.darkText ? 'dark' : ''}" style="--c:${t.colorHex}">${esc(t.name)}</span>`; };
export const typeBadges = (list, small) => `<span class="types">${list.map((n) => typeBadge(n, small)).join('')}</span>`;
export const duration = (m) => (m < 60 ? `${m} Min` : `${Math.floor(m / 60)} Std${m % 60 ? ` ${m % 60} Min` : ''}`);
export const num = (n) => Number(n).toLocaleString('de-DE');
export const bar = (fraction, color) => `<div class="bar"><span style="width:${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%${color ? `;background:${color}` : ''}"></span></div>`;
export const segmented = (key, options) => {
  const current = app.meta.sub[key] ?? options[0][0];
  return `<div class="segmented" role="tablist">${options.map(([id, label]) => `<button role="tab" data-action="sub" data-key="${key}" data-value="${id}" aria-selected="${id === current}">${esc(label)}</button>`).join('')}</div>`;
};
export const sub = (key, fallback) => app.meta.sub[key] ?? fallback;

// 5.9 – Aufräumen: ⓘ statt Erklärtext, gleiche Seitenköpfe, kleine Unter-Schalter, „Heute“-Streifen.
export const info = (text) => `<details class="info"><summary aria-label="Erklärung anzeigen" title="So funktioniert's">ⓘ</summary><p>${esc(text)}</p></details>`;
export const pageHead = (title, subtitle = '', infoText = '', trailing = '') => `<div class="page-head"><div><h2>${esc(title)}${infoText ? info(infoText) : ''}</h2>${subtitle ? `<p class="small muted">${esc(subtitle)}</p>` : ''}</div>${trailing}</div>`;
export const pills = (key, options, fallback = options[0][0]) => {
  const current = app.meta.sub[key] ?? fallback;
  return `<div class="pills" role="tablist">${options.map(([id, label]) => `<button role="tab" data-action="sub" data-key="${key}" data-value="${id}" aria-selected="${id === current}">${esc(label)}</button>`).join('')}</div>`;
};
const todayChip = (e) => `<button class="today-chip" style="--c:${G.TODAY_COLORS[e.kind]}" data-action="today" data-kind="${e.kind}" data-habitat="${e.habitatID ?? ''}" data-id="${e.pokemonID ?? ''}" title="${esc(`${e.title} · ${e.detail}`)}">
  ${e.dexID ? `<img src="${ds(e.dexID)}" alt="">` : '<span aria-hidden="true">⚠️</span>'}<span><strong>${esc(e.title)}</strong><small>${esc(e.detail)}</small></span></button>`;
export function todayStrip(state, mode) {
  const events = G.todayEvents(state, mode);
  if (!events.length) return '';
  const more = events.length - G.TODAY_VISIBLE;
  return `<div class="today">${events.slice(0, G.TODAY_VISIBLE).map(todayChip).join('')}${more > 0 ? `<details class="today-more"><summary>+${more} weitere</summary><div class="today-list">${events.map(todayChip).join('')}</div></details>` : ''}</div>`;
}

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

/** Short message; with `action` ({ label, action }) it carries a button, e.g. „Rückgängig“. */
export function toast(message, action = null) {
  const el = $('#toast');
  el.textContent = message;
  if (action) { const b = document.createElement('button'); b.className = 'link'; b.dataset.action = action.action; b.textContent = action.label; el.append(' ', b); }
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), action ? 10000 : 3600);
}

// MARK: Tutorial mit Prof. Eibe, Spielhilfe, Neu in dieser Version
export function showTutorial(index = 0) {
  const steps = G.C.life.tutorial;
  const step = steps[index];
  const last = index === steps.length - 1;
  openSheet(`<div class="tutorial">
    <div class="row"><small class="muted">Schritt ${index + 1} von ${steps.length}</small><button class="link" data-action="tutorial-done">Überspringen</button></div>
    <div class="tutorial-card"><div><img src="${ds(step.spriteID)}" alt=""><small>Prof. Eibe</small></div>
      <div><h2>${esc(step.title)}</h2><ul>${step.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div></div>
    <div class="dots">${steps.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row wrap">
      ${step.page && index > 0 && !last ? `<button class="pill quiet" data-action="tutorial-show" data-page="${step.page}">Zeig mir das</button>` : ''}
      <button class="pill quiet" data-action="help">Spielhilfe</button>
      ${index > 0 ? `<button class="pill quiet" data-action="tutorial-step" data-index="${index - 1}">Zurück</button>` : ''}
      ${last ? '<button class="pill" data-action="tutorial-first">Erste Runde: 15 Minuten</button>' : `<button class="pill" data-action="tutorial-step" data-index="${index + 1}">Weiter</button>`}
    </div></div>`);
}
export function showHelp(query = '') {
  const list = G.C.life.help.filter((h) => !query || `${h.title} ${h.text}`.toLowerCase().includes(query.toLowerCase()));
  openSheet(`<h2>Spielhilfe von A bis Z</h2>
    <input type="search" data-action="help-search" value="${esc(query)}" placeholder="Suchen" aria-label="Spielhilfe durchsuchen">
    <div class="stack">${list.map((h) => `<div class="panel"><strong>${esc(h.title)}</strong><p class="small muted">${esc(h.text)}</p></div>`).join('') || '<p class="muted">Nichts gefunden.</p>'}</div>
    <div class="row"><button class="pill quiet" data-action="tutorial">Tutorial</button><button class="pill" data-action="close">Schließen</button></div>`);
}
export function showWhatsNew() {
  const w = G.C.life.whatsNew;
  openSheet(`<h2>Neu in ${esc(w.version)}</h2><ul class="result">${w.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="row"><button class="pill quiet" data-action="tutorial">Tutorial ansehen</button><button class="pill" data-action="close">Los geht's</button></div>`,
  () => { app.meta.lastSeenVersion = w.version; saveMeta(); });
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
/** The "Trainer-Memo" page of the Diamant/Perl summary. */
function trainerMemo(p) {
  const state = app.state;
  const origin = p.species.elementType === 'Fossil' ? 'Aus einem Fossil im Untergrund wiederbelebt.'
    : G.legendaryID(p.species) != null ? 'Ein legendärer Begleiter aus Raid oder Ei.'
    : (state.plantedTrees || []).some((t) => t.wasWildEncounter && t.pokemonID === p.id) ? 'Bei einer wilden Begegnung gefangen.' : 'Dein Trainingspartner aus dem Poké-Shop.';
  const matchup = G.raidMatchup(G.pokemonTypes(p), G.typesOf(G.activeBoss(state).pokedexID));
  const fits = G.C.habitats.places.find((h) => G.habitatFits(h, p));
  const since = G.fromSwiftDate(p.obtainedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<div class="memo"><strong>TRAINER-MEMO</strong>
    <p>Seit ${since} bei dir. ${origin}</p>
    <p>${p.trainingMinutes} Fokus-Minuten in ${p.sessions} Runden trainiert.</p>
    <p>Gegen den Raid-Boss: ${G.MATCHUP[matchup].label}.</p>
    ${fits ? `<p class="muted">Fühlt sich ${esc(fits.locative)} wohl.</p>` : ''}</div>`;
}
export function pokemonSheet(id) {
  const state = app.state;
  const p = G.findPokemon(state, id);
  if (!p) return;
  const d = G.describe(p);
  const running = !!app.session;
  const inTeam = state.teamPokemonIDs.includes(id);
  const trip = (state.expeditions || []).find((t) => t.pokemonID === id);
  const teamFull = state.teamPokemonIDs.length >= G.TEAM_SIZE;
  const home = G.habitatOf(state, id);
  const where = inTeam ? (id === state.selectedPokemonID ? 'Trainingspartner im Team' : 'Im Team')
    : home ? `Wohnt ${home.locative}`
    : G.inPension(state, id) ? 'In der Pension Trostu' 
    : trip ? `Auf Expedition: ${G.EXPEDITIONS[trip.kind].title} (${trip.progressMinutes}/${G.EXPEDITIONS[trip.kind].goal} Min)` : `Im PC, ${state.pcBoxes[G.boxOf(state, id)]?.name ?? ''}`;
  const nature = G.natureOf(p);
  const stone = G.stoneNeeded(p);
  const candies = G.itemCount(state, 'sonderbonbon');
  const ribbons = G.ribbonsOf(state, id);
  const cond = G.conditionsOf(state, id);
  const stoneName = (dex) => G.stoneByID(G.C.zone.stoneFor[String(dex)])?.name;
  const chain = p.species.stages.slice(0, 3).map((st, i) => `${i ? `<span class="evo-arrow">→<small>${esc(stoneName(st.pokedexID) ?? `Lv. ${p.species.stages.length === 2 ? 20 : i === 1 ? 16 : 36}`)}</small></span>` : ''}
    <span class="evo-stage ${i + 1 <= d.stage ? '' : 'dim'}"><img src="${ds(st.pokedexID, app.meta.sheetShiny)}" alt=""><small>${esc(st.name)}</small></span>`).join('');
  const journeyPanel = `<div class="panel stack small">
    <div class="row"><strong>Entwicklungslinie</strong><button class="link" data-action="sheet-shiny" data-id="${id}">${app.meta.sheetShiny ? 'Normal zeigen' : 'Shiny zeigen'}</button></div>
    <div class="evo-line">${chain}</div><p><strong>Wesen: ${esc(nature.name)}</strong> · <span class="muted">${esc(nature.hint)}</span></p>
    <div class="conditions">${G.contestCategories().map((c) => `<div class="row"><span>${esc(c.name)}</span>${bar(cond[c.id] / G.C.zone.contest.maxCondition, c.colorHex)}<span>${cond[c.id]}</span></div>`).join('')}</div>
    ${ribbons.length ? `<p>Bänder: ${ribbons.map((r) => { const [c, k] = r.split('-').map(Number); return `<span title="${esc(G.contestCategories()[c].name)}, ${esc(G.contestRanks()[k].name)}" style="color:${G.contestCategories()[c].colorHex}">🎀</span>`; }).join('')}</p>` : ''}
    <div class="row wrap">${candies && !d.maxLevel ? `<button class="pill quiet" data-action="candy" data-id="${id}">Sonderbonbon geben (${candies})</button>` : ''}
      ${stone ? `<button class="pill quiet" data-action="stone" data-id="${id}" data-stone="${stone.id}">${esc(stone.name)} verwenden (${G.itemCount(state, stone.id)})</button>` : ''}</div></div>`;
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
    if (G.inPension(state, id)) actions += `<button class="pill quiet" data-action="pension-leave" data-id="${id}">Aus der Pension abholen</button>`;
    else if (!G.pensionProblem(state, id, running)) actions += `<button class="pill quiet" data-action="pension-add" data-id="${id}">In die Pension Trostu geben</button>`;
    if (home) actions += `<button class="pill quiet" data-action="habitat-leave" data-id="${id}">Zurück in den PC</button>`;
    else { const fit = G.suggestedHabitat(state, id); if (fit) actions += `<button class="pill quiet" data-action="habitat-quick" data-id="${id}" data-habitat="${fit.id}">Einziehen lassen: ${esc(fit.name)}</button>`; }
    if ((state.expeditions || []).length < G.MAX_EXPEDITIONS) {
      actions += '<p class="small muted">Auf Expedition schicken:</p>' + Object.entries(G.EXPEDITIONS).map(([key, k]) => `<button class="pill quiet" data-action="expedition" data-id="${id}" data-kind="${key}">${k.icon} ${k.title}: ${k.goal} Min · ${k.coins} Münzen</button>`).join('');
    }
  }
  const legend = G.legendaryID(p.species) != null;
  openSheet(`
    <div class="sheet-head"><img src="${art(d.spriteID, p.isShiny)}" alt=""><div>
      <h2>${esc(d.name)}${p.isShiny ? ' <span class="note-sun">✦</span>' : ''}</h2>
      <p class="muted">Lv. ${d.level} · ${esc(p.species.displayName)} · #${d.spriteID}</p>
      ${typeBadges(G.pokemonTypes(p))}
      <p class="small">${esc(where)}</p>
      ${bar(d.progress)}
      <p class="small muted">${d.maxLevel ? 'Level 100 erreicht.' : `Noch ${d.minutesToNextLevel} Fokus-Min bis Lv. ${d.level + 1}.`}${d.nextEvolutionName ? ` Entwicklung zu ${esc(d.nextEvolutionName)} in ${duration(d.minutesToNextEvolution)}.` : ''}</p>
      <p class="small muted">${p.trainingMinutes} Min gemeinsam · ${p.sessions} Trainings · +${d.raidBonus} % Raid-Bonus</p>
    </div></div>
    ${trainerMemo(p)}
    ${journeyPanel}
    <form class="row" data-form="rename" data-id="${id}"><input name="nickname" maxlength="24" placeholder="Spitzname" value="${esc(p.nickname)}" aria-label="Spitzname"><button class="pill quiet">Speichern</button></form>
    <div class="actions">${actions}
      ${legend ? '' : `<button class="pill quiet" data-action="adopt" data-species="${esc(p.species.id)}">Weiteres Exemplar · ${G.copyPrice(state, p.species)} Münzen</button>`}
      <button class="pill danger" data-action="release" data-id="${id}" ${running || trip ? 'disabled' : ''}>Freilassen …</button>
      <button class="pill quiet" data-action="close">Schließen</button></div>`);
}

import * as G from './game.js';

const SAVE_KEY = 'pokeforest.save';
const META_KEY = 'pokeforest.meta';
const SESSION_KEY = 'pokeforest.session';
const STRICT_GRACE_MS = 15000;
const PRESETS = [15, 25, 45, 60, 90];
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

const $ = (selector, root = document) => root.querySelector(selector);
const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const art = (id, shiny) => `${SPRITES}/other/official-artwork/${shiny ? 'shiny/' : ''}${id}.png`;
const pixel = (id, shiny) => `${SPRITES}/${shiny ? 'shiny/' : ''}${id}.png`;
const duration = (minutes) => (minutes < 60 ? `${minutes} Min` : `${Math.floor(minutes / 60)} Std${minutes % 60 ? ` ${minutes % 60} Min` : ''}`);

let state = load(SAVE_KEY);
let meta = load(META_KEY) || { minutes: 25, strict: false, boxIndex: 0 };
let session = load(SESSION_KEY);
let currentView = 'train';
let ticker = null;
let hiddenAt = null;
const evolutionQueue = [];

function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function store(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { toast('Speichern im Browser nicht möglich. Sichere deinen Stand im Sync-Bereich.'); } }
function saveState() { meta.changedAt = Date.now(); store(SAVE_KEY, state); store(META_KEY, meta); }

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 3200);
}

// MARK: Navigation
document.querySelectorAll('.tabbar button').forEach((button) => button.addEventListener('click', () => show(button.dataset.view)));
function show(view) {
  currentView = view;
  document.querySelectorAll('.tabbar button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
  render();
}

function render() {
  $('#coins').textContent = state ? String(state.coins) : '';
  $('#coins').title = state ? `${state.coins} PokéMünzen` : '';
  $('#sync-dot').textContent = state ? syncLabel() : '';
  if (!state) { renderWelcome(); return; }
  ({ train: renderTraining, team: renderTeam, safari: renderSafari, sync: renderSync })[currentView]();
}

function syncLabel() {
  if (!meta.exportedAt) return 'Noch nicht gesichert';
  return meta.changedAt > meta.exportedAt ? '● Nicht gesichert' : 'Gesichert';
}

// MARK: Welcome (no save yet)
function renderWelcome() {
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-train'; });
  $('#view-train').innerHTML = `
    <div class="welcome">
      <h1>Dein Team wartet</h1>
      <p>Lade den Spielstand von deinem Mac, dann trainierst du hier mit denselben Pokémon weiter.</p>
      <ol class="steps">
        <li>Am Mac: <strong>Einstellungen › iPhone &amp; iPad › Jetzt sichern</strong>.</li>
        <li>Hier auf <strong>Spielstand laden</strong> tippen und in <strong>iCloud Drive › PokéForest</strong> die Datei <em>PokéForest_Sync.json</em> wählen.</li>
      </ol>
      <div class="sync-actions">
        <button class="pill" data-action="import">Spielstand laden</button>
        <button class="pill quiet" data-action="fresh">Ohne Mac neu beginnen</button>
      </div>
    </div>`;
}

// MARK: Training
function partner() { return state && G.findPokemon(state, state.selectedPokemonID); }

function renderTraining() {
  const view = $('#view-train');
  const p = partner();
  if (!p) { view.innerHTML = `<div class="welcome"><h2>Kein Trainingspartner</h2><p>Wähle im Bereich Team &amp; PC ein Pokémon aus.</p></div>`; return; }
  const d = G.describe(p);
  const running = !!session;
  const minutes = running ? session.minutes : meta.minutes;
  const dayID = G.pokemonOfTheDay(state.pokemonRoster);
  const dayBonus = dayID === p.id ? Math.floor((minutes * G.DAY_BONUS_PERCENT) / 100) : 0;
  const gain = minutes + dayBonus;
  const projected = G.describe({ ...p, experience: p.experience + gain });
  const star = dayID && dayID !== p.id ? G.findPokemon(state, dayID) : null;
  const others = state.teamPokemonIDs.filter((id) => id !== p.id).map((id) => G.findPokemon(state, id)).filter(Boolean);
  const share = G.sharedExperience(gain);

  view.innerHTML = `
    <div class="train-layout">
      <div class="arena">
        <div class="ring ${running ? 'running' : ''}" id="ring">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle class="track" cx="100" cy="100" r="90"/>
            <circle class="progress" id="ring-progress" cx="100" cy="100" r="90" stroke-dasharray="565.5" stroke-dashoffset="565.5"/>
          </svg>
          <div class="core"><div class="mound"></div><img class="partner" src="${art(d.spriteID, p.isShiny)}" alt="${escapeHTML(d.name)}"></div>
        </div>
        <div class="clock" id="clock" aria-live="off">${String(minutes).padStart(2, '0')}:00</div>
        ${running ? `
          <p class="muted clock-hint" id="clock-hint">${session.strict ? 'Strenger Modus: Bleib in der App.' : 'Du kannst die App schließen – die Zeit läuft weiter.'}</p>
          <button class="giveup" data-action="giveup">Runde abbrechen</button>` : `
          <div class="durations" role="group" aria-label="Dauer">
            ${PRESETS.map((m) => `<button class="chip" data-action="minutes" data-minutes="${m}" aria-pressed="${m === minutes}">${m} Min</button>`).join('')}
          </div>
          <input type="range" min="5" max="180" step="5" value="${minutes}" id="minutes" aria-label="Dauer in Minuten">
          <button class="start" data-action="start">${escapeHTML(d.name)} trainieren</button>`}
      </div>
      <div class="panel">
        <div class="partner-card">
          <img src="${art(d.spriteID, p.isShiny)}" alt="">
          <div>
            <h3>${escapeHTML(d.name)} <span class="muted small">Lv. ${d.level}</span></h3>
            <div class="bar" aria-label="Erfahrung"><span style="width:${Math.round(d.progress * 100)}%"></span></div>
            <p class="small muted">${d.maxLevel ? 'Level 100 erreicht.' : `Diese Runde +${gain} EP → Lv. ${projected.level}. Noch ${d.toNextLevel} Fokus-Min bis Lv. ${d.level + 1}.`}</p>
            ${d.nextEvolutionName ? `<p class="small ${d.toNextEvolution <= gain ? 'note-sun' : 'muted'}">${d.toNextEvolution <= gain ? `Diese Runde entwickelt es sich zu ${escapeHTML(d.nextEvolutionName)}!` : `Entwicklung zu ${escapeHTML(d.nextEvolutionName)} in ${duration(d.toNextEvolution)} Fokus`}</p>` : ''}
            ${dayBonus ? `<p class="small note-sun">Pokémon des Tages: +${G.DAY_BONUS_PERCENT} % EP</p>` : ''}
            ${star && !running ? `<p class="small"><button class="pill quiet" data-action="partner" data-id="${star.id}">Heute in Topform: ${escapeHTML(G.describe(star).name)} wählen</button></p>` : ''}
          </div>
        </div>
        <div class="mini-team" aria-label="Weitere Team-Mitglieder">
          ${others.map((o) => { const od = G.describe(o); return `<button data-action="partner" data-id="${o.id}" ${running ? 'disabled' : ''} title="${escapeHTML(od.name)} als Partner"><img src="${pixel(od.spriteID, o.isShiny)}" alt="${escapeHTML(od.name)}"><span>${state.expShareEnabled && !od.maxLevel ? `+${share}` : `Lv.${od.level}`}</span></button>`; }).join('')}
        </div>
        <div class="row" style="margin-top:14px">
          <label class="switch"><input type="checkbox" data-action="share" ${state.expShareEnabled ? 'checked' : ''}> EP-Teiler</label>
          <span class="small muted">${state.expShareEnabled ? `Team bekommt je +${share} EP` : 'Nur der Partner lernt'}</span>
        </div>
        <div class="row" style="margin-top:8px">
          <label class="switch"><input type="checkbox" data-action="strict" ${meta.strict ? 'checked' : ''} ${running ? 'disabled' : ''}> Strenger Modus</label>
          <span class="small muted">Verlassen &gt; 15 Sek. beendet die Runde</span>
        </div>
      </div>
    </div>`;
  const range = $('#minutes');
  range?.addEventListener('input', () => { meta.minutes = Number(range.value); store(META_KEY, meta); $('#clock').textContent = `${String(meta.minutes).padStart(2, '0')}:00`; updateChips(); });
  range?.addEventListener('change', render);
  tick();
}
function updateChips() { document.querySelectorAll('[data-action="minutes"]').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.minutes) === meta.minutes))); }

function startSession() {
  if (!partner()) return;
  const now = Date.now();
  session = { partnerID: state.selectedPokemonID, minutes: meta.minutes, startedAt: now, endsAt: now + meta.minutes * 60000, strict: meta.strict };
  store(SESSION_KEY, session);
  render();
}

function tick() {
  clearInterval(ticker);
  if (!session) return;
  const update = () => {
    const left = Math.max(0, session.endsAt - Date.now());
    const total = session.minutes * 60000;
    const clock = $('#clock');
    if (clock) clock.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
    const ring = $('#ring-progress');
    if (ring) ring.style.strokeDashoffset = String(565.5 * (left / total));
    document.title = `${clock?.textContent ?? ''} · PokéForest`;
    if (left <= 0) finishSession();
  };
  update();
  ticker = setInterval(update, 1000);
}

function finishSession() {
  clearInterval(ticker);
  const done = session;
  session = null;
  store(SESSION_KEY, null);
  document.title = 'PokéForest';
  if (state.selectedPokemonID !== done.partnerID && G.findPokemon(state, done.partnerID)) state.selectedPokemonID = done.partnerID;
  const result = G.completeRound(state, done.minutes, new Date(done.endsAt));
  saveState();
  evolutionQueue.push(...result.evolutions);
  showResult(result);
  render();
}

function failSession(reason) {
  clearInterval(ticker);
  const failed = session;
  session = null;
  store(SESSION_KEY, null);
  document.title = 'PokéForest';
  const p = G.findPokemon(state, failed.partnerID);
  if (p) {
    state.plantedTrees.unshift({ id: G.newID(), species: p.species, durationMinutes: failed.minutes, timestamp: G.toSwiftDate(), survived: false,
      tagName: (state.tags || [])[0]?.name ?? 'Fokus', tagColorHex: (state.tags || [])[0]?.colorHex ?? '#34C759', note: `Abgebrochen (Web): ${reason}`,
      coinsEarned: 0, isShiny: !!p.isShiny, isMega: false, wasWildEncounter: false, biomeID: state.selectedBiome ?? null, pokemonID: p.id,
      trainedStage: G.describe(p).stage, trainerBonusXP: 0 });
    saveState();
  }
  toast(`Runde beendet: ${reason}. Keine EP.`);
  render();
}

function showResult(r) {
  const lines = [
    `<li><strong>+${r.earned} EP</strong> für ${escapeHTML(r.partner.name)}${r.dayBonus ? ` (davon ${r.dayBonus} als Pokémon des Tages)` : ''}</li>`,
    `<li>+${r.coins} Münzen</li>`,
    r.shared.recipients.length ? `<li class="note-share">EP-Teiler: +${r.shared.amount} EP für ${r.shared.recipients.map(escapeHTML).join(', ')}</li>` : '',
    ...r.levelUps.map((l) => `<li>${escapeHTML(l.name)}: Lv. ${l.from} → ${l.to}</li>`),
    r.finishedTrips.length ? `<li>Expedition fertig: ${r.finishedTrips.map(escapeHTML).join(', ')}</li>` : '',
  ].join('');
  openSheet(`
    <div class="sheet-head"><img src="${art(r.partner.spriteID)}" alt=""><div><h2>Geschafft!</h2><p class="muted">${r.minutes} Minuten Fokus.</p></div></div>
    <ul class="result">${lines}</ul>
    <div class="actions"><button class="pill" data-action="close">Weiter</button></div>`, () => playEvolutions());
}

// MARK: Team & PC
function renderTeam() {
  const view = $('#view-team');
  const dayID = G.pokemonOfTheDay(state.pokemonRoster);
  meta.boxIndex = Math.min(meta.boxIndex || 0, state.pcBoxes.length - 1);
  const box = state.pcBoxes[meta.boxIndex];
  const slots = Array.from({ length: G.TEAM_SIZE }, (_, i) => state.teamPokemonIDs[i]);
  view.innerHTML = `
    <div class="row"><h2>Dein Team</h2><span class="muted">${state.teamPokemonIDs.length} / ${G.TEAM_SIZE}</span></div>
    <div class="team-grid">
      ${slots.map((id) => {
        if (!id) return '<div class="slot empty">Frei</div>';
        const p = G.findPokemon(state, id); const d = G.describe(p);
        return `<button class="slot ${id === state.selectedPokemonID ? 'partner' : ''}" data-action="inspect" data-id="${id}">
          ${id === state.selectedPokemonID ? '<span class="badge partner">Partner</span>' : ''}
          ${id === dayID ? '<span class="badge sun">☀︎ +50 %</span>' : ''}
          <img src="${art(d.spriteID, p.isShiny)}" alt="" loading="lazy"><strong>${escapeHTML(d.name)}</strong><span class="small muted">Lv. ${d.level}</span>
          <div class="bar"><span style="width:${Math.round(d.progress * 100)}%"></span></div></button>`;
      }).join('')}
    </div>
    <div class="panel row">
      <label class="switch"><input type="checkbox" data-action="share" ${state.expShareEnabled ? 'checked' : ''}> EP-Teiler</label>
      <span class="small muted">${state.expShareEnabled ? `Jedes andere Team-Mitglied bekommt ${G.SHARE_PERCENT} % der EP des Partners.` : 'Aus: nur der Partner bekommt EP.'}</span>
    </div>
    <div class="box-head">
      <button class="icon-btn" data-action="box" data-delta="-1" ${meta.boxIndex === 0 ? 'disabled' : ''} aria-label="Vorherige Box">‹</button>
      <h3>${escapeHTML(box.name)} <span class="muted small">${box.pokemonIDs.length}/${G.BOX_CAPACITY}</span></h3>
      <button class="icon-btn" data-action="box" data-delta="1" ${meta.boxIndex >= state.pcBoxes.length - 1 ? 'disabled' : ''} aria-label="Nächste Box">›</button>
    </div>
    <div class="pc-grid">
      ${Array.from({ length: G.BOX_CAPACITY }, (_, i) => {
        const id = box.pokemonIDs[i];
        if (!id) return '<div class="cell"></div>';
        const p = G.findPokemon(state, id); const d = G.describe(p);
        const away = G.onExpedition(state, id);
        return `<button class="cell ${away ? 'away' : ''}" data-action="inspect" data-id="${id}" aria-label="${escapeHTML(d.name)}, Level ${d.level}${away ? ', auf Expedition' : ''}">
          <img src="${pixel(d.spriteID, p.isShiny)}" alt="" loading="lazy">${id === dayID ? '<span class="badge sun">☀︎</span>' : ''}${away ? '<span class="badge trip">⛺</span>' : ''}<span class="lv">${d.level}</span></button>`;
      }).join('')}
    </div>
    <h2 style="margin-top:22px">Expeditionen <span class="muted small">${(state.expeditions || []).length} / ${G.MAX_EXPEDITIONS}</span></h2>
    <div class="trips">
      ${(state.expeditions || []).length ? state.expeditions.map((t) => {
        const k = G.EXPEDITIONS[t.kind]; const p = G.findPokemon(state, t.pokemonID); const d = G.describe(p); const done = t.progressMinutes >= k.goal;
        return `<div class="panel trip"><img src="${pixel(d.spriteID, p.isShiny)}" alt="">
          <div><strong>${k.icon} ${k.title}</strong> <span class="muted small">${escapeHTML(d.name)}</span>
          <div class="bar"><span style="width:${Math.round((t.progressMinutes / k.goal) * 100)}%"></span></div>
          <span class="small muted">${done ? 'Zurück mit Fundstücken!' : `${t.progressMinutes} / ${k.goal} Fokus-Minuten`}</span></div>
          ${done ? `<button class="pill" data-action="claim" data-id="${t.id}">Abholen</button>` : `<button class="pill quiet" data-action="recall" data-id="${t.id}">Zurückrufen</button>`}</div>`;
      }).join('') : '<p class="muted">Tippe ein Pokémon im PC an und schicke es los. Jede Fokus-Minute bringt es weiter.</p>'}
    </div>`;
}

function inspect(id) {
  const p = G.findPokemon(state, id); const d = G.describe(p);
  const inTeam = state.teamPokemonIDs.includes(id);
  const trip = (state.expeditions || []).find((t) => t.pokemonID === id);
  const teamFull = state.teamPokemonIDs.length >= G.TEAM_SIZE;
  const running = !!session;
  const where = inTeam ? (id === state.selectedPokemonID ? 'Trainingspartner im Team' : 'Im Team')
    : trip ? `Auf Expedition: ${G.EXPEDITIONS[trip.kind].title}` : `Im PC, ${state.pcBoxes[G.boxOf(state, id)]?.name}`;
  let actions = '';
  if (!trip && id !== state.selectedPokemonID) actions += `<button class="pill" data-action="partner" data-id="${id}" ${running ? 'disabled' : ''}>Als Trainingspartner wählen</button>`;
  if (inTeam) actions += `<button class="pill quiet" data-action="to-pc" data-id="${id}" ${state.teamPokemonIDs.length <= 1 || (running && id === state.selectedPokemonID) ? 'disabled' : ''}>In den PC</button>`;
  else if (!trip) {
    actions += teamFull
      ? `<p class="small muted">Team voll. Tausche mit:</p><div class="mini-team">${state.teamPokemonIDs.filter((m) => !(running && m === state.selectedPokemonID)).map((m) => {
          const md = G.describe(G.findPokemon(state, m));
          return `<button data-action="swap" data-id="${id}" data-with="${m}" aria-label="Tauschen mit ${escapeHTML(md.name)}"><img src="${pixel(md.spriteID)}" alt=""><span>Lv.${md.level}</span></button>`;
        }).join('')}</div>`
      : `<button class="pill quiet" data-action="to-team" data-id="${id}">Ins Team holen</button>`;
    if ((state.expeditions || []).length < G.MAX_EXPEDITIONS) actions += '<p class="small muted">Auf Expedition schicken:</p>';
    if ((state.expeditions || []).length < G.MAX_EXPEDITIONS) {
      actions += Object.entries(G.EXPEDITIONS).map(([key, k]) => `<button class="pill quiet" data-action="expedition" data-id="${id}" data-kind="${key}">${k.icon} ${k.title}: ${k.goal} Min · ${k.coins} Münzen</button>`).join('');
    }
  }
  openSheet(`
    <div class="sheet-head"><img src="${art(d.spriteID, p.isShiny)}" alt=""><div>
      <h2>${escapeHTML(d.name)}</h2><p class="muted">Lv. ${d.level} · ${escapeHTML(p.species.displayName)}</p><p class="small">${escapeHTML(where)}</p>
      <div class="bar"><span style="width:${Math.round(d.progress * 100)}%"></span></div>
      ${d.nextEvolutionName ? `<p class="small muted">Entwicklung zu ${escapeHTML(d.nextEvolutionName)} in ${duration(d.toNextEvolution)} Fokus</p>` : ''}
    </div></div>
    <div class="actions">${actions}<button class="pill quiet" data-action="close">Schließen</button></div>`);
}

// MARK: Safari
function renderSafari() {
  const view = $('#view-safari');
  const team = state.teamPokemonIDs.map((id) => G.findPokemon(state, id));
  const rest = state.pokemonRoster.filter((p) => !state.teamPokemonIDs.includes(p.id) && !G.onExpedition(state, p.id));
  const residents = [...team, ...rest].slice(0, 12);
  const spots = [[16, 46], [30, 62], [22, 82], [40, 36], [58, 30], [70, 40], [36, 84], [86, 34], [12, 66], [62, 86], [52, 58], [80, 86]];
  view.innerHTML = `
    <div class="row"><h2>Safari-Wiese</h2><span class="muted small">${residents.length} Pokémon${(state.expeditions || []).length ? `, ${state.expeditions.length} unterwegs` : ''}</span></div>
    <div class="meadow" style="margin-top:10px">
      ${residents.map((p, i) => { const d = G.describe(p); const [x, y] = spots[i];
        return `<button class="resident" style="left:${x}%;top:${y}%;--delay:${(i * 0.7).toFixed(1)}s" data-action="inspect" data-id="${p.id}" aria-label="${escapeHTML(d.name)}, Level ${d.level}">
          <img src="${pixel(d.spriteID, p.isShiny)}" alt="">${p.id === state.selectedPokemonID ? `<span class="tag">★ ${escapeHTML(d.name)}</span>` : ''}</button>`; }).join('')}
    </div>
    <p class="small muted" style="margin-top:8px">Dein Team steht vorne. Tippe ein Pokémon an für Details.</p>`;
}

// MARK: Sync
function renderSync() {
  const changed = meta.changedAt ? new Date(meta.changedAt).toLocaleString('de-DE') : '–';
  const exported = meta.exportedAt ? new Date(meta.exportedAt).toLocaleString('de-DE') : 'noch nie';
  $('#view-sync').innerHTML = `
    <h2>Mit dem Mac abgleichen</h2>
    <div class="panel" style="margin-top:10px">
      <p>Beide Geräte nutzen die Datei <strong>PokéForest_Sync.json</strong> in <strong>iCloud Drive › PokéForest</strong>.</p>
      <ol class="steps">
        <li><strong>Vor dem Training hier:</strong> Am Mac „Jetzt sichern“, dann hier „Vom Mac laden“.</li>
        <li><strong>Nach dem Training hier:</strong> „Für den Mac sichern“ und in iCloud Drive › PokéForest die alte Datei ersetzen. Am Mac dann „Stand vom iPhone/iPad laden“.</li>
      </ol>
      <div class="sync-actions">
        <button class="pill" data-action="import">Vom Mac laden</button>
        <button class="pill" data-action="export">Für den Mac sichern</button>
      </div>
      <p class="small muted" style="margin-top:12px">Zuletzt geändert: ${changed}<br>Zuletzt gesichert: ${exported}</p>
    </div>
    <p class="small muted" style="margin-top:14px">Es zählt immer der zuletzt geladene Stand. Trainiere deshalb nicht gleichzeitig auf Mac und iPhone.</p>`;
}

const fileInput = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const problem = G.validateSave(data);
    if (problem) { toast(problem); return; }
    if (session) { toast('Beende zuerst die laufende Runde.'); return; }
    state = G.normalizeTeam(data);
    meta.exportedAt = Date.now();
    meta.changedAt = meta.exportedAt;
    store(SAVE_KEY, state); store(META_KEY, meta);
    toast(`Geladen: ${state.pokemonRoster.length} Pokémon, ${state.coins} Münzen.`);
    show('train');
  } catch { toast('Die Datei ließ sich nicht lesen. Wähle PokéForest_Sync.json.'); }
});

async function exportSave() {
  const file = new File([JSON.stringify(state)], 'PokéForest_Sync.json', { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'PokéForest-Spielstand' });
    } else {
      const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    }
    meta.exportedAt = Date.now();
    store(META_KEY, meta);
    toast('Gesichert. Lege die Datei in iCloud Drive › PokéForest ab.');
    render();
  } catch (error) { if (error?.name !== 'AbortError') toast('Sichern hat nicht geklappt. Versuche es nochmal.'); }
}

function freshSave() {
  const starter = (id, displayName, stages, primaryHex, secondaryHex, elementType) =>
    ({ id, displayName, stages: stages.map(([pokedexID, name]) => ({ pokedexID, name })), price: 0, primaryHex, secondaryHex, elementType, loreText: 'Ein treuer Fokus-Begleiter auf deiner Trainingsreise.' });
  const species = [
    starter('oak', 'Bisasam-Linie', [[1, 'Bisasam'], [2, 'Bisaknosp'], [3, 'Bisaflor']], '#47C77A', '#298F5C', 'Pflanze / Gift'),
    starter('pine', 'Glumanda-Linie', [[4, 'Glumanda'], [5, 'Glutexo'], [6, 'Glurak']], '#F57338', '#D93D29', 'Feuer / Flug'),
    starter('sakura', 'Schiggy-Linie', [[7, 'Schiggy'], [8, 'Schillok'], [9, 'Turtok']], '#3DA8F5', '#2970C7', 'Wasser'),
  ];
  const now = G.toSwiftDate();
  const roster = species.map((s) => ({ id: G.newID(), species: s, experience: 0, trainingMinutes: 0, sessions: 0, nickname: '', isShiny: false, obtainedAt: now }));
  state = G.normalizeTeam({
    coins: 100, plantedTrees: [], blockedApps: [], blockedWebsites: [],
    tags: [{ id: G.newID(), name: 'Lernen', colorHex: '#5856D6', icon: 'book.fill' }],
    unlockedSpeciesIDs: ['oak', 'pine', 'sakura'], pokemonRoster: roster, teamPokemonIDs: roster.map((p) => p.id), pcBoxes: [],
    selectedPokemonID: roster[0].id, expShareEnabled: false, expeditions: [], berryInventory: {}, levelCurveVersion: 2,
  });
  saveState();
  show('train');
}

// MARK: Sheets & evolution
function openSheet(html, onClose) {
  const dialog = $('#sheet');
  dialog.innerHTML = `<div class="sheet-body">${html}</div>`;
  // A close event from a previous sheet can arrive after this one opened; ignore it while open.
  dialog.onclose = () => { if (dialog.open) return; dialog.innerHTML = ''; onClose?.(); };
  if (!dialog.open) dialog.showModal();
}
function closeSheet() { const d = $('#sheet'); if (d.open) d.close(); }

function playEvolutions() {
  const event = evolutionQueue.shift();
  if (!event) return;
  const dialog = $('#evolution');
  dialog.innerHTML = `<div class="evo-body"><h2 id="evo-title">Nanu?</h2>
    <div class="evo-stage" id="evo-stage"><img id="evo-img" src="${art(event.fromSpriteID, event.shiny)}" alt=""></div>
    <p id="evo-text">${escapeHTML(event.fromName)} entwickelt sich …</p>
    <button class="pill" id="evo-button">Überspringen</button></div>`;
  dialog.showModal();
  const img = $('#evo-img', dialog);
  const reveal = () => {
    clearTimeout(flicker.timer);
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
    flicker.timer = setTimeout(flicker, Math.max(60, 420 * (1 - t)));
  };
  $('#evo-button', dialog).onclick = reveal;
  dialog.onclose = () => { clearTimeout(flicker.timer); playEvolutions(); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) reveal(); else flicker();
}

// MARK: Actions
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const { action, id } = target.dataset;
  const act = (ok, message, failure) => { if (ok) { saveState(); toast(message); } else if (failure) toast(failure); closeSheet(); render(); };
  switch (action) {
    case 'minutes': meta.minutes = Number(target.dataset.minutes); store(META_KEY, meta); render(); break;
    case 'start': startSession(); break;
    case 'giveup': if (confirm('Runde wirklich abbrechen? Dein Pokémon bekommt keine EP.')) failSession('manuell abgebrochen'); break;
    case 'partner': act(G.choosePartner(state, id), `${G.describe(G.findPokemon(state, id)).name} ist dein Partner.`, 'Das geht gerade nicht.'); break;
    case 'inspect': inspect(id); break;
    case 'to-pc': act(G.moveToPC(state, id), 'Im PC abgelegt.', 'Dein Team braucht mindestens ein Pokémon.'); break;
    case 'to-team': act(G.addToTeam(state, id), 'Jetzt im Team.', 'Das Team ist voll.'); break;
    case 'swap': act(G.swapIntoTeam(state, id, target.dataset.with), 'Getauscht.', 'Tauschen geht gerade nicht.'); break;
    case 'expedition': act(G.startExpedition(state, id, target.dataset.kind), `Unterwegs zur ${G.EXPEDITIONS[target.dataset.kind].title}.`, 'Es sind schon zwei Pokémon unterwegs.'); break;
    case 'recall': G.recallExpedition(state, id); act(true, 'Ohne Fund zurückgekehrt.'); break;
    case 'claim': {
      const found = G.claimExpedition(state, id);
      if (found) { evolutionQueue.push(...found.evolutions); act(true, `${found.name} bringt ${found.kind.coins} Münzen und ${found.kind.berries.map((b) => G.BERRY_NAMES[b]).join(', ')} mit.`); playEvolutions(); }
      break;
    }
    case 'box': meta.boxIndex = Math.max(0, Math.min(state.pcBoxes.length - 1, meta.boxIndex + Number(target.dataset.delta))); store(META_KEY, meta); render(); break;
    case 'import': fileInput.click(); break;
    case 'export': exportSave(); break;
    case 'fresh': freshSave(); break;
    case 'close': closeSheet(); break;
  }
});
document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.dataset?.action === 'share') { state.expShareEnabled = target.checked; saveState(); render(); }
  if (target.dataset?.action === 'strict') { meta.strict = target.checked; store(META_KEY, meta); }
});

// Strict mode and catching up after the phone was locked or the app closed.
document.addEventListener('visibilitychange', () => {
  if (!session) return;
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (session.strict && hiddenAt && Date.now() - hiddenAt > STRICT_GRACE_MS && Date.now() < session.endsAt) { hiddenAt = null; failSession('App verlassen'); return; }
  hiddenAt = null;
  tick();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (state) { G.normalizeTeam(state); store(SAVE_KEY, state); }
if (session && state && Date.now() >= session.endsAt) finishSession(); else render();

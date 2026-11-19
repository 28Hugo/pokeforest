import * as G from './game.js';
import { app, $, esc, ds, jingle, openSheet, showTutorial, showHelp, showWhatsNew, showShortcuts, save, saveMeta, toast, closeSheet, pokemonSheet, queueEvolutions, playEvolutions, loadAll } from './ui.js';
import * as Training from './views/training.js';
import * as Safari from './views/safari.js';
import * as Trainer from './views/trainer.js';
import * as Shop from './views/shop.js';
import * as More from './views/more.js';

const VIEWS = { train: Training, safari: Safari, trainer: Trainer, shop: Shop, more: More };
const MODULES = [Training, Safari, Trainer, Shop, More];

/** 5.12: the coin counter counts up and down instead of jumping. */
let shownCoins = null;
function countCoins(to) {
  const el = $('#coins');
  if (to == null) { el.textContent = ''; shownCoins = null; return; }
  const from = shownCoins;
  shownCoins = to;
  if (from == null || from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = G.formatNumber(to); return; }
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  const start = performance.now();
  const step = (t) => { if (shownCoins !== to) return; const k = Math.min(1, (t - start) / 600); el.textContent = G.formatNumber(Math.round(from + (to - from) * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

app.render = function render() {
  const tab = app.state ? (app.meta.tab in VIEWS ? app.meta.tab : 'train') : 'train';
  document.querySelectorAll('.tabbar button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === tab)));
  const s = app.state;
  countCoins(s ? s.coins : null);
  $('#coins').title = s ? `${G.formatNumber(s.coins)} PokéMünzen` : '';
  $('#streak').textContent = s ? G.streakSidebar(G.streakDays(s)) : '';
  if (s) { const lv = G.trainerLevel(s); $('#trainer-line').textContent = G.trainerLine(lv, G.rankFor(lv).title); $('#trainer-line').title = `Noch ${G.formatNumber(G.trainerThreshold(lv + 1) - G.trainerXP(s))} XP bis Lv. ${lv + 1}`; } else $('#trainer-line').textContent = '';
  $('#sync-dot').textContent = s ? (!app.meta.exportedAt ? 'Nicht gesichert' : app.meta.changedAt > app.meta.exportedAt ? '● Nicht gesichert' : 'Gesichert') : '';
  $('#goal').innerHTML = s ? `<span style="width:${Math.round(Math.min(1, G.todayMinutes(s) / G.dailyGoal(s)) * 100)}%"></span>` : '';
  $('#goal').title = s ? `Heute ${G.todayMinutes(s)} / ${G.dailyGoal(s)} Min` : '';
  const ready = s ? (s.expeditions || []).filter((t) => t.progressMinutes >= G.EXPEDITIONS[t.kind].goal).length : 0;
  $('[data-view="safari"]').dataset.badge = (s ? ready + G.habitatFitCount(s) : 0) || '';
  $('[data-view="shop"]').dataset.badge = (s ? G.ripePlotCount(s) : 0) || '';
  const quests = s ? (s.dailyQuests || []).filter((q) => !q.isClaimed && q.currentValue >= q.targetValue).length : 0;
  $('[data-view="trainer"]').dataset.badge = (quests + (s ? G.readyWeeklyCount(s) : 0)) || '';
  const view = $('#view');
  if (!s) { renderWelcome(view); return; }
  VIEWS[tab].render(view);
  // Keep the chosen section visible in scrollable section bars.
  view.querySelectorAll('.segmented [aria-selected="true"], .habitat-chips [aria-selected="true"]').forEach((b) => {
    const bar = b.parentElement;
    if (bar.scrollWidth > bar.clientWidth) bar.scrollLeft += b.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - b.offsetWidth) / 2;
  });
};

function renderWelcome(view) {
  view.innerHTML = `
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

// MARK: Actions shared by several views
function common(action, el) {
  const s = app.state;
  const running = !!app.session;
  const done = (ok, msg, fail) => { if (ok) { save(); if (msg) toast(msg); } else if (fail) toast(fail); closeSheet(); app.render(); return true; };
  switch (action) {
    case 'tab': { app.meta.tab = el.dataset.view; saveMeta(); app.render(); window.scrollTo(0, 0); const v = $('#view'); v.classList.remove('page-in'); void v.offsetWidth; v.classList.add('page-in'); return true; }
    case 'sub': { app.meta.sub[el.dataset.key] = el.dataset.value; saveMeta(); app.render(); const v = $('#view'); v.classList.remove('page-in'); void v.offsetWidth; v.classList.add('page-in'); return true; }
    case 'close': closeSheet(); return true;
    case 'bell': app.meta.unread = 0; saveMeta(); el.querySelector('b')?.remove(); return true;
    case 'today-more': if (G.markTodaySeen(s, app.meta.mode)) save(); return true;
    case 'sheet-tab': app.meta.sheetTab = el.dataset.tab; saveMeta(); pokemonSheet(el.dataset.id); return true;
    case 'shortcuts': showShortcuts(); return true;
    case 'today': {
      const kind = el.dataset.kind;
      el.closest('details')?.removeAttribute('open');
      G.markTodaySeen(s, app.meta.mode); save();
      if (kind === 'galactic') { app.meta.tab = 'safari'; app.meta.sub.safari = 'meadow'; app.meta.habitatID = el.dataset.habitat; }
      else if (kind === 'roamer' || kind === 'outbreak') { if (!running && !app.meta.pomodoroEnabled) { app.meta.mode = 'wild'; G.setHuntHabitat(s, el.dataset.habitat); save(); } app.meta.tab = 'train'; }
      else if (kind === 'topform') { if (!running && G.choosePartner(s, el.dataset.id)) { app.meta.mode = 'owned'; save(); } app.meta.tab = 'train'; }
      else if (kind === 'rival') { app.meta.tab = 'trainer'; app.meta.sub.trainer = 'gyms'; }
      else if (kind === 'pension') { app.meta.tab = 'safari'; app.meta.sub.safari = 'pension'; }
      saveMeta(); app.render(); window.scrollTo(0, 0); return true;
    }
    case 'inspect': pokemonSheet(el.dataset.id); return true;
    case 'partner': return done(!running && G.choosePartner(s, el.dataset.id), `${G.describe(G.findPokemon(s, el.dataset.id)).name} ist dein Partner.`, 'Das geht gerade nicht.');
    case 'to-pc': return done(G.moveToPC(s, el.dataset.id, running), 'Im PC abgelegt.', 'Dein Team braucht mindestens ein Pokémon.');
    case 'to-team': return done(G.addToTeam(s, el.dataset.id), 'Jetzt im Team.', 'Das Team ist voll.');
    case 'swap': return done(G.swapIntoTeam(s, el.dataset.id, el.dataset.with), 'Getauscht.', 'Tauschen geht gerade nicht.');
    case 'expedition': return done(G.startExpedition(s, el.dataset.id, el.dataset.kind), `Unterwegs zur ${G.EXPEDITIONS[el.dataset.kind].title}.`, 'Es sind schon zwei Pokémon unterwegs.');
    case 'recall': G.recallExpedition(s, el.dataset.id); return done(true, 'Ohne Fund zurückgekehrt.');
    case 'claim-trip': {
      const found = G.claimExpedition(s, el.dataset.id);
      if (found) { queueEvolutions(found.evolutions); done(true, `${found.name} bringt ${found.kind.coins} Münzen und ${found.kind.berries.map(G.berryName).join(', ')} mit.`); playEvolutions(); }
      return true;
    }
    case 'release': {
      const p = G.findPokemon(s, el.dataset.id);
      if (p && confirm(`${G.describe(p).name} wirklich freilassen? Level und Spitzname gehen verloren.`)) {
        const ok = G.releasePokemon(s, p.id, running);
        done(ok, null, 'Freilassen ist gerade nicht möglich.');
        if (ok) toast(`${G.describe(p).name} wurde freigelassen.`, { label: 'Rückgängig', action: 'undo-release' });
      }
      return true;
    }
    case 'undo-release': { const name = G.undoRelease(s); if (name) { save(); app.render(); toast(`${name} ist zurück.`); } else toast('Zu spät, nach 10 Sekunden geht es nicht mehr.'); return true; }
    case 'sheet-shiny': app.meta.sheetShiny = !app.meta.sheetShiny; saveMeta(); pokemonSheet(el.dataset.id); return true;
    case 'tutorial': showTutorial(0); return true;
    case 'tutorial-step': showTutorial(Number(el.dataset.index)); return true;
    case 'tutorial-show': { const page = el.dataset.page; app.meta.tab = page === 'underground' ? 'safari' : page === 'timer' ? 'train' : page; if (page === 'underground') app.meta.sub.safari = 'dig'; saveMeta(); closeSheet(); app.render(); toast('Weiter mit dem Tutorial: Mehr › Tutorial'); return true; }
    case 'tutorial-done': G.ensureJourney(s).tutorialSeen = true; app.meta.lastSeenVersion = G.C.life.whatsNew.version; save(); closeSheet(); return true;
    case 'tutorial-first': G.ensureJourney(s).tutorialSeen = true; app.meta.lastSeenVersion = G.C.life.whatsNew.version; app.meta.minutes = 15; app.meta.mode = 'owned'; app.meta.tab = 'train'; save(); closeSheet(); app.render(); return true;
    case 'help': showHelp(); return true;
    case 'whats-new': showWhatsNew(); return true;
    case 'adopt': {
      const species = s.pokemonRoster.find((p) => p.species.id === el.dataset.species)?.species;
      return done(species && G.adoptCopy(s, species), 'Neues Exemplar auf Level 1 – im Team oder PC.', 'Dafür fehlen dir PokéMünzen.');
    }
    case 'candy': {
      const r = G.useSonderbonbon(s, el.dataset.id, running);
      if (!r) { toast('Das geht gerade nicht.'); return true; }
      if (r.evolution) queueEvolutions([r.evolution]);
      done(true, `Sonderbonbon: jetzt Lv. ${r.level}!`); jingle('levelUp'); playEvolutions(); return true;
    }
    case 'stone': {
      const ev = G.useStone(s, el.dataset.stone, el.dataset.id, running);
      if (!ev) { toast(`Dir fehlt ein ${G.stoneByID(el.dataset.stone)?.name ?? 'Stein'}. Du findest ihn im Untergrund oder im Kampfpunkte-Laden.`); return true; }
      queueEvolutions([ev]); done(true); playEvolutions(); return true;
    }
    case 'poffin': {
      if (app.meta.poffin === el.dataset.id) { toast('Dieser Knursp ist schon gebacken.'); return true; }
      const problem = G.craftPoffin(s, app.meta, el.dataset.id, app.meta.mode, running);
      if (problem) toast(problem); else { save(); toast('Knursp gebacken! Er wirkt in der nächsten Runde.'); }
      app.render(); return true;
    }
  }
  return false;
}

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'button')) return;
  const action = el.dataset.action;
  if (common(action, el)) return;
  for (const m of MODULES) if (m.handle?.(action, el)) return;
});
document.addEventListener('change', (event) => {
  const el = event.target;
  const action = el.dataset?.action;
  if (!action) return;
  if (action === 'share') { app.state.expShareEnabled = el.checked; save(); app.render(); return; }
  if (action === 'strict') { app.meta.strict = el.checked; saveMeta(); return; }
  for (const m of MODULES) if (m.change?.(el)) return;
});
document.addEventListener('input', (event) => { for (const m of MODULES) if (m.input?.(event.target)) return; });
document.addEventListener('submit', (event) => {
  const form = event.target;
  event.preventDefault();
  if (form.dataset.form === 'rename') {
    const p = G.findPokemon(app.state, form.dataset.id);
    if (p) { p.nickname = new FormData(form).get('nickname').trim().slice(0, 24); save(); toast('Spitzname gespeichert.'); closeSheet(); app.render(); }
    return;
  }
  for (const m of MODULES) if (m.submit?.(form)) return;
});

async function start() {
  try {
    G.init(await fetch('catalog.json').then((r) => r.json()));
  } catch {
    $('#view').innerHTML = '<div class="welcome"><h1>Keine Verbindung</h1><p>Beim ersten Start braucht PokéForest Internet. Danach läuft es auch offline.</p></div>';
    return;
  }
  loadAll();
  More.applyAppearance();
  Training.resume();
  app.render();
  prefetchOwnSprites();
  if (app.state && !app.session) {
    const j = G.ensureJourney(app.state);
    if (!j.tutorialSeen && !(app.state.plantedTrees || []).length) showTutorial(0);
    else if (app.meta.lastSeenVersion !== G.C.life.whatsNew.version && (app.state.plantedTrees || []).length) showWhatsNew();
    else showWeeklyRecap();
  }
}
app.showTutorial = () => showTutorial(0);
app.showHelp = () => showHelp();
// Tasten 1–5 wechseln die Seiten, solange kein Eingabefeld aktiv ist.
document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || !app.state) return;
  if (event.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
  if (event.key === '?') { event.preventDefault(); showShortcuts(); return; }
  // 5.13: ← / → step through the tabs of the current page.
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const tabs = [...(document.querySelector('#view .segmented[role="tablist"]')?.querySelectorAll('button') || [])];
    if (tabs.length) {
      event.preventDefault();
      const i = Math.max(0, tabs.findIndex((b) => b.getAttribute('aria-selected') === 'true'));
      tabs[G.tabCycle(i, tabs.length, event.key === 'ArrowRight')].click();
    }
    return;
  }
  const tab = ['train', 'safari', 'trainer', 'shop', 'more'][Number(event.key) - 1];
  if (tab) { app.meta.tab = tab; saveMeta(); app.render(); window.scrollTo(0, 0); }
});
document.addEventListener('input', (event) => { if (event.target.dataset?.action === 'help-search') { const v = event.target.value; showHelp(v); const i = document.querySelector('[data-action="help-search"]'); i?.focus(); i?.setSelectionRange(v.length, v.length); } });
/** Monday: last week's summary, once. */
function showWeeklyRecap() {
  const s = app.state;
  if (!s || app.session) return;
  const r = G.weeklyRecap(s);
  if (!r) return;
  const peak = Math.max(1, ...r.perDay);
  openSheet(`<h2>Deine Woche ${esc(r.week)}</h2>
    <div class="week big">${r.perDay.map((m, i) => `<div><small>${m}</small><span style="height:${Math.round((m / peak) * 100)}%"></span><small>${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i]}</small></div>`).join('')}</div>
    <p><strong>${r.total} Min Fokus</strong> · ${r.rounds} Runden · ${r.caught} gefangen${r.shinies ? ` · ${r.shinies} Shiny` : ''}</p>
    ${r.bestName ? `<div class="row"><img src="${ds(r.bestSprite)}" alt="" style="width:64px;image-rendering:pixelated"><p>Dein Partner der Woche: <strong>${esc(r.bestName)}</strong> mit ${r.bestMinutes} Minuten.</p></div>` : ''}
    <button class="pill" data-action="close">Auf in die neue Woche</button>`, () => { G.markRecapShown(app.state, r.week); save(); });
}
/** Keeps the sprites of your own Pokémon (all their stages) and of the gym aces offline. */
function prefetchOwnSprites() {
  const s = app.state;
  if (!s || !navigator.onLine || !('caches' in window)) return;
  const ids = new Set(G.C.journey.challenges.map((c) => c.aceDexID));
  for (const p of s.pokemonRoster) p.species.stages.forEach((st) => ids.add(st.pokedexID));
  const shiny = s.pokemonRoster.filter((p) => p.isShiny).map((p) => G.describe(p).spriteID);
  const urls = [...[...ids].filter((id) => id >= 1 && id <= 1025).map((id) => ds(id)), ...shiny.map((id) => ds(id, true))];
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  idle(async () => { for (const url of urls) { try { await fetch(url, { mode: 'cors' }); } catch { return; } } });
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
start();

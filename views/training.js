// Training & Gras: own Pokémon or wild encounter, Pomodoro chains, Ewigstein, berries and Knursp.
import * as G from '../game.js';
import { app, $, esc, art, pixel, duration, bar, save, saveMeta, saveSession, toast, openSheet, closeSheet, queueEvolutions, playEvolutions } from '../ui.js';

const PRESETS = [15, 25, 45, 60, 90];
const MODE_RAW = { owned: 'Eigenes Pokémon trainieren', wild: 'Wilde Begegnung (Nationaldex)' };
let ticker = null;
let hiddenAt = null;

const planned = () => {
  const m = app.meta;
  return m.pomodoroEnabled ? G.normalizePlan(m.pomodoro).focusMinutes : m.minutes;
};
/** Session-shaped preview of what would start now. */
function previewSession() {
  const m = app.meta;
  const plan = m.pomodoroEnabled ? G.normalizePlan(m.pomodoro) : null;
  return { mode: m.mode, minutes: planned(), poffin: G.poffinKey(m.poffin), pomodoro: plan, round: 1 };
}

export function render(view) {
  const state = app.state;
  const s = app.session;
  const running = !!s;
  const mode = running ? s.mode : app.meta.mode;
  const preview = running ? s : previewSession();
  const minutes = preview.minutes;
  const tier = G.C.tiers[G.tierFor(minutes)];
  const partner = G.findPokemon(state, state.selectedPokemonID);
  const d = partner ? G.describe(partner) : null;
  const ep = G.partnerEP(state, preview);
  const gain = mode === 'owned' && d ? Math.min(ep.base + ep.bonus, G.threshold(100) - partner.experience) : 0;
  const projected = d ? G.describe({ ...partner, experience: partner.experience + gain }) : null;
  const shiny = G.shinyPercent(state, preview);
  const coins = G.coinPreview(state, preview);
  const megaReady = mode === 'owned' && d && d.level >= 50 && d.stage === G.stageCount(partner.species) && minutes >= 90 && G.megaFor(partner.species);
  const sprite = mode === 'wild' ? null : (megaReady ? G.megaFor(partner.species).pokedexID : d?.spriteID);
  const dayID = G.pokemonOfTheDay(state.pokemonRoster);
  const star = dayID && dayID !== state.selectedPokemonID ? G.findPokemon(state, dayID) : null;
  const tags = state.tags;
  const tag = tags.find((t) => t.id === (running ? s.tagID : app.meta.tagID)) ?? tags[0];
  const share = G.sharedExperience(mode === 'wild' ? minutes : minutes + ep.bonus);
  const others = state.teamPokemonIDs.filter((id) => id !== state.selectedPokemonID).map((id) => G.findPokemon(state, id)).filter(Boolean);
  const banner = app.meta.banner;
  const phase = !running ? 'idle' : s.inBreak ? 'break' : s.pausedUntil ? 'pause' : 'focus';
  const phaseTitle = { idle: '', break: `Erholungspause · Runde ${s?.round}/${s?.pomodoro?.rounds}`, pause: 'Ewigstein-Pause', focus: mode === 'wild' ? 'Etwas raschelt im hohen Gras …' : `${esc(d?.name)} trainiert` }[phase];
  const recent = (state.plantedTrees || []).find((t) => t.survived && !t.wasWildEncounter && G.findPokemon(state, t.pokemonID));

  view.innerHTML = `
    ${banner ? `<div class="banner ${banner.ok ? '' : 'bad'}"><p>${esc(banner.text)}</p>${banner.recap ? '<button class="link" data-action="recap">Trainingsmoment ansehen</button>' : ''}<button class="icon-btn small" data-action="dismiss-banner" aria-label="Hinweis schließen">×</button></div>` : ''}
    ${running ? '' : `
    <div class="mode-switch" role="tablist" aria-label="Trainingsart">
      <button role="tab" data-action="mode" data-mode="owned" aria-selected="${mode === 'owned'}" ${app.meta.pomodoroEnabled && mode !== 'owned' ? '' : ''}><strong>Eigenes Pokémon</strong><span>Lv. 1–100, Entwicklungen, Mega</span></button>
      <button role="tab" data-action="mode" data-mode="wild" aria-selected="${mode === 'wild'}"><strong>Wilde Begegnung</strong><span>Zufall aus #1–#1025 fangen</span></button>
    </div>`}
    ${mode === 'wild' ? `
    <div class="tiers" role="group" aria-label="Seltenheit">
      ${G.C.tiers.map((t, i) => `<button class="tier ${i === G.tierFor(minutes) ? 'on' : ''}" data-action="tier" data-minutes="${t.suggested}" ${running || app.meta.pomodoroEnabled ? 'disabled' : ''}>
        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${['poke-ball', 'great-ball', 'ultra-ball', 'master-ball'][i]}.png" alt=""><strong>${esc(t.id)}</strong><span>${['5–29', '30–59', '60–119', '120+'][i]} Min</span></button>`).join('')}
    </div>` : ''}
    <div class="train-layout">
      <div class="arena">
        <p class="phase">${phaseTitle || (mode === 'wild' ? `${esc(tier.id)}e Begegnung · ${esc(tier.subtitle)}` : megaReady ? `Mega-Entwicklung bereit: ${esc(G.megaFor(partner.species).name)}` : `${esc(d?.name)} · Lv. ${d?.level} → ${projected?.level}`)}</p>
        <div class="ring ${running ? 'running' : ''} ${phase}" id="ring">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle class="track" cx="100" cy="100" r="90"/>
            <circle class="progress" id="ring-progress" cx="100" cy="100" r="90" stroke-dasharray="565.5" stroke-dashoffset="${running ? 565.5 : 565.5 * (1 - Math.max(0.04, (minutes - 5) / 175))}"/>
          </svg>
          <div class="core"><div class="mound ${mode === 'wild' ? 'grass' : ''}"></div>
            ${mode === 'wild' ? `<div class="tall-grass" aria-hidden="true">🌿🌿🌿</div><img class="partner ball" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${['poke-ball', 'great-ball', 'ultra-ball', 'master-ball'][G.tierFor(minutes)]}.png" alt="">`
              : `<img class="partner" src="${art(sprite, partner?.isShiny)}" alt="${esc(d?.name)}">`}
          </div>
        </div>
        <div class="clock" id="clock">${String(minutes).padStart(2, '0')}:00</div>
        <p class="muted small clock-hint" id="clock-hint">${running ? (s.strict ? 'Strenger Modus: Bleib in der App.' : 'Die Zeit läuft weiter, auch wenn du die App schließt.') : `Fertig um ${new Date(Date.now() + minutes * 60000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}</p>
        <p class="rewards"><span class="coin-dot"></span>+${coins} Münzen${mode === 'wild' ? ` · <span class="note-sun">✦ ${shiny} % Shiny</span>` : ''}${state.activeBerryBuff ? ` · ${esc(G.berryName(state.activeBerryBuff))}` : ''}${(running ? s.poffin : G.poffinKey(app.meta.poffin)) ? ' · Knursp' : ''}</p>
        ${running ? `
          <div class="row center">
            ${s.inBreak ? '' : `<button class="pill quiet" data-action="everstone" ${s.everstoneUsed && !s.pausedUntil ? 'disabled' : ''}>${s.pausedUntil ? 'Weiter trainieren' : s.everstoneUsed ? 'Ewigstein verbraucht' : 'Ewigstein-Pause (3 Min)'}</button>`}
            <button class="pill danger" data-action="giveup">${s.inBreak ? 'Kette beenden' : 'Abbrechen'}</button>
          </div>` : app.meta.pomodoroEnabled ? `
          <p class="small muted">Pomodoro-Kette: ${G.normalizePlan(app.meta.pomodoro).rounds} × ${G.normalizePlan(app.meta.pomodoro).focusMinutes} Min, ${G.normalizePlan(app.meta.pomodoro).breakMinutes} Min Pause</p>` : `
          <div class="durations" role="group" aria-label="Dauer">
            ${PRESETS.map((m) => `<button class="chip" data-action="minutes" data-minutes="${m}" aria-pressed="${m === minutes}">${m} Min</button>`).join('')}
          </div>
          <input type="range" min="5" max="180" step="5" value="${minutes}" id="minutes" aria-label="Dauer in Minuten">`}
      </div>
      <div class="side">
        ${mode === 'owned' && d ? `
        <div class="panel">
          <div class="partner-card"><img src="${art(d.spriteID, partner.isShiny)}" alt=""><div>
            <h3>${esc(d.name)} <span class="muted small">Lv. ${d.level}</span></h3>
            ${bar(d.progress)}
            <p class="small muted">${d.maxLevel ? 'Level 100 · Fokus-Champion' : `Diese Runde +${gain} EP → Lv. ${projected.level}. Noch ${d.toNextLevel} Fokus-Min bis Lv. ${d.level + 1}.`}</p>
            ${d.nextEvolutionName ? `<p class="small ${d.toNextEvolution <= gain ? 'note-sun' : 'muted'}">${d.toNextEvolution <= gain ? `Diese Runde entwickelt es sich zu ${esc(d.nextEvolutionName)}!` : `Entwicklung zu ${esc(d.nextEvolutionName)} in ${duration(d.toNextEvolution)} Fokus`}</p>` : ''}
            ${ep.day ? `<p class="small note-sun">Pokémon des Tages: +${G.DAY_BONUS_PERCENT} % EP</p>` : ''}
            ${state.activeBerryBuff === 'epbeere' ? '<p class="small note-share">EP-Beere: doppelte EP</p>' : ''}
          </div></div>
          ${star && !running ? `<button class="pill quiet wide" data-action="partner" data-id="${star.id}">Heute in Topform: ${esc(G.describe(star).name)} wählen</button>` : ''}
          <div class="mini-team">${others.map((o) => { const od = G.describe(o); return `<button data-action="partner" data-id="${o.id}" ${running ? 'disabled' : ''} title="${esc(od.name)} als Partner"><img src="${pixel(od.spriteID, o.isShiny)}" alt="${esc(od.name)}"><span>${state.expShareEnabled && !od.maxLevel ? `+${share}` : `Lv.${od.level}`}</span></button>`; }).join('')}</div>
        </div>` : mode === 'wild' ? `
        <div class="panel"><h3>Wilde Begegnung</h3><p class="small muted">Nach der Runde zeigt sich ein Pokémon aus dem Nationaldex. Je länger, desto seltener. Es landet im Team oder im PC, seine Linie erscheint im Shop.</p>
          ${state.expShareEnabled ? `<p class="small note-share">EP-Teiler: jedes Team-Mitglied bekommt +${share} EP</p>` : ''}</div>` : ''}
        <div class="panel stack">
          <label class="switch"><input type="checkbox" data-action="share" ${state.expShareEnabled ? 'checked' : ''}> EP-Teiler <span class="small muted">${state.expShareEnabled ? `Team bekommt ${G.SHARE_PERCENT} %` : 'nur der Partner lernt'}</span></label>
          <label class="field">Fokus-Tag
            <select data-action="tag" ${running ? 'disabled' : ''}>${tags.map((t) => `<option value="${t.id}" ${t.id === tag.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
          ${running ? '' : `
          <label class="field">Notiz <input data-action="note" value="${esc(app.meta.note || '')}" placeholder="z. B. Vorlesung, Projekt" maxlength="80"></label>
          <details class="extras" ${app.meta.extrasOpen ? 'open' : ''}>
            <summary data-action="extras">Beeren, Knursp &amp; Pomodoro</summary>
            <div class="berries">${G.C.berries.map((b) => { const count = state.berryInventory?.[b.id] || 0; const problem = G.berryProblem(state, b.id, mode, false);
              return `<button class="chip ${state.activeBerryBuff === b.id ? 'on' : ''}" data-action="berry" data-id="${b.id}" ${!count || problem ? 'disabled' : ''} title="${esc(problem || b.effect)}"><span class="dot" style="background:${b.colorHex}"></span>${esc(b.name)} (${count})</button>`; }).join('')}</div>
            ${state.activeBerryBuff ? `<button class="link" data-action="return-berry">${esc(G.berryName(state.activeBerryBuff))} zurücklegen</button>` : ''}
            <p class="small muted">Eine Beere pro Runde, bei Abbruch verbraucht.</p>
            <div class="berries">${G.C.poffins.map((p) => `<button class="chip ${app.meta.poffin === p.id ? 'on' : ''}" data-action="poffin" data-id="${esc(p.id)}" title="${esc(p.recipe)}">${esc(p.name)}</button>`).join('')}</div>
            <label class="switch"><input type="checkbox" data-action="pomodoro" ${app.meta.pomodoroEnabled ? 'checked' : ''}> Pomodoro-Kette</label>
            ${app.meta.pomodoroEnabled ? (() => { const p = G.normalizePlan(app.meta.pomodoro); return `
              <div class="plan">
                <label>Runden <input type="number" min="2" max="8" value="${p.rounds}" data-plan="rounds"></label>
                <label>Fokus <input type="number" min="15" max="60" step="5" value="${p.focusMinutes}" data-plan="focusMinutes"></label>
                <label>Pause <input type="number" min="1" max="15" value="${p.breakMinutes}" data-plan="breakMinutes"></label>
              </div>
              <p class="small muted">Gesamt ${duration(p.rounds * p.focusMinutes + (p.rounds - 1) * p.breakMinutes)} · doppelte Runden-EP · Abschlussbonus +${G.planCompletionXP(p)} EP</p>`; })() : ''}
          </details>
          <div class="row">
            <button class="pill quiet" data-action="repeat" ${recent ? '' : 'disabled'}>Letztes Training</button>
            <button class="pill quiet" data-action="presets">Vorlagen</button>
          </div>`}
          <label class="switch"><input type="checkbox" data-action="strict" ${app.meta.strict ? 'checked' : ''} ${running ? 'disabled' : ''}> Strenger Modus <span class="small muted">Verlassen &gt; 15 Sek. beendet die Runde</span></label>
        </div>
      </div>
    </div>
    ${running ? '' : `<div class="start-bar"><button class="start" data-action="start">${mode === 'wild' ? `Ins hohe Gras gehen (${minutes} Min)` : `${esc(d?.name ?? 'Training')} trainieren (${minutes} Min)`}</button></div>`}`;

  const range = $('#minutes', view);
  range?.addEventListener('input', () => { app.meta.minutes = Number(range.value); saveMeta(); $('#clock').textContent = `${String(app.meta.minutes).padStart(2, '0')}:00`; });
  range?.addEventListener('change', () => app.render());
  view.querySelectorAll('[data-plan]').forEach((input) => input.addEventListener('change', () => {
    app.meta.pomodoro = G.normalizePlan({ ...app.meta.pomodoro, [input.dataset.plan]: Number(input.value) });
    saveMeta(); app.render();
  }));
  startTicker();
}

// MARK: Running sessions
function startTicker() {
  clearInterval(ticker);
  if (!app.session) { document.title = 'PokéForest'; return; }
  const update = () => {
    const s = app.session;
    if (!s) return;
    const event = G.advance(s);
    if (event === 'complete') { finishRound(); return; }
    if (event === 'round-started') { saveSession(); toast(`Runde ${s.round}/${s.pomodoro.rounds} startet!`); if (s.mode === 'wild') loadWild(); app.render(); return; }
    const left = G.secondsLeft(s);
    const clock = $('#clock');
    const text = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    if (clock) clock.textContent = text;
    const total = s.inBreak ? s.pomodoro.breakMinutes * 60 : s.pausedUntil ? G.EVERSTONE_SECONDS : s.minutes * 60;
    const ring = $('#ring-progress');
    if (ring) ring.style.strokeDashoffset = String(565.5 * (left / total));
    document.title = `${text} · PokéForest`;
  };
  update();
  ticker = setInterval(update, 1000);
}

async function loadWild() {
  const s = app.session;
  if (!s || s.mode !== 'wild' || s.wildBranches) return;
  try {
    const branches = await G.fetchWildEncounter(app.state, s.minutes);
    if (app.session === s) { s.wildBranches = branches; saveSession(); }
  } catch {
    if (app.session === s) toast('Pokédex gerade nicht erreichbar. Deine Begegnung nutzt ein Pokémon aus dem Offline-Team.');
  }
}

function start() {
  const { session, error } = G.createSession(app.state, app.meta);
  if (error) { app.meta.banner = { ok: false, text: error }; saveMeta(); app.render(); return; }
  app.session = session;
  app.meta.banner = null;
  app.meta.note = '';
  saveSession(); save();
  if (session.mode === 'wild') loadWild();
  app.render();
}

function finishRound() {
  const s = app.session;
  const result = G.completeRound(app.state, s, new Date(Math.min(Date.now(), s.endsAt + 1000)));
  if (!result.breakStarted) app.session = null;
  if (app.meta.poffin && G.poffinKey(app.meta.poffin) !== 'zeit') app.meta.poffin = null;
  saveSession(); save();
  queueEvolutions(result.evolutions);
  app.meta.lastResult = result;
  const text = result.wild
    ? `${result.shiny ? '✨ Shiny! ' : ''}Wilde Begegnung: ${result.captured.formName} gefangen${result.inPC ? ' (Team voll – im PC)' : ''}! +${result.coins} Münzen.`
    : `${result.partnerName} · Lv. ${result.partner.level} trainiert! +${result.coins} Münzen.`;
  app.meta.banner = { ok: true, text: result.breakStarted ? `Runde ${result.round}/${s.pomodoro.rounds} geschafft! ${s.pomodoro.breakMinutes} Min Pause.` : text, recap: true };
  saveMeta();
  showRecap(result);
  app.render();
}

function giveUp(reason) {
  const s = app.session;
  if (!s) return;
  const { chainEnded } = G.failRound(app.state, s, reason);
  app.session = null;
  if (app.meta.poffin && G.poffinKey(app.meta.poffin) !== 'zeit') app.meta.poffin = null;
  app.meta.banner = { ok: !!chainEnded, text: chainEnded ? 'Pomodoro-Kette beendet. Abgeschlossene Runden bleiben erhalten.' : s.mode === 'wild' ? `Das wilde Pokémon ist geflohen (${reason}).` : `Training beendet (${reason}). Keine EP.` };
  saveSession(); save(); saveMeta();
  app.render();
}

export function showRecap(r = app.meta.lastResult) {
  if (!r) return;
  const sprite = r.wild ? r.captured.spriteID : r.partner.spriteID;
  const items = [
    r.wild ? `<li><strong>${esc(r.captured.formName)}</strong> gefangen${r.inPC ? ', wartet im PC' : ''}</li>` : `<li><strong>+${r.earned} EP</strong> für ${esc(r.partnerName)}${r.dayBonus ? ` (davon ${r.dayBonus} als Pokémon des Tages)` : ''}</li>`,
    `<li>+${r.coins} Münzen · ${r.raidDamage} Raid-Schaden${r.mega ? ' · Mega-Runde' : ''}</li>`,
    r.shared.recipients.length ? `<li class="note-share">EP-Teiler: +${r.shared.amount} EP für ${r.shared.recipients.map(esc).join(', ')}</li>` : '',
    ...r.levelUps.map((l) => `<li>${esc(l.name)}: Lv. ${l.from} → ${l.to}</li>`),
    r.trainerLevelUp ? `<li class="note-sun">Trainer-Level ${r.trainerLevelUp}!</li>` : '',
    ...r.notes.map((n) => `<li>${esc(n)}</li>`),
    r.newBadges.length ? `<li class="note-sun">Neue Orden: ${r.newBadges.map(esc).join(', ')}</li>` : '',
    ...r.researchUpdates.slice(0, 3).map((u) => `<li>${esc(u.region)} · ${esc(u.title)}: +${r.minutes} Min${u.ready ? ' · Belohnung bereit!' : ''}</li>`),
    r.finishedTrips.length ? `<li>Expedition fertig: ${r.finishedTrips.map(esc).join(', ')}</li>` : '',
    r.chainDone ? '<li class="note-sun">Pomodoro-Kette geschafft! Abschlussbonus erhalten.</li>' : '',
  ].join('');
  openSheet(`
    <div class="sheet-head"><img src="${art(sprite, r.shiny)}" alt=""><div><h2>${r.wild ? 'Gefangen!' : 'Geschafft!'}</h2><p class="muted">${r.minutes} Minuten Fokus.</p></div></div>
    <ul class="result">${items}</ul>
    <div class="actions"><button class="pill" data-action="close">Weiter</button></div>`, () => playEvolutions());
}

function presetsSheet() {
  const presets = app.state.focusPresets || [];
  openSheet(`<h2>Trainingsvorlagen</h2>
    ${presets.length ? presets.map((p) => `<div class="row panel"><div><strong>${esc(p.name)}</strong><p class="small muted">${p.preferences.duration} Min · ${p.preferences.mode === MODE_RAW.wild ? 'Wilde Begegnung' : 'Eigenes Pokémon'}${p.preferences.pomodoro ? ' · Pomodoro' : ''}</p></div>
      <button class="pill" data-action="apply-preset" data-id="${p.id}">Laden</button><button class="icon-btn" data-action="delete-preset" data-id="${p.id}" aria-label="Vorlage löschen">×</button></div>`).join('') : '<p class="muted">Noch keine Vorlagen.</p>'}
    <form class="row" data-form="preset"><input name="name" maxlength="30" placeholder="Name der Vorlage" required aria-label="Name der Vorlage"><button class="pill">Aktuelle Einstellung sichern</button></form>
    <button class="pill quiet" data-action="close">Schließen</button>`);
}

// MARK: Actions
export function handle(action, el) {
  const state = app.state;
  const meta = app.meta;
  switch (action) {
    case 'mode': if (!app.session) { meta.mode = el.dataset.mode; saveMeta(); app.render(); } return true;
    case 'tier': case 'minutes': if (!app.session) { meta.minutes = Number(el.dataset.minutes); saveMeta(); app.render(); } return true;
    case 'start': start(); return true;
    case 'giveup': if (confirm(app.session?.inBreak ? 'Pomodoro-Kette beenden?' : 'Runde wirklich abbrechen? Dein Pokémon bekommt keine EP.')) giveUp('manuell abgebrochen'); return true;
    case 'everstone': if (app.session && G.toggleEverstone(app.session)) { saveSession(); app.render(); } return true;
    case 'berry': if (G.activateBerry(state, el.dataset.id, meta.mode, !!app.session)) { save(); app.render(); } return true;
    case 'return-berry': if (G.returnBerry(state, !!app.session)) { save(); app.render(); } return true;
    case 'poffin': {
      if (meta.poffin === el.dataset.id) { toast('Dieser Knursp ist schon gebacken.'); return true; }
      const problem = G.craftPoffin(state, meta, el.dataset.id, meta.mode, !!app.session);
      if (problem) toast(problem); else { toast('Knursp gebacken! Er wirkt in der nächsten Runde.'); save(); }
      app.render(); return true;
    }
    case 'extras': meta.extrasOpen = !el.parentElement.open; saveMeta(); return false;
    case 'dismiss-banner': meta.banner = null; saveMeta(); app.render(); return true;
    case 'recap': showRecap(); return true;
    case 'repeat': {
      const recent = (state.plantedTrees || []).find((t) => t.survived && !t.wasWildEncounter && G.findPokemon(state, t.pokemonID));
      if (recent && G.choosePartner(state, recent.pokemonID)) {
        meta.mode = 'owned'; meta.minutes = recent.durationMinutes; meta.pomodoroEnabled = false; meta.note = recent.note === 'Fokus-Training erfolgreich' ? '' : recent.note;
        meta.tagID = state.tags.find((t) => t.name === recent.tagName)?.id ?? meta.tagID;
        save(); app.render(); toast('Letztes Training vorbereitet.');
      }
      return true;
    }
    case 'presets': presetsSheet(); return true;
    case 'apply-preset': {
      const p = (state.focusPresets || []).find((x) => x.id === el.dataset.id);
      if (p) {
        const pr = p.preferences;
        meta.mode = pr.mode === MODE_RAW.wild ? 'wild' : 'owned'; meta.minutes = pr.duration; meta.pomodoroEnabled = !!pr.pomodoro; meta.strict = !!pr.strict; meta.note = p.note || '';
        if (pr.pomodoroPlan) meta.pomodoro = G.normalizePlan(pr.pomodoroPlan);
        meta.tagID = pr.tagID; if (pr.pokemonID) G.choosePartner(state, pr.pokemonID);
        save(); closeSheet(); app.render(); toast(`Vorlage „${p.name}“ geladen.`);
      }
      return true;
    }
    case 'delete-preset': state.focusPresets = (state.focusPresets || []).filter((x) => x.id !== el.dataset.id); save(); presetsSheet(); return true;
    case 'pomodoro': case 'share': case 'strict': case 'tag': case 'note': return false;
  }
  return false;
}
export function change(el) {
  const meta = app.meta;
  switch (el.dataset.action) {
    case 'pomodoro': meta.pomodoroEnabled = el.checked; saveMeta(); app.render(); return true;
    case 'tag': meta.tagID = el.value; saveMeta(); return true;
    case 'note': meta.note = el.value; saveMeta(); return true;
  }
  return false;
}
export function submit(form) {
  if (form.dataset.form !== 'preset') return false;
  const name = new FormData(form).get('name').trim();
  if (!name) return true;
  const state = app.state;
  const p = G.findPokemon(state, state.selectedPokemonID);
  const meta = app.meta;
  state.focusPresets = [...(state.focusPresets || []), {
    id: G.newID(), name, note: meta.note || '',
    preferences: { duration: meta.minutes, speciesID: p ? G.canonical(state, p.species).id : 'oak', tagID: meta.tagID ?? state.tags[0].id, mode: MODE_RAW[meta.mode],
      pomodoro: !!meta.pomodoroEnabled, guardian: state.preferences?.guardian ?? 'Standard-Trainer (10s Warnzeit)', strict: !!meta.strict, autoplay: !!state.preferences?.autoplay,
      pokemonID: p?.id ?? null, pomodoroPlan: G.normalizePlan(meta.pomodoro) },
  }].slice(-8);
  save(); presetsSheet(); toast('Vorlage gesichert.');
  return true;
}

// Strict mode and catching up after the phone was locked.
document.addEventListener('visibilitychange', () => {
  const s = app.session;
  if (!s) return;
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (s.strict && !s.inBreak && !s.pausedUntil && hiddenAt && Date.now() - hiddenAt > 15000 && Date.now() < s.endsAt) { hiddenAt = null; giveUp('App verlassen'); return; }
  hiddenAt = null;
  startTicker();
});
export function resume() { if (app.session?.mode === 'wild' && !app.session.wildBranches && !app.session.inBreak) loadWild(); }

// Training & Gras: own Pokémon or wild encounter, Pomodoro chains, Ewigstein, berries and Knursp.
import * as G from '../game.js';
import { app, $, esc, art, pixel, ds, typeBadges, duration, bar, save, saveMeta, saveSession, toast, openSheet, closeSheet, queueEvolutions, playEvolutions } from '../ui.js';

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
  const share = G.sharedExperience(mode === 'wild' ? minutes * G.EXP_PER_MINUTE : ep.base + ep.bonus);
  const others = state.teamPokemonIDs.filter((id) => id !== state.selectedPokemonID).map((id) => G.findPokemon(state, id)).filter(Boolean);
  const banner = app.meta.banner;
  const phase = !running ? 'idle' : s.inBreak ? 'break' : s.pausedUntil ? 'pause' : 'focus';
  const phaseTitle = { idle: '', break: `Erholungspause · Runde ${s?.round}/${s?.pomodoro?.rounds}`, pause: 'Ewigstein-Pause', focus: mode === 'wild' ? 'Etwas raschelt im hohen Gras …' : `${esc(d?.name)} trainiert` }[phase];
  const recent = (state.plantedTrees || []).find((t) => t.survived && !t.wasWildEncounter && G.findPokemon(state, t.pokemonID));

  view.innerHTML = `
    ${banner ? `<div class="banner ${banner.ok ? '' : 'bad'}"><p>${esc(banner.text)}</p>${banner.recap ? '<button class="link" data-action="recap">Trainingsmoment ansehen</button>' : ''}${banner.recap && !running && lastRound() ? '<button class="link" data-action="again">↻ Gleiche Runde nochmal</button>' : ''}<button class="icon-btn small" data-action="dismiss-banner" aria-label="Hinweis schließen">×</button></div>` : ''}
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
        ${poketch({ state, s, running, mode, minutes, partner, d, gain, coins, phase })}
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
            ${typeBadges(G.pokemonTypes(partner), true)}
            ${bar(d.progress)}
            <p class="small muted">${d.maxLevel ? 'Level 100 · Fokus-Champion' : `Diese Runde +${gain} EP → Lv. ${projected.level}. Noch ${d.minutesToNextLevel} Fokus-Min bis Lv. ${d.level + 1}.`}</p>
            ${d.nextEvolutionName ? `<p class="small ${d.toNextEvolution <= gain ? 'note-sun' : 'muted'}">${d.toNextEvolution <= gain ? `Diese Runde entwickelt es sich zu ${esc(d.nextEvolutionName)}!` : `Entwicklung zu ${esc(d.nextEvolutionName)} in ${duration(d.minutesToNextEvolution)} Fokus`}</p>` : ''}
            ${(() => { const m = G.currentRaidMatchup(state, mode); return m === 'neutral' ? '' : `<p class="small ${m === 'super' ? 'note-share' : 'note-sun'}">Raid: ${G.MATCHUP[m].label}</p>`; })()}
            ${(() => { const c = G.activeChallenge(state); if (!c) return ''; const m = G.gymMatchup(partner, c);
              return `<p class="small ${m === 'super' ? 'note-share' : m === 'weak' ? 'note-sun' : 'muted'}">Arena ${esc(c.leader)}: ${G.gymHPLeft(state)} KP · ${G.SHORT_MATCHUP[m]}</p>`; })()}
            ${ep.day ? `<p class="small note-sun">Pokémon des Tages: +${G.DAY_BONUS_PERCENT} % EP</p>` : ''}
            ${ep.habitat ? `<p class="small note-sun">Voller Lebensraum (${esc(G.partnerHabitatBonus(state, { mode: 'owned' })?.name ?? '')}): +${G.C.habitats.fullHabitatBonusPercent} % EP</p>` : ''}
            ${state.activeBerryBuff === 'epbeere' ? '<p class="small note-share">EP-Beere: doppelte EP</p>' : ''}
          </div></div>
          ${star && !running ? `<button class="pill quiet wide" data-action="partner" data-id="${star.id}">Heute in Topform: ${esc(G.describe(star).name)} wählen</button>` : ''}
          <div class="mini-team">${others.map((o) => { const od = G.describe(o); const adv = G.bestEffectiveness(G.pokemonTypes(o), G.typesOf(G.activeBoss(state).pokedexID)) >= 2 || (G.activeChallenge(state) && G.gymMatchup(o, G.activeChallenge(state)) === 'super');
            return `<button data-action="partner" data-id="${o.id}" ${running ? 'disabled' : ''} title="${esc(od.name)} als Partner${adv ? ' · Typvorteil' : ''}"><img src="${pixel(od.spriteID, o.isShiny)}" alt="${esc(od.name)}"><span>${state.expShareEnabled && !od.maxLevel ? `+${share}` : `Lv.${od.level}`}${adv ? ' ×2' : ''}</span></button>`; }).join('')}</div>
          ${running ? '' : (() => { const types = G.activeChallenge(state) ? G.challengeTypes(G.activeChallenge(state)) : G.typesOf(G.activeBoss(state).pokedexID);
            const c = G.bestCounter(state, types); return c && c.id !== partner.id ? `<button class="pill quiet wide" data-action="partner" data-id="${c.id}">Konter${G.activeChallenge(state) ? ` gegen ${esc(G.activeChallenge(state).leader)}` : ' für den Raid'}: ${esc(G.describe(c).name)} Lv. ${G.describe(c).level}</button>` : ''; })()}
        </div>` : mode === 'wild' ? `
        <div class="panel"><h3>Wilde Begegnung</h3><p class="small muted">Nach der Runde zeigt sich ein Pokémon aus dem Nationaldex. Je länger, desto seltener. Es landet im Team oder im PC.</p>
          <label class="field">Jagdgebiet <select data-action="hunt" ${running ? 'disabled' : ''}>
            <option value="">Überall (alle Typen)</option>
            ${G.C.habitats.places.map((h) => { const dex = G.habitatDex(state, h); const swarm = G.massOutbreak().habitatID === h.id ? ` · Massenauftreten: ${G.massOutbreak().name}` : '';
              return `<option value="${h.id}" ${G.huntHabitat(state)?.id === h.id ? 'selected' : ''} ${G.habitatUnlocked(state, h) ? '' : 'disabled'}>${esc(h.name)} · ${h.types.map((x) => G.typeInfo(x).name).join(', ')} · ${dex.owned}/${dex.total}${esc(swarm)}${G.habitatUnlocked(state, h) ? '' : ' (gesperrt)'}</option>`; }).join('')}
          </select></label>
          <p class="small muted">Im Jagdgebiet haben ${G.C.huntTypeChancePercent} % der wilden Pokémon einen passenden Typ. Die Zahl zeigt, wie viele Arten dieser Typen du hast.</p>
          ${G.radarChain(state) ? `<p class="small note-sun">📡 Pokéradar-Kette ${G.radarChain(state)} · +${G.radarShinyBonus(G.radarChain(state))} % Shiny${G.radarChain(state) >= G.C.journey.radar.lockOnChain ? ' · jede Begegnung passt zum Typ' : ''}. Ein Abbruch lässt sie reißen.</p>`
            : G.huntHabitat(state) ? `<p class="small muted">📡 Bleib im selben Gebiet: Jede geschaffte wilde Runde verlängert die Pokéradar-Kette (+${G.C.journey.radar.shinyPerLink} % Shiny pro Glied).</p>`
            : `<p class="small muted">${G.DAYTIME_ICON[G.dayTime().id]} ${esc(G.dayTime().name)}: ${esc(G.dayTime().hint)}</p>`}
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
  range?.addEventListener('input', () => { app.meta.minutes = Number(range.value); saveMeta(); $('#clock').textContent = `${String(app.meta.minutes).padStart(2, '0')}:00`; const pct = $('#lcd-pct'); if (pct) pct.textContent = `${app.meta.minutes} Min`; });
  range?.addEventListener('change', () => app.render());
  view.querySelectorAll('[data-plan]').forEach((input) => input.addEventListener('change', () => {
    app.meta.pomodoro = G.normalizePlan({ ...app.meta.pomodoro, [input.dataset.plan]: Number(input.value) });
    saveMeta(); app.render();
  }));
  startTicker();
}

// MARK: Pokétch (the watch from Diamant/Perl/Platin)
const POKETCH_APPS = [['timer', 'Fokus-Uhr'], ['pedometer', 'Schrittzähler'], ['party', 'Pokémon-Liste'], ['friendship', 'Freundschaftstest'], ['calendar', 'Kalender'], ['clock', 'Analoguhr']];
const lastRound = () => (app.state.plantedTrees || []).find((t) => t.survived && !t.wasWildEncounter && G.findPokemon(app.state, t.pokemonID));
function clockHands(date = new Date()) {
  const h = date.getHours() % 12; const m = date.getMinutes(); const sec = date.getSeconds();
  return { h: (h + m / 60) * 30, m: (m + sec / 60) * 6, s: sec * 6 };
}
const lcdBar = (fraction, id = '') => `<div class="lcd-bar" ${id ? `id="${id}"` : ''}>${Array.from({ length: 20 }, (_, i) => `<i class="${i < Math.round(fraction * 20) ? 'on' : ''}"></i>`).join('')}</div>`;
function poketch({ state, s, running, mode, minutes, partner, d, gain, coins, phase }) {
  const appID = POKETCH_APPS.some(([id]) => id === app.meta.poketchApp) ? app.meta.poketchApp : 'timer';
  let screen;
  if (appID === 'pedometer') {
    const today = G.todayMinutes(state); const goal = G.dailyGoal(state);
    screen = `<div class="lcd-row"><span>Schrittzähler</span><span>Heute</span></div>
      <div class="lcd-main"><div class="lcd-digits">${String(Math.min(9999, today)).padStart(4, '0')}</div><span class="lcd-unit">/ ${goal} Min</span></div>
      ${lcdBar(Math.min(1, today / goal))}
      <div class="lcd-row"><span>Serie ${G.streakDays(state)} Tage</span><span>${today >= goal ? 'Ziel erreicht!' : `Noch ${goal - today} Min`}</span></div>`;
  } else if (appID === 'party') {
    const team = state.teamPokemonIDs.map((id) => G.findPokemon(state, id)).filter(Boolean);
    screen = `<div class="lcd-row"><span>Pokémon-Liste</span><span>${team.length}/6</span></div>
      <div class="lcd-party">${team.map((m) => { const md = G.describe(m); return `<div><img class="lcd-sprite-img" src="${ds(md.spriteID, m.isShiny)}" alt="${esc(md.name)}"><span>Lv. ${md.level}</span><b><i style="width:${Math.round(md.progress * 100)}%"></i></b></div>`; }).join('')}</div>`;
  } else if (appID === 'friendship') {
    const minutesTogether = partner?.trainingMinutes ?? 0;
    const hearts = Math.min(5, Math.floor(minutesTogether / 120) + (minutesTogether > 0 ? 1 : 0));
    screen = `<div class="lcd-row"><span>Freundschaftstest</span><span>${minutesTogether} Min</span></div>
      <div class="lcd-main">${partner ? `<img class="lcd-sprite-img" src="${ds(d.spriteID, partner.isShiny)}" alt="${esc(d.name)}">` : ''}
        <div><div class="lcd-hearts">${Array.from({ length: 5 }, (_, i) => (i < hearts ? '♥' : '♡')).join('')}</div>
        <span class="lcd-unit">${['Kennt dich kaum', 'Gewöhnt sich an dich', 'Mag dich', 'Mag dich sehr', 'Vertraut dir', 'Beste Freunde!'][hearts]}</span></div></div>`;
  } else if (appID === 'calendar') {
    const now = new Date(); const year = now.getFullYear(); const month = now.getMonth();
    const days = new Date(year, month + 1, 0).getDate(); const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const focus = new Set((state.plantedTrees || []).filter((t) => t.survived).map((t) => G.fromSwiftDate(t.timestamp)).filter((d2) => d2.getFullYear() === year && d2.getMonth() === month).map((d2) => d2.getDate()));
    screen = `<div class="lcd-row"><span>Kalender</span><span>${focus.size} Fokus-Tage</span></div>
      <div class="lcd-cal">${['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((x) => `<b>${x}</b>`).join('')}${'<i></i>'.repeat(offset)}${Array.from({ length: days }, (_, i) => `<i class="${focus.has(i + 1) ? 'on' : ''} ${i + 1 === now.getDate() ? 'today' : ''}">${i + 1}</i>`).join('')}</div>`;
  } else if (appID === 'clock') {
    const a = clockHands();
    const tod = G.dayTime();
    screen = `<div class="lcd-row"><span>Analoguhr</span><span>${esc(tod.name)}</span></div>
      <div class="lcd-main"><svg class="lcd-clock" viewBox="-50 -50 100 100" aria-label="Uhrzeit ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}">
        <circle r="45" fill="none" stroke-width="4"/>${Array.from({ length: 12 }, (_, i) => `<line y1="-44" y2="${i % 3 ? -39 : -35}" transform="rotate(${i * 30})" stroke-width="3"/>`).join('')}
        <line id="hand-h" y2="-24" stroke-width="5" transform="rotate(${a.h})"/><line id="hand-m" y2="-36" stroke-width="3" transform="rotate(${a.m})"/><line id="hand-s" y2="-38" stroke-width="1.5" transform="rotate(${a.s})"/><circle r="4"/></svg>
        <span class="lcd-unit">${tod.id === 'night' ? 'Geister unterwegs' : tod.id === 'morning' ? 'Käfer unterwegs' : 'Alle unterwegs'}</span></div>`;
  } else {
    const label = !running ? (mode === 'wild' ? 'Bereit · Wild' : 'Bereit') : phase === 'break' ? `Pause · ${s.round}/${s.pomodoro.rounds}` : phase === 'pause' ? 'Ewigstein' : s.pomodoro ? `Fokus · ${s.round}/${s.pomodoro.rounds}` : 'Fokus läuft';
    const hunt = G.huntHabitat(state);
    screen = `<div class="lcd-row"><span>${label}</span><span id="lcd-pct">${running ? '0 %' : `${minutes} Min`}</span></div>
      <div class="lcd-main">${mode === 'wild' ? '<div class="lcd-ball" aria-hidden="true"></div>'
        : `<button class="lcd-sprite" data-action="tab" data-view="safari" ${running ? 'disabled' : ''} aria-label="Partner im Team wechseln"><img class="lcd-sprite-img" src="${ds(d?.spriteID ?? 1, partner?.isShiny)}" alt="${esc(d?.name)}"></button>`}
        <div class="lcd-digits" id="clock">${String(minutes).padStart(2, '0')}:00</div></div>
      ${lcdBar(0, 'lcd-bar')}
      <div class="lcd-row"><span>${mode === 'wild' ? (G.radarChain(state) ? `Radar-Kette ${G.radarChain(state)}` : `Jagd: ${esc(hunt?.name ?? 'überall')}`) : G.activeChallenge(state) ? `Arena ${esc(G.activeChallenge(state).leader)}: ${G.gymHPLeft(state)} KP` : `${esc(d?.name)} Lv. ${d?.level}`}</span><span>${mode === 'wild' ? `+${coins} Münzen` : `+${gain} EP`}</span></div>`;
  }
  return `<div class="poketch">
    <div class="poketch-body"><div class="lcd" aria-live="off">${screen}</div></div>
    <div class="poketch-side"><button class="poketch-button" data-action="poketch-app" aria-label="Pokétch-App wechseln, jetzt ${POKETCH_APPS.find(([id]) => id === appID)[1]}"></button>
      ${POKETCH_APPS.map(([id]) => `<span class="poketch-dot ${id === appID ? 'on' : ''}"></span>`).join('')}</div>
  </div>`;
}

// MARK: Running sessions
function startTicker() {
  clearInterval(ticker);
  if (!app.session) {
    document.title = 'PokéForest';
    if (app.meta.poketchApp === 'clock') ticker = setInterval(updateClockHands, 1000);
    return;
  }
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
    const filled = Math.round((1 - left / total) * 20);
    document.querySelectorAll('#lcd-bar i').forEach((seg, i) => seg.classList.toggle('on', i < filled));
    const pct = $('#lcd-pct');
    if (pct) pct.textContent = `${Math.round((1 - left / total) * 100)} %`;
    document.title = `${text} · PokéForest`;
    updateClockHands();
  };
  update();
  ticker = setInterval(update, 1000);
}

function updateClockHands() {
  const a = clockHands();
  for (const [id, deg] of [['hand-h', a.h], ['hand-m', a.m], ['hand-s', a.s]]) document.getElementById(id)?.setAttribute('transform', `rotate(${deg})`);
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
  const { chainEnded, rescued, lostChain } = G.failRound(app.state, s, reason);
  app.session = null;
  if (app.meta.poffin && G.poffinKey(app.meta.poffin) !== 'zeit') app.meta.poffin = null;
  app.meta.banner = { ok: !!chainEnded, text: chainEnded ? 'Pomodoro-Kette beendet. Abgeschlossene Runden bleiben erhalten.' : s.mode === 'wild' ? `Das wilde Pokémon ist geflohen (${reason}).${lostChain > 1 ? ` Die Pokéradar-Kette (${lostChain}) ist gerissen.` : ''}` : (rescued ? `Training beendet (${reason}). Himmihbeere: ${rescued.name} behält +${rescued.ep} EP für ${rescued.minutes} geschaffte Minuten.` : `Training beendet (${reason}). Keine EP.`) };
  if (rescued?.evolution) queueEvolutions([rescued.evolution]);
  saveSession(); save(); saveMeta();
  app.render();
  if (rescued?.evolution) playEvolutions();
}

export function showRecap(r = app.meta.lastResult) {
  if (!r) return;
  const sprite = r.wild ? r.captured.spriteID : r.partner.spriteID;
  const items = [
    r.wild ? `<li><strong>${esc(r.captured.formName)}</strong> gefangen${r.inPC ? ', wartet im PC' : ''}</li>` : `<li><strong>+${r.earned} EP</strong> für ${esc(r.partnerName)}${r.dayBonus ? ` (davon ${r.dayBonus} als Pokémon des Tages)` : ''}</li>`,
    `<li>+${r.coins} Münzen · ${r.raidDamage} Raid-Schaden${r.mega ? ' · Mega-Runde' : ''}</li>`,
    r.shared.recipients.length ? `<li class="note-share">EP-Teiler: +${r.shared.amount} EP für ${r.shared.recipients.map(esc).join(', ')}</li>` : '',
    r.habitatTraining?.residents.length ? `<li class="note-share">Lebensräume: +${r.habitatTraining.amount} EP für ${r.habitatTraining.residents.length === 1 ? esc(r.habitatTraining.residents[0]) : `${r.habitatTraining.residents.length} Bewohner`}</li>` : '',
    r.newDig ? `<li class="note-sun">Untergrund: neue Grabung bereit</li>` : '',
    r.habitatBonus ? `<li class="note-sun">Voller Lebensraum: +${r.habitatBonus} EP extra</li>` : '',
    ...r.levelUps.map((l) => `<li>${esc(l.name)}: Lv. ${l.from} → ${l.to}</li>`),
    r.trainerLevelUp ? `<li class="note-sun">Trainer-Level ${r.trainerLevelUp}!</li>` : '',
    ...r.notes.map((n) => `<li>${esc(n)}</li>`),
    r.newBadges.length ? `<li class="note-sun">Neue Orden: ${r.newBadges.map(esc).join(', ')}</li>` : '',
    ...r.researchUpdates.slice(0, 3).map((u) => `<li>${esc(u.region)} · ${esc(u.title)}: +${r.minutes} Min${u.ready ? ' · Belohnung bereit!' : ''}</li>`),
    r.finishedTrips.length ? `<li>Expedition fertig: ${r.finishedTrips.map(esc).join(', ')}</li>` : '',
    r.chainDone ? '<li class="note-sun">Pomodoro-Kette geschafft! Abschlussbonus erhalten.</li>' : '',
  ].join('');
  const xp = r.partnerXP;
  openSheet(`
    <div class="sheet-head"><img src="${art(sprite, r.shiny)}" alt=""><div><h2>${r.wild ? 'Gefangen!' : 'Geschafft!'}</h2><p class="muted">${r.minutes} Minuten Fokus.</p></div></div>
    ${xp ? `<div class="xp-gain" data-from="${xp.progressBefore}" data-to="${xp.progressAfter}" data-ups="${xp.to - xp.from}">
      <div class="row"><strong id="xp-level">${esc(xp.name)} Lv. ${xp.from}</strong><strong class="note-share">+${xp.gained} EP</strong></div>
      <div class="xp-track"><i id="xp-fill" style="width:${Math.round(xp.progressBefore * 100)}%"></i></div>
      <p class="xp-levelup" id="xp-up" hidden>Level-up! ${esc(xp.name)} ist jetzt Lv. ${xp.to}!</p></div>` : ''}
    <ul class="result">${items}</ul>
    ${(() => { const h = r.wild && r.individualID ? G.suggestedHabitat(app.state, r.individualID) : null;
      return h ? `<button class="pill quiet wide" data-action="habitat-quick" data-id="${r.individualID}" data-habitat="${h.id}">🏡 Passt ${esc(h.locative)}: einziehen lassen</button>` : ''; })()}
    <div class="actions">${!r.wild && !app.session && lastRound() ? '<button class="pill quiet" data-action="again">↻ Gleiche Runde nochmal</button>' : ''}<button class="pill" data-action="close">Weiter</button></div>`, () => playEvolutions());
  if (xp) animateXP(xp);
}

/** The EP bar fills like after a DS battle; every level-up gets its own moment. */
async function animateXP(xp) {
  const fill = document.getElementById('xp-fill'); const label = document.getElementById('xp-level'); const up = document.getElementById('xp-up');
  if (!fill) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ups = Math.max(0, xp.to - xp.from);
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  if (reduce) { fill.style.width = `${xp.progressAfter * 100}%`; label.textContent = `${xp.name} Lv. ${xp.to}`; up.hidden = !ups; return; }
  await wait(350);
  for (let i = 0; i < Math.min(ups, 5); i++) {
    fill.style.transition = 'width .6s ease-in'; fill.style.width = '100%';
    await wait(650);
    fill.style.transition = 'none'; fill.style.width = '0%'; label.textContent = `${xp.name} Lv. ${xp.from + i + 1}`;
    await wait(30);
  }
  if (ups) { label.textContent = `${xp.name} Lv. ${xp.to}`; up.hidden = false; }
  fill.style.transition = 'width .7s ease-out'; fill.style.width = `${xp.progressAfter * 100}%`;
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
    case 'habitat-quick': { const msg = G.placeInHabitat(app.state, el.dataset.id, G.habitatByID(el.dataset.habitat)); if (msg) { save(); toast(msg); el.remove(); } return true; }
    case 'poketch-app': { const ids = POKETCH_APPS.map(([id]) => id); meta.poketchApp = ids[(Math.max(0, ids.indexOf(meta.poketchApp || 'timer')) + 1) % ids.length]; saveMeta(); app.render(); return true; }
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
    case 'again': {
      const recent = lastRound();
      if (!recent || app.session || !G.choosePartner(state, recent.pokemonID)) return true;
      meta.mode = 'owned'; meta.minutes = recent.durationMinutes; meta.pomodoroEnabled = false;
      meta.tagID = state.tags.find((t) => t.name === recent.tagName)?.id ?? meta.tagID;
      closeSheet(); start(); return true;
    }
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
    case 'hunt': if (!app.session) { G.setHuntHabitat(app.state, el.value || null); save(); app.render(); } return true;
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
// Leertaste startet eine Runde (oder Ewigstein-Pause), solange kein Eingabefeld aktiv ist.
document.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  const t = event.target;
  if (t.closest?.('input, textarea, select, button, [contenteditable], dialog[open]') || document.querySelector('dialog[open]')) return;
  if (!app.state || (app.meta.tab && app.meta.tab !== 'train')) return;
  event.preventDefault();
  if (!app.session) start();
  else if (G.toggleEverstone(app.session)) { saveSession(); app.render(); }
});
export function resume() { if (app.session?.mode === 'wild' && !app.session.wildBranches && !app.session.inBreak) loadWild(); }

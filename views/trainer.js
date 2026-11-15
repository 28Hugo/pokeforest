// Trainer & Raids: badges, raids, quests, eggs, daycare, research, league, Pokédex and profile.
import * as G from '../game.js';
import { app, $, esc, art, pixel, num, bar, segmented, sub, save, saveMeta, toast, openSheet, closeSheet } from '../ui.js';

export function render(view) {
  const s = app.state;
  const level = G.trainerLevel(s);
  const rank = G.rankFor(level);
  const xp = G.trainerXP(s);
  const avatar = G.currentAvatar(s);
  const progress = (xp - G.trainerThreshold(level)) / Math.max(1, G.trainerThreshold(level + 1) - G.trainerThreshold(level));
  const streak = G.streakDays(s);
  view.innerHTML = `
    <div class="panel trainer-head">
      <img src="${art(avatar.pokedexID, avatar.isShiny)}" alt="" style="background:${avatar.colorHex}33">
      <div><h2>${esc(s.trainerName)}</h2>
        <p class="small" style="color:${rank.colorHex}">Lv. ${level} · ${rank.badgeEmoji} ${esc(rank.title)}${streak ? ` · ${streak} ${streak === 1 ? 'Tag' : 'Tage'} Serie` : ''}</p>
        ${bar(progress, rank.colorHex)}<p class="small muted">${num(G.trainerThreshold(level + 1) - xp)} XP bis zum nächsten Level</p></div>
    </div>
    ${segmented('trainer', [['badges', 'Orden'], ['raids', 'Raids & Quests'], ['research', 'Forschung'], ['league', 'Liga & Pokédex'], ['profile', 'Profil']])}
    <div id="trainer-body"></div>`;
  const body = $('#trainer-body', view);
  ({ badges: renderBadges, raids: renderRaids, research: renderResearch, league: renderLeague, profile: renderProfile })[sub('trainer', 'badges')](body);
}

function renderBadges(body) {
  const all = G.badges(app.state);
  const regions = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Champ-Liga'];
  body.innerHTML = `<div class="row"><h3>Dein Orden-Etui</h3><strong class="note-sun">${all.filter((b) => b.earned).length} / ${all.length}</strong></div>
    ${regions.map((r) => { const list = all.filter((b) => b.region === r); return `
      <div class="row"><h4>${r}</h4><span class="small muted">${list.filter((b) => b.earned).length} von ${list.length}</span></div>
      <div class="badge-grid">${list.map((b) => `<button class="badge-tile ${b.earned ? 'earned' : ''}" style="--accent:${b.color}" data-action="badge" data-id="${b.id}">
        <span class="medal"></span><strong>${esc(b.name)}</strong><small>${b.earned ? 'Erhalten' : 'Noch offen'}</small></button>`).join('')}</div>`; }).join('')}`;
}

function renderRaids(body) {
  const s = app.state;
  const boss = G.activeBoss(s);
  const quests = s.dailyQuests || [];
  body.innerHTML = `
    <div class="panel raid">
      <img src="${art(boss.pokedexID)}" alt="">
      <div><h3>${esc(boss.name)}</h3>
        ${bar(boss.currentHP / boss.maxHP, '#E3463B')}
        <p class="small muted">${num(boss.currentHP)} / ${num(boss.maxHP)} KP · Belohnung ${boss.rewardCoins} Münzen + ${esc(boss.rewardSpecies.displayName)} · ${boss.defeatedCount}× besiegt</p>
        <p class="small muted">Jede Fokus-Minute trifft den Boss. Mega-Runden ×2, Drachen-Knursp ×3, dazu der Raid-Bonus deines Partners.</p>
        <button class="pill quiet" data-action="bosses" ${app.session ? 'disabled' : ''}>Boss wechseln</button></div>
    </div>
    <h3>Tagesquests</h3>
    <div class="stack">${quests.map((q) => `<div class="panel row"><div><strong>${esc(q.title)}</strong>${bar(q.currentValue / q.targetValue)}<span class="small muted">${q.currentValue} / ${q.targetValue} · ${G.C.quests.find((d) => d.kind === q.kind)?.rewardCoins ?? q.rewardCoins} Münzen</span></div>
      <button class="pill" data-action="claim-quest" data-id="${q.id}" ${q.isClaimed || q.currentValue < q.targetValue ? 'disabled' : ''}>${q.isClaimed ? 'Abgeholt' : 'Abholen'}</button></div>`).join('')}</div>
    <h3>Pokémon-Eier</h3>
    <div class="stack">${(s.eggs || []).map((e) => `<div class="panel row"><img class="egg" src="${e.isHatched ? pixel(e.rewardSpecies.stages[0].pokedexID) : 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystery-egg.png'}" alt="">
      <div><strong>${esc(e.title)}</strong>${bar(e.accumulatedMinutes / e.requiredMinutes)}<span class="small muted">${e.isHatched ? `Geschlüpft: ${esc(e.rewardSpecies.displayName)}` : `${e.accumulatedMinutes} / ${e.requiredMinutes} Fokus-Minuten`}</span></div></div>`).join('')}
      <p class="small muted">Es brütet immer das erste ungeschlüpfte Ei.</p></div>
    <h3>Pension Route 34</h3>
    <div class="stack">${(s.daycareSlots || []).map((slot, i) => `<div class="panel daycare-slot"><img src="${pixel(slot.species.stages[0].pokedexID)}" alt="">
      <div><strong>${esc(slot.species.displayName)}</strong><br><span class="small muted">Zuneigung ${slot.affectionLevel} · ${'♥'.repeat(Math.min(5, 1 + Math.floor(slot.affectionLevel / 5)))} · ${slot.accumulatedMinutes} Min</span></div>
      <select data-action="daycare" data-index="${i}" aria-label="Pokémon für Platz ${i + 1}"><option value="">Wechseln …</option>${G.unlockedSpecies(s).map((sp) => `<option value="${esc(sp.id)}">${esc(sp.displayName)}</option>`).join('')}</select></div>`).join('')}
      <p class="small muted">Alle 30 Fokus-Minuten steigt die Zuneigung, mit einem kleinen Münz-Geschenk.</p></div>`;
}
function bossSheet() {
  const s = app.state;
  const owned = new Set(G.unlockedSpecies(s).map(G.legendaryID).filter((x) => x != null));
  openSheet(`<h2>Raid-Boss wählen</h2><div class="boss-list">${s.raidCampaign.bosses.map((b) => `<button class="boss ${b.pokedexID === s.raidCampaign.selectedBossID ? 'on' : ''}" data-action="select-boss" data-id="${b.pokedexID}">
    <img src="${pixel(b.pokedexID)}" alt="" loading="lazy"><span><strong>${esc(b.name)}</strong><small>${num(b.currentHP)}/${num(b.maxHP)} KP · ${b.defeatedCount}× besiegt${owned.has(b.pokedexID) ? ' · im Team' : ''}</small></span></button>`).join('')}</div>
    <button class="pill quiet" data-action="close">Schließen</button>`);
}

function renderResearch(body) {
  const s = app.state;
  const regionID = app.meta.researchRegion || 'kanto';
  const region = G.C.regionByID[regionID];
  const missions = G.C.research.missions.filter((m) => m.region === regionID);
  const claimed = new Set(s.claimedResearchIDs || []);
  const ready = G.C.research.missions.filter((m) => !claimed.has(m.id) && G.researchProgress(s, m).complete).length;
  body.innerHTML = `
    <div class="row"><select data-action="region" aria-label="Region">${G.C.research.regions.map((r) => `<option value="${r.id}" ${r.id === regionID ? 'selected' : ''}>${esc(r.title)} · ${esc(r.games)}</option>`).join('')}</select>
      ${ready ? `<span class="note-sun small">${ready} Belohnung${ready === 1 ? '' : 'en'} bereit</span>` : ''}</div>
    <div class="panel" style="border-color:${region.accentHex}"><h3>${esc(region.title)} mit ${esc(region.professor)}</h3><p class="small muted">Trainiere die passenden Pokémon-Familien. Wilde Begegnungen zählen nicht.</p></div>
    <div class="stack">${missions.map((m) => { const p = G.researchProgress(s, m); const done = claimed.has(m.id);
      const families = G.missionFamilies(m);
      return `<div class="panel mission ${done ? 'done' : ''}"><div class="row"><strong>${esc(m.title)}</strong><span class="small muted">${m.rewardCoins} Münzen${m.reward ? ` + ${esc(m.reward.displayName)}` : ''}${m.rewardBerry ? ` + ${esc(G.berryName(m.rewardBerry))}` : ''}</span></div>
        <div class="fams">${families.map((f) => `<img src="${pixel(f.allowedIDs[0])}" alt="${esc(f.title)}" title="${esc(f.title)}">`).join('')}</div>
        ${bar(p.fraction, region.accentHex)}<p class="small muted">${done ? 'Erledigt' : esc(p.remainingText)}</p>
        ${done ? '' : p.complete ? `<button class="pill" data-action="claim-research" data-id="${m.id}">Belohnung abholen</button>` : `<button class="pill quiet" data-action="research-train" data-id="${m.id}" ${app.session ? 'disabled' : ''}>Training vorbereiten</button>`}</div>`; }).join('')}</div>
    ${G.canClaimRegion(s, regionID) ? `<button class="pill wide" data-action="claim-region" data-id="${regionID}">${esc(region.title)}-Reise abschließen: +100 Münzen</button>` : ''}`;
}
function researchTrain(missionID) {
  const s = app.state;
  const m = G.C.research.missions.find((x) => x.id === missionID);
  const families = G.missionFamilies(m);
  const partners = s.pokemonRoster.filter((p) => families.some((f) => p.species.stages.some((st) => f.allowedIDs.includes(st.pokedexID))) && !G.onExpedition(s, p.id));
  if (!partners.length) { toast('Dir fehlt noch ein passendes Pokémon. Schau im Shop oder bei wilden Begegnungen.'); return; }
  const p = G.researchProgress(s, m);
  const remainingSessions = Math.max(1, m.requiredSessions - p.sessions);
  const minutes = Math.min(180, Math.max(5, Math.ceil(Math.max(5, m.requiredMinutes - p.minutes) / remainingSessions / 5) * 5));
  openSheet(`<h2>${esc(m.title)}</h2><p class="muted">Wähle einen Partner. Die Dauer wird auf ${minutes} Min gesetzt.</p>
    <div class="boss-list">${partners.map((x) => { const d = G.describe(x); return `<button class="boss" data-action="research-partner" data-id="${x.id}" data-minutes="${minutes}"><img src="${pixel(d.spriteID, x.isShiny)}" alt=""><span><strong>${esc(d.name)}</strong><small>Lv. ${d.level}</small></span></button>`; }).join('')}</div>
    <button class="pill quiet" data-action="close">Schließen</button>`);
}

function renderLeague(body) {
  const s = app.state;
  const league = G.weeklyLeague(s);
  const dex = G.availableSpecies(s);
  const shiny = !!app.meta.dexShiny;
  body.innerHTML = `
    <div class="panel"><div class="row"><h3>Wochen-Liga</h3><span class="small muted">Montag bis Sonntag</span></div>
      <p><strong>${league.minutes} / ${league.goal}</strong> Fokus-Minuten</p>${bar(league.minutes / league.goal)}
      <div class="row"><label class="field">Wochenziel <select data-action="league-goal">${[60, 180, 300, 600, 900, 1200].map((g) => `<option ${g === league.goal ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
        <button class="pill" data-action="claim-league" ${league.complete && !league.claimed ? '' : 'disabled'}>${league.claimed ? 'Abgeholt' : '+40 Münzen abholen'}</button></div>
      <p class="small muted">Eine Belohnung je Kalenderwoche.</p></div>
    <div class="panel"><h3>Rivalen dieser Woche</h3>${G.C.rivals.map((r) => `<div class="rival"><img src="${pixel(r.partnerPokedexID)}" alt=""><div><strong>${esc(r.name)}</strong><span class="small muted">${esc(r.title)} · ${r.weeklyTargetMinutes} Min</span></div>
      <span class="small ${league.minutes >= r.weeklyTargetMinutes ? 'note-sun' : 'muted'}">${league.minutes >= r.weeklyTargetMinutes ? 'Besiegt' : `noch ${r.weeklyTargetMinutes - league.minutes} Min`}</span></div>`).join('')}</div>
    <div class="row"><h3>Pokédex</h3><label class="switch"><input type="checkbox" data-action="dex-shiny" ${shiny ? 'checked' : ''}> Shiny</label></div>
    <p class="small muted">${dex.filter((x) => G.isUnlocked(s, x)).length} von ${dex.length} entdeckten Linien freigeschaltet.</p>
    <div class="dex">${dex.map((x) => `<div class="dex-entry ${G.isUnlocked(s, x) ? '' : 'locked'}">${x.stages.map((st) => `<img src="${pixel(st.pokedexID, shiny)}" alt="${esc(st.name)}" title="${esc(st.name)} #${st.pokedexID}" loading="lazy">`).join('')}<small>${esc(x.displayName)}</small></div>`).join('')}</div>`;
}

function renderProfile(body) {
  const s = app.state;
  const level = G.trainerLevel(s);
  body.innerHTML = `
    <form class="panel stack" data-form="profile">
      <label class="field">Trainername <input name="name" maxlength="30" value="${esc(s.trainerName)}"></label>
      <label class="field">Motto <input name="motto" maxlength="100" value="${esc(s.trainerMotto)}"></label>
      <button class="pill">Speichern</button></form>
    <h3>Profilbild</h3>
    <div class="avatars">${G.C.avatars.map((a) => { const owned = (s.unlockedAvatarIDs || []).includes(a.id);
      return `<button class="avatar ${a.id === s.selectedAvatarID ? 'on' : ''}" data-action="avatar" data-id="${a.id}" ${owned ? '' : 'disabled'} style="--accent:${a.colorHex}" title="${esc(a.name)} (${esc(a.rarity)})"><img src="${pixel(a.pokedexID, a.isShiny)}" alt=""><small>${owned ? esc(a.name) : '???'}</small></button>`; }).join('')}</div>
    <p class="small muted">Weitere Profilbilder gibt es im Shop als Kapsel.</p>
    <h3>Trainer-Rang</h3>
    <div class="ranks">${G.C.ranks.map((r) => `<div class="rank ${level >= r.minLevel ? 'on' : ''} ${G.rankFor(level).id === r.id ? 'now' : ''}" style="--accent:${r.colorHex}"><img src="${pixel(r.pokedexID)}" alt=""><div><strong>${r.badgeEmoji} ${esc(r.title)}</strong><small>${r.maxLevel ? (r.minLevel === r.maxLevel ? `Lv. ${r.minLevel}` : `Lv. ${r.minLevel}–${r.maxLevel}`) : `Ab Lv. ${r.minLevel}`}</small><p class="small muted">${esc(r.description)}</p></div></div>`).join('')}</div>`;
}

export function handle(action, el) {
  const s = app.state;
  const done = (msg) => { save(); if (msg) toast(msg); closeSheet(); app.render(); return true; };
  switch (action) {
    case 'badge': { const b = G.badges(s).find((x) => x.id === el.dataset.id); toast(`${b.name} (${b.leader}): ${b.text}${b.earned ? ' ✓' : ''}`); return true; }
    case 'bosses': bossSheet(); return true;
    case 'select-boss': G.selectBoss(s, Number(el.dataset.id)); return done();
    case 'claim-quest': { const coins = G.claimQuest(s, el.dataset.id); return done(coins ? `+${coins} Münzen!` : null); }
    case 'claim-research': return done(G.claimResearch(s, el.dataset.id));
    case 'claim-region': return done(G.claimRegion(s, el.dataset.id));
    case 'research-train': researchTrain(el.dataset.id); return true;
    case 'research-partner': if (G.choosePartner(s, el.dataset.id)) { app.meta.mode = 'owned'; app.meta.minutes = Number(el.dataset.minutes); app.meta.pomodoroEnabled = false; app.meta.tab = 'train'; saveMeta(); return done('Training vorbereitet.'); } return true;
    case 'claim-league': return done(G.claimLeague(s) ? '+40 Münzen für die Wochen-Liga!' : null);
    case 'avatar': s.selectedAvatarID = el.dataset.id; return done();
  }
  return false;
}
export function change(el) {
  const s = app.state;
  switch (el.dataset.action) {
    case 'region': app.meta.researchRegion = el.value; saveMeta(); app.render(); return true;
    case 'league-goal': s.weeklyLeagueGoal = Number(el.value); save(); app.render(); return true;
    case 'dex-shiny': app.meta.dexShiny = el.checked; saveMeta(); app.render(); return true;
    case 'daycare': {
      const species = G.unlockedSpecies(s).find((x) => x.id === el.value);
      if (species) { s.daycareSlots[Number(el.dataset.index)] = { id: G.newID(), species, affectionLevel: 1, accumulatedMinutes: 0 }; save(); app.render(); }
      return true;
    }
  }
  return false;
}
export function submit(form) {
  if (form.dataset.form !== 'profile') return false;
  const data = new FormData(form);
  app.state.trainerName = data.get('name').trim() || app.state.trainerName;
  app.state.trainerMotto = data.get('motto').trim();
  save(); toast('Profil gespeichert.'); app.render();
  return true;
}

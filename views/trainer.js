// Trainer & Raids: badges, gyms, raids, quests, eggs, research, league, Pokédex and profile.
import * as G from '../game.js';
import { app, $, esc, art, pixel, ds, jingle, typeBadges, num, bar, segmented, sub, pills, info, save, saveMeta, toast, openSheet, closeSheet } from '../ui.js';

export function render(view) {
  const s = app.state;
  const level = G.trainerLevel(s);
  const rank = G.rankFor(level);
  const xp = G.trainerXP(s);
  const avatar = G.currentAvatar(s);
  const progress = (xp - G.trainerThreshold(level)) / Math.max(1, G.trainerThreshold(level + 1) - G.trainerThreshold(level));
  const streak = G.streakDays(s);
  const current = sub('trainer', 'gyms');
  const group = G.trainerGroupOf(current);
  view.innerHTML = `
    <div class="panel trainer-head">
      <img src="${art(avatar.pokedexID, avatar.isShiny)}" alt="" style="background:${avatar.colorHex}33">
      <div><h2>${esc(s.trainerName)}</h2>
        <p class="small" style="color:${rank.colorHex}">Lv. ${level} · ${rank.badgeEmoji} ${esc(rank.title)}${streak ? ` · ${streak} ${streak === 1 ? 'Tag' : 'Tage'} Serie` : ''}</p>
        ${bar(progress, rank.colorHex)}<p class="small muted">${num(G.trainerThreshold(level + 1) - xp)} XP bis zum nächsten Level</p></div>
    </div>
    <div class="segmented" role="tablist">${G.TRAINER_GROUPS.map((g) => { const ready = g.id === 'battles' ? G.readyWeeklyCount(s) : 0;
      return `<button role="tab" data-action="sub" data-key="trainer" data-value="${g.subs[0][0]}" aria-selected="${g.id === group.id}">${esc(g.title)}${ready ? ` (${ready})` : ''}</button>`; }).join('')}</div>
    ${pills('trainer', group.subs, current)}
    <div id="trainer-body"></div>`;
  const body = $('#trainer-body', view);
  ({ badges: renderBadges, gyms: renderGyms, zone: renderZone, contest: renderContest, raids: renderRaids, research: renderResearch, league: renderLeague, profile: renderProfile })[current](body);
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

const BADGE_ICON = { 'sinnoh-coal': '◆', 'sinnoh-forest': '❦', 'sinnoh-cobble': '⬢', 'sinnoh-fen': '💧', 'sinnoh-relic': '✧', 'sinnoh-mine': '⚒', 'sinnoh-icicle': '❄', 'sinnoh-beacon': '☀' };
function renderGyms(body) {
  const s = app.state;
  const running = !!app.session;
  const active = G.activeChallenge(s);
  const c = active ?? G.nextChallenge(s);
  const partner = G.findPokemon(s, s.selectedPokemonID);
  let card;
  if (!c) {
    card = `<div class="panel champion"><h3>👑 Du bist Champ von Sinnoh!</h3><p class="small muted">Alle Orden und die ganze Liga gehören dir. Die Liga kann dich erneut fordern, mit mehr KP.</p>
      <button class="pill" data-action="league-rematch" ${running ? 'disabled' : ''}>Revanche gegen die Liga</button></div>`;
  } else {
    const max = G.challengeMaxHP(s, c);
    const hp = active ? G.gymHPLeft(s) : max;
    const m = G.gymMatchup(partner, c);
    const counter = G.bestCounter(s, G.challengeTypes(c));
    card = `<div class="panel gym-card" style="--accent:${c.colorHex}">
      <div class="gym-ace"><img src="${ds(c.aceDexID)}" alt="${esc(G.pokemonName(c.aceDexID))}"></div>
      <div class="stack">
        <div><h3>${esc(c.title)} ${esc(c.leader)}</h3><p class="small muted">${esc(c.place)}${c.badgeName ? ` · ${esc(c.badgeName)}` : ''}</p></div>
        <p class="quote">„${esc(c.quote)}“</p>
        <p class="small"><strong>${esc(G.pokemonName(c.aceDexID))}</strong> ${typeBadges(G.challengeTypes(c), true)}</p>
        <div class="row small"><strong class="note-sun">KP</strong><span>${hp} / ${max}</span></div>
        ${bar(hp / Math.max(1, max), hp / max < 0.2 ? '#E3463B' : hp / max < 0.5 ? '#F5C542' : '#47C77A')}
        ${partner ? `<p class="small ${m === 'super' ? 'note-share' : m === 'weak' ? 'note-sun' : 'muted'}">${esc(G.describe(partner).name)}: ${G.SHORT_MATCHUP[m]}</p>` : ''}
        <p class="small muted">Schwächen: ${G.weaknesses(G.challengeTypes(c)).map((t) => G.typeInfo(t).name).join(', ')}</p>
        <div class="row wrap">
          ${active ? `<button class="pill" data-action="tab" data-view="train">Zum Training</button><button class="pill quiet" data-action="leave-gym" ${running ? 'disabled' : ''}>Kampf verlassen</button>`
            : `<button class="pill" data-action="challenge" data-id="${c.id}" ${running ? 'disabled' : ''}>Herausfordern</button>`}
          ${counter && counter.id !== partner?.id ? `<button class="pill quiet" data-action="counter" data-id="${counter.id}" ${running ? 'disabled' : ''} title="Macht es zum Partner und öffnet das Training">Konter: ${esc(G.describe(counter).name)} Lv. ${G.describe(counter).level}</button>` : ''}
        </div>
      </div></div>`;
  }
  body.innerHTML = `
    <h3>Arenen in Sinnoh${info('Fordere einen Arenaleiter heraus. Jede Trainingsrunde mit deinem eigenen Partner zieht seinem Pokémon KP ab: 1 KP pro Minute, mit Typvorteil doppelt so viel.')}</h3>
    <div class="badge-case">${G.gyms().map((g) => `<div class="case-slot ${G.isDefeated(s, g) ? 'won' : ''}" style="--accent:${g.colorHex}" title="${esc(g.badgeName)} · ${esc(g.leader)}, ${esc(g.place)}"><span>${BADGE_ICON[g.id] ?? '★'}</span><small>${esc(g.badgeName)}</small></div>`).join('')}</div>
    <p class="small muted">${G.gymBadgeCount(s)} / 8 Orden</p>
    ${card}
    <div class="duo">${rivalCard(s)}${spearCard(s)}</div>
    <h3>Pokémon-Liga ${s.journey?.gyms?.leagueRematches ? `<span class="small muted">Revanche ${s.journey.gyms.leagueRematches}</span>` : ''}</h3>
    <div class="league-row">${G.league().map((l) => `<div class="${G.isDefeated(s, l) ? 'won' : G.challengeAvailable(s, l) ? 'open' : 'locked'}"><img src="${ds(l.aceDexID)}" alt=""><strong>${esc(l.leader)}</strong><small>${esc(l.title)}</small></div>`).join('')}</div>`;
}

function renderZone(body) {
  const s = app.state;
  const j = G.ensureJourney(s);
  const Z = G.C.zone;
  const floor = j.tower.floor;
  const block = Math.floor(floor / Z.tower.bossEvery) * Z.tower.bossEvery;
  const items = Object.entries(j.items).filter(([, n]) => n > 0);
  const shiny = G.shinyStats(s);
  const stone = app.meta.prizeStone || Z.stones[0].id;
  body.innerHTML = `
    <p class="small muted">Jede geschaffte Runde bringt dich im Kampfturm eine Etage höher und gibt Kampfpunkte. Jede ${Z.tower.bossEvery}. Etage ist ein Turm-Boss mit +${Z.tower.bossBonus} Punkten. Ein Abbruch schickt dich zurück nach unten.</p>
    <div class="cards">
      <div class="card"><strong>${floor}</strong><span>Etage</span></div>
      <div class="card"><strong>${j.tower.best}</strong><span>Rekord</span></div>
      <div class="card"><strong>${j.tower.points}</strong><span>Kampfpunkte</span></div>
    </div>
    <div class="tower">${Array.from({ length: Z.tower.bossEvery }, (_, i) => block + i + 1).map((n, i) => `<span class="${n <= floor ? 'done' : ''}">${i === Z.tower.bossEvery - 1 ? '👑' : n <= floor ? '✓' : '·'}<small>${n}</small></span>`).join('')}</div>
    <h3>Kampfpunkte-Laden</h3>
    <div class="stack">${Z.prizes.map((x) => `<div class="panel item-row"><div><strong>${esc(x.name)}</strong><p class="small muted">${esc(x.detail)}</p>
      ${x.id === 'stein' ? `<select data-action="prize-stone" aria-label="Stein wählen">${Z.stones.map((st) => `<option value="${st.id}" ${st.id === stone ? 'selected' : ''}>${esc(st.name)}</option>`).join('')}</select>` : ''}</div>
      <button class="pill" data-action="buy-prize" data-id="${x.id}" ${j.tower.points < x.price ? 'disabled' : ''}>${x.price} KP</button></div>`).join('')}</div>
    <h3>Beutel</h3>
    ${items.length ? `<div class="row wrap">${items.map(([id, n]) => { const st = G.stoneByID(id); return `<span class="chip"><span class="dot" style="background:${st?.colorHex ?? '#7A9AE8'}"></span>${esc(st?.name ?? 'Sonderbonbon')} × ${n}</span>`; }).join('')}</div>
      <p class="small muted">Benutzen kannst du sie im Steckbrief eines Pokémon.</p>` : '<p class="small muted">Noch leer. Steine findest du im Untergrund, Sonderbonbons im Kampfpunkte-Laden.</p>'}
    <h3>Wochen-Quests <span class="small muted">${G.weekKey()}</span></h3>
    <div class="stack">${Z.weekly.map((q) => { const n = G.weeklyProgress(s, q.id); const claimed = G.weeklyClaimed(s, q.id);
      return `<div class="panel row"><div><strong>${esc(q.title)}</strong>${bar(Math.min(1, n / q.target), '#2AA198')}<span class="small muted">${Math.min(n, q.target)} / ${q.target} · ${esc(q.reward)}</span></div>
        <button class="pill" data-action="claim-weekly" data-id="${q.id}" ${claimed || n < q.target ? 'disabled' : ''}>${claimed ? 'Abgeholt' : 'Abholen'}</button></div>`; }).join('')}</div>
    <h3>Rekorde &amp; Shiny-Zähler</h3>
    <div class="cards">
      <div class="card"><strong>${shiny.owned}</strong><span>Shinys im Besitz</span></div>
      <div class="card"><strong>${shiny.caught}</strong><span>Shinys gefangen</span></div>
      <div class="card"><strong>${j.radar.best}</strong><span>Beste Radar-Kette</span></div>
      <div class="card"><strong>${j.pension.hatchedCount}</strong><span>Eier geschlüpft</span></div>
    </div>`;
}

function renderContest(body) {
  const s = app.state;
  const cat = G.categoryOfWeek();
  const ranked = [...s.pokemonRoster].sort((a, b) => G.contestScore(s, b, cat.id) - G.contestScore(s, a, cat.id));
  const p = G.findPokemon(s, app.meta.contestID) ?? ranked[0];
  if (!p) { body.innerHTML = '<p class="muted">Noch keine Pokémon.</p>'; return; }
  const d = G.describe(p);
  const cond = G.conditionsOf(s, p.id);
  const result = app.meta.contestResult;
  body.innerHTML = `
    <p class="small muted">Jede Fokus-Runde trainiert die Kondition deines Partners, passend zu seinem ersten Typ. Knursp aus Beeren hebt sie zusätzlich. Pro Woche darfst du in jedem Rang einmal antreten.</p>
    <p>Diese Woche: <span class="chip" style="background:${cat.colorHex};color:#fff">${esc(cat.name)}</span></p>
    <div class="panel contest">
      <div class="contest-mon"><img src="${ds(d.spriteID, p.isShiny)}" alt=""><strong>${esc(d.name)} · Lv. ${d.level}</strong><span class="note-sun">${G.contestScore(s, p, cat.id)} Punkte</span>
        <select data-action="contest-pick" aria-label="Pokémon wählen">${ranked.slice(0, 30).map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(G.describe(x).name)} · ${G.contestScore(s, x, cat.id)} P.</option>`).join('')}</select></div>
      <div class="stack">
        ${conditionBars(cond)}
        <div class="row wrap small">Knursp füttern: ${G.C.berries.map((b) => `<button class="chip" data-action="feed" data-id="${b.id}" data-pokemon="${p.id}" ${(s.berryInventory?.[b.id] || 0) ? '' : 'disabled'}>${esc(b.name)} (${s.berryInventory?.[b.id] || 0})</button>`).join('')}</div>
        ${G.contestRanks().map((r) => `<div class="row"><div><strong>${esc(r.name)}</strong><br><span class="small muted">Gegner ${r.opponentScore} P. · +${r.rewardCoins} Münzen</span></div>
          ${G.ribbonsOf(s, p.id).includes(`${cat.id}-${r.id}`) ? '<span title="Band">🎀</span>' : ''}
          <button class="pill quiet" data-action="contest-enter" data-rank="${r.id}" data-pokemon="${p.id}" ${G.canEnterContest(s, r.id) ? '' : 'disabled'}>Antreten</button></div>`).join('')}
        ${result ? `<p class="${result.won ? 'note-share' : 'muted'}">${result.won ? '🎀 ' : ''}${esc(result.text)}</p>` : ''}
      </div>
    </div>`;
}
export function conditionBars(cond) {
  return `<div class="conditions">${G.contestCategories().map((c) => `<div class="row small"><span>${esc(c.name)}</span>${bar(cond[c.id] / G.C.zone.contest.maxCondition, c.colorHex)}<span>${cond[c.id]}</span></div>`).join('')}</div>`;
}

function rivalCard(s) {
  const r = G.rival(s); const ace = G.rivalAce(s); const p = G.findPokemon(s, s.selectedPokemonID);
  const m = p ? G.raidMatchup(G.pokemonTypes(p), G.typesOf(ace)) : 'neutral';
  const max = G.rivalMaxHP(s);
  return `<div class="panel rival compact"><img src="${ds(ace)}" alt=""><div class="stack">
    <div class="row"><h3>Rivale ${esc(G.C.life.rival.name)}${info(`„${G.C.life.rival.quote}“ Barry fordert dich jede Woche heraus. Nimm den Kampf an, dann zieht jede Trainingsrunde ihm KP ab. Sieg: ${G.rivalReward(s)} Münzen + ${G.C.life.rival.rewardPoints} Kampfpunkte.`)}</h3>${typeBadges(G.typesOf(ace), true)}</div>
    ${r.beaten ? '<p class="small note-share">✓ Diese Woche besiegt</p>'
      : `${bar((max - r.damage) / max, '#E8920E')}<div class="row"><span class="small muted">${max - r.damage} / ${max} KP${p ? ` · ${esc(G.describe(p).name)}: ${G.SHORT_MATCHUP[m]}` : ''}</span>
        <button class="pill small ${r.active ? 'quiet' : ''}" data-action="${r.active ? 'rival-leave' : 'rival-start'}" ${app.session ? 'disabled' : ''}>${r.active ? 'Verlassen' : 'Annehmen'}</button></div>`}</div></div>`;
}
function spearCard(s) {
  if (!G.spearOpen(s)) return '';
  const sp = G.ensureJourney(s).spear;
  const met = (id) => s.pokemonRoster.some((p) => p.species.stages.some((st) => st.pokedexID === id));
  return `<div class="panel spear compact"><div class="row">${[483, 484, 487].map((id) => `<img src="${ds(id)}" alt="" style="${met(id) ? '' : 'filter:grayscale(1);opacity:.5'}">`).join('')}</div>
    <h3>Speersäule</h3><p class="small">${esc(G.spearText(s))}</p>
    ${sp.step >= 3 ? '' : !sp.version ? `<div class="row"><button class="pill" data-action="spear" data-version="diamant">Diamant-Weg: Dialga</button><button class="pill" data-action="spear" data-version="perl">Perl-Weg: Palkia</button></div>`
      : sp.active ? `<p class="small note-share">Aktiv: Runden ab ${G.C.life.spear.minMinutes} Min zählen.</p>` : `<button class="pill" data-action="spear" data-version="${sp.version}">Zur Speersäule</button>`}</div>`;
}

function renderRaids(body) {
  const s = app.state;
  const boss = G.activeBoss(s);
  const quests = s.dailyQuests || [];
  body.innerHTML = `
    <div class="panel raid">
      <img src="${art(boss.pokedexID)}" alt="">
      <div><h3>${esc(G.lineTitle(boss.rewardSpecies))}</h3>
        ${typeBadges(G.typesOf(boss.pokedexID))}
        ${bar(boss.currentHP / boss.maxHP, '#E3463B')}
        <p class="small muted">${num(boss.currentHP)} / ${num(boss.maxHP)} KP · Belohnung ${boss.rewardCoins} Münzen + ${esc(G.lineTitle(boss.rewardSpecies))} · ${boss.defeatedCount}× besiegt</p>
        <p class="small">Schwach gegen: ${typeBadges(G.weaknesses(G.typesOf(boss.pokedexID)), true)}</p>
        ${(() => { const m = G.currentRaidMatchup(s); const p = G.findPokemon(s, s.selectedPokemonID); return `<p class="small ${m === 'super' ? 'note-share' : m === 'weak' ? 'note-sun' : 'muted'}">${p ? `${esc(G.describe(p).name)}: ` : ''}${G.MATCHUP[m].label}</p>`; })()}
        ${(() => { const c = G.bestCounter(s, G.typesOf(boss.pokedexID)); return c && c.id !== s.selectedPokemonID ? `<button class="pill quiet" data-action="partner" data-id="${c.id}" ${app.session ? 'disabled' : ''}>Bester Konter: ${esc(G.describe(c).name)} Lv. ${G.describe(c).level}</button>` : ''; })()}
        <p class="small muted">1 Min = 1 KP · Mega-Runde ×2 · Drachen-Knursp ×3 · passender Typ des Partners ×2, unpassender ×0,5.</p>
        <button class="pill quiet" data-action="bosses" ${app.session ? 'disabled' : ''}>Boss wechseln</button></div>
    </div>
    <h3>Tagesquests</h3>
    <div class="stack">${quests.map((q) => `<div class="panel row"><div><strong>${esc(q.title)}</strong>${q.kind === 'type' ? ` ${typeBadges([q.typeID], true)}` : ''}${bar(q.currentValue / q.targetValue)}<span class="small muted">${q.currentValue} / ${q.targetValue} · ${G.C.quests.find((d) => d.kind === q.kind)?.rewardCoins ?? q.rewardCoins} Münzen</span>
      ${(() => { if (q.kind !== 'type' || q.currentValue >= q.targetValue) return ''; const pick = G.bestOfType(s, q.typeID); return pick && pick.id !== s.selectedPokemonID ? `<button class="link" data-action="partner" data-id="${pick.id}" ${app.session ? 'disabled' : ''}>${esc(G.describe(pick).name)} wählen</button>` : ''; })()}</div>
      <button class="pill" data-action="claim-quest" data-id="${q.id}" ${q.isClaimed || q.currentValue < q.targetValue ? 'disabled' : ''}>${q.isClaimed ? 'Abgeholt' : 'Abholen'}</button></div>`).join('')}</div>
    <h3>Pokémon-Eier</h3>
    <div class="stack">${(s.eggs || []).map((e) => `<div class="panel row"><img class="egg" src="${e.isHatched ? pixel(e.rewardSpecies.stages[0].pokedexID) : 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/mystery-egg.png'}" alt="">
      <div><strong>${esc(e.title)}</strong>${bar(e.accumulatedMinutes / e.requiredMinutes)}<span class="small muted">${e.isHatched ? `Geschlüpft: ${esc(e.rewardSpecies.displayName)}` : `${e.accumulatedMinutes} / ${e.requiredMinutes} Fokus-Minuten`}</span></div></div>`).join('')}
      <p class="small muted">Es brütet immer das erste ungeschlüpfte Ei.</p></div>
    <p class="small muted">Die Pension Trostu mit Eiern findest du unter Safari › Pension.</p>`;
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
    ${(() => { const r = G.professorRating(s); return `<div class="panel memo prof"><small class="muted">Prof. Eibe bewertet deinen Pokédex</small><h3>${esc(r.title)} · ${G.ownedPokedexCount(s)} / 1025</h3><p>„${esc(r.text)}“</p></div>`; })()}
    <div class="row"><h3>Pokédex <span class="small muted">${G.ownedPokedexCount(s)} / 1025 gefangen</span></h3><label class="switch"><input type="checkbox" data-action="dex-shiny" ${shiny ? 'checked' : ''}> Shiny</label></div>
    <label class="switch"><input type="checkbox" data-action="dex-sinnoh" ${app.meta.dexSinnoh ? 'checked' : ''}> Sinnoh-Dex (Platin, Nr. 1–210)</label>
    ${app.meta.dexSinnoh ? (() => { const owned = new Set(s.pokemonRoster.flatMap((p) => p.species.stages.slice(0, G.describe(p).stage).map((st) => st.pokedexID)));
      const order = G.C.life.sinnohDex; const have = order.filter((id) => owned.has(id)).length;
      return `<p class="small muted">${have} / 210 im Sinnoh-Dex gefangen</p><div class="sinnoh-dex">${order.map((id, i) => `<div class="${owned.has(id) ? 'have' : ''}" title="${String(i + 1).padStart(3, '0')} ${esc(G.pokemonName(id))}"><img src="${pixel(id)}" alt="" loading="lazy"><small>${String(i + 1).padStart(3, '0')}</small></div>`).join('')}</div>`; })() : ''}
    <input type="search" data-action="dex-search" placeholder="Name oder Nummer" value="${esc(app.meta.dexSearch || '')}" aria-label="Pokédex durchsuchen">
    <select data-action="dex-type" aria-label="Pokédex nach Typ filtern"><option value="">Alle Typen</option>${G.C.types.names.map((x) => `<option value="${x.id}" ${Number(app.meta.dexType) === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <p class="small muted">${dex.filter((x) => G.isUnlocked(s, x)).length} von ${dex.length} entdeckten Linien freigeschaltet.</p>
    <div class="dex">${(() => { const q = (app.meta.dexSearch || '').trim().toLowerCase().replace('#', '');
      const owned = new Set(s.pokemonRoster.flatMap((p) => p.species.stages.slice(0, G.describe(p).stage).map((st) => st.pokedexID)));
      return dex.filter((x) => (!Number(app.meta.dexType) || x.stages.some((st) => G.typesOf(st.pokedexID).includes(Number(app.meta.dexType))))
        && (!q || x.stages.some((st) => st.name.toLowerCase().includes(q) || String(st.pokedexID) === q)))
        .map((x) => { const caught = x.stages.filter((st) => owned.has(st.pokedexID)); const place = G.habitatForDex(x.stages[0].pokedexID);
          return `<div class="dex-entry ${G.isUnlocked(s, x) ? '' : 'locked'}">${x.stages.map((st) => `<img src="${pixel(st.pokedexID, shiny)}" alt="${esc(st.name)}" title="${esc(st.name)} #${st.pokedexID}" loading="lazy">`).join('')}<small>${esc(G.lineTitle(x))}</small>${typeBadges(G.typesOf(x.stages[0].pokedexID), true)}
            <small class="${caught.length ? 'note-share' : 'muted'}">${caught.length ? `✓ ${caught.map((st) => esc(st.name)).join(', ')}` : 'Noch nicht gefangen'}</small>${place ? `<small class="muted">📍 ${esc(place.name)}</small>` : ''}</div>`; }).join(''); })()}</div>`;
}

function cardStars(s) {
  const j = G.ensureJourney(s);
  return [G.isChampion(s), G.ownedPokedexCount(s) >= 493, j.tower.best >= 49,
    Object.values(j.contest.ribbons).some((list) => list.some((r) => r.endsWith('-3'))), G.shinyStats(s).owned >= 5].filter(Boolean).length;
}
const CARD_COLORS = ['#3A6EC8', '#3AA86A', '#C89A3A', '#C86A9A', '#9A9AA8', '#2E2A38'];
function trainerCard(s) {
  const stars = cardStars(s);
  const p = G.findPokemon(s, s.selectedPokemonID);
  const mins = G.totalMinutes(s);
  return `<div class="trainer-card" style="--card:${CARD_COLORS[stars]}">
    <div class="row"><strong>TRAINERPASS</strong><span>${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span></div>
    <div class="card-inner"><dl>
      <dt>Name</dt><dd>${esc(s.trainerName)}</dd><dt>Rang</dt><dd>Lv. ${G.trainerLevel(s)} · ${esc(G.rankFor(G.trainerLevel(s)).title)}</dd>
      <dt>Geld</dt><dd>${s.coins} ₽</dd><dt>Pokédex</dt><dd>${G.ownedPokedexCount(s)}</dd><dt>Fokuszeit</dt><dd>${Math.floor(mins / 60)} Std ${mins % 60} Min</dd></dl>
      ${p ? `<img src="${ds(G.describe(p).spriteID, p.isShiny)}" alt="">` : ''}</div>
    <div class="card-badges">${G.gyms().map((g) => `<i style="${G.isDefeated(s, g) ? `background:${g.colorHex}` : ''}"></i>`).join('')}</div></div>`;
}
/** Draws the card on a canvas and offers it as PNG. */
async function exportCard() {
  const s = app.state;
  const stars = cardStars(s);
  const canvas = document.createElement('canvas'); canvas.width = 880; canvas.height = 520;
  const c = canvas.getContext('2d');
  const round = (x, y, w, h, r, fill) => { c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
  round(0, 0, 880, 520, 32, CARD_COLORS[stars]);
  c.fillStyle = '#fff'; c.font = '800 30px "Baloo 2", system-ui'; c.fillText('TRAINERPASS', 36, 60);
  c.fillStyle = '#F5D04A'; c.fillText('★'.repeat(stars) + '☆'.repeat(5 - stars), 650, 60);
  round(28, 88, 824, 300, 20, '#F8F4E8');
  const mins = G.totalMinutes(s);
  const rows = [['Name', s.trainerName], ['Rang', `Lv. ${G.trainerLevel(s)} · ${G.rankFor(G.trainerLevel(s)).title}`], ['Geld', `${s.coins} ₽`], ['Pokédex', String(G.ownedPokedexCount(s))], ['Fokuszeit', `${Math.floor(mins / 60)} Std ${mins % 60} Min`]];
  rows.forEach(([k, v], i) => { c.fillStyle = '#7A6A4A'; c.font = '700 22px system-ui'; c.fillText(k, 56, 140 + i * 52); c.fillStyle = '#2A2418'; c.font = '700 26px system-ui'; c.fillText(v, 210, 140 + i * 52); });
  const p = G.findPokemon(s, s.selectedPokemonID);
  if (p) {
    await new Promise((done) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { c.imageSmoothingEnabled = false; c.drawImage(img, 620, 110, 220, 220); done(); }; img.onerror = done; img.src = `${ds(G.describe(p).spriteID, p.isShiny)}?card=1`; });
  }
  G.gyms().forEach((g, i) => { c.beginPath(); c.arc(70 + i * 62, 450, 24, 0, Math.PI * 2); c.fillStyle = G.isDefeated(s, g) ? g.colorHex : 'rgba(255,255,255,.2)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.stroke(); });
  try {
    const blob = await new Promise((done) => canvas.toBlob(done, 'image/png'));
    const file = new File([blob], 'Trainerpass.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Mein Trainerpass' }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Trainerpass.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Trainerpass gespeichert.');
  } catch { toast('Das Bild konnte nicht erstellt werden.'); }
}

function renderProfile(body) {
  const s = app.state;
  const level = G.trainerLevel(s);
  body.innerHTML = `
    ${trainerCard(s)}
    <p class="small muted">Sterne gibt es für: Champ von Sinnoh, 493 Pokédex-Einträge, Kampfturm-Etage 49, ein Band im Master-Rang und 5 Shinys.</p>
    <div class="row wrap"><button class="pill quiet" data-action="export-card">Trainerpass teilen oder sichern</button>
      <button class="pill quiet" data-action="tutorial">Tutorial</button><button class="pill quiet" data-action="help">Spielhilfe</button></div>
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
    case 'counter': if (!app.session && G.choosePartner(app.state, el.dataset.id)) { app.meta.mode = 'owned'; app.meta.tab = 'train'; save(); saveMeta(); app.render(); window.scrollTo(0, 0); } return true;
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
    case 'export-card': exportCard(); return true;
    case 'rival-start': G.startRival(s, !!app.session); return done('Barry: „Los geht’s!“');
    case 'rival-leave': G.leaveRival(s, !!app.session); return done();
    case 'spear': G.startSpear(s, el.dataset.version, !!app.session); return done('Auf zur Speersäule!');
    case 'tutorial': app.showTutorial?.(); return true;
    case 'help': app.showHelp?.(); return true;
    case 'buy-prize': { const problem = G.buyPrize(s, el.dataset.id, app.meta.prizeStone || G.C.zone.stones[0].id); if (problem) { toast(problem); return true; } return done('Gekauft.'); }
    case 'claim-weekly': return done(G.claimWeekly(s, el.dataset.id) ? 'Wochen-Quest abgeholt!' : null);
    case 'feed': { if (G.feedKnursp(s, el.dataset.id, el.dataset.pokemon)) { save(); toast('Knursp gefüttert.'); } app.render(); return true; }
    case 'contest-enter': {
      const r = G.enterContest(s, el.dataset.pokemon, Number(el.dataset.rank));
      if (r) { app.meta.contestResult = r; saveMeta(); save(); if (r.won) jingle('badge'); }
      app.render(); return true;
    }
    case 'challenge': { const c = G.challengeByID(el.dataset.id); return done(c && G.startChallenge(s, c, !!app.session) ? `${c.leader} nimmt deine Herausforderung an!` : null); }
    case 'leave-gym': G.leaveChallenge(s, !!app.session); return done();
    case 'league-rematch': G.startLeagueRematch(s, !!app.session); return done('Die Liga erwartet dich erneut.');
  }
  return false;
}
export function change(el) {
  const s = app.state;
  switch (el.dataset.action) {
    case 'region': app.meta.researchRegion = el.value; saveMeta(); app.render(); return true;
    case 'league-goal': s.weeklyLeagueGoal = Number(el.value); save(); app.render(); return true;
    case 'dex-shiny': app.meta.dexShiny = el.checked; saveMeta(); app.render(); return true;
    case 'dex-type': app.meta.dexType = el.value; saveMeta(); app.render(); return true;
    case 'dex-sinnoh': app.meta.dexSinnoh = el.checked; saveMeta(); app.render(); return true;
    case 'prize-stone': app.meta.prizeStone = el.value; saveMeta(); return true;
    case 'contest-pick': app.meta.contestID = el.value; app.meta.contestResult = null; saveMeta(); app.render(); return true;
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
export function input(el) {
  if (el.dataset.action !== 'dex-search') return false;
  app.meta.dexSearch = el.value; saveMeta();
  const pos = el.selectionStart; app.render();
  const again = document.querySelector('[data-action="dex-search"]'); again?.focus(); again?.setSelectionRange(pos, pos);
  return true;
}

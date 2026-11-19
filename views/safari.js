// Safari: Sinnoh habitats, Team & PC, statistics and logbook.
import * as G from '../game.js';
import { app, $, esc, art, pixel, ds, typeBadges, duration, num, bar, segmented, sub, pills, pageHead, info, emptyState, save, saveMeta, toast, openSheet, closeSheet, pokemonSheet, queueEvolutions, playEvolutions } from '../ui.js';

export function render(view) {
  let section = sub('safari', 'meadow');
  if (section === 'stats' || section === 'log') { app.meta.sub.chronik = section; section = 'chronik'; app.meta.sub.safari = 'chronik'; }
  const s = app.state;
  const residents = Object.values(s.habitatResidents || {}).reduce((a, ids) => a + ids.length, 0);
  view.innerHTML = `${pageHead('Safari', `${s.pokemonRoster.length} Begleiter · ${residents} wohnen in Lebensräumen`)}
    ${segmented('safari', [['meadow', 'Lebensräume'], ['pension', `Pension${s.journey?.pension?.egg ? ' 🥚' : ''}`], ['dig', `Untergrund${(s.undergroundCharges ?? 1) > 0 ? ` (${s.undergroundCharges ?? 1})` : ''}`], ['team', 'Team & PC'], ['chronik', 'Chronik']])}
    <div id="safari-body"></div>`;
  const body = $('#safari-body', view);
  const chronik = (b) => { b.innerHTML = `${pills('chronik', [['stats', 'Kalender'], ['log', 'Logbuch']])}<div id="chronik-body"></div>`; (sub('chronik', 'stats') === 'log' ? renderLog : renderStats)($('#chronik-body', b)); };
  ({ meadow: renderHabitats, pension: renderPension, team: renderTeam, dig: renderDig, chronik })[section](body);
}

// MARK: Lebensräume (Sinnoh habitats with DS battle backdrops)
const SCENE_W = 256; const SCENE_H = 192;
function currentHabitat() { return G.habitatByID(app.meta.habitatID) ?? G.C.habitats.places[0]; }
function biome() { return G.C.biomes.find((b) => b.id === app.state.selectedBiome) ?? G.C.biomes[0]; }
const sceneBox = (index) => {
  const [x, y, , ry] = G.C.habitats.platforms[index];
  const size = index < 3 ? 64 : 80;
  const top = y + ry / 2 - size + size / 12;
  return `left:${((x - size / 2) / SCENE_W) * 100}%;top:${(top / SCENE_H) * 100}%;width:${(size / SCENE_W) * 100}%`;
};
function renderHabitats(body) {
  const s = app.state;
  const H = G.C.habitats;
  const h = currentHabitat();
  const open = G.habitatUnlocked(s, h);
  const residents = G.residentsOf(s, h);
  const full = residents.length >= H.capacity;
  const total = Object.values(s.habitatResidents || {}).reduce((a, ids) => a + ids.length, 0);
  const fullCount = H.places.filter((x) => G.habitatFull(s, x)).length;
  const partner = G.findPokemon(s, s.selectedPokemonID);
  const boosted = G.partnerHabitatBonus(s, { mode: 'owned' });
  const outbreak = G.massOutbreak();
  const dex = G.habitatDex(s, h);
  const fitting = G.habitatCandidates(s, h).filter((x) => !G.habitatOf(s, x.id)).length;
  const invasion = G.galacticInvasion(s);
  const pickups = G.pickupReady(s);
  body.innerHTML = `
    <div class="row"><h3>Lebensräume in Sinnoh${info(`Lass PC-Pokémon an Orten wohnen, die zu ihrem Typ passen. Sie trainieren bei jeder Runde mit. Ein voller Lebensraum gibt seinen Bewohnern als Partner +${H.fullHabitatBonusPercent} % EP. Jeder bewohnte Lebensraum bringt einmal am Tag ein Fundstück.`)}</h3><span class="small muted">${total} Bewohner · ${fullCount}/${H.places.length} voll</span></div>
    ${pickups ? `<button class="pill wide" data-action="pickup">🎁 Fundstücke abholen (${pickups})</button>` : ''}
    ${(() => { const layout = G.habitatLayout(s, h.id, !!app.meta.allHabitats);
      return `<div class="habitat-chips grid" role="tablist" aria-label="Lebensräume">${layout.shown.map((x) => { const ok = G.habitatUnlocked(s, x); const n = G.residentIDs(s, x).length;
      return `<button role="tab" class="habitat-chip ${x.id === h.id ? 'on' : ''} ${ok ? '' : 'locked'}" aria-selected="${x.id === h.id}" data-action="habitat-pick" data-id="${x.id}">
        <img src="img/habitats/${x.id}.png" alt=""><span><strong>${esc(x.name)}</strong><small>${ok ? `${n}/${H.capacity}${n >= H.capacity ? ' ★' : ''}` : `ab ${num(x.requiredMinutes)} Min 🔒`}</small>
        ${(() => { const r = G.habitatResidentsPreview(G.residentsOf(s, x).map((p) => G.describe(p).spriteID));
          return ok && r.shown.length ? `<em class="chip-residents">${r.shown.map((id) => `<img src="${ds(id)}" alt="">`).join('')}${r.more ? `<small>+${r.more}</small>` : ''}</em>`
            : `<i>${x.types.map((t) => `<b style="background:${G.typeInfo(t).colorHex}"></b>`).join('')}</i>`; })()}</span></button>`; }).join('')}
        ${layout.hidden || app.meta.allHabitats ? `<button class="habitat-chip more" data-action="habitats-all">${app.meta.allHabitats ? 'Weniger zeigen' : `🔒 ${layout.hidden} weitere freischaltbar`}</button>` : ''}</div>`; })()}
    <div class="habitat-scene ${open ? '' : 'locked'} time-${G.dayTime().id}">
      <img class="backdrop" src="img/habitats/${h.id}.png" alt="">
      <div class="place-sign"><strong>${esc(h.name)}</strong><small>${esc(h.place)}</small></div>
      ${open && invasion?.id === h.id ? `<div class="galactic-sign" title="${esc(`Die Bewohner verstecken sich und trainieren nicht. Jage hier oder trainiere einen passenden Partner. Belohnung: ${G.C.life.galactic.rewardCoins} Münzen und ein Sonderbonbon.`)}">TEAM GALAKTIK<small>${G.galacticSignText(G.galacticProgress(s), G.C.life.galactic.goalMinutes)} zum Vertreiben</small><span class="sign-bar"><i style="width:${Math.min(100, Math.round(G.galacticProgress(s) / G.C.life.galactic.goalMinutes * 100))}%"></i></span></div>` : ''}
      ${open && G.roamerIn(s, h) ? `<div class="roamer-sign"><img src="${ds(G.roamerIn(s, h))}" alt="">Gesichtet: ${esc(G.pokemonName(G.roamerIn(s, h)))}</div>` : ''}
      ${open && outbreak.habitatID === h.id ? `<div class="outbreak-sign"><img src="${ds(outbreak.dexID)}" alt="">Massenauftreten: ${esc(outbreak.name)}</div>` : ''}
      ${H.platforms.map((_, i) => { const p = residents[i];
        if (p) { const d = G.describe(p); return `<button class="habitat-mon bob${i % 2}" style="${sceneBox(i)}" data-action="inspect" data-id="${p.id}" aria-label="${esc(d.name)}, Level ${d.level}"><img src="${ds(d.spriteID, p.isShiny)}" alt="">${p.isShiny ? '<span class="sparkle" aria-hidden="true">✦</span>' : ''}</button>`; }
        if (!open) return '';
        const [x, y] = H.platforms[i];
        return `<button class="habitat-free" style="left:${(x / SCENE_W) * 100}%;top:${((y - 2) / SCENE_H) * 100}%" data-action="habitat-add" aria-label="Freier Platz: Pokémon einziehen lassen">+</button>`; }).join('')}
      ${open ? '' : `<div class="habitat-lock"><strong>🔒 Ab ${num(h.requiredMinutes)} Fokus-Minuten</strong><small>Du hast ${num(G.totalMinutes(s))} Minuten.</small></div>`}
    </div>
    <div class="panel stack">
      <div class="row">${typeBadges(h.types)}${info(`${h.flavor} Bewohner bekommen ${H.residentSharePercent} % deiner Fokus-Minuten als EP. Ist der Lebensraum voll, bekommen Partner vom Typ ${h.types.map((t) => G.typeInfo(t).name).join(' oder ')} +${H.fullHabitatBonusPercent} % EP.${(s.claimedHabitatIDs || []).includes(h.id) ? '' : ` Beim ersten Mal voll: +${H.firstFillReward} PokéMünzen.`} Pokédex dieser Typen: ${dex.owned} / ${dex.total}.`)}</div>
      <div class="row small"><strong>Bewohner</strong><span>${residents.length} / ${H.capacity}</span></div>
      <div class="resident-slots">${Array.from({ length: H.capacity }, (_, i) => residents[i]).map((p) => { if (!p) return `<button class="resident-slot empty" data-action="habitat-add" ${open ? '' : 'disabled'} aria-label="Freier Platz: Pokémon einziehen lassen">+</button>`;
        const d = G.describe(p); return `<button class="resident-slot" data-action="inspect" data-id="${p.id}" title="${esc(d.name)} · Lv. ${d.level}" aria-label="${esc(d.name)}, Level ${d.level}"><img src="${ds(d.spriteID, p.isShiny)}" alt=""><small>Lv. ${d.level}</small></button>`; }).join('')}</div>
      <p class="small ${full ? 'note-sun' : 'muted'}">${full ? '★ Voll' : '☆ Voll gibt'} +${H.fullHabitatBonusPercent} % EP${partner && boosted?.id === h.id ? ` · ${esc(G.describe(partner).name)} profitiert` : ''}</p>
      ${open && !full && fitting ? `<button class="pill quiet" data-action="habitat-auto">✨ Passende einziehen lassen (${Math.min(fitting, H.capacity - residents.length)})</button>` : ''}
    </div>
`;
}
function habitatPicker() {
  const s = app.state;
  const h = currentHabitat();
  const list = G.habitatCandidates(s, h);
  openSheet(`<h2>Wer zieht ${esc(h.locative)} ein?</h2>
    <p class="small muted">Passende Typen: ${typeBadges(h.types, true)}</p>
    ${list.length ? `<div class="stack">${list.map((p) => { const d = G.describe(p); const home = G.habitatOf(s, p.id);
      return `<div class="panel resident-row"><img src="${ds(d.spriteID, p.isShiny)}" alt="">
        <div><strong>${esc(d.name)}</strong> <span class="small muted">Lv. ${d.level}</span>${typeBadges(G.pokemonTypes(p), true)}${home ? `<small class="muted">wohnt ${esc(home.locative)}</small>` : ''}</div>
        <button class="pill" data-action="habitat-place" data-id="${p.id}">${home ? 'Umziehen' : 'Einziehen'}</button></div>`; }).join('')}</div>`
      : `<p class="muted">Kein passendes Pokémon im PC. Team-Mitglieder und Pokémon auf Expedition können nicht einziehen. Fange wilde Pokémon vom Typ ${h.types.map((t) => G.typeInfo(t).name).join(', ')}.</p>`}
    <button class="pill quiet" data-action="close">Fertig</button>`);
}
function biomeSheet() {
  const s = app.state;
  openSheet(`<h2>Gebiet wechseln</h2>
    <p class="small muted">Bestimmt, wo deine wilden Begegnungen stattfinden.</p>
    <div class="biome-list">${G.C.biomes.map((b) => { const open = G.biomeUnlocked(s, b);
      return `<button class="biome ${b.id === s.selectedBiome ? 'on' : ''}" data-action="select-biome" data-id="${esc(b.id)}" ${open ? '' : 'disabled'} style="--accent:${b.accentHex}">
        <img src="${pixel(b.mascotID)}" alt=""><span><strong>${esc(b.title)}</strong><small>${esc(b.region)} · ${open ? 'freigeschaltet' : esc(b.unlock)}</small></span></button>`; }).join('')}</div>
    <label class="switch"><input type="checkbox" data-action="preview" ${s.safariPreviewEnabled ? 'checked' : ''}> Alle Gebiete als Vorschau zeigen</label>
    <button class="pill quiet" data-action="close">Schließen</button>`);
}

// MARK: Pension Trostu
function renderPension(body) {
  const s = app.state;
  const P = G.C.journey.pension;
  const j = G.ensureJourney(s);
  const parents = G.pensionParents(s);
  const egg = j.pension.egg;
  body.innerHTML = `
    <div class="row"><h3>Pension Trostu${info(`Gib zwei Pokémon ab. Nach ${P.eggMinutes} Fokus-Minuten findet das Paar ein Ei, nach weiteren ${P.hatchMinutes} Minuten schlüpft ein Pokémon in der Grundform.`)}</h3>${j.pension.hatchedCount ? `<span class="small muted">${j.pension.hatchedCount} geschlüpft</span>` : ''}</div>
    <div class="pension">
      ${Array.from({ length: P.capacity }, (_, i) => parents[i]).map((p) => { if (!p) return '<button class="pension-slot empty" data-action="pension-pick"><span>＋</span>Pokémon abgeben</button>';
        const d = G.describe(p); return `<div class="pension-slot"><img src="${ds(d.spriteID, p.isShiny)}" alt=""><strong>${esc(d.name)}</strong><small>Lv. ${d.level}</small>
          <button class="link" data-action="pension-leave" data-id="${p.id}">Abholen</button></div>`; }).join('')}
    </div>
    <div class="panel egg-panel">
      ${egg ? `<div class="egg ${G.eggWobbles(egg.minutesLeft) ? '' : 'calm'}" style="--wobble:${(4 + 8 * G.eggProgress(egg)).toFixed(1)}deg;--speed:${Math.max(0.25, 1.2 - G.eggProgress(egg)).toFixed(2)}s" aria-hidden="true"></div>
        <div><h3>Ein Ei</h3><p class="small">${esc(G.eggStatus(egg))}</p>${bar(G.eggProgress(egg), 'var(--sun)')}<p class="small muted">Noch ${Math.max(0, egg.minutesLeft)} Fokus-Minuten</p></div>`
      : parents.length >= P.capacity ? `<div><h3>Die beiden verstehen sich gut.</h3>${bar(j.pension.minuteBank / P.eggMinutes, '#EB85C7')}<p class="small muted">Ei in ${P.eggMinutes - j.pension.minuteBank} Fokus-Minuten</p></div>`
      : `<div><h3>Noch kein Paar</h3><p class="small muted">Gib zwei Pokémon ab. Das Ei stammt von einem der beiden.</p></div>`}
      ${app.meta.lastHatch ? `<div class="hatch-pop"><span class="shell l"></span><span class="shell r"></span><img src="${ds(app.meta.lastHatch.spriteID, app.meta.lastHatch.shiny)}" alt=""><small class="note-share">${esc(app.meta.lastHatch.name)}${app.meta.lastHatch.shiny ? ' ✨' : ''} ist geschlüpft!</small></div>` : ''}
    </div>
    ${parents.length ? '' : (() => { const pool = G.pensionCandidates(s, !!app.session).filter((p) => !s.teamPokemonIDs.includes(p.id));
      const pairs = G.pensionPairs(pool.map((p) => ({ id: p.id, lineKey: G.lineKey(p.species), isShiny: !!p.isShiny, level: G.describe(p).level })));
      return pairs.length ? `<h3>Passende Paare aus dem PC</h3><div class="stack">${pairs.map(([a, b]) => { const pa = G.findPokemon(s, a.id); const pb = G.findPokemon(s, b.id); const da = G.describe(pa); const db = G.describe(pb);
        return `<div class="panel row pair"><img src="${ds(da.spriteID, pa.isShiny)}" alt=""><img src="${ds(db.spriteID, pb.isShiny)}" alt=""><div><strong>${esc(da.name)} &amp; ${esc(db.name)}</strong><small class="muted">${a.lineKey === b.lineKey ? 'Gleiche Linie' : 'Mit Shiny: doppelte Shiny-Chance'}</small></div>
          <button class="pill quiet" data-action="pension-pair" data-ids="${a.id},${b.id}" ${app.session ? 'disabled' : ''}>Beide abgeben</button></div>`; }).join('')}</div>` : ''; })()}`;
}
function pensionPicker() {
  const s = app.state;
  const list = G.pensionCandidates(s, !!app.session);
  openSheet(`<h2>Wen gibst du in die Pension?</h2>
    <p class="small muted">Pension-Pokémon trainieren nicht, bis du sie abholst. Legendäre legen keine Eier.</p>
    ${list.length ? `<div class="stack">${list.map((p) => { const d = G.describe(p);
      return `<div class="panel resident-row"><img src="${ds(d.spriteID, p.isShiny)}" alt="">
        <div><strong>${esc(d.name)}</strong> <span class="small muted">Lv. ${d.level}${s.teamPokemonIDs.includes(p.id) ? ' · im Team' : ''}</span>${typeBadges(G.pokemonTypes(p), true)}</div>
        <button class="pill" data-action="pension-add" data-from="picker" data-id="${p.id}">Abgeben</button></div>`; }).join('')}</div>` : '<p class="muted">Gerade kann kein Pokémon in die Pension.</p>'}
    <button class="pill quiet" data-action="close">Fertig</button>`);
}

// MARK: Untergrund (digging like in Diamant/Perl)
function renderDig(body) {
  const s = app.state;
  const U = G.C.underground;
  const wall = app.meta.digWall;
  const charges = s.undergroundCharges ?? 1;
  const tool = app.meta.digTool || 'pickaxe';
  let content;
  if (wall) {
    const found = G.revealedItems(wall);
    const cells = [];
    for (let y = 0; y < U.rows; y++) for (let x = 0; x < U.columns; x++) {
      const layers = G.wallLayers(wall, x, y);
      const item = layers === 0 ? G.wallItemAt(wall, x, y) : null;
      cells.push(`<button class="dig-cell l${Math.min(layers, 4)}" style="${item ? `background:${G.treasureOf(item).colorHex}` : ''}" data-action="dig" data-x="${x}" data-y="${y}" aria-label="${layers ? `Fels, ${layers} Schichten` : item ? `Freigelegt: ${esc(G.treasureOf(item).name)}` : 'Freigelegt'}"></button>`);
    }
    const art = found.map((p) => { const t = G.treasureOf(p);
      return `<div class="dig-find" style="left:${(p.x / U.columns) * 100}%;top:${(p.y / U.rows) * 100}%;width:${(t.width / U.columns) * 100}%;height:${(t.height / U.rows) * 100}%">
        ${t.spriteID ? `<img src="${ds(t.spriteID)}" alt="">` : t.stone ? `<span class="stone" style="--c:${t.colorHex}">◆</span>` : t.id === 'herzschuppe' ? '<span class="heart">♥</span>' : `<span class="sphere" style="--c:${t.colorHex}"></span>`}<small>${esc(t.name)}</small></div>`; }).join('');
    content = `
      <div class="row"><div class="segmented small">${U.tools.map((t) => `<button data-action="dig-tool" data-id="${t.id}" aria-selected="${t.id === tool}">${t.id === 'pickaxe' ? '⛏' : '🔨'} ${esc(t.name)}</button>`).join('')}</div>
        <div class="dig-stability"><small>Wand-Stabilität</small>${bar(wall.stability / U.maxStability, wall.stability < 15 ? 'var(--ball-red)' : 'var(--sun)')}</div></div>
      <p class="small note-sun">✨ ${wall.items.length} Funde funkeln in dieser Wand</p>
      <div class="dig-wall ${app.meta.digShake ? 'shake' : ''} cracks-${Math.min(4, Math.floor((1 - wall.stability / U.maxStability) * 5))}" style="--cols:${U.columns};--rows:${U.rows}">${cells.join('')}${art}</div>
      <p class="small muted">Tippe auf die Wand. Spitzhacke kostet 1 Stabilität, der Hammer 2 und trifft mehr Fels. ${found.length} von ${wall.items.length} Funden liegen frei.</p>
      <button class="pill wide" data-action="dig-finish">Fertig, Funde mitnehmen</button>`;
  } else {
    const r = app.meta.digResult;
    content = `${r ? `<div class="panel"><h3>${r.collapsed ? 'Die Wand ist eingestürzt!' : 'Grabung beendet'}</h3><p>${esc(G.digSummary(r))}</p>${r.fossils.length ? '<p class="small muted">Deine Fossil-Pokémon warten im PC.</p>' : ''}</div>` : ''}
      <div class="panel stack"><div class="dig-idle ${charges > 0 ? 'ready' : ''}" aria-hidden="true"><i></i><i></i><i></i><b>⛏</b></div>
        ${charges > 0 ? '<strong>Die Wand wartet.</strong><button class="pill wide" data-action="dig-start">Grabung starten</button>'
        : `<strong>⏳ Nächste Grabung in ${G.minutesToNextDig(s)} Fokus-Minuten</strong>${bar(G.digProgress(G.minutesToNextDig(s)), '#9A7448')}`}</div>
      ${bagPanel(s)}`;
  }
  body.innerHTML = `
    <div class="row"><h3>Untergrund${info(`Pro ${U.minutesPerDig} Fokus-Minuten bekommst du eine Grabung. Leg Schätze frei, bevor die Wand einstürzt. Kleine Kugel +10 Münzen · Große Kugel +30 · Herzschuppe: eine Beere · Entwicklungssteine landen im Beutel · Fossilien erwachen als Koknodon, Schilterus, Amonitas, Kabuto, Anorith, Liliep oder Aerodactyl.`)}</h3></div>
    ${`
    <div class="row"><strong>⛏ ${charges} / ${U.maxCharges} Grabungen bereit</strong>${charges < U.maxCharges ? `<span class="small muted">nächste in ${G.minutesToNextDig(s)} Min</span>` : ''}</div>
    ${charges < U.maxCharges && !wall ? `<button class="pill quiet" data-action="buy-dig" ${G.canBuyDig(s) ? '' : 'disabled'}>+1 Grabung für ${G.C.zone.extra.extraDigPrice} Münzen (1× am Tag)</button>` : ''}
    ${content}`}`;
}

function bagPanel(s) {
  const items = [['sonderbonbon', 'Sonderbonbon', '#7A9AE8'], ...G.C.zone.stones.map((st) => [st.id, st.name, st.colorHex])].filter(([id]) => G.itemCount(s, id) > 0);
  return `<div class="panel"><h3>Beutel</h3>${items.length ? `<div class="bag-grid">${items.map(([id, name, c]) => `<div class="bag-tile" style="--c:${c}" title="${esc(name)} × ${G.itemCount(s, id)}"><img src="${G.itemSpriteURL(id)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'◆'}))"><small>${esc(name)}</small><b>×${G.itemCount(s, id)}</b></div>`).join('')}</div><p class="small muted">Benutzen im Steckbrief eines Pokémon.</p>`
    : emptyState(G.EMPTY_MASCOT.bag, 'Noch leer. Steine findest du hier, Sonderbonbons im Kampfpunkte-Laden.')}</div>`;
}

// MARK: Team & PC
function renderTeam(body) {
  const s = app.state;
  const dayID = G.pokemonOfTheDay(s.pokemonRoster);
  app.meta.boxIndex = Math.min(app.meta.boxIndex || 0, s.pcBoxes.length - 1);
  const box = s.pcBoxes[app.meta.boxIndex];
 const query = (app.meta.pcSearch || '').trim().toLowerCase();
  const typeFilter = Number(app.meta.pcType) || 0;
  const fitOnly = !!app.meta.pcFit;
  const filtering = !!query || !!typeFilter || fitOnly;
  const matches = (p) => {
    const types = G.pokemonTypes(p);
    if (typeFilter && !types.includes(typeFilter)) return false;
    if (fitOnly && !G.suggestedHabitat(s, p.id)) return false;
    return !query || `${G.describe(p).name} ${p.species.displayName} ${p.species.stages.map((x) => x.name).join(' ')} ${types.map((n) => G.typeInfo(n).name).join(' ')} #${G.describe(p).spriteID}`.toLowerCase().includes(query);
  };
  const hits = filtering ? s.pcBoxes.map((b, i) => [i, b.pokemonIDs.filter((id) => matches(G.findPokemon(s, id))).length]).filter(([, n]) => n) : [];
  const badges = (p) => `${p.id === dayID ? '<span class="badge sun">☀︎</span>' : ''}${G.onExpedition(s, p.id) ? '<span class="badge trip">⛺</span>' : ''}${G.inPension(s, p.id) ? '<span class="badge pension">♥</span>' : ''}${G.isNew(p) ? '<span class="badge new">Neu</span>' : ''}`;
  body.innerHTML = `
    <div class="row"><h3>Dein Team</h3><span class="muted">${s.teamPokemonIDs.length} / ${G.TEAM_SIZE}</span></div>
    <div class="team-grid">
      ${Array.from({ length: G.TEAM_SIZE }, (_, i) => s.teamPokemonIDs[i]).map((id) => {
        if (!id) return '<div class="slot empty">Frei</div>';
        const p = G.findPokemon(s, id); const d = G.describe(p);
        return `<button class="slot ${id === s.selectedPokemonID ? 'partner' : ''}" data-action="inspect" data-id="${id}">
          ${id === s.selectedPokemonID ? '<span class="badge partner">Partner</span>' : ''}${badges(p)}
          <img src="${art(d.spriteID, p.isShiny)}" alt="" loading="lazy"><strong>${esc(d.name)}</strong><span class="small muted">Lv. ${d.level}</span>${bar(d.progress)}
          ${s.expShareEnabled && id !== s.selectedPokemonID && !d.maxLevel ? `<span class="small note-share">+${G.sharedExperience(app.meta.minutes)} EP</span>` : ''}</button>`;
      }).join('')}
    </div>
    <div class="panel row">
      <label class="switch"><input type="checkbox" data-action="share" ${s.expShareEnabled ? 'checked' : ''}> EP-Teiler</label>
      <span class="small muted">${s.expShareEnabled ? `Jedes andere Team-Mitglied bekommt ${G.SHARE_PERCENT} % der EP des Partners.` : 'Aus: nur der Partner bekommt EP.'}</span>
    </div>
    <div class="box-head">
      <button class="icon-btn" data-action="box" data-delta="-1" ${app.meta.boxIndex === 0 ? 'disabled' : ''} aria-label="Vorherige Box">‹</button>
      <h3><button class="link" data-action="rename-box">${esc(box.name)}</button> <span class="muted small">${box.pokemonIDs.length}/${G.BOX_CAPACITY}</span></h3>
      <button class="icon-btn" data-action="box" data-delta="1" ${app.meta.boxIndex >= s.pcBoxes.length - 1 ? 'disabled' : ''} aria-label="Nächste Box">›</button>
    </div>
    <div class="row">
      <input type="search" data-action="pc-search" placeholder="PC durchsuchen" value="${esc(app.meta.pcSearch || '')}" aria-label="PC durchsuchen">
      <select data-action="sort-box" aria-label="Box sortieren"><option value="">Sortieren …</option><option value="level">Level</option><option value="name">Name</option><option value="pokedex">Pokédex-Nr.</option><option value="newest">Neueste</option></select>
      <button class="pill quiet" data-action="add-box">+ Box</button>
    </div>
    <div class="row wrap">
      <select data-action="wallpaper" aria-label="Box-Hintergrund">${G.C.life.wallpapers.map((w) => `<option value="${w.id}" ${G.wallpaperOf(s, app.meta.boxIndex).id === w.id ? 'selected' : ''}>Hintergrund: ${esc(w.name)}</option>`).join('')}</select>
      <button class="pill quiet ${app.meta.pcSelect ? 'on' : ''}" data-action="pc-select">${app.meta.pcSelect ? 'Auswahl beenden' : 'Auswählen'}</button>
    </div>
    ${app.meta.pcSelect ? `<div class="row wrap small"><strong>${(app.meta.pcPicked || []).length} ausgewählt</strong>
      <select data-action="pc-move" aria-label="In Box verschieben"><option value="">In Box …</option>${s.pcBoxes.map((b, i) => `<option value="${i}">${esc(b.name)} (${b.pokemonIDs.length}/${G.BOX_CAPACITY})</option>`).join('')}</select>
      <button class="pill quiet" data-action="pc-settle">In Lebensräume</button><button class="pill quiet" data-action="pc-pick-all">Alle</button></div>` : ''}
    <div class="row wrap">
      <select data-action="pc-type" aria-label="Nach Typ filtern"><option value="">Alle Typen</option>${G.C.types.names.map((x) => `<option value="${x.id}" ${typeFilter === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <label class="switch"><input type="checkbox" data-action="pc-fit" ${fitOnly ? 'checked' : ''}> Passt in Lebensraum</label>
      ${app.meta.pcSearch || typeFilter || fitOnly ? '<button class="link" data-action="pc-reset">Filter zurücksetzen</button>' : ''}
    </div>
    ${filtering ? `<div class="row wrap small">${hits.length ? 'Treffer:' : 'Keine Treffer im PC'} ${hits.map(([i, n]) => `<button class="chip ${i === app.meta.boxIndex ? 'on' : ''}" data-action="goto-box" data-index="${i}">${esc(s.pcBoxes[i].name)} (${n})</button>`).join('')}</div>` : ''}
    <div class="pc-grid" style="background:linear-gradient(${G.wallpaperOf(s, app.meta.boxIndex).colors[0]}99, ${G.wallpaperOf(s, app.meta.boxIndex).colors[1]}88)">
      ${Array.from({ length: G.pcVisibleRows(box.pokemonIDs.map((_, i) => i), 6, G.BOX_CAPACITY / 6) * 6 }, (_, i) => box.pokemonIDs[i]).map((id) => {
        if (!id) return '<div class="cell"></div>';
        const p = G.findPokemon(s, id); const d = G.describe(p);
        const picked = (app.meta.pcPicked || []).includes(id);
        return `<button class="cell ${G.onExpedition(s, id) ? 'away' : ''} ${matches(p) ? '' : 'dim'} ${picked ? 'picked' : ''}" data-action="${app.meta.pcSelect ? 'pc-pick' : 'inspect'}" data-id="${id}" aria-label="${esc(d.name)}, Level ${d.level}${app.meta.pcSelect ? (picked ? ', ausgewählt' : ', nicht ausgewählt') : ''}">
          <img src="${pixel(d.spriteID, p.isShiny)}" alt="" loading="lazy">${badges(p)}<span class="lv">${d.level}</span></button>`;
      }).join('')}
    </div>
    <h3 style="margin-top:20px">Expeditionen <span class="muted small">${(s.expeditions || []).length} / ${G.MAX_EXPEDITIONS}</span>${info('PC-Pokémon erkunden die Gegend, während du dich konzentrierst. Jede geschaffte Fokus-Minute bringt sie weiter.')}</h3>
    ${(() => { if ((s.expeditions || []).length >= G.MAX_EXPEDITIONS) return '';
      const pool = s.pokemonRoster.filter((p) => !s.teamPokemonIDs.includes(p.id) && !G.onExpedition(s, p.id) && !G.inPension(s, p.id) && !G.habitatOf(s, p.id)).map((p) => ({ id: p.id, level: G.describe(p).level }));
      const picks = G.expeditionPicks(pool).map((id) => G.findPokemon(s, id));
      return picks.length ? `<div class="row wrap trip-picks">${picks.map((p) => { const d = G.describe(p); return `<span class="trip-pick"><img src="${pixel(d.spriteID, p.isShiny)}" alt="">${esc(d.name)} · Lv. ${d.level}
        <select data-action="trip-send" data-id="${p.id}" aria-label="${esc(d.name)} losschicken"><option value="">Losschicken …</option>${Object.entries(G.EXPEDITIONS).map(([k, e]) => `<option value="${k}">${e.icon} ${esc(e.title)} · ${e.goal} Min</option>`).join('')}</select></span>`; }).join('')}</div>` : ''; })()}
    <div class="trips">${(s.expeditions || []).length ? s.expeditions.map((t) => {
      const k = G.EXPEDITIONS[t.kind]; const p = G.findPokemon(s, t.pokemonID); const d = G.describe(p); const done = t.progressMinutes >= k.goal;
      return `<div class="panel trip"><img src="${pixel(d.spriteID, p.isShiny)}" alt=""><div><strong>${k.icon} ${k.title}</strong> <span class="muted small">${esc(d.name)}</span>${bar(t.progressMinutes / k.goal)}
        <span class="small muted">${done ? 'Zurück mit Fundstücken!' : `${t.progressMinutes} / ${k.goal} Fokus-Minuten`} · ${k.coins} Münzen, ${k.berries.map(G.berryName).join(' + ')}</span></div>
        ${done ? `<button class="pill" data-action="claim-trip" data-id="${t.id}">Abholen</button>` : `<button class="pill quiet" data-action="recall" data-id="${t.id}">Zurückrufen</button>`}</div>`;
    }).join('') : ''}</div>`;
}

// MARK: Statistics
const PERIODS = [['today', 'Heute'], ['week', 'Woche'], ['month', 'Monat'], ['all', 'Gesamt']];
function inPeriod(entry, period) {
  const d = G.fromSwiftDate(entry.timestamp); const now = new Date();
  if (period === 'today') return d.toDateString() === now.toDateString();
  if (period === 'week') return now - d <= 7 * 86400000;
  if (period === 'month') return now - d <= 31 * 86400000;
  return true;
}
function renderStats(body) {
  const s = app.state;
  const period = sub('period', 'today');
  const entries = (s.plantedTrees || []).filter((t) => inPeriod(t, period));
  const wins = entries.filter((t) => t.survived);
  const minutes = wins.reduce((a, t) => a + t.durationMinutes, 0);
  const rate = entries.length ? Math.round((wins.length / entries.length) * 100) : null;
  const heat = G.heatmap(s);
  const max = Math.max(1, ...heat.map((d) => d.minutes));
  const tags = {};
  for (const t of wins) tags[t.tagName] = (tags[t.tagName] || { minutes: 0, color: t.tagColorHex }), tags[t.tagName].minutes += t.durationMinutes;
  const best = G.bestHour(s);
  const week = heat.slice(-7);
  const weekMax = Math.max(1, ...week.map((d) => d.minutes));
  body.innerHTML = `
    ${segmented('period', PERIODS)}
    <div class="cards three">
      <div class="card"><strong>${G.formatNumber(minutes)} Min</strong><span>${G.CHRONICLE_TITLES[0]}</span></div>
      <div class="card"><strong>${G.formatNumber(wins.filter((t) => t.wasWildEncounter).length)}</strong><span>${G.CHRONICLE_TITLES[1]}</span></div>
      <div class="card"><strong>${rate == null ? '–' : `${G.successPercent(wins.length, entries.length)} %`}</strong><span>${G.CHRONICLE_TITLES[2]} · ${wins.length} von ${entries.length}</span></div>
    </div>
    <div class="panel"><h3>Diese Woche</h3>
      ${G.weekChartEmpty(week.map((d) => d.minutes)) ? emptyState(G.EMPTY_MASCOT.chronicle, 'Diese Woche noch keine Runde. Die erste füllt das Diagramm.') : `<div class="week">${week.map((d) => `<div><span style="height:${Math.round((d.minutes / weekMax) * 100)}%" title="${d.minutes} Min"></span><small>${d.date.toLocaleDateString('de-DE', { weekday: 'short' })}</small></div>`).join('')}</div>
      <p class="small muted">${week.reduce((a, d) => a + d.minutes, 0)} Minuten an ${week.filter((d) => d.minutes).length} Tagen · Serie: ${G.streakDays(s)} Tage</p>`}</div>
    <button class="link" data-action="heat-toggle">${app.meta.showHeat ? '28 Tage ausblenden' : '28 Tage anzeigen'}</button>
    ${app.meta.showHeat ? `<div class="panel"><h3>Letzte 28 Tage</h3>
      <div class="heat">${heat.map((d) => `<span title="${d.date.toLocaleDateString('de-DE')}: ${d.minutes} Min" style="opacity:${d.minutes ? 0.25 + 0.75 * (d.minutes / max) : 0.08}"></span>`).join('')}</div>
      ${best != null ? `<p class="small muted">Beste Fokus-Zeit: ${String(best).padStart(2, '0')}:00 Uhr</p>` : ''}</div>` : ''}
    <div class="panel"><h3>Nach Fokus-Tag</h3>
      ${Object.entries(tags).sort((a, b) => b[1].minutes - a[1].minutes).map(([name, v]) => `<div class="row small"><span><span class="dot" style="background:${v.color}"></span>${esc(name)}</span><span>${num(v.minutes)} Min</span></div>${bar(v.minutes / Math.max(1, minutes), v.color)}`).join('') || '<p class="muted small">Noch keine Runden in diesem Zeitraum.</p>'}</div>`;
}

// MARK: Logbook
function renderLog(body) {
  const s = app.state;
  const query = (app.meta.logSearch || '').toLowerCase();
  const shiny = !!app.meta.logShiny;
  const limit = app.meta.logLimit || 20;
  const list = (s.plantedTrees || []).filter((t) => (!shiny || t.isShiny) && (!query || `${G.entryName(t)} ${t.tagName} ${t.note}`.toLowerCase().includes(query)));
  body.innerHTML = `
    <div class="row"><input type="search" data-action="log-search" placeholder="Pokémon, Tag oder Notiz" value="${esc(app.meta.logSearch || '')}" aria-label="Logbuch durchsuchen">
      <label class="switch"><input type="checkbox" data-action="log-shiny" ${shiny ? 'checked' : ''}> Nur Shinys</label></div>
    <div class="log">${list.slice(0, limit).map((t) => `
      <div class="entry ${t.survived ? '' : 'failed'}"><img src="${pixel(G.entrySprite(t), t.isShiny)}" alt="" loading="lazy">
        <div><strong>${esc(G.entryName(t))}</strong><p class="small muted">${G.fromSwiftDate(t.timestamp).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · ${t.durationMinutes} Min · <span class="dot" style="background:${t.tagColorHex}"></span>${esc(t.tagName)}${t.wasWildEncounter ? ' · Wild' : ''}</p>
        <p class="small">${esc(t.note)}</p></div>
        <span class="small ${t.survived ? '' : 'bad'}">${t.survived ? `+${t.coinsEarned}` : 'Geflohen'}</span></div>`).join('') || (query || shiny ? emptyState(G.EMPTY_MASCOT.search, 'Kein Eintrag passt zur Suche.', 'log-clear', 'Suche leeren') : emptyState(G.EMPTY_MASCOT.chronicle, 'Noch keine Einträge. Deine Runden landen hier.', 'tab', 'Zum Training', 'data-view="train"'))}</div>
    ${list.length > limit ? `<button class="pill quiet wide" data-action="log-more">Weitere ${Math.min(20, list.length - limit)} anzeigen</button>` : ''}`;
}

// MARK: Actions
export function handle(action, el) {
  const s = app.state; const meta = app.meta;
  const done = (ok, msg, fail) => { if (ok) { save(); if (msg) toast(msg); } else if (fail) toast(fail); closeSheet(); app.render(); return true; };
  switch (action) {
    case 'biomes': biomeSheet(); return true;
    case 'select-biome': s.selectedBiome = el.dataset.id; return done(true);
    case 'dig-start': { const wall = G.startDig(s); if (wall) { meta.digWall = wall; meta.digResult = null; save(); saveMeta(); } app.render(); return true; }
    case 'buy-dig': return done(G.buyDig(s), 'Eine Grabung mehr!', 'Heute schon gekauft oder zu wenig Münzen.');
    case 'dig-tool': meta.digTool = el.dataset.id; saveMeta(); app.render(); return true;
    case 'dig': {
      if (!meta.digWall) return true;
      const over = G.strikeWall(meta.digWall, Number(el.dataset.x), Number(el.dataset.y), meta.digTool || 'pickaxe');
      if (over) return handle('dig-finish', el);
      meta.digShake = !meta.digShake; saveMeta(); app.render();
      document.querySelector('.dig-wall')?.classList.remove('shake', 'shake2');
      requestAnimationFrame(() => document.querySelector('.dig-wall')?.classList.add('shake'));
      return true;
    }
    case 'dig-finish': {
      if (!meta.digWall) return true;
      meta.digResult = G.finishDig(s, meta.digWall); meta.digWall = null;
      save(); saveMeta(); toast(G.digSummary(meta.digResult)); app.render(); return true;
    }
    case 'habitat-pick': meta.habitatID = el.dataset.id; saveMeta(); app.render(); return true;
    case 'habitat-add': habitatPicker(); return true;
    case 'pickup': { const found = G.collectPickup(s); if (found.length) { save(); openSheet(`<h2>Mitnahme</h2><p>Deine Bewohner haben etwas gefunden:</p><ul class="result">${found.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><button class="pill" data-action="close">Super</button>`); app.render(); } return true; }
    case 'pc-select': meta.pcSelect = !meta.pcSelect; meta.pcPicked = []; saveMeta(); app.render(); return true;
    case 'pc-pick': { const set = new Set(meta.pcPicked || []); set.has(el.dataset.id) ? set.delete(el.dataset.id) : set.add(el.dataset.id); meta.pcPicked = [...set]; saveMeta(); app.render(); return true; }
    case 'pc-pick-all': meta.pcPicked = [...s.pcBoxes[meta.boxIndex].pokemonIDs]; saveMeta(); app.render(); return true;
    case 'pc-settle': { const n = G.settleMany(s, meta.pcPicked || []); meta.pcPicked = []; saveMeta(); return done(n > 0, `${n} Pokémon sind eingezogen.`, 'Kein passender freier Lebensraum.'); }
    case 'pc-reset': meta.pcSearch = ''; meta.pcType = ''; meta.pcFit = false; saveMeta(); app.render(); return true;
    case 'heat-toggle': meta.showHeat = !meta.showHeat; saveMeta(); app.render(); return true;
    case 'habitats-all': meta.allHabitats = !meta.allHabitats; saveMeta(); app.render(); return true;
    case 'habitat-auto': { const r = G.autoFillHabitat(s, currentHabitat()); return done(r.placed > 0, r.message, 'Kein passendes Pokémon frei.'); }
    case 'pension-pick': pensionPicker(); return true;
    case 'pension-add': {
      const ok = G.addToPension(s, el.dataset.id, !!app.session);
      if (!ok) { toast(G.pensionProblem(s, el.dataset.id, !!app.session) || 'Das geht gerade nicht.'); return true; }
      save(); toast(`${G.describe(G.findPokemon(s, el.dataset.id)).name} ist jetzt in der Pension.`);
      if (el.dataset.from === 'picker' && G.pensionParents(s).length < G.C.journey.pension.capacity) pensionPicker(); else closeSheet();
      app.render(); return true;
    }
    case 'pension-pair': {
      const ids = el.dataset.ids.split(',');
      const ok = ids.every((id) => G.addToPension(s, id, !!app.session));
      if (ok) save(); toast(ok ? 'Beide sind jetzt in der Pension.' : 'Das geht gerade nicht.'); app.render(); return true;
    }
    case 'pension-leave': G.removeFromPension(s, el.dataset.id); return done(true, 'Abgeholt. Es wartet im PC.');
    case 'habitat-place': {
      const message = G.placeInHabitat(s, el.dataset.id, currentHabitat());
      if (!message) { toast('Das geht gerade nicht.'); return true; }
      save(); toast(message);
      if (G.habitatFull(s, currentHabitat())) { closeSheet(); app.render(); } else { app.render(); habitatPicker(); }
      return true;
    }
    case 'habitat-leave': { const p = G.findPokemon(s, el.dataset.id); G.removeFromHabitat(s, el.dataset.id); return done(true, `${G.describe(p).name} ist zurück im PC.`); }
    case 'box': meta.boxIndex = Math.max(0, Math.min(s.pcBoxes.length - 1, meta.boxIndex + Number(el.dataset.delta))); saveMeta(); app.render(); return true;
    case 'goto-box': meta.boxIndex = Number(el.dataset.index); saveMeta(); app.render(); return true;
    case 'add-box': s.pcBoxes.push({ id: G.newID(), name: `Box ${s.pcBoxes.length + 1}`, pokemonIDs: [] }); meta.boxIndex = s.pcBoxes.length - 1; return done(true);
    case 'rename-box': { const name = prompt('Name der Box', s.pcBoxes[meta.boxIndex].name); if (name?.trim()) { s.pcBoxes[meta.boxIndex].name = name.trim().slice(0, 20); return done(true); } return true; }
    case 'log-clear': meta.logSearch = ''; meta.logShiny = false; saveMeta(); app.render(); return true;
    case 'log-more': meta.logLimit = (meta.logLimit || 20) + 20; saveMeta(); app.render(); return true;
    case 'claim-trip': {
      const found = G.claimExpedition(s, el.dataset.id);
      if (found) { queueEvolutions(found.evolutions); done(true, `${found.name} bringt ${found.kind.coins} Münzen und ${found.kind.berries.map(G.berryName).join(', ')} mit.`); playEvolutions(); }
      return true;
    }
    case 'recall': G.recallExpedition(s, el.dataset.id); return done(true, 'Ohne Fund zurückgekehrt.');
  }
  return false;
}
export function change(el) {
  const s = app.state; const meta = app.meta;
  switch (el.dataset.action) {
    case 'preview': s.safariPreviewEnabled = el.checked; if (!G.biomeUnlocked(s, G.C.biomes.find((b) => b.id === s.selectedBiome))) s.selectedBiome = G.C.biomes[0].id; save(); closeSheet(); app.render(); return true;
    case 'pc-type': meta.pcType = el.value; saveMeta(); app.render(); return true;
    case 'pc-fit': meta.pcFit = el.checked; saveMeta(); app.render(); return true;
    case 'pc-move': if (el.value !== '') { const n = G.moveMany(s, meta.pcPicked || [], Number(el.value)); meta.pcPicked = []; saveMeta(); save(); toast(`${n} Pokémon verschoben.`); app.render(); } return true;
    case 'wallpaper': G.setWallpaper(s, meta.boxIndex, el.value); save(); app.render(); return true;
    case 'sort-box': if (el.value) { G.sortBox(s, meta.boxIndex, el.value); save(); app.render(); } return true;
    case 'log-shiny': meta.logShiny = el.checked; saveMeta(); app.render(); return true;
    case 'trip-send': if (el.value) { if (G.startExpedition(s, el.dataset.id, el.value)) { save(); toast(`${G.describe(G.findPokemon(s, el.dataset.id)).name} ist unterwegs.`); } else toast('Gerade nicht möglich.'); app.render(); } return true;
  }
  return false;
}
export function input(el) {
  const meta = app.meta;
  if (el.dataset.action === 'pc-search') { meta.pcSearch = el.value; saveMeta(); rerenderKeepingFocus(el); return true; }
  if (el.dataset.action === 'log-search') { meta.logSearch = el.value; saveMeta(); rerenderKeepingFocus(el); return true; }
  return false;
}
function rerenderKeepingFocus(el) {
  const action = el.dataset.action; const pos = el.selectionStart;
  app.render();
  const again = document.querySelector(`[data-action="${action}"]`);
  if (again) { again.focus(); again.setSelectionRange(pos, pos); }
}
export { pokemonSheet };

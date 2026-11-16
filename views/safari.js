// Safari: Sinnoh habitats, Team & PC, statistics and logbook.
import * as G from '../game.js';
import { app, $, esc, art, pixel, ds, typeBadges, duration, num, bar, segmented, sub, save, saveMeta, toast, openSheet, closeSheet, pokemonSheet, queueEvolutions, playEvolutions } from '../ui.js';

export function render(view) {
  const section = sub('safari', 'meadow');
  view.innerHTML = `<div class="row"><h2>Safari</h2><span class="muted small">${app.state.pokemonRoster.length} Begleiter</span></div>
    ${segmented('safari', [['meadow', 'Lebensräume'], ['team', 'Team & PC'], ['stats', 'Statistik'], ['log', 'Logbuch']])}
    <div id="safari-body"></div>`;
  const body = $('#safari-body', view);
  ({ meadow: renderHabitats, team: renderTeam, stats: renderStats, log: renderLog })[section](body);
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
  const b = biome();
  body.innerHTML = `
    <p class="small muted">Lass PC-Pokémon an Orten wohnen, die zu ihrem Typ passen. Sie trainieren bei jeder Runde mit. · ${total} Bewohner · ${fullCount}/${H.places.length} voll</p>
    <div class="habitat-chips" role="tablist" aria-label="Lebensräume">${H.places.map((x) => { const ok = G.habitatUnlocked(s, x); const n = G.residentIDs(s, x).length;
      return `<button role="tab" class="habitat-chip ${x.id === h.id ? 'on' : ''} ${ok ? '' : 'locked'}" aria-selected="${x.id === h.id}" data-action="habitat-pick" data-id="${x.id}">
        <img src="img/habitats/${x.id}.png" alt=""><span><strong>${esc(x.name)}</strong><small>${ok ? `${n}/${H.capacity}${n >= H.capacity ? ' ★' : ''}` : `ab ${num(x.requiredMinutes)} Min 🔒`}</small>
        <i>${x.types.map((t) => `<b style="background:${G.typeInfo(t).colorHex}"></b>`).join('')}</i></span></button>`; }).join('')}</div>
    <div class="habitat-scene ${open ? '' : 'locked'}">
      <img class="backdrop" src="img/habitats/${h.id}.png" alt="">
      <div class="place-sign"><strong>${esc(h.name)}</strong><small>${esc(h.place)}</small></div>
      ${H.platforms.map((_, i) => { const p = residents[i];
        if (p) { const d = G.describe(p); return `<button class="habitat-mon" style="${sceneBox(i)}" data-action="inspect" data-id="${p.id}" aria-label="${esc(d.name)}, Level ${d.level}"><img src="${ds(d.spriteID, p.isShiny)}" alt=""></button>`; }
        if (!open) return '';
        const [x, y] = H.platforms[i];
        return `<button class="habitat-free" style="left:${(x / SCENE_W) * 100}%;top:${((y - 2) / SCENE_H) * 100}%" data-action="habitat-add" aria-label="Freier Platz: Pokémon einziehen lassen">+</button>`; }).join('')}
      ${open ? '' : `<div class="habitat-lock"><strong>🔒 Ab ${num(h.requiredMinutes)} Fokus-Minuten</strong><small>Du hast ${num(G.totalMinutes(s))} Minuten.</small></div>`}
    </div>
    <div class="panel stack">
      <p>${esc(h.flavor)}</p>
      ${typeBadges(h.types)}
      <div class="row small"><strong>Bewohner</strong><span>${residents.length} / ${H.capacity}</span></div>
      ${bar(residents.length / H.capacity, full ? 'var(--sun)' : null)}
      <ul class="bonus-list small">
        <li>🚶 Bewohner bekommen ${H.residentSharePercent} % deiner Fokus-Minuten als EP.</li>
        <li class="${full ? 'note-sun' : ''}">${full ? '★' : '☆'} ${full ? `Voll: Partner vom Typ ${h.types.map((t) => G.typeInfo(t).name).join(' oder ')} bekommen +${H.fullHabitatBonusPercent} % EP.` : `Wenn voll: Partner vom passenden Typ bekommen +${H.fullHabitatBonusPercent} % EP.`}</li>
        ${(s.claimedHabitatIDs || []).includes(h.id) ? '' : `<li>🎁 Beim ersten Mal voll: +${H.firstFillReward} PokéMünzen</li>`}
        ${partner && boosted?.id === h.id ? `<li class="note-share">✓ ${esc(G.describe(partner).name)} profitiert gerade davon.</li>` : ''}
      </ul>
      <button class="pill" data-action="habitat-add" ${!open || full ? 'disabled' : ''}>Pokémon einziehen lassen</button>
    </div>
    ${residents.length ? `<div class="stack">${residents.map((p) => { const d = G.describe(p);
      return `<div class="panel resident-row"><img src="${ds(d.spriteID, p.isShiny)}" alt="">
        <div><strong>${esc(d.name)}</strong> <span class="small muted">Lv. ${d.level}</span>${typeBadges(G.pokemonTypes(p), true)}</div>
        <button class="pill quiet" data-action="inspect" data-id="${p.id}">Steckbrief</button>
        <button class="icon-btn small" data-action="habitat-leave" data-id="${p.id}" aria-label="${esc(d.name)} zurück in den PC">↩</button></div>`; }).join('')}</div>` : ''}
    <div class="panel row travel-row"><img src="${pixel(b.mascotID)}" alt=""><div><strong>Reiseziel für wilde Begegnungen</strong><p class="small muted">${esc(b.title)} · ${esc(b.region)}</p></div>
      <button class="pill quiet" data-action="biomes">Gebiet wechseln</button></div>`;
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

// MARK: Team & PC
function renderTeam(body) {
  const s = app.state;
  const dayID = G.pokemonOfTheDay(s.pokemonRoster);
  app.meta.boxIndex = Math.min(app.meta.boxIndex || 0, s.pcBoxes.length - 1);
  const box = s.pcBoxes[app.meta.boxIndex];
  const query = (app.meta.pcSearch || '').trim().toLowerCase();
  const matches = (p) => !query || `${G.describe(p).name} ${p.species.displayName} ${p.species.stages.map((x) => x.name).join(' ')} #${G.describe(p).spriteID}`.toLowerCase().includes(query);
  const hits = query ? s.pcBoxes.map((b, i) => [i, b.pokemonIDs.filter((id) => matches(G.findPokemon(s, id))).length]).filter(([, n]) => n) : [];
  const badges = (p) => `${p.id === dayID ? '<span class="badge sun">☀︎</span>' : ''}${G.onExpedition(s, p.id) ? '<span class="badge trip">⛺</span>' : ''}${G.isNew(p) ? '<span class="badge new">Neu</span>' : ''}`;
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
    ${dayID ? (() => { const star = G.findPokemon(s, dayID); return `<div class="panel row sun-card"><img src="${pixel(G.describe(star).spriteID, star.isShiny)}" alt=""><p class="small"><strong class="note-sun">Pokémon des Tages</strong><br>${esc(G.describe(star).name)} bekommt heute +${G.DAY_BONUS_PERCENT} % EP.</p><button class="pill quiet" data-action="partner" data-id="${dayID}" ${app.session ? 'disabled' : ''}>Trainieren</button></div>`; })() : ''}
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
    ${query ? `<div class="row wrap small">${hits.length ? 'Treffer:' : 'Keine Treffer im PC'} ${hits.map(([i, n]) => `<button class="chip ${i === app.meta.boxIndex ? 'on' : ''}" data-action="goto-box" data-index="${i}">${esc(s.pcBoxes[i].name)} (${n})</button>`).join('')}</div>` : ''}
    <div class="pc-grid">
      ${Array.from({ length: G.BOX_CAPACITY }, (_, i) => box.pokemonIDs[i]).map((id) => {
        if (!id) return '<div class="cell"></div>';
        const p = G.findPokemon(s, id); const d = G.describe(p);
        return `<button class="cell ${G.onExpedition(s, id) ? 'away' : ''} ${matches(p) ? '' : 'dim'}" data-action="inspect" data-id="${id}" aria-label="${esc(d.name)}, Level ${d.level}">
          <img src="${pixel(d.spriteID, p.isShiny)}" alt="" loading="lazy">${badges(p)}<span class="lv">${d.level}</span></button>`;
      }).join('')}
    </div>
    <h3 style="margin-top:20px">Expeditionen <span class="muted small">${(s.expeditions || []).length} / ${G.MAX_EXPEDITIONS}</span></h3>
    <div class="trips">${(s.expeditions || []).length ? s.expeditions.map((t) => {
      const k = G.EXPEDITIONS[t.kind]; const p = G.findPokemon(s, t.pokemonID); const d = G.describe(p); const done = t.progressMinutes >= k.goal;
      return `<div class="panel trip"><img src="${pixel(d.spriteID, p.isShiny)}" alt=""><div><strong>${k.icon} ${k.title}</strong> <span class="muted small">${esc(d.name)}</span>${bar(t.progressMinutes / k.goal)}
        <span class="small muted">${done ? 'Zurück mit Fundstücken!' : `${t.progressMinutes} / ${k.goal} Fokus-Minuten`} · ${k.coins} Münzen, ${k.berries.map(G.berryName).join(' + ')}</span></div>
        ${done ? `<button class="pill" data-action="claim-trip" data-id="${t.id}">Abholen</button>` : `<button class="pill quiet" data-action="recall" data-id="${t.id}">Zurückrufen</button>`}</div>`;
    }).join('') : '<p class="muted small">Tippe ein Pokémon im PC an und schicke es los. Jede Fokus-Minute bringt es weiter.</p>'}</div>`;
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
    <div class="cards">
      <div class="card"><strong>${num(minutes)}</strong><span>Fokus-Minuten</span></div>
      <div class="card"><strong>${wins.length}</strong><span>erfolgreiche Runden</span></div>
      <div class="card"><strong>${rate == null ? '–' : `${rate} %`}</strong><span>Erfolgsquote</span></div>
      <div class="card"><strong>${num(wins.reduce((a, t) => a + t.coinsEarned, 0))}</strong><span>Münzen verdient</span></div>
    </div>
    <div class="panel"><h3>Diese Woche</h3>
      <div class="week">${week.map((d) => `<div><span style="height:${Math.round((d.minutes / weekMax) * 100)}%" title="${d.minutes} Min"></span><small>${d.date.toLocaleDateString('de-DE', { weekday: 'short' })}</small></div>`).join('')}</div>
      <p class="small muted">${week.reduce((a, d) => a + d.minutes, 0)} Minuten an ${week.filter((d) => d.minutes).length} Tagen · Serie: ${G.streakDays(s)} Tage</p></div>
    <div class="panel"><h3>Letzte 28 Tage</h3>
      <div class="heat">${heat.map((d) => `<span title="${d.date.toLocaleDateString('de-DE')}: ${d.minutes} Min" style="opacity:${d.minutes ? 0.25 + 0.75 * (d.minutes / max) : 0.08}"></span>`).join('')}</div>
      ${best != null ? `<p class="small muted">Beste Fokus-Zeit: ${String(best).padStart(2, '0')}:00 Uhr</p>` : ''}</div>
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
        <span class="small ${t.survived ? '' : 'bad'}">${t.survived ? `+${t.coinsEarned}` : 'Geflohen'}</span></div>`).join('') || '<p class="muted">Keine Einträge.</p>'}</div>
    ${list.length > limit ? `<button class="pill quiet wide" data-action="log-more">Weitere ${Math.min(20, list.length - limit)} anzeigen</button>` : ''}`;
}

// MARK: Actions
export function handle(action, el) {
  const s = app.state; const meta = app.meta;
  const done = (ok, msg, fail) => { if (ok) { save(); if (msg) toast(msg); } else if (fail) toast(fail); closeSheet(); app.render(); return true; };
  switch (action) {
    case 'biomes': biomeSheet(); return true;
    case 'select-biome': s.selectedBiome = el.dataset.id; return done(true);
    case 'habitat-pick': meta.habitatID = el.dataset.id; saveMeta(); app.render(); return true;
    case 'habitat-add': habitatPicker(); return true;
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
    case 'sort-box': if (el.value) { G.sortBox(s, meta.boxIndex, el.value); save(); app.render(); } return true;
    case 'log-shiny': meta.logShiny = el.checked; saveMeta(); app.render(); return true;
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

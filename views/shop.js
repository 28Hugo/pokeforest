// Poké-Shop: species lines, berries, Knursp, Wunder-Tausch and avatar capsules.
import * as G from '../game.js';
import { app, $, esc, pixel, typeBadges, num, segmented, sub, save, saveMeta, toast, openSheet, closeSheet } from '../ui.js';

export function render(view) {
  view.innerHTML = `<div class="row"><h2>Poké-Shop</h2><span class="muted small">${num(app.state.coins)} Münzen</span></div>
    <div class="steps-strip small"><span>🌿 Wilde Begegnung</span><span>›</span><span>🛒 Linie erscheint hier</span><span>›</span><span>⚡ Freischalten &amp; trainieren</span></div>
    ${segmented('shop', [['lines', 'Pokémon-Linien'], ['items', 'Beeren & Tausch']])}
    <div id="shop-body"></div>`;
  const body = $('#shop-body', view);
  (sub('shop', 'lines') === 'lines' ? renderLines : renderItems)(body);
}

function renderLines(body) {
  const s = app.state;
  const query = (app.meta.shopSearch || '').toLowerCase();
  const lines = G.availableSpecies(s).filter((x) => !query || `${x.displayName} ${x.stages.map((st) => st.name).join(' ')}`.toLowerCase().includes(query));
  body.innerHTML = `<input type="search" data-action="shop-search" placeholder="Linie suchen" value="${esc(app.meta.shopSearch || '')}" aria-label="Linien durchsuchen">
    <div class="lines">${lines.map((x) => {
      const unlocked = G.isUnlocked(s, x); const legend = G.legendaryID(x) != null;
      const own = s.pokemonRoster.find((p) => G.lineKey(p.species) === G.lineKey(x));
      const price = G.shopPrice(s, x); const copy = G.copyPrice(s, x);
      const evo = x.stages.length === 3 ? `Fokus-Entwicklungen: Lv. 16 und 36` : x.stages.length === 2 ? `Fokus-Entwicklung ab Lv. 20` : 'Einzel-Pokémon';
      return `<div class="line-card" style="--accent:${x.primaryHex}">
        <div class="line-sprites">${x.stages.map((st) => `<img src="${pixel(st.pokedexID)}" alt="${esc(st.name)}" title="${esc(st.name)}" loading="lazy">`).join('')}</div>
        <strong>${esc(G.lineTitle(x))}</strong>${typeBadges(G.typesOf(x.stages[0].pokedexID), true)}<span class="small muted">${evo}</span>
        ${unlocked ? `<div class="row">${own ? `<button class="pill quiet" data-action="partner" data-id="${own.id}" ${app.session ? 'disabled' : ''}>${own.id === s.selectedPokemonID ? 'Aktiv' : 'Trainieren'}</button>` : '<span class="small muted">Kein Exemplar</span>'}
          ${legend ? '' : `<button class="pill quiet" data-action="adopt-line" data-id="${esc(x.id)}" ${s.coins < copy ? 'disabled' : ''}>+ Exemplar · ${copy}</button>`}</div>`
          : legend ? '<span class="small muted">Legendär: nur über Raids, Eier oder Begegnungen</span>'
          : `<button class="pill" data-action="unlock-line" data-id="${esc(x.id)}" ${s.coins < price ? 'disabled' : ''}>Freischalten · ${num(price)} Münzen</button>`}
      </div>`; }).join('')}</div>`;
}

const PLANT_ART = ['', '🌱', '🌿', '🌸'];
function berryPlots(s) {
  const P = G.C.journey.berryPlots;
  const plots = G.ensureJourney(s).berryPlots;
  const inv = s.berryInventory || {};
  return `<div class="panel berry-beds"><h3>Beerenbeete in Flori</h3>
    <p class="small muted">Pflanze eine Beere aus deinem Beutel. Sie wächst mit jeder Fokus-Minute und ist nach ${P.growMinutes} Minuten reif. Bei der Ernte bekommst du ${P.harvestMin} bis ${P.harvestMax} Beeren.</p>
    <div class="beds">${plots.map((plot, i) => { const stage = G.plotStage(plot); const b = G.C.berries.find((x) => x.id === plot.berryID);
      return `<div class="bed stage${stage}">
        <div class="soil">${stage === 4 ? `<span class="ripe" style="--c:${b.colorHex}">●●●</span>` : `<span>${PLANT_ART[stage]}</span>`}</div>
        <small>${b ? `${esc(b.name)} · ${G.STAGE_NAMES[stage]}` : 'Leeres Beet'}</small>
        ${b && stage < 4 ? `<div class="bar-mini"><i style="width:${Math.round(G.plotProgress(plot) * 100)}%;background:${b.colorHex}"></i></div><small class="muted">${Math.max(0, P.growMinutes - plot.minutes)} Min</small>`
          : stage === 4 ? `<button class="pill small" data-action="harvest" data-index="${i}">Ernten</button>`
          : `<select data-action="plant" data-index="${i}" aria-label="Beere für Beet ${i + 1}"><option value="">Pflanzen …</option>${G.C.berries.map((x) => `<option value="${x.id}" ${inv[x.id] ? '' : 'disabled'}>${esc(x.name)} (${inv[x.id] || 0})</option>`).join('')}</select>`}
      </div>`; }).join('')}</div></div>`;
}
function renderItems(body) {
  const s = app.state;
  const inv = s.berryInventory || {};
  body.innerHTML = `
    ${berryPlots(s)}
    <h3>Beeren</h3>
    <div class="stack">${G.C.berries.map((b) => `<div class="panel item-row"><span class="dot big" style="background:${b.colorHex}"></span>
      <div><strong>${esc(b.name)}</strong> <span class="small muted">× ${inv[b.id] || 0}</span><p class="small muted">${esc(b.effect)}</p></div>
      <button class="pill" data-action="buy-berry" data-id="${b.id}" ${s.coins < b.price ? 'disabled' : ''}>${b.price} Münzen</button></div>`).join('')}</div>
    <h3>Knursp-Bäckerei</h3>
    <div class="stack">${G.C.poffins.map((p) => `<div class="panel item-row"><div><strong>${esc(p.name)}</strong><p class="small muted">${esc(p.recipe)}</p></div>
      <button class="pill quiet" data-action="poffin" data-id="${esc(p.id)}" ${app.meta.poffin === p.id ? 'disabled' : ''}>${app.meta.poffin === p.id ? 'Gebacken' : 'Backen'}</button></div>`).join('')}
      <p class="small muted">Ein gebackener Knursp wirkt in deiner nächsten Runde.</p></div>
    <h3>Wunder-Tausch</h3>
    <div class="panel item-row"><p class="small">Tausche ${G.WONDER_TRADE_PRICE} Münzen gegen eine Überraschung: eine neue Linie, Beeren oder ein Nugget.</p>
      <button class="pill" data-action="wonder" ${s.coins < G.WONDER_TRADE_PRICE ? 'disabled' : ''}>Tauschen</button></div>
    <h3>Profilbild-Kapsel</h3>
    <div class="panel item-row"><p class="small">Zieh für ${G.AVATAR_CAPSULE_PRICE} Münzen ein neues Trainer-Profilbild (${(s.unlockedAvatarIDs || []).length}/${G.C.avatars.length}).</p>
      <button class="pill" data-action="capsule" ${s.coins < G.AVATAR_CAPSULE_PRICE ? 'disabled' : ''}>Ziehen</button></div>`;
}

export function handle(action, el) {
  const s = app.state;
  const species = () => G.availableSpecies(s).find((x) => x.id === el.dataset.id);
  switch (action) {
    case 'unlock-line': {
      const x = species();
      if (x && confirm(`${x.displayName} für ${G.shopPrice(s, x)} Münzen freischalten?`)) {
        const id = G.unlockLine(s, x);
        if (id) { save(); toast(`${x.displayName} freigeschaltet! Ein eigenes Exemplar wartet in Team & PC.`); } else toast('Freischalten nicht möglich.');
        app.render();
      }
      return true;
    }
    case 'adopt-line': { const x = species(); if (x && G.adoptCopy(s, x)) { save(); toast('Neues Exemplar auf Level 1 – im Team oder PC.'); } else toast('Dafür fehlen dir PokéMünzen.'); app.render(); return true; }
    case 'harvest': { const n = G.harvestPlot(s, Number(el.dataset.index)); if (n) { save(); toast(`+${n} Beeren geerntet.`); } app.render(); return true; }
    case 'buy-berry': if (G.buyBerry(s, el.dataset.id)) { save(); toast(`${G.berryName(el.dataset.id)} gekauft.`); } app.render(); return true;
    case 'wonder': if (confirm(`${G.WONDER_TRADE_PRICE} Münzen für einen Wunder-Tausch einsetzen?`)) { const msg = G.wonderTrade(s); save(); openSheet(`<h2>Wunder-Tausch</h2><p>${esc(msg)}</p><button class="pill" data-action="close">Super</button>`); app.render(); } return true;
    case 'capsule': if (confirm(`${G.AVATAR_CAPSULE_PRICE} Münzen für eine Profilbild-Kapsel einsetzen?`)) { const msg = G.avatarCapsule(s); save(); toast(msg); app.render(); } return true;
  }
  return false;
}
export function input(el) {
  if (el.dataset.action !== 'shop-search') return false;
  app.meta.shopSearch = el.value; saveMeta();
  const pos = el.selectionStart; app.render();
  const again = document.querySelector('[data-action="shop-search"]'); again?.focus(); again?.setSelectionRange(pos, pos);
  return true;
}
export function change(el) {
  if (el.dataset.action !== 'plant' || !el.value) return false;
  if (G.plantBerry(app.state, el.value, Number(el.dataset.index))) { save(); toast(`${G.berryName(el.value)} gepflanzt.`); }
  app.render();
  return true;
}

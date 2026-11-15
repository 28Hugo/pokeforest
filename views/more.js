// Mehr: PokéRadio, settings and sync with the Mac.
import * as G from '../game.js';
import { app, $, esc, pixel, segmented, sub, save, saveMeta, toast, replaceState, openSheet } from '../ui.js';

export function render(view) {
  view.innerHTML = `${segmented('more', [['radio', 'Poké-Radio'], ['settings', 'Einstellungen'], ['sync', 'Sync']])}<div id="more-body"></div>`;
  const body = $('#more-body', view);
  ({ radio: renderRadio, settings: renderSettings, sync: renderSync })[sub('more', 'radio')](body);
}

// MARK: Radio
const ambience = { ctx: null, channels: {} };
const CHANNELS = [['rain', 'Regen'], ['vinyl', 'Vinyl-Knistern'], ['fire', 'Lagerfeuer'], ['waves', 'Wellen']];
function noiseBuffer(ctx, kind) {
  const length = ctx.sampleRate * 4; const buffer = ctx.createBuffer(1, length, ctx.sampleRate); const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === 'vinyl') data[i] = Math.random() < 0.0008 ? white : white * 0.02;
    else if (kind === 'fire') { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5 + (Math.random() < 0.0015 ? white * 0.6 : 0); }
    else if (kind === 'waves') { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5 * (0.55 + 0.45 * Math.sin((i / ctx.sampleRate) * Math.PI * 0.5)); }
    else data[i] = white * 0.5;
  }
  return buffer;
}
function setChannel(id, volume) {
  ambience.ctx ||= new AudioContext();
  const ctx = ambience.ctx;
  let ch = ambience.channels[id];
  if (!ch) {
    const source = ctx.createBufferSource(); source.buffer = noiseBuffer(ctx, id); source.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = id === 'rain' ? 'highpass' : 'lowpass'; filter.frequency.value = id === 'rain' ? 900 : id === 'vinyl' ? 6000 : 700;
    const gain = ctx.createGain(); gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(ctx.destination); source.start();
    ch = ambience.channels[id] = { gain };
  }
  ch.gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.2);
  if (ctx.state === 'suspended') ctx.resume();
}
function renderRadio(body) {
  const stations = G.C.stations;
  const current = stations.find((s) => s.id === app.meta.station) ?? stations[0];
  const mix = app.meta.mix || {};
  body.innerHTML = `
    <h2>PokéRadio</h2>
    <div class="player">${app.meta.radioOn ? `<iframe src="https://www.youtube-nocookie.com/embed/${current.youtubeVideoID}?autoplay=1&playsinline=1" title="${esc(current.title)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
      : `<button class="player-cover" data-action="radio-play" style="--accent:${current.accentHex}"><span class="ball-dot big"></span><strong>${esc(current.title)}</strong><span>${esc(current.artist)}</span><span class="pill">Abspielen</span></button>`}</div>
    <p class="small muted">Musik von den Künstlerkanälen auf YouTube, Internet nötig.</p>
    <div class="stations">${stations.map((s) => `<button class="station ${s.id === current.id ? 'on' : ''}" data-action="station" data-id="${s.id}" style="--accent:${s.accentHex}"><strong>${esc(s.title)}</strong><small>${esc(s.artist)}</small><small>${esc(s.region)}</small></button>`).join('')}</div>
    <h3>Atmosphäre</h3>
    <div class="panel stack">${CHANNELS.map(([id, label]) => `<label class="field">${label}<input type="range" min="0" max="100" value="${Math.round((mix[id] || 0) * 100)}" data-mix="${id}" aria-label="${label}"></label>`).join('')}
      <p class="small muted">Wird im Browser erzeugt, funktioniert auch offline.</p></div>`;
  body.querySelectorAll('[data-mix]').forEach((input) => input.addEventListener('input', () => {
    app.meta.mix = { ...(app.meta.mix || {}), [input.dataset.mix]: Number(input.value) / 100 };
    saveMeta(); setChannel(input.dataset.mix, (Number(input.value) / 100) * 0.35);
  }));
}

// MARK: Settings
function renderSettings(body) {
  const s = app.state;
  body.innerHTML = `
    <h2>Einstellungen</h2>
    <div class="panel stack">
      <label class="field">Tagesziel in Minuten <input type="number" min="5" max="720" step="5" inputmode="numeric" value="${G.dailyGoal(s)}" data-setting="dailyGoal"></label>
      <p class="small muted">Heute: ${G.todayMinutes(s)} / ${G.dailyGoal(s)} Minuten.</p>
      <label class="field">Erscheinungsbild <select data-setting="appearance">${[['auto', 'Wie das Gerät'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([id, label]) => `<option value="${id}" ${(app.meta.appearance || 'auto') === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label class="switch"><input type="checkbox" data-setting="strict" ${app.meta.strict ? 'checked' : ''}> Strenger Modus <span class="small muted">ersetzt den Fokus-Wächter des Macs</span></label>
    </div>
    <h3>Fokus-Tags</h3>
    <div class="panel stack">${s.tags.map((t) => `<div class="row"><span><span class="dot" style="background:${t.colorHex}"></span>${esc(t.name)}</span>${s.tags.length > 1 ? `<button class="icon-btn small" data-action="delete-tag" data-id="${t.id}" aria-label="${esc(t.name)} löschen">×</button>` : ''}</div>`).join('')}
      <form class="row" data-form="tag"><input name="name" maxlength="20" placeholder="Neuer Tag" required aria-label="Neuer Tag"><input name="color" type="color" value="#34C759" aria-label="Farbe"><button class="pill quiet">Hinzufügen</button></form></div>
    <p class="small muted">Nicht im Browser möglich: Apps und Websites sperren, Mini-HUD und Menüleiste. Das bleibt der Mac-App vorbehalten.</p>`;
  body.querySelectorAll('[data-setting]').forEach((el) => el.addEventListener('change', () => {
    const key = el.dataset.setting;
    if (key === 'dailyGoal') { s.dailyGoalMinutes = Math.max(5, Math.min(720, Number(el.value) || 90)); save(); }
    if (key === 'appearance') { app.meta.appearance = el.value; saveMeta(); applyAppearance(); }
    if (key === 'strict') { app.meta.strict = el.checked; saveMeta(); }
    app.render();
  }));
}
export function applyAppearance() {
  const mode = app.meta.appearance || 'auto';
  document.documentElement.dataset.theme = mode === 'auto' ? '' : mode;
}

// MARK: Sync
function renderSync(body) {
  const changed = app.meta.changedAt ? new Date(app.meta.changedAt).toLocaleString('de-DE') : '–';
  const exported = app.meta.exportedAt ? new Date(app.meta.exportedAt).toLocaleString('de-DE') : 'noch nie';
  body.innerHTML = `
    <h2>Mit dem Mac abgleichen</h2>
    <div class="panel">
      <p>Beide Geräte nutzen die Datei <strong>PokéForest_Sync.json</strong> in <strong>iCloud Drive › PokéForest</strong>.</p>
      <ol class="steps">
        <li><strong>Vor dem Training hier:</strong> Am Mac „Jetzt sichern“, dann hier „Vom Mac laden“.</li>
        <li><strong>Nach dem Training hier:</strong> „Für den Mac sichern“, die alte Datei in iCloud Drive › PokéForest ersetzen, am Mac „Stand vom iPhone/iPad laden“.</li>
      </ol>
      <div class="sync-actions"><button class="pill" data-action="import">Vom Mac laden</button><button class="pill" data-action="export">Für den Mac sichern</button></div>
      <p class="small muted" style="margin-top:12px">Zuletzt geändert: ${changed}<br>Zuletzt gesichert: ${exported}</p>
    </div>
    <p class="small muted">Es zählt immer der zuletzt geladene Stand. Trainiere nicht gleichzeitig auf Mac und iPhone.</p>`;
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
    if (app.session) { toast('Beende zuerst die laufende Runde.'); return; }
    replaceState(data);
    app.meta.exportedAt = Date.now(); app.meta.changedAt = app.meta.exportedAt; saveMeta();
    toast(`Geladen: ${app.state.pokemonRoster.length} Pokémon, ${app.state.coins} Münzen.`);
    app.meta.tab = 'train'; app.render();
  } catch { toast('Die Datei ließ sich nicht lesen. Wähle PokéForest_Sync.json.'); }
});
async function exportSave() {
  const file = new File([JSON.stringify(app.state)], 'PokéForest_Sync.json', { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'PokéForest-Spielstand' });
    else { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    app.meta.exportedAt = Date.now(); saveMeta();
    toast('Gesichert. Lege die Datei in iCloud Drive › PokéForest ab.'); app.render();
  } catch (error) { if (error?.name !== 'AbortError') toast('Sichern hat nicht geklappt. Versuche es nochmal.'); }
}

export function handle(action, el) {
  switch (action) {
    case 'import': fileInput.click(); return true;
    case 'export': exportSave(); return true;
    case 'fresh': replaceState(G.freshSave()); app.meta.tab = 'train'; saveMeta(); app.render(); return true;
    case 'station': app.meta.station = el.dataset.id; app.meta.radioOn = true; saveMeta(); app.render(); return true;
    case 'radio-play': app.meta.radioOn = true; saveMeta(); app.render(); return true;
    case 'delete-tag': app.state.tags = app.state.tags.filter((t) => t.id !== el.dataset.id); save(); app.render(); return true;
  }
  return false;
}
export function submit(form) {
  if (form.dataset.form !== 'tag') return false;
  const data = new FormData(form);
  const name = data.get('name').trim();
  if (name) { app.state.tags.push({ id: G.newID(), name, colorHex: data.get('color').toUpperCase(), icon: 'tag.fill' }); save(); app.render(); }
  return true;
}
export { openSheet, pixel };

// PokéForest game engine for the web app. Every rule mirrors the Mac app (Swift),
// so a save edited here opens on the Mac without surprises. Catalog data comes from
// catalog.json, exported straight from the Swift sources (scripts/export_web_catalog.sh).

export const TEAM_SIZE = 6;
export const BOX_CAPACITY = 30;
export const SHARE_PERCENT = 50;
export const DAY_BONUS_PERCENT = 50;
export const MAX_EXPEDITIONS = 2;
export const POMODORO_COMPLETION_COINS = 20;
export const RESEARCH_REGION_COINS = 100;
export const WONDER_TRADE_PRICE = 400;
export const AVATAR_CAPSULE_PRICE = 360;
export const EVERSTONE_SECONDS = 180;
const REFERENCE_EPOCH_MS = 978307200000; // Swift dates count seconds from 2001-01-01.

export let C = null; // catalog
export function init(catalog) {
  C = catalog;
  C.legendary = new Set(catalog.legendaryIDs);
  C.familyByID = Object.fromEntries(catalog.research.families.map((f) => [f.id, f]));
  C.regionByID = Object.fromEntries(catalog.research.regions.map((r) => [r.id, r]));
}

export const toSwiftDate = (date = new Date()) => (date.getTime() - REFERENCE_EPOCH_MS) / 1000;
export const fromSwiftDate = (seconds) => new Date(seconds * 1000 + REFERENCE_EPOCH_MS);
export const newID = () => crypto.randomUUID().toUpperCase();
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// MARK: Species helpers (TreeSpecies)
export const lineKey = (s) => s.stages.map((x) => x.pokedexID).join('-');
export const stageCount = (s) => Math.max(1, s.stages.length);
export const spriteFor = (s, stage) => s.stages[Math.min(Math.max(0, stage - 1), s.stages.length - 1)]?.pokedexID ?? 1;
export const nameFor = (s, stage) => s.stages[Math.min(Math.max(0, stage - 1), s.stages.length - 1)]?.name ?? s.displayName;
export function legendaryID(s) {
  const base = s.stages[0]?.pokedexID;
  if (!C.legendary.has(base)) return null;
  const last = s.stages.at(-1).pokedexID;
  return C.legendary.has(last) ? last : base;
}
export function megaFor(s) {
  const final = s.stages.at(-1);
  const sprite = final && C.megaSpriteIDs[String(final.pokedexID)];
  if (!sprite) return null;
  return { pokedexID: sprite, name: `Mega-${final.name}${[6, 150, 26].includes(final.pokedexID) ? ' X' : ''}` };
}
export function targetStage(minutes, maxStages) {
  const raw = minutes < 30 ? 1 : minutes < 60 ? 2 : 3;
  return Math.min(raw, maxStages);
}
const isStarter = (s) => ['1-2-3', '4-5-6', '7-8-9'].includes(lineKey(s));

// MARK: Levels (OwnedPokemon, 5.3 curve)
export function threshold(level) {
  const steps = Math.max(0, Math.min(99, level - 1));
  return Math.round(0.75 * Math.pow(steps, 1.8) + 4 * steps);
}
export function levelFor(experience) {
  let level = 1;
  for (let l = 1; l <= 100; l++) if (experience >= threshold(l)) level = l;
  return level;
}
export function stageFor(level, count) {
  if (count === 1) return 1;
  if (count === 2) return level >= 20 ? 2 : 1;
  return level >= 36 ? 3 : level >= 16 ? 2 : 1;
}
function evolutionLevel(count, stage) {
  if (stage >= Math.min(3, count)) return null;
  return count === 2 ? 20 : stage === 1 ? 16 : 36;
}
export function describe(pokemon) {
  const s = pokemon.species;
  const level = levelFor(pokemon.experience);
  const stage = stageFor(level, stageCount(s));
  const maxLevel = level === 100;
  const start = threshold(level);
  const end = threshold(level + 1);
  const nextEvolution = evolutionLevel(stageCount(s), stage);
  return {
    level, stage, maxLevel,
    spriteID: spriteFor(s, stage),
    formName: nameFor(s, stage),
    name: pokemon.nickname || nameFor(s, stage),
    progress: maxLevel ? 1 : Math.min(1, Math.max(0, (pokemon.experience - start) / Math.max(1, end - start))),
    toNextLevel: maxLevel ? 0 : Math.max(0, end - pokemon.experience),
    nextEvolutionName: nextEvolution ? nameFor(s, stage + 1) : null,
    nextEvolutionLevel: nextEvolution,
    toNextEvolution: nextEvolution ? Math.max(0, threshold(nextEvolution) - pokemon.experience) : null,
    raidBonus: Math.min(20, Math.floor(level / 25) * 5),
  };
}
const capXP = (xp) => Math.min(threshold(100), Math.max(0, xp));

// MARK: History helpers (PlantedTree)
export function evolvedStage(entry) {
  if (entry.trainedStage != null) return Math.max(1, Math.min(stageCount(entry.species), entry.trainedStage));
  if (entry.wasWildEncounter) return 1;
  return targetStage(entry.durationMinutes, stageCount(entry.species));
}
export function entryName(entry) {
  const stage = evolvedStage(entry);
  const base = nameFor(entry.species, stage);
  const mega = entry.survived && !entry.wasWildEncounter && stage === stageCount(entry.species) && entry.isMega ? megaFor(entry.species) : null;
  return (entry.isShiny ? '✨ ' : '') + (mega?.name ?? base);
}
export function entrySprite(entry) {
  const stage = evolvedStage(entry);
  const mega = entry.survived && !entry.wasWildEncounter && stage === stageCount(entry.species) && entry.isMega ? megaFor(entry.species) : null;
  return mega?.pokedexID ?? spriteFor(entry.species, stage);
}
const survived = (state) => (state.plantedTrees || []).filter((t) => t.survived);
const entryDate = (t) => fromSwiftDate(t.timestamp);

export function todayMinutes(state, now = new Date()) {
  return survived(state).filter((t) => sameDay(entryDate(t), now)).reduce((sum, t) => sum + t.durationMinutes, 0);
}
export function totalMinutes(state) { return survived(state).reduce((sum, t) => sum + t.durationMinutes, 0); }
export function streakDays(state, now = new Date()) {
  const days = new Set(survived(state).map((t) => startOfDay(entryDate(t)).getTime()));
  let day = startOfDay(now);
  if (!days.has(day.getTime())) day = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1);
  let streak = 0;
  while (days.has(day.getTime())) { streak++; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1); }
  return streak;
}
export const dailyGoal = (state) => Math.max(5, Math.min(720, state.dailyGoalMinutes ?? 90));

// MARK: Trainer (EconomyBalance, TrainerClassRank)
export const trainerThreshold = (level) => { const s = Math.max(0, level - 1); return 80 * s + 15 * s * s; };
export function raidWins(state) {
  const c = state.raidCampaign;
  return c ? (c.legacyDefeats || 0) + c.bosses.reduce((sum, b) => sum + b.defeatedCount, 0) : 0;
}
export function trainerXP(state) {
  const wins = survived(state);
  return totalMinutes(state) + wins.length * 5 + raidWins(state) * 50 + wins.reduce((sum, t) => sum + Math.max(0, t.trainerBonusXP || 0), 0);
}
export function trainerLevel(state) {
  const xp = trainerXP(state);
  let level = 1;
  while (trainerThreshold(level + 1) <= xp) level++;
  return level;
}
export function rankFor(level) {
  return C.ranks.find((r) => level >= r.minLevel && (r.maxLevel == null || level <= r.maxLevel)) ?? C.ranks.at(-1);
}

// MARK: Species catalog, discovery and ownership (ForestStore)
export const rawCatalog = (state) => [...C.species, ...(state.customSpecies || [])];
export function canonical(state, s) { return rawCatalog(state).find((x) => lineKey(x) === lineKey(s)) ?? s; }
export function ownedLegendaryIDs(state) {
  const raw = rawCatalog(state).filter((s) => (state.unlockedSpeciesIDs || []).includes(s.id));
  return new Set([...raw.map(legendaryID), ...state.pokemonRoster.map((p) => legendaryID(p.species)), ...survived(state).map((t) => legendaryID(t.species))].filter((x) => x != null));
}
export function isUnlocked(state, s) {
  if (isStarter(s) || state.pokemonRoster.some((p) => lineKey(p.species) === lineKey(s))) return true;
  const legend = legendaryID(s);
  if (legend != null) return ownedLegendaryIDs(state).has(legend);
  return rawCatalog(state).some((x) => lineKey(x) === lineKey(s) && (state.unlockedSpeciesIDs || []).includes(x.id));
}
export function isDiscovered(state, s) {
  const c = canonical(state, s);
  return isStarter(c) || (state.discoveredSpeciesIDs || []).includes(c.id) || isUnlocked(state, c);
}
function uniqueSpecies(list) {
  const seen = new Set();
  return list.filter((s) => { const key = legendaryID(s) != null ? `legendary-${legendaryID(s)}` : `line-${lineKey(s)}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
export const availableSpecies = (state) => uniqueSpecies(rawCatalog(state)).filter((s) => isDiscovered(state, s));
export const unlockedSpecies = (state) => availableSpecies(state).filter((s) => isUnlocked(state, s));

function addImportedSpecies(state, s) {
  const c = canonical(state, s);
  state.discoveredSpeciesIDs ||= [];
  if (!state.discoveredSpeciesIDs.includes(c.id)) state.discoveredSpeciesIDs.push(c.id);
  if (rawCatalog(state).some((x) => lineKey(x) === lineKey(s))) return;
  const legend = legendaryID(s);
  state.customSpecies ||= [];
  if (legend != null && state.customSpecies.some((x) => legendaryID(x) === legend)) return;
  state.customSpecies.push(s);
}
const newPokemon = (species, shiny = false) => ({ id: newID(), species, experience: 0, trainingMinutes: 0, sessions: 0, nickname: '', isShiny: shiny, obtainedAt: toSwiftDate() });

/** Gives a species line to the player once (eggs, raids, research, wonder trade). Returns true for a first catch. */
export function awardSpecies(state, s) {
  const already = isUnlocked(state, s);
  addImportedSpecies(state, s);
  const c = canonical(state, s);
  state.unlockedSpeciesIDs ||= [];
  if (!state.unlockedSpeciesIDs.includes(c.id)) state.unlockedSpeciesIDs.push(c.id);
  const legend = legendaryID(c);
  if (!state.pokemonRoster.some((p) => lineKey(p.species) === lineKey(c) || (legend != null && legendaryID(p.species) === legend))) {
    state.pokemonRoster.push(newPokemon(c));
  }
  normalizeTeam(state);
  return !already;
}

// MARK: Economy (EconomyBalance)
export function trainingCoins(minutes, { mega = false, berry = false, goldPoffin = false, pomodoro = false } = {}) {
  if (minutes <= 0) return 0;
  const item = goldPoffin ? 3 : berry ? 2 : 1;
  const multiplier = Math.min(3, (mega ? 1.25 : 1) * item * (pomodoro ? 1.1 : 1));
  return Math.round((minutes / 5) * multiplier);
}
export const shopPrice = (state, s) => (isStarter(s) ? 0 : Math.max(600, canonical(state, s).price * 4));
export const copyPrice = (state, s) => (isStarter(s) ? 150 : Math.max(120, Math.floor(shopPrice(state, s) / 3)));
export const tierFor = (minutes) => (minutes < 30 ? 0 : minutes < 60 ? 1 : minutes < 120 ? 2 : 3);

// MARK: Pokémon of the day
export function pokemonOfTheDay(roster, day = new Date()) {
  if (roster.length <= TEAM_SIZE) return null;
  const candidates = roster.filter((p) => levelFor(p.experience) < 100).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!candidates.length) return null;
  const dayNumber = BigInt(Math.max(0, Math.floor(startOfDay(day).getTime() / 1000 / 86400)));
  const mixed = ((dayNumber * 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn) >> 17n;
  return candidates[Number(mixed % BigInt(candidates.length))].id;
}
export const sharedExperience = (base) => (base > 0 ? Math.max(1, Math.floor((base * SHARE_PERCENT) / 100)) : 0);

// MARK: Team & PC (TeamRules)
export function normalizeTeam(state) {
  const roster = state.pokemonRoster || [];
  const valid = new Set(roster.map((p) => p.id));
  const seen = new Set();
  const team = [];
  for (const id of state.teamPokemonIDs || []) if (valid.has(id) && !seen.has(id) && team.length < TEAM_SIZE) { team.push(id); seen.add(id); }
  const overflow = (state.teamPokemonIDs || []).filter((id) => valid.has(id) && !seen.has(id));
  let boxes = (state.pcBoxes || []).map((box) => ({ ...box, pokemonIDs: box.pokemonIDs.filter((id) => { if (!valid.has(id) || seen.has(id)) return false; seen.add(id); return true; }) }));
  if (!boxes.length) boxes = [{ id: newID(), name: 'Box 1', pokemonIDs: [] }];
  for (const id of [...overflow, ...roster.map((p) => p.id).filter((x) => !seen.has(x))]) {
    seen.add(id);
    if (team.length < TEAM_SIZE) { team.push(id); continue; }
    const free = boxes.find((b) => b.pokemonIDs.length < BOX_CAPACITY);
    if (free) free.pokemonIDs.push(id); else boxes.push({ id: newID(), name: `Box ${boxes.length + 1}`, pokemonIDs: [id] });
  }
  if (boxes.every((b) => b.pokemonIDs.length >= BOX_CAPACITY)) boxes.push({ id: newID(), name: `Box ${boxes.length + 1}`, pokemonIDs: [] });
  state.teamPokemonIDs = team;
  state.pcBoxes = boxes;
  state.expeditions = (state.expeditions || []).filter((t) => valid.has(t.pokemonID) && !team.includes(t.pokemonID));
  if (!team.includes(state.selectedPokemonID)) state.selectedPokemonID = team[0] ?? null;
  normalizeHabitats(state);
  return state;
}
export const findPokemon = (state, id) => state.pokemonRoster.find((p) => p.id === id);
export const boxOf = (state, id) => state.pcBoxes.findIndex((b) => b.pokemonIDs.includes(id));
export const onExpedition = (state, id) => (state.expeditions || []).some((t) => t.pokemonID === id);
export function addToTeam(state, id) {
  if (onExpedition(state, id) || state.teamPokemonIDs.includes(id) || state.teamPokemonIDs.length >= TEAM_SIZE) return false;
  const box = boxOf(state, id);
  if (box >= 0) state.pcBoxes[box].pokemonIDs = state.pcBoxes[box].pokemonIDs.filter((x) => x !== id);
  state.teamPokemonIDs.push(id);
  normalizeHabitats(state);
  return true;
}
export function moveToPC(state, id, running = false) {
  if (!state.teamPokemonIDs.includes(id) || state.teamPokemonIDs.length <= 1 || (running && id === state.selectedPokemonID)) return false;
  state.teamPokemonIDs = state.teamPokemonIDs.filter((x) => x !== id);
  let box = state.pcBoxes.find((b) => b.pokemonIDs.length < BOX_CAPACITY);
  if (!box) { box = { id: newID(), name: `Box ${state.pcBoxes.length + 1}`, pokemonIDs: [] }; state.pcBoxes.push(box); }
  box.pokemonIDs.push(id);
  if (state.selectedPokemonID === id) state.selectedPokemonID = state.teamPokemonIDs[0];
  return true;
}
export function swapIntoTeam(state, boxedID, memberID) {
  const box = boxOf(state, boxedID);
  const slot = state.teamPokemonIDs.indexOf(memberID);
  if (box < 0 || slot < 0 || onExpedition(state, boxedID)) return false;
  const boxSlot = state.pcBoxes[box].pokemonIDs.indexOf(boxedID);
  state.teamPokemonIDs[slot] = boxedID;
  state.pcBoxes[box].pokemonIDs[boxSlot] = memberID;
  if (state.selectedPokemonID === memberID) state.selectedPokemonID = boxedID;
  normalizeHabitats(state);
  return true;
}
export function choosePartner(state, id) {
  if (onExpedition(state, id) || !findPokemon(state, id)) return false;
  if (!state.teamPokemonIDs.includes(id) && !addToTeam(state, id) && !swapIntoTeam(state, id, state.selectedPokemonID ?? state.teamPokemonIDs.at(-1))) return false;
  state.selectedPokemonID = id;
  const p = findPokemon(state, id);
  completePreferences(state);
  state.preferences.pokemonID = id;
  state.preferences.speciesID = canonical(state, p.species).id;
  return true;
}
/** The Mac needs every TrainingPreferences field, so a web-only save gets the Mac's defaults. */
export function completePreferences(state) {
  const partner = findPokemon(state, state.selectedPokemonID);
  state.preferences = {
    duration: 25, speciesID: partner ? canonical(state, partner.species).id : 'oak', tagID: state.tags?.[0]?.id ?? newID(),
    mode: 'Eigenes Pokémon trainieren', pomodoro: false, guardian: 'Standard-Trainer (10s Warnzeit)', strict: false, autoplay: false,
    ...(state.preferences || {}),
  };
  return state;
}
export function sortBox(state, index, order) {
  const box = state.pcBoxes[index];
  const members = box.pokemonIDs.map((id) => findPokemon(state, id)).filter(Boolean);
  const by = {
    level: (a, b) => b.experience - a.experience,
    name: (a, b) => describe(a).name.localeCompare(describe(b).name, 'de'),
    pokedex: (a, b) => describe(a).spriteID - describe(b).spriteID,
    newest: (a, b) => b.obtainedAt - a.obtainedAt,
  }[order];
  box.pokemonIDs = members.sort(by).map((p) => p.id);
}
export function releasePokemon(state, id, running) {
  const p = findPokemon(state, id);
  if (!p || running || onExpedition(state, id)) return false;
  state.unlockedSpeciesIDs ||= [];
  const c = canonical(state, p.species);
  if (!state.unlockedSpeciesIDs.includes(c.id)) state.unlockedSpeciesIDs.push(c.id);
  state.pokemonRoster = state.pokemonRoster.filter((x) => x.id !== id);
  normalizeTeam(state);
  return true;
}
export const isNew = (p, now = new Date()) => now.getTime() - fromSwiftDate(p.obtainedAt).getTime() < 86400000;

// MARK: Types (PokemonType, original types of #1–#1025)
let typeForms = null;
const decodeTypes = (code) => [...code].map((c) => c.charCodeAt(0) - 96).filter((n) => n >= 1 && n <= 18);
/** Type numbers (1 = Normal … 18 = Fee) by Pokédex or PokeAPI form id. */
export function typesOf(dexID) {
  const T = C.types;
  if (dexID >= 1 && dexID <= T.maxDex) return decodeTypes(T.encoded.slice((dexID - 1) * 2, dexID * 2));
  typeForms ||= Object.fromEntries(T.forms.split(';').map((e) => e.split(':')).map(([id, code]) => [Number(id), code]));
  return typeForms[dexID] ? decodeTypes(typeForms[dexID]) : [];
}
export const typeInfo = (n) => C.types.names[n - 1];
export const pokemonTypes = (p) => typesOf(describe(p).spriteID);

// MARK: Lebensräume (PokemonHabitat, HabitatRules)
export const habitatByID = (id) => C.habitats.places.find((h) => h.id === id);
export const habitatUnlocked = (state, h) => totalMinutes(state) >= h.requiredMinutes;
export const habitatFits = (h, p) => pokemonTypes(p).some((t) => h.types.includes(t));
export const residentIDs = (state, h) => state.habitatResidents?.[h.id] || [];
export const residentsOf = (state, h) => residentIDs(state, h).map((id) => findPokemon(state, id)).filter(Boolean);
export const habitatFull = (state, h) => residentIDs(state, h).length >= C.habitats.capacity;
export const habitatOf = (state, id) => C.habitats.places.find((h) => residentIDs(state, h).includes(id)) ?? null;
export const residentExperience = (minutes) => (minutes > 0 ? Math.max(1, Math.floor((minutes * C.habitats.residentSharePercent) / 100)) : 0);
export function normalizeHabitats(state) {
  const team = new Set(state.teamPokemonIDs || []);
  const travelling = new Set((state.expeditions || []).map((t) => t.pokemonID));
  const seen = new Set();
  const result = {};
  for (const h of C.habitats.places) {
    const ids = (state.habitatResidents?.[h.id] || []).filter((id) => {
      const p = findPokemon(state, id);
      if (!p || team.has(id) || travelling.has(id) || seen.has(id) || !habitatFits(h, p)) return false;
      seen.add(id); return true;
    }).slice(0, C.habitats.capacity);
    if (ids.length) result[h.id] = ids;
  }
  state.habitatResidents = result;
  return state;
}
/** PC Pokémon that could move in (also those living elsewhere), strongest first. */
export function habitatCandidates(state, h) {
  const here = new Set(residentIDs(state, h));
  return state.pokemonRoster.filter((p) => !state.teamPokemonIDs.includes(p.id) && !onExpedition(state, p.id) && !here.has(p.id) && habitatFits(h, p))
    .sort((a, b) => b.experience - a.experience || describe(a).name.localeCompare(describe(b).name, 'de'));
}
/** Moves a PC Pokémon in. Returns a message, or null when it is not possible. */
export function placeInHabitat(state, id, h) {
  const p = findPokemon(state, id);
  if (!p || !habitatUnlocked(state, h) || state.teamPokemonIDs.includes(id) || onExpedition(state, id) || !habitatFits(h, p)
    || habitatFull(state, h) || residentIDs(state, h).includes(id)) return null;
  const residents = {};
  for (const [key, ids] of Object.entries(state.habitatResidents || {})) { const rest = ids.filter((x) => x !== id); if (rest.length) residents[key] = rest; }
  residents[h.id] = [...(residents[h.id] || []), id];
  state.habitatResidents = residents;
  state.claimedHabitatIDs ||= [];
  if (habitatFull(state, h) && !state.claimedHabitatIDs.includes(h.id)) {
    state.claimedHabitatIDs.push(h.id); state.claimedHabitatIDs.sort();
    state.coins += C.habitats.firstFillReward;
    return `${h.name} ist voll! +${C.habitats.firstFillReward} PokéMünzen. Partner vom Typ ${h.types.map((t) => typeInfo(t).name).join(', ')} bekommen jetzt +${C.habitats.fullHabitatBonusPercent} % EP.`;
  }
  return `${describe(p).name} lebt jetzt ${h.locative}.`;
}
export function removeFromHabitat(state, id) {
  const residents = {};
  for (const [key, ids] of Object.entries(state.habitatResidents || {})) { const rest = ids.filter((x) => x !== id); if (rest.length) residents[key] = rest; }
  state.habitatResidents = residents;
}
/** The full habitat that boosts the partner this round, if any. */
export function partnerHabitatBonus(state, s) {
  if (s.mode !== 'owned') return null;
  const p = findPokemon(state, state.selectedPokemonID);
  return p ? C.habitats.places.find((h) => habitatFull(state, h) && habitatFits(h, p)) ?? null : null;
}

// MARK: Expeditions
export const EXPEDITIONS = {
  meadow: { title: 'Beerenwiese', goal: 60, coins: 5, berries: ['sananabeere'], icon: '🍓' },
  coast: { title: 'Küstenpfad', goal: 150, coins: 12, berries: ['epbeere'], icon: '🌊' },
  mountain: { title: 'Bergexpedition', goal: 300, coins: 25, berries: ['schillerpin', 'sananabeere'], icon: '⛰️' },
};
export const berryName = (id) => C.berries.find((b) => b.id === id)?.name ?? id;
export function startExpedition(state, id, kind) {
  state.expeditions ||= [];
  if (state.expeditions.length >= MAX_EXPEDITIONS || state.teamPokemonIDs.includes(id) || onExpedition(state, id) || !findPokemon(state, id)) return false;
  state.expeditions.push({ id: newID(), pokemonID: id, kind, progressMinutes: 0, startedAt: toSwiftDate() });
  normalizeHabitats(state);
  return true;
}
export function recallExpedition(state, tripID) { state.expeditions = (state.expeditions || []).filter((t) => t.id !== tripID); }
export function claimExpedition(state, tripID) {
  const trip = (state.expeditions || []).find((t) => t.id === tripID);
  if (!trip) return null;
  const kind = EXPEDITIONS[trip.kind];
  if (trip.progressMinutes < kind.goal) return null;
  state.coins += kind.coins;
  state.berryInventory ||= {};
  for (const berry of kind.berries) state.berryInventory[berry] = (state.berryInventory[berry] || 0) + 1;
  const explorer = findPokemon(state, trip.pokemonID);
  const evolutions = [];
  if (explorer) {
    const before = describe(explorer);
    explorer.experience = capXP(explorer.experience + kind.goal / 2);
    const after = describe(explorer);
    if (after.stage > before.stage) evolutions.push(evolutionEvent(explorer, before, after));
  }
  recallExpedition(state, tripID);
  return { kind, name: explorer ? describe(explorer).name : 'Dein Pokémon', evolutions };
}
function evolutionEvent(pokemon, before, after) {
  return { id: pokemon.id, fromName: pokemon.nickname || before.formName, toName: after.formName, fromSpriteID: before.spriteID, toSpriteID: after.spriteID, shiny: pokemon.isShiny };
}

// MARK: Daily quests (DailyQuest)
export function refreshQuests(state, now = new Date()) {
  const questDay = state.questDate != null ? fromSwiftDate(state.questDate) : null;
  if (!questDay || !sameDay(questDay, now) || !state.dailyQuests?.length) {
    state.questDate = toSwiftDate(now);
    state.dailyQuests = C.quests.map((q) => ({ ...q, id: newID(), currentValue: 0, isClaimed: false }));
    return true;
  }
  return false;
}
function recordQuest(q, { minutes, stage, mega, goalReached }) {
  if (q.isClaimed) return;
  if (q.kind === 'minutes') q.currentValue += Math.max(0, minutes);
  else if (q.kind === 'sessions') q.currentValue += 1;
  else if (q.kind === 'evolution') { if (stage >= 2) q.currentValue += 1; }
  else if (q.kind === 'dailyGoal') { if (goalReached || mega) q.currentValue = 1; }
  q.currentValue = Math.min(q.targetValue, q.currentValue);
}
export function claimQuest(state, id) {
  const q = state.dailyQuests.find((x) => x.id === id);
  if (!q || q.isClaimed || q.currentValue < q.targetValue) return 0;
  q.isClaimed = true;
  const reward = C.quests.find((d) => d.kind === q.kind)?.rewardCoins ?? Math.min(20, q.rewardCoins);
  state.coins += reward;
  return reward;
}

// MARK: Raids (RaidCampaign)
export function ensureRaids(state) {
  if (!state.raidCampaign) {
    const bosses = structuredClone(C.raidBosses);
    state.raidCampaign = { bosses, selectedBossID: pick(bosses).pokedexID, legacyDefeats: 0 };
  }
  const known = new Set(state.raidCampaign.bosses.map((b) => b.pokedexID));
  for (const b of C.raidBosses) if (!known.has(b.pokedexID)) state.raidCampaign.bosses.push(structuredClone(b));
}
export const activeBoss = (state) => state.raidCampaign.bosses.find((b) => b.pokedexID === state.raidCampaign.selectedBossID) ?? state.raidCampaign.bosses[0];
export function selectBoss(state, id) { if (state.raidCampaign.bosses.some((b) => b.pokedexID === id)) state.raidCampaign.selectedBossID = id; }
function damageBoss(state, damage) {
  const c = state.raidCampaign;
  const boss = activeBoss(state);
  if (damage <= 0 || !boss) return null;
  boss.currentHP = Math.max(0, boss.currentHP - Math.min(damage, boss.currentHP));
  if (boss.currentHP > 0) return null;
  boss.defeatedCount += 1;
  const defeated = structuredClone(boss);
  boss.currentHP = boss.maxHP;
  const exclude = new Set(unlockedSpecies(state).map(legendaryID).filter((x) => x != null));
  const fresh = c.bosses.filter((b) => b.defeatedCount === 0 && !exclude.has(b.pokedexID));
  const candidates = fresh.length ? fresh : c.bosses.filter((b) => b.pokedexID !== defeated.pokedexID);
  if (candidates.length) c.selectedBossID = pick(candidates).pokedexID;
  return defeated;
}

// MARK: Badges (kantoGymBadges)
export function badges(state, now = new Date()) {
  const wins = survived(state);
  const mins = totalMinutes(state);
  const stage3 = wins.filter((t) => evolvedStage(t) === 3).length;
  const shinies = wins.filter((t) => t.isShiny).length;
  const megas = wins.filter((t) => t.durationMinutes >= 90).length;
  const daycare = Math.max(1, ...(state.daycareSlots || []).map((d) => d.affectionLevel));
  const lines = unlockedSpecies(state).length;
  const raids = raidWins(state);
  const streak = streakDays(state, now);
  const sinnoh = unlockedSpecies(state).filter((s) => spriteFor(s, 1) >= 387 && spriteFor(s, 1) <= 493).length;
  const bestLevel = Math.max(0, ...state.pokemonRoster.map((p) => levelFor(p.experience)));
  const b = (id, name, region, leader, text, color, earned) => ({ id, name, region, leader, text, color, earned });
  const list = [
    b('boulder', 'Felsorden', 'Kanto', 'Rocko', 'Erste Fokus-Sitzung erfolgreich abgeschlossen', '#A8A29E', wins.length >= 1),
    b('cascade', 'Quellorden', 'Kanto', 'Misty', '60 Fokus-Minuten gesammelt', '#38BDF8', mins >= 60),
    b('thunder', 'Donnerorden', 'Kanto', 'Major Bob', '5 Trainings oder Begegnungen erfolgreich abgeschlossen', '#FACC15', wins.length >= 5),
    b('rainbow', 'Farborden', 'Kanto', 'Erika', '240 Fokus-Minuten gesammelt', '#4ADE80', mins >= 240),
    b('soul', 'Seelenorden', 'Kanto', 'Koga', 'Ein Pokémon auf Stufe 3 trainiert', '#F472B6', stage3 >= 1),
    b('marsh', 'Sumpforden', 'Kanto', 'Sabrina', '5 Pokémon-Linien freigeschaltet', '#C084FC', lines >= 5),
    b('volcano', 'Vulkanorden', 'Kanto', 'Pyro', 'Ein Shiny-Pokémon gefangen oder einen Raid-Boss besiegt', '#F97316', shinies >= 1 || raids >= 1),
    b('earth', 'Erdorden', 'Kanto', 'Giovanni', '600 Fokus-Minuten gesammelt', '#10B981', mins >= 600),
    b('zephyr', 'Flügelorden', 'Johto', 'Falk', `Tagesziel (${dailyGoal(state)} Min) an einem Tag erreicht`, '#60A5FA', todayMinutes(state, now) >= dailyGoal(state)),
    b('fog', 'Phantomorden', 'Johto', 'Jens', '2 Shiny-Pokémon in der Sammlung', '#818CF8', shinies >= 2),
    b('mineral', 'Stahlorden', 'Johto', 'Jasmin', '7 Tage Fokus-Serie oder 20 erfolgreiche Sitzungen', '#94A3B8', streak >= 7 || wins.length >= 20),
    b('rising', 'Drachenorden', 'Johto', 'Sandra', 'Eine Sitzung mit mindestens 90 Minuten', '#F43F5E', megas >= 1),
    b('stone', 'Steinorden', 'Hoenn', 'Felizia', 'Pension-Zuneigung auf Level 5 gebracht', '#FB923C', daycare >= 5),
    b('feather', 'Federorden', 'Hoenn', 'Wibke', '10 Pokémon-Linien freigeschaltet', '#38BDF8', lines >= 10),
    b('mind', 'Mentalorden', 'Hoenn', 'Ben & Svenja', '2 Raid-Siege und 1.000 Fokus-Minuten', '#E879F9', raids >= 2 && mins >= 1000),
    b('rain', 'Schauerorden', 'Hoenn', 'Wassili', '1.500 Fokus-Minuten gesammelt', '#FBBF24', mins >= 1500),
    b('sinnoh-coal', 'Kohleorden', 'Sinnoh', 'Veit · Erzelingen', '2.000 Fokus-Minuten gesammelt', '#A58A6C', mins >= 2000),
    b('sinnoh-forest', 'Waldorden', 'Sinnoh', 'Silvana · Ewigenau', '2.500 Fokus-Minuten gesammelt', '#75AF57', mins >= 2500),
    b('sinnoh-cobble', 'Bergorden', 'Sinnoh', 'Hilda · Schleiede', '40 erfolgreiche Trainings oder Begegnungen', '#DB8874', wins.length >= 40),
    b('sinnoh-fen', 'Fennorden', 'Sinnoh', 'Marinus · Weideburg', '3.000 Fokus-Minuten gesammelt', '#5BB7B4', mins >= 3000),
    b('sinnoh-relic', 'Reliktorden', 'Sinnoh', 'Lamina · Herzhofen', '3 Pokémon-Linien mit Basisform aus Generation 4 freigeschaltet', '#AD86C4', sinnoh >= 3),
    b('sinnoh-mine', 'Minenorden', 'Sinnoh', 'Adam · Fleetburg', '3.500 Fokus-Minuten und 3 Raid-Siege', '#B0A4A4', mins >= 3500 && raids >= 3),
    b('sinnoh-icicle', 'Firnorden', 'Sinnoh', 'Frida · Blizzach', '14 Tage Fokus-Serie oder 60 erfolgreiche Sitzungen', '#8AD5E7', streak >= 14 || wins.length >= 60),
    b('sinnoh-beacon', 'Lichtorden', 'Sinnoh', 'Volkner · Sonnewik', '5.000 Fokus-Minuten gesammelt', '#F3D366', mins >= 5000),
    b('champ-team', 'Teamorden', 'Champ-Liga', 'Volles Team', '6 Pokémon gleichzeitig im Team', '#22C55E', state.teamPokemonIDs.length >= TEAM_SIZE),
    b('champ-level', 'Meisterorden', 'Champ-Liga', 'Starker Partner', 'Ein Pokémon auf Level 50 gebracht', '#EF4444', bestLevel >= 50),
    b('champ-collector', 'Sammlerorden', 'Champ-Liga', 'Voller PC', '30 Pokémon gesammelt', '#3B82F6', state.pokemonRoster.length >= 30),
    b('champ-marathon', 'Marathonorden', 'Champ-Liga', 'Ausdauer', '7.500 Fokus-Minuten gesammelt', '#F59E0B', mins >= 7500),
    b('champ-streak', 'Serienorden', 'Champ-Liga', 'Beständigkeit', '30 Tage Fokus-Serie', '#A855F7', streak >= 30),
    b('champ-champion', 'Championorden', 'Champ-Liga', 'Champ', '10.000 Fokus-Minuten gesammelt', '#EAB308', mins >= 10000),
  ];
  const stored = new Set(state.earnedGymBadgeIDs || []);
  return list.map((x) => ({ ...x, earned: x.earned || stored.has(x.id) }));
}
export function refreshBadges(state, now) {
  const earned = badges(state, now).filter((x) => x.earned).map((x) => x.id);
  state.earnedGymBadgeIDs = [...new Set([...(state.earnedGymBadgeIDs || []), ...earned])];
}

// MARK: Biomes
export function biomeUnlocked(state, biome) {
  return !!state.safariPreviewEnabled || (state.unlockedBiomeIDs || []).includes(biome.id)
    || (totalMinutes(state) >= biome.requiredMinutes && (!biome.needsRaid || raidWins(state) >= 1));
}
function unlockBiomes(state) {
  state.unlockedBiomeIDs ||= [];
  for (const b of C.biomes) if (totalMinutes(state) >= b.requiredMinutes && (!b.needsRaid || raidWins(state) >= 1) && !state.unlockedBiomeIDs.includes(b.id)) state.unlockedBiomeIDs.push(b.id);
}

// MARK: Research (RegionalResearchMission)
function familyMatches(family, entry) {
  return entry.survived && !entry.wasWildEncounter && family.allowedIDs.includes(spriteFor(entry.species, evolvedStage(entry)));
}
export const missionFamilies = (m) => m.familyIDs.map((id) => C.familyByID[id]);
export function researchProgress(state, mission) {
  const families = missionFamilies(mission);
  const entries = (state.plantedTrees || []).filter((e) => families.some((f) => familyMatches(f, e)));
  const minutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const sessions = entries.length;
  const famCount = families.filter((f) => entries.some((e) => familyMatches(f, e))).length;
  const complete = minutes >= mission.requiredMinutes && sessions >= mission.requiredSessions && famCount >= mission.requiredFamilies;
  const fraction = Math.min(1, minutes / mission.requiredMinutes, sessions / mission.requiredSessions, famCount / mission.requiredFamilies);
  const parts = [];
  if (mission.requiredMinutes > minutes) parts.push(`${mission.requiredMinutes - minutes} Min`);
  if (mission.requiredSessions > sessions) { const n = mission.requiredSessions - sessions; parts.push(`${n} Runde${n === 1 ? '' : 'n'}`); }
  if (mission.requiredFamilies > famCount) { const n = mission.requiredFamilies - famCount; parts.push(`${n} Pokémon-Familie${n === 1 ? '' : 'n'}`); }
  return { minutes, sessions, famCount, complete, fraction, remainingText: complete ? 'Forschung abgeschlossen · Belohnung bereit' : `Noch ${parts.join(' · ')}` };
}
export function claimResearch(state, missionID) {
  const m = C.research.missions.find((x) => x.id === missionID);
  state.claimedResearchIDs ||= [];
  if (!m || state.claimedResearchIDs.includes(m.id) || !researchProgress(state, m).complete) return null;
  state.claimedResearchIDs.push(m.id);
  state.coins += m.rewardCoins;
  if (m.rewardBerry) { state.berryInventory ||= {}; state.berryInventory[m.rewardBerry] = (state.berryInventory[m.rewardBerry] || 0) + 1; }
  if (m.reward) awardSpecies(state, m.reward);
  if (state.trackedResearchID === m.id) state.trackedResearchID = null;
  refreshBadges(state);
  return `${C.regionByID[m.region].professor} bedankt sich: +${m.rewardCoins} PokéMünzen${m.reward ? ` und ${m.reward.displayName}` : ''}.`;
}
export function canClaimRegion(state, regionID) {
  const done = new Set(state.claimedResearchIDs || []);
  return !(state.claimedResearchRegionIDs || []).includes(regionID) && C.research.missions.filter((m) => m.region === regionID).every((m) => done.has(m.id));
}
export function claimRegion(state, regionID) {
  if (!canClaimRegion(state, regionID)) return null;
  const region = C.regionByID[regionID];
  state.claimedResearchRegionIDs ||= [];
  state.claimedResearchRegionIDs.push(regionID);
  state.coins += RESEARCH_REGION_COINS;
  state.berryInventory ||= {};
  state.berryInventory.schillerpin = (state.berryInventory.schillerpin || 0) + 2;
  if (region.completionPartner) awardSpecies(state, region.completionPartner);
  refreshBadges(state);
  return `${region.title}-Reise abgeschlossen! +100 PokéMünzen, 2 Schiller-Essenzen${region.completionPartner ? ` und ${region.completionPartner.displayName}` : ''}.`;
}

// MARK: Weekly league (WeeklyLeagueProgress, ISO week, Monday start)
export function weeklyLeague(state, now = new Date()) {
  const day = startOfDay(now);
  const offset = (day.getDay() + 6) % 7;
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const goal = Math.max(60, Math.min(3000, state.weeklyLeagueGoal ?? 300));
  const minutes = survived(state).filter((t) => { const d = entryDate(t); return d >= start && d <= now && d < end; }).reduce((s, t) => s + t.durationMinutes, 0);
  const weekKey = `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`;
  return { minutes, goal, weekKey, end, complete: minutes >= goal, claimed: (state.claimedLeagueWeeks || []).includes(weekKey) };
}
export function claimLeague(state) {
  const league = weeklyLeague(state);
  if (!league.complete || league.claimed) return false;
  state.claimedLeagueWeeks ||= [];
  state.claimedLeagueWeeks.push(league.weekKey);
  state.coins += 40;
  return true;
}

// MARK: Shop
export function unlockLine(state, s) {
  const c = canonical(state, s);
  if (!isDiscovered(state, c) || isUnlocked(state, c) || legendaryID(c) != null || state.coins < shopPrice(state, c)) return false;
  state.coins -= shopPrice(state, c);
  state.unlockedSpeciesIDs ||= [];
  state.unlockedSpeciesIDs.push(c.id);
  const p = newPokemon(c);
  state.pokemonRoster.push(p);
  normalizeTeam(state);
  refreshBadges(state);
  return p.id;
}
export function adoptCopy(state, s) {
  const c = canonical(state, s);
  if (!isUnlocked(state, c) || legendaryID(c) != null || state.coins < copyPrice(state, c)) return false;
  state.coins -= copyPrice(state, c);
  state.pokemonRoster.push(newPokemon(c));
  normalizeTeam(state);
  return true;
}
export function buyBerry(state, id) {
  const berry = C.berries.find((b) => b.id === id);
  if (!berry || state.coins < berry.price) return false;
  state.coins -= berry.price;
  state.berryInventory ||= {};
  state.berryInventory[id] = (state.berryInventory[id] || 0) + 1;
  return true;
}
export function craftPoffin(state, meta, poffinID, mode, running) {
  const poffin = C.poffins.find((p) => p.id === poffinID);
  if (!poffin || running) return 'Knursp werden vor dem Training gebacken.';
  if (poffin.berries[0] === 'himmihbeere' && poffin.berries[1] === 'schillerpin' && mode !== 'wild') return 'Der Meister-Knursp wirkt nur bei wilden Begegnungen. Wähle zuerst „Wilde Begegnung“.';
  const inv = state.berryInventory || {};
  if ((inv[poffin.berries[0]] || 0) < 1 || (inv[poffin.berries[1]] || 0) < 1) return `Dafür brauchst du ${poffin.recipe}.`;
  inv[poffin.berries[0]] -= 1;
  inv[poffin.berries[1]] -= 1;
  meta.poffin = poffinID;
  return null;
}
export function wonderTrade(state) {
  if (state.coins < WONDER_TRADE_PRICE) return `Nicht genug PokéMünzen (${WONDER_TRADE_PRICE} für Wunder-Tausch benötigt).`;
  state.coins -= WONDER_TRADE_PRICE;
  const locked = availableSpecies(state).filter((s) => !isUnlocked(state, s) && legendaryID(s) == null);
  const roll = randomInt(1, 100);
  if (roll <= 45 && locked.length) {
    const won = pick(locked);
    awardSpecies(state, won);
    return `Jackpot im Wunder-Tausch! Du hast ${won.displayName} (Wert: ${shopPrice(state, won)} Münzen) erhalten!`;
  }
  state.berryInventory ||= {};
  if (roll <= 75) {
    state.berryInventory.schillerpin = (state.berryInventory.schillerpin || 0) + 1;
    state.berryInventory.sananabeere = (state.berryInventory.sananabeere || 0) + 1;
    return 'Wunder-Tausch: 1× Schiller-Essenz und 1× Sananabeere erhalten!';
  }
  const bonus = randomInt(50, 90);
  state.coins += bonus;
  return `Wunder-Tausch: Ein seltenes Nugget (+${bonus} PokéMünzen) erhalten!`;
}
export function avatarCapsule(state) {
  state.unlockedAvatarIDs ||= ['av-pikachu', 'av-eevee'];
  const locked = C.avatars.filter((a) => !state.unlockedAvatarIDs.includes(a.id));
  if (!locked.length) return `Du besitzt bereits alle ${C.avatars.length} Profilbilder!`;
  if (state.coins < AVATAR_CAPSULE_PRICE) return `Nicht genug PokéMünzen (${AVATAR_CAPSULE_PRICE} für eine Profilbild-Kapsel benötigt).`;
  state.coins -= AVATAR_CAPSULE_PRICE;
  const won = pick(locked);
  state.unlockedAvatarIDs.push(won.id);
  state.selectedAvatarID = won.id;
  return `Neues Profilbild gezogen: ${won.name} (${won.rarity})! Es ist direkt ausgerüstet.`;
}
export const currentAvatar = (state) => C.avatars.find((a) => a.id === state.selectedAvatarID) ?? C.avatars[0];

// MARK: Berries before training
export function berryProblem(state, berryID, mode, running) {
  if (running) return 'Beeren werden vor dem Training ausgewählt.';
  if (state.activeBerryBuff) return 'Es ist bereits eine Beere bereitgelegt.';
  if (berryID === 'schillerpin' && mode !== 'wild') return 'Schiller-Essenz wirkt nur bei neuen wilden Begegnungen.';
  if (berryID === 'epbeere') {
    if (mode !== 'owned') return 'Die EP-Beere wirkt nur beim Training eines eigenen Pokémon.';
    const p = findPokemon(state, state.selectedPokemonID);
    if (!p) return 'Wähle zuerst ein eigenes Pokémon.';
    if (levelFor(p.experience) === 100) return 'Dieses Pokémon hat bereits Level 100 erreicht.';
  }
  return null;
}
export function activateBerry(state, id, mode, running) {
  const count = state.berryInventory?.[id] || 0;
  if (!count || berryProblem(state, id, mode, running)) return false;
  state.berryInventory[id] = count - 1;
  state.activeBerryBuff = id;
  return true;
}
export function returnBerry(state, running) {
  if (running || !state.activeBerryBuff) return false;
  state.berryInventory[state.activeBerryBuff] = (state.berryInventory[state.activeBerryBuff] || 0) + 1;
  state.activeBerryBuff = null;
  return true;
}

// MARK: Pomodoro (PomodoroPlan)
export function normalizePlan(plan = {}) {
  const rounds = Math.min(8, Math.max(2, plan.rounds ?? 4));
  const focus = Math.floor((Math.min(60, Math.max(15, plan.focusMinutes ?? 25)) + 2) / 5) * 5;
  const breakMinutes = Math.min(15, Math.max(1, plan.breakMinutes ?? 5));
  return { rounds, focusMinutes: focus, breakMinutes };
}
export const planCompletionXP = (p) => Math.floor((p.rounds * p.focusMinutes) / 2);

// MARK: Previews for the training screen
export function shinyPercent(state, session) {
  if (session.mode !== 'wild') return 0;
  if (session.poffin === 'zeit') return 50;
  if (session.poffin === 'gold') return 35;
  if (state.activeBerryBuff === 'schillerpin') return 25;
  return 8 + Math.min(10, streakDays(state) * 2) + (session.minutes >= 90 ? 7 : 0);
}
export const poffinKey = (id) => (id?.startsWith('Gold') ? 'gold' : id?.startsWith('Drachen') ? 'dragon' : id?.startsWith('Meister') ? 'zeit' : null);

/** Pokémon EP for the partner this round, before the level-100 cap (pokemonExperienceBonus + minutes). */
export function partnerEP(state, s) {
  if (s.mode !== 'owned') return { base: 0, bonus: 0, day: 0 };
  const p = findPokemon(state, state.selectedPokemonID);
  if (!p) return { base: 0, bonus: 0, day: 0 };
  const pomodoroBonus = s.pomodoro ? s.minutes + (s.round === s.pomodoro.rounds ? planCompletionXP(s.pomodoro) : 0) : 0;
  const berry = state.activeBerryBuff === 'epbeere' ? s.minutes : 0;
  const day = pokemonOfTheDay(state.pokemonRoster) === p.id ? Math.floor((s.minutes * DAY_BONUS_PERCENT) / 100) : 0;
  const habitat = partnerHabitatBonus(state, s) ? Math.floor((s.minutes * C.habitats.fullHabitatBonusPercent) / 100) : 0;
  return { base: s.minutes, bonus: pomodoroBonus + berry + day + habitat, day, habitat };
}
export function coinPreview(state, s) {
  return trainingCoins(s.minutes, { mega: s.minutes >= 90, berry: state.activeBerryBuff === 'sananabeere', goldPoffin: s.poffin === 'gold', pomodoro: !!s.pomodoro });
}

// MARK: Wild encounters (NationalDexImporter)
export function randomWildDexID(minutes, ownedLegends) {
  const tier = tierFor(minutes);
  const ordinary = Array.from({ length: 1025 }, (_, i) => i + 1).filter((id) => !C.legendary.has(id));
  if (tier === 0) return randomInt(1, 100) <= 40 ? pick(ordinary) : pick(C.wild.common);
  if (tier === 1) return randomInt(1, 100) <= 25 ? pick(ordinary) : pick(C.wild.rare.filter((id) => !C.legendary.has(id)));
  if (tier === 2) return pick(C.wild.epic);
  const unowned = [...C.legendary].sort((a, b) => a - b).filter((id) => !ownedLegends.has(id));
  if (randomInt(1, 100) <= 10 && unowned.length) return pick(unowned);
  return pick(C.wild.epic);
}
const COLORS = { red: ['#F55C47', '#C93B2B'], blue: ['#3DA8F5', '#2970C7'], yellow: ['#FACC2E', '#E0991A'], green: ['#47C77A', '#298F5C'], purple: ['#A661EB', '#7038AD'], pink: ['#EB85C7', '#C44D99'], brown: ['#C78C56', '#8F5D30'], gray: ['#7C8B99', '#4B5663'], black: ['#7C8B99', '#4B5663'], white: ['#8AD6EB', '#58A3BD'] };
/** Loads every evolution branch of a random wild Pokémon from PokeAPI, like the Mac. */
export async function fetchWildEncounter(state, minutes) {
  const dexID = randomWildDexID(minutes, ownedLegendaryIDs(state));
  const tier = C.tiers[tierFor(minutes)];
  const get = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`PokeAPI ${r.status}`); return r.json(); };
  const species = await get(`https://pokeapi.co/api/v2/pokemon-species/${dexID}/`);
  const chain = await get(species.evolution_chain.url);
  const idOf = (url) => Number(url.split('/').filter(Boolean).at(-1));
  const paths = [];
  const walk = (link, path) => { const next = [...path, idOf(link.species.url)]; if (!link.evolves_to.length) paths.push(next); else link.evolves_to.forEach((c) => walk(c, next)); };
  walk(chain.chain, []);
  const matching = paths.filter((p) => p.includes(species.id));
  const all = matching.length ? matching : paths;
  const cache = {};
  const branches = [];
  for (const path of all.slice(0, 5)) {
    const stages = [];
    let color = species.color?.name ?? 'green';
    for (const id of path.slice(0, 3)) {
      if (!cache[id]) {
        const info = id === species.id ? species : await get(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
        cache[id] = { name: info.names.find((n) => n.language.name === 'de')?.name ?? info.names.find((n) => n.language.name === 'en')?.name ?? info.name, color: info.color?.name ?? 'green' };
      }
      color = cache[id].color;
      stages.push({ pokedexID: id, name: cache[id].name });
    }
    const [first, last] = [stages[0], stages.at(-1)];
    const [hex1, hex2] = COLORS[color] ?? COLORS.green;
    const title = all.length > 1 && stages.length > 1 ? `${first.name} → ${last.name} (#${first.pokedexID})` : stages.length > 1 ? `${first.name}-Linie (#${first.pokedexID})` : `${first.name} (#${first.pokedexID})`;
    branches.push({ id: `dex-${stages.map((x) => x.pokedexID).join('-')}`, displayName: title, stages, price: tier.price, primaryHex: hex1, secondaryHex: hex2, elementType: tier.id, loreText: `In der Wildnis entdeckt! Basis-Stufe: ${first.name} (#${first.pokedexID}).` });
  }
  return branches;
}

// MARK: Sessions (startFocusSession / tick / completeSessionSuccess / giveUpSession)
/**
 * A running session lives in `session` (stored separately from the save):
 * { mode, minutes, endsAt, pausedUntil, remainingMs, everstoneUsed, pomodoro, round, inBreak, breakEndsAt,
 *   poffin, tagID, note, biomeID, wildBranches, strict }
 */
export function createSession(state, meta, now = Date.now()) {
  const mode = meta.mode ?? 'owned';
  if (mode === 'owned' && !findPokemon(state, state.selectedPokemonID)) return { error: 'Wähle zuerst ein eigenes Pokémon.' };
  if (state.activeBerryBuff) {
    const saved = state.activeBerryBuff; state.activeBerryBuff = null;
    const problem = berryProblem(state, saved, mode, false);
    state.activeBerryBuff = saved;
    if (problem) return { error: `${problem} Lege die Beere zurück oder wähle einen passenden Partner.` };
  }
  refreshQuests(state);
  const pomodoro = meta.pomodoroEnabled ? normalizePlan(meta.pomodoro) : null;
  const minutes = pomodoro ? pomodoro.focusMinutes : meta.minutes;
  return { session: { mode, minutes, endsAt: now + minutes * 60000, pausedUntil: null, remainingMs: null, everstoneUsed: false, pomodoro, round: 1,
    inBreak: false, breakEndsAt: null, poffin: poffinKey(meta.poffin), tagID: meta.tagID, note: meta.note || '', biomeID: state.selectedBiome ?? null,
    partnerID: state.selectedPokemonID, wildBranches: null, strict: !!meta.strict } };
}
export function toggleEverstone(s, now = Date.now()) {
  if (s.inBreak) return false;
  if (s.pausedUntil) { s.endsAt = now + s.remainingMs; s.pausedUntil = null; s.remainingMs = null; return true; }
  if (s.everstoneUsed) return false;
  s.remainingMs = Math.max(0, s.endsAt - now);
  s.pausedUntil = now + EVERSTONE_SECONDS * 1000;
  s.everstoneUsed = true;
  return true;
}
/** Advances pauses and breaks. Returns 'complete' when a focus round has run out. */
export function advance(s, now = Date.now()) {
  if (s.inBreak) {
    if (now >= s.breakEndsAt) {
      s.inBreak = false; s.round = Math.min(s.pomodoro.rounds, s.round + 1);
      s.endsAt = s.breakEndsAt + s.minutes * 60000; s.breakEndsAt = null; s.everstoneUsed = false; s.note = ''; s.wildBranches = null;
      return 'round-started';
    }
    return null;
  }
  if (s.pausedUntil) {
    if (now < s.pausedUntil) return null;
    s.endsAt = s.pausedUntil + s.remainingMs; s.pausedUntil = null; s.remainingMs = null;
  }
  return now >= s.endsAt ? 'complete' : null;
}
export function secondsLeft(s, now = Date.now()) {
  if (s.inBreak) return Math.max(0, Math.ceil((s.breakEndsAt - now) / 1000));
  if (s.pausedUntil) return Math.max(0, Math.ceil((s.pausedUntil - now) / 1000));
  return Math.max(0, Math.ceil((s.endsAt - now) / 1000));
}

function tagFor(state, s) {
  const tags = state.tags?.length ? state.tags : C.tags;
  return tags.find((t) => t.id === s.tagID) ?? tags[0];
}

export function completeRound(state, s, now = new Date()) {
  refreshQuests(state, now);
  const wild = s.mode === 'wild';
  const badgesBefore = new Set(badges(state, now).filter((b) => b.earned).map((b) => b.id));
  const trainerBefore = trainerLevel(state);
  const goalBefore = todayMinutes(state, now);
  const levelsBefore = new Map(state.pokemonRoster.map((p) => [p.id, levelFor(p.experience)]));
  const researchReadyBefore = new Set(C.research.missions.filter((m) => researchProgress(state, m).complete).map((m) => m.id));
  const raidHPBefore = activeBoss(state).currentHP;
  const minutes = s.minutes;
  const coins = coinPreview(state, s);
  state.coins += coins;
  const shiny = wild && randomInt(1, 100) <= shinyPercent(state, s);
  const ep = partnerEP(state, s);
  const pomodoroBonusXP = s.pomodoro ? s.minutes + (s.round === s.pomodoro.rounds ? planCompletionXP(s.pomodoro) : 0) : 0;
  const dragon = s.poffin === 'dragon';
  state.activeBerryBuff = null;
  if (wild || s.poffin !== 'zeit') s.poffin = null;

  let individual; let capturedSpecies; let evolutions = [];
  let partner = findPokemon(state, state.selectedPokemonID);
  if (wild) {
    const branches = s.wildBranches?.length ? s.wildBranches : [pick(C.species.slice(0, 8))];
    branches.forEach((b) => addImportedSpecies(state, b));
    capturedSpecies = branches[0];
    const legend = legendaryID(capturedSpecies);
    individual = legend != null ? state.pokemonRoster.find((p) => legendaryID(p.species) === legend) : null;
    if (!individual) { individual = newPokemon(canonical(state, capturedSpecies), shiny); state.pokemonRoster.push(individual); }
    normalizeTeam(state);
  } else {
    const before = describe(partner);
    partner.experience = capXP(partner.experience + s.minutes + ep.bonus);
    partner.trainingMinutes += s.minutes; partner.sessions += 1; partner.lastTrainedAt = toSwiftDate(now);
    const after = describe(partner);
    if (after.stage > before.stage) evolutions.push(evolutionEvent(partner, before, after));
    individual = partner; capturedSpecies = partner.species;
  }
  const d = describe(individual);
  const mega = !wild && d.level >= 50 && d.stage === stageCount(individual.species) && minutes >= 90 && !!megaFor(individual.species);

  const shared = { amount: 0, recipients: [], evolutions: [] };
  if (state.expShareEnabled) {
    shared.amount = sharedExperience(wild ? minutes : minutes + ep.bonus);
    for (const id of state.teamPokemonIDs) {
      const m = findPokemon(state, id);
      if (!m || id === individual.id || levelFor(m.experience) === 100) continue;
      const before = describe(m);
      m.experience = capXP(m.experience + shared.amount);
      const after = describe(m);
      shared.recipients.push(after.name);
      if (after.stage > before.stage) { evolutions.push(evolutionEvent(m, before, after)); shared.evolutions.push(`${before.formName} → ${after.formName}`); }
    }
  }
  const habitatTraining = { amount: residentExperience(minutes), residents: [] };
  for (const h of C.habitats.places) {
    for (const id of state.habitatResidents?.[h.id] || []) {
      const m = findPokemon(state, id);
      if (!m || levelFor(m.experience) === 100) continue;
      const before = describe(m);
      m.experience = capXP(m.experience + habitatTraining.amount);
      const after = describe(m);
      habitatTraining.residents.push(after.name);
      if (after.stage > before.stage) evolutions.push(evolutionEvent(m, before, after));
    }
  }
  const finishedTrips = [];
  for (const trip of state.expeditions || []) {
    const goal = EXPEDITIONS[trip.kind].goal;
    if (trip.progressMinutes >= goal) continue;
    trip.progressMinutes = Math.min(goal, trip.progressMinutes + minutes);
    if (trip.progressMinutes >= goal) finishedTrips.push(describe(findPokemon(state, trip.pokemonID)).name);
  }

  const tag = tagFor(state, s);
  const entry = { id: newID(), species: capturedSpecies, durationMinutes: minutes, timestamp: toSwiftDate(now), survived: true,
    tagName: tag.name, tagColorHex: tag.colorHex, note: s.note || (wild ? `Wilde Begegnung (${C.tiers[tierFor(minutes)].id}) – Basis-Form entdeckt!` : 'Fokus-Training erfolgreich'),
    coinsEarned: coins, isShiny: !!individual.isShiny, isMega: mega && !!megaFor(capturedSpecies), wasWildEncounter: wild, biomeID: s.biomeID,
    pokemonID: individual.id, trainedStage: wild ? 1 : d.stage, trainerBonusXP: pomodoroBonusXP };
  state.plantedTrees ||= [];
  state.plantedTrees.unshift(entry);

  // Eggs, raid, daycare and quests (applySessionProgressToEggsRaidDaycareAndQuests)
  const notes = [];
  const egg = (state.eggs || []).find((e) => !e.isHatched);
  if (egg) {
    egg.accumulatedMinutes += minutes;
    if (egg.accumulatedMinutes >= egg.requiredMinutes) { egg.accumulatedMinutes = egg.requiredMinutes; egg.isHatched = true; awardSpecies(state, egg.rewardSpecies); notes.push(`Ei geschlüpft: ${egg.rewardSpecies.displayName}!`); }
  }
  const raidBonus = wild ? 0 : d.raidBonus;
  const damage = Math.round(minutes * (dragon ? 3 : mega ? 2 : 1) * (1 + raidBonus / 100));
  const defeated = damageBoss(state, damage);
  if (defeated) {
    const reward = C.raidBosses.find((b) => b.pokedexID === defeated.pokedexID)?.rewardCoins ?? 100;
    state.coins += reward;
    const first = awardSpecies(state, defeated.rewardSpecies);
    notes.push(`Raid gewonnen: ${defeated.rewardSpecies.displayName}! +${reward} Münzen${first ? ', neuer Begleiter' : ''}.`);
  }
  for (const slot of state.daycareSlots || []) {
    slot.accumulatedMinutes += minutes;
    const level = 1 + Math.floor(slot.accumulatedMinutes / 30);
    if (level > slot.affectionLevel) { slot.affectionLevel = level; state.coins += 3; }
  }
  const goalReached = todayMinutes(state, now) >= dailyGoal(state);
  for (const q of state.dailyQuests || []) recordQuest(q, { minutes, stage: wild ? 1 : d.stage, mega, goalReached });

  unlockBiomes(state);
  refreshBadges(state, now);
  const newBadges = badges(state, now).filter((b) => b.earned && !badgesBefore.has(b.id)).map((b) => b.name);
  const researchUpdates = C.research.missions.filter((m) => !(state.claimedResearchIDs || []).includes(m.id) && missionFamilies(m).some((f) => familyMatches(f, entry)))
    .map((m) => ({ title: m.title, region: C.regionByID[m.region].title, ready: !researchReadyBefore.has(m.id) && researchProgress(state, m).complete }));
  const levelUps = state.pokemonRoster.filter((p) => levelsBefore.has(p.id) && levelFor(p.experience) > levelsBefore.get(p.id))
    .map((p) => ({ name: describe(p).name, from: levelsBefore.get(p.id), to: levelFor(p.experience) }));
  const trainerAfter = trainerLevel(state);
  if (goalBefore < dailyGoal(state) && goalReached) notes.push(`Tagesziel erreicht: ${todayMinutes(state, now)} / ${dailyGoal(state)} Min`);

  // Pomodoro continuation
  let chainDone = false; let breakStarted = false;
  if (s.pomodoro && s.round < s.pomodoro.rounds) {
    s.inBreak = true; s.breakEndsAt = now.getTime() + s.pomodoro.breakMinutes * 60000; breakStarted = true;
  } else if (s.pomodoro) {
    chainDone = true;
    state.coins += Math.floor((POMODORO_COMPLETION_COINS * s.pomodoro.rounds) / 4);
  }
  return {
    wild, minutes, coins, shiny: !!individual.isShiny, captured: wild ? describe(individual) : null, capturedSpecies,
    partner: d, partnerName: d.name, earned: wild ? 0 : s.minutes + ep.bonus, dayBonus: ep.day || 0, mega,
    shared, habitatTraining, habitatBonus: ep.habitat || 0, finishedTrips, levelUps, evolutions, notes, newBadges, researchUpdates,
    raidDamage: Math.min(raidHPBefore, damage), trainerLevelUp: trainerAfter > trainerBefore ? trainerAfter : null,
    inPC: boxOf(state, individual.id) >= 0 && wild, breakStarted, chainDone, round: s.round,
  };
}

export function failRound(state, s, reason, now = new Date()) {
  state.activeBerryBuff = null;
  if (s.inBreak) return { chainEnded: true };
  const partner = findPokemon(state, state.selectedPokemonID);
  const species = s.mode === 'wild' ? (partner?.species ?? C.species[0]) : partner.species;
  const tag = tagFor(state, s);
  state.plantedTrees ||= [];
  state.plantedTrees.unshift({ id: newID(), species, durationMinutes: s.minutes, timestamp: toSwiftDate(now), survived: false, tagName: tag.name, tagColorHex: tag.colorHex,
    note: s.note ? `${s.note} (${reason})` : reason, coinsEarned: 0, isShiny: false, isMega: false, wasWildEncounter: s.mode === 'wild', biomeID: s.biomeID });
  return { chainEnded: false };
}

// MARK: Stats
export function heatmap(state, days = 28, now = new Date()) {
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    return { date, minutes: survived(state).filter((t) => sameDay(entryDate(t), date)).reduce((s, t) => s + t.durationMinutes, 0) };
  });
}
export function bestHour(state) {
  const buckets = {};
  for (const t of survived(state)) { const h = entryDate(t).getHours(); buckets[h] = (buckets[h] || 0) + t.durationMinutes; }
  const entries = Object.entries(buckets);
  if (!entries.length) return null;
  return Number(entries.sort((a, b) => b[1] - a[1])[0][0]);
}

// MARK: Save handling
export function validateSave(data) {
  if (!data || typeof data !== 'object') return 'Die Datei ist kein PokéForest-Spielstand.';
  if (!Array.isArray(data.pokemonRoster) || !Array.isArray(data.plantedTrees) || typeof data.coins !== 'number') return 'Der Datei fehlen Pokémon oder Münzen. Exportiere sie am Mac neu.';
  for (const p of data.pokemonRoster) if (!p.id || !p.species || !Array.isArray(p.species.stages) || !p.species.stages.length) return 'Ein Pokémon in der Datei ist unvollständig.';
  return null;
}
/** Fills fields a fresh or older save may lack, using the Mac's defaults. */
export function prepareSave(state) {
  state.tags = state.tags?.length ? state.tags : structuredClone(C.tags);
  state.blockedApps ||= []; state.blockedWebsites ||= [];
  state.berryInventory ||= { sananabeere: 1, himmihbeere: 1, schillerpin: 0 };
  state.eggs ||= structuredClone(C.eggs).map((e) => ({ ...e, id: newID() }));
  state.daycareSlots ||= C.species.slice(0, 2).map((species) => ({ id: newID(), species, affectionLevel: 1, accumulatedMinutes: 0 }));
  state.unlockedAvatarIDs ||= ['av-pikachu', 'av-eevee'];
  state.selectedAvatarID ||= 'av-pikachu';
  state.trainerName ||= 'Trainer';
  state.trainerMotto ||= 'Jede Minute Fokus bringt mein Team näher an die Spitze!';
  state.dailyGoalMinutes ??= 90;
  state.weeklyLeagueGoal ??= 300;
  state.selectedBiome ||= C.biomes[0].id;
  state.selectedWeather ||= C.weathers[0];
  state.selectedTimeTheme ||= C.timeThemes[0];
  state.levelCurveVersion = 2;
  state.habitatResidents ||= {};
  state.claimedHabitatIDs ||= [];
  ensureRaids(state);
  refreshQuests(state);
  normalizeTeam(state);
  completePreferences(state);
  return state;
}
export function freshSave() {
  const roster = C.species.slice(0, 3).map((s) => newPokemon(s));
  return prepareSave({
    coins: 100, plantedTrees: [], unlockedSpeciesIDs: ['oak', 'pine', 'sakura'], discoveredSpeciesIDs: ['oak', 'pine', 'sakura'],
    pokemonRoster: roster, teamPokemonIDs: roster.map((p) => p.id), pcBoxes: [], selectedPokemonID: roster[0].id,
    expShareEnabled: false, expeditions: [], unlockedBiomeIDs: [C.biomes[0].id], earnedGymBadgeIDs: [],
  });
}

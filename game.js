// PokéForest game rules for the web app. They mirror the Mac app (Swift) exactly,
// so a save edited here opens on the Mac without surprises.

export const TEAM_SIZE = 6;
export const BOX_CAPACITY = 30;
export const SHARE_PERCENT = 50;
export const DAY_BONUS_PERCENT = 50;
export const MAX_EXPEDITIONS = 2;
// Swift encodes Date as seconds since 2001-01-01 (UTC).
const REFERENCE_EPOCH_MS = 978307200000;

export const toSwiftDate = (date = new Date()) => (date.getTime() - REFERENCE_EPOCH_MS) / 1000;
export const fromSwiftDate = (seconds) => new Date(seconds * 1000 + REFERENCE_EPOCH_MS);
export const newID = () => crypto.randomUUID().toUpperCase();

// MARK: Levels (OwnedPokemon.threshold, 5.3 curve)
export function threshold(level) {
  const steps = Math.max(0, Math.min(99, level - 1));
  return Math.round(0.75 * Math.pow(steps, 1.8) + 4 * steps);
}
export function levelFor(experience) {
  let level = 1;
  for (let l = 1; l <= 100; l++) if (experience >= threshold(l)) level = l;
  return level;
}
export function stageFor(level, stageCount) {
  if (stageCount === 1) return 1;
  if (stageCount === 2) return level >= 20 ? 2 : 1;
  return level >= 36 ? 3 : level >= 16 ? 2 : 1;
}
export function evolutionLevels(stageCount, stage) {
  if (stage >= Math.min(3, stageCount)) return null;
  return stageCount === 2 ? 20 : stage === 1 ? 16 : 36;
}

/** Everything the UI needs to know about one owned Pokémon. */
export function describe(pokemon) {
  const species = pokemon.species;
  const level = levelFor(pokemon.experience);
  const stage = stageFor(level, species.stages.length);
  const info = species.stages[Math.min(stage, species.stages.length) - 1];
  const maxLevel = level === 100;
  const start = threshold(level);
  const end = threshold(level + 1);
  const nextEvolution = evolutionLevels(species.stages.length, stage);
  return {
    level, stage, maxLevel,
    spriteID: info.pokedexID,
    formName: info.name,
    name: pokemon.nickname || info.name,
    progress: maxLevel ? 1 : Math.min(1, Math.max(0, (pokemon.experience - start) / Math.max(1, end - start))),
    toNextLevel: maxLevel ? 0 : Math.max(0, end - pokemon.experience),
    nextEvolutionName: nextEvolution ? species.stages[stage]?.name : null,
    toNextEvolution: nextEvolution ? Math.max(0, threshold(nextEvolution) - pokemon.experience) : null,
  };
}

// MARK: Coins (EconomyBalance.trainingCoins without items)
export function trainingCoins(minutes) {
  if (minutes <= 0) return 0;
  const mega = minutes >= 90 ? 1.25 : 1;
  return Math.round((minutes / 5) * Math.min(3, mega));
}

// MARK: Pokémon of the day (PokemonOfTheDay.pick)
export function pokemonOfTheDay(roster, day = new Date()) {
  if (roster.length <= TEAM_SIZE) return null;
  const candidates = roster.filter((p) => levelFor(p.experience) < 100)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!candidates.length) return null;
  const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayNumber = BigInt(Math.max(0, Math.floor(midnight.getTime() / 1000 / 86400)));
  const mixed = ((dayNumber * 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn) >> 17n;
  return candidates[Number(mixed % BigInt(candidates.length))].id;
}

export const sharedExperience = (base) => (base > 0 ? Math.max(1, Math.floor((base * SHARE_PERCENT) / 100)) : 0);

// MARK: Team & PC (TeamRules.normalized)
export function normalizeTeam(state) {
  const roster = state.pokemonRoster || [];
  const valid = new Set(roster.map((p) => p.id));
  const seen = new Set();
  const team = [];
  for (const id of state.teamPokemonIDs || []) {
    if (valid.has(id) && !seen.has(id) && team.length < TEAM_SIZE) { team.push(id); seen.add(id); }
  }
  const overflow = (state.teamPokemonIDs || []).filter((id) => valid.has(id) && !seen.has(id));
  let boxes = (state.pcBoxes || []).map((box) => ({
    ...box,
    pokemonIDs: box.pokemonIDs.filter((id) => { if (!valid.has(id) || seen.has(id)) return false; seen.add(id); return true; }),
  }));
  if (!boxes.length) boxes = [{ id: newID(), name: 'Box 1', pokemonIDs: [] }];
  for (const id of [...overflow, ...roster.map((p) => p.id).filter((id) => !seen.has(id))]) {
    seen.add(id);
    if (team.length < TEAM_SIZE) { team.push(id); continue; }
    const free = boxes.find((b) => b.pokemonIDs.length < BOX_CAPACITY);
    if (free) free.pokemonIDs.push(id);
    else boxes.push({ id: newID(), name: `Box ${boxes.length + 1}`, pokemonIDs: [id] });
  }
  if (boxes.every((b) => b.pokemonIDs.length >= BOX_CAPACITY)) boxes.push({ id: newID(), name: `Box ${boxes.length + 1}`, pokemonIDs: [] });
  state.teamPokemonIDs = team;
  state.pcBoxes = boxes;
  state.expeditions = (state.expeditions || []).filter((t) => valid.has(t.pokemonID) && !team.includes(t.pokemonID));
  if (!team.includes(state.selectedPokemonID)) state.selectedPokemonID = team[0] ?? null;
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
  return true;
}
export function moveToPC(state, id) {
  if (!state.teamPokemonIDs.includes(id) || state.teamPokemonIDs.length <= 1) return false;
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
  return true;
}
/** Makes a Pokémon the training partner; a PC Pokémon swaps with the old partner if the team is full. */
export function choosePartner(state, id) {
  if (onExpedition(state, id) || !findPokemon(state, id)) return false;
  if (!state.teamPokemonIDs.includes(id)) {
    if (!addToTeam(state, id) && !swapIntoTeam(state, id, state.selectedPokemonID ?? state.teamPokemonIDs.at(-1))) return false;
  }
  state.selectedPokemonID = id;
  const pokemon = findPokemon(state, id);
  if (state.preferences) { state.preferences.pokemonID = id; state.preferences.speciesID = pokemon.species.id; }
  return true;
}

// MARK: Expeditions (ExpeditionKind)
export const EXPEDITIONS = {
  meadow: { title: 'Beerenwiese', goal: 60, coins: 5, berries: ['sananabeere'], icon: '🍓' },
  coast: { title: 'Küstenpfad', goal: 150, coins: 12, berries: ['epbeere'], icon: '🌊' },
  mountain: { title: 'Bergexpedition', goal: 300, coins: 25, berries: ['schillerpin', 'sananabeere'], icon: '⛰️' },
};
export const BERRY_NAMES = { sananabeere: 'Sananabeere', himmihbeere: 'Himmihbeere', schillerpin: 'Schiller-Essenz', epbeere: 'EP-Beere' };

export function startExpedition(state, id, kind) {
  state.expeditions ||= [];
  if (state.expeditions.length >= MAX_EXPEDITIONS || state.teamPokemonIDs.includes(id) || onExpedition(state, id) || !findPokemon(state, id)) return false;
  state.expeditions.push({ id: newID(), pokemonID: id, kind, progressMinutes: 0, startedAt: toSwiftDate() });
  return true;
}
export function recallExpedition(state, tripID) {
  state.expeditions = (state.expeditions || []).filter((t) => t.id !== tripID);
}
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
    explorer.experience = Math.min(threshold(100), explorer.experience + kind.goal / 2);
    const after = describe(explorer);
    if (after.stage > before.stage) evolutions.push(evolutionEvent(explorer, before, after));
  }
  recallExpedition(state, tripID);
  return { kind, name: explorer ? describe(explorer).name : 'Dein Pokémon', evolutions };
}

function evolutionEvent(pokemon, before, after) {
  return { id: pokemon.id, fromName: pokemon.nickname || before.formName, toName: after.formName,
    fromSpriteID: before.spriteID, toSpriteID: after.spriteID, shiny: pokemon.isShiny };
}

// MARK: Finishing a focus round (ForestStore.completeSessionSuccess, owned training)
/**
 * Applies a successful round of `minutes` with the current partner.
 * Returns what happened so the UI can celebrate it.
 */
export function completeRound(state, minutes, now = new Date()) {
  const partner = findPokemon(state, state.selectedPokemonID);
  if (!partner) throw new Error('Kein Trainingspartner gewählt');
  const before = new Map(state.pokemonRoster.map((p) => [p.id, describe(p)]));
  const dayBonus = pokemonOfTheDay(state.pokemonRoster, now) === partner.id ? Math.floor((minutes * DAY_BONUS_PERCENT) / 100) : 0;
  const coins = trainingCoins(minutes);
  state.coins += coins;

  partner.experience = Math.min(threshold(100), Math.max(0, partner.experience) + minutes + dayBonus);
  partner.trainingMinutes += minutes;
  partner.sessions += 1;
  partner.lastTrainedAt = toSwiftDate(now);

  const shared = { amount: 0, recipients: [] };
  if (state.expShareEnabled) {
    shared.amount = sharedExperience(minutes + dayBonus);
    for (const id of state.teamPokemonIDs) {
      const member = findPokemon(state, id);
      if (!member || id === partner.id || levelFor(member.experience) === 100) continue;
      member.experience = Math.min(threshold(100), member.experience + shared.amount);
      shared.recipients.push(describe(member).name);
    }
  }

  const finishedTrips = [];
  for (const trip of state.expeditions || []) {
    const goal = EXPEDITIONS[trip.kind].goal;
    if (trip.progressMinutes >= goal) continue;
    trip.progressMinutes = Math.min(goal, trip.progressMinutes + minutes);
    if (trip.progressMinutes >= goal) finishedTrips.push(describe(findPokemon(state, trip.pokemonID)).name);
  }

  const after = describe(partner);
  const tag = (state.tags || []).find((t) => t.id === state.preferences?.tagID) || (state.tags || [])[0] || { name: 'Fokus', colorHex: '#34C759' };
  state.plantedTrees ||= [];
  state.plantedTrees.unshift({
    id: newID(), species: partner.species, durationMinutes: minutes, timestamp: toSwiftDate(now), survived: true,
    tagName: tag.name, tagColorHex: tag.colorHex, note: 'Fokus-Training (Web)', coinsEarned: coins,
    isShiny: !!partner.isShiny, isMega: false, wasWildEncounter: false, biomeID: state.selectedBiome ?? null,
    pokemonID: partner.id, trainedStage: after.stage, trainerBonusXP: 0,
  });

  const levelUps = [];
  const evolutions = [];
  for (const pokemon of state.pokemonRoster) {
    const was = before.get(pokemon.id);
    const now2 = describe(pokemon);
    if (now2.level > was.level) levelUps.push({ name: now2.name, from: was.level, to: now2.level });
    if (now2.stage > was.stage) evolutions.push(evolutionEvent(pokemon, was, now2));
  }
  return { partner: after, minutes, coins, dayBonus, earned: minutes + dayBonus, shared, finishedTrips, levelUps, evolutions };
}

/** Basic checks before accepting a file as a PokéForest save. */
export function validateSave(data) {
  if (!data || typeof data !== 'object') return 'Die Datei ist kein PokéForest-Spielstand.';
  if (!Array.isArray(data.pokemonRoster) || !Array.isArray(data.plantedTrees) || typeof data.coins !== 'number') return 'Der Datei fehlen Pokémon oder Münzen. Exportiere sie am Mac neu.';
  for (const p of data.pokemonRoster) {
    if (!p.id || !p.species || !Array.isArray(p.species.stages) || !p.species.stages.length) return 'Ein Pokémon in der Datei ist unvollständig.';
  }
  return null;
}

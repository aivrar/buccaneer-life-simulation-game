/**
 * Historical figure spawner — places hand-crafted characters into the world.
 * No random rolling, no LLM calls. Every field is explicitly set.
 */

import { v4 as uuid } from 'uuid';
import { AgentQueries, ShipQueries, SkillQueries, ReputationQueries, RelationshipQueries } from '../db/queries.js';
import { buildPersonaProfile } from './persona-engine.js';
import { applyOverlay } from './base-agent.js';
import { HISTORICAL_FIGURES, type HistoricalFigure } from './historical-figures.js';
import { issueLetterOfMarque } from '../engine/documents.js';
import { createDefaultRelationship } from '../engine/relationships.js';
import type { ShipClassName } from '../db/models.js';

export async function spawnHistoricalFigure(
  figure: HistoricalFigure,
  tick: number,
): Promise<void> {
  // 1. Build persona profile from hand-crafted traits
  const persona = buildPersonaProfile(figure.traits, figure.name, figure.type);
  persona.background = figure.background;

  // 2. Insert agent into DB
  await AgentQueries.insert({
    id: figure.id,
    type: figure.type as any,
    name: figure.name,
    port_id: figure.startPort,
    sea_zone_id: figure.startSeaZone,
    ship_id: null,
    status: 'in_port',
    nationality: figure.heritage,
    gender: figure.gender,
    heritage: figure.heritage,
    nickname: figure.nickname,
    attributes: JSON.stringify(figure.attributes),
    persona: JSON.stringify(persona),
    cash: figure.startingCash,
    infamy: figure.startingInfamy,
    last_decision_tick: 0,
    cooldown_until_tick: 0,
  });

  // 3. Create ship if specified
  if (figure.shipName && figure.shipClass) {
    const shipId = `ship_${figure.id}`;
    const { SHIP_CLASSES } = await import('../config/ships.js');
    const classData = SHIP_CLASSES[figure.shipClass];

    await ShipQueries.insert({
      id: shipId,
      name: figure.shipName,
      class: figure.shipClass as ShipClassName,
      captain_id: figure.id,
      hull: 90,
      sails: 90,
      guns: figure.shipGuns ?? Math.floor((classData?.maxGuns ?? 10) * 0.7),
      max_guns: classData?.maxGuns ?? 16,
      crew_count: figure.shipCrew ?? classData?.crewMin ?? 20,
      crew_capacity: classData?.crewMax ?? 75,
      cargo_used: 0,
      cargo_capacity: classData?.cargoCapacity ?? 100,
      speed_base: classData?.speed ?? 7,
      maneuverability: classData?.maneuverability ?? 5,
      port_id: figure.startPort,
      sea_zone_id: figure.startSeaZone,
      status: 'docked',
      current_zone_id: null,
      barnacle_level: 5,
      rot_level: 3,
      powder_stores: 90,
      food_stores: 90,
      water_stores: 90,
      destination_port_id: null,
      origin_port_id: null,
      arrival_tick: null,
      departure_tick: null,
    });
  }

  // 4. Insert skills
  for (const skill of figure.skills) {
    await SkillQueries.upsert(
      figure.id,
      skill.domain,
      skill.subSkill,
      skill.level,
      0,
      tick,
    );
  }

  // 5. Set starting reputation across relevant zones
  if (figure.startingInfamy > 0) {
    const primaryZones = ['great_bahama_bank', 'providence_channel', 'windward_passage', 'kingston_approaches', 'florida_straits'];
    for (const zone of primaryZones) {
      const rep = figure.traits.honor > 50 ? 10 : -10;
      await ReputationQueries.upsert(
        figure.id,
        zone,
        rep,
        figure.startingInfamy,
        figure.traits.honor,
        tick,
      );
    }
  }

  // 6. Create starting relationships
  for (const rel of figure.relationships) {
    const relationship = createDefaultRelationship(figure.id, rel.targetId);
    relationship.fondness = rel.fondness;
    relationship.trust = rel.trust;
    relationship.respect = rel.respect;
    relationship.fear = rel.fear;
    relationship.rivalry = rel.rivalry;
    relationship.familiarity = rel.familiarity;
    relationship.last_interaction_tick = tick;
    await RelationshipQueries.upsert(relationship);
  }

  // 7. Issue documents where relevant
  if (figure.type === 'privateer_captain') {
    // Jennings and other privateers get a letter of marque against Spain
    await issueLetterOfMarque(
      figure.id,
      'english',
      ['spanish', 'french'],
      figure.startPort,
      tick,
      4800, // ~100 game days
    );
  }
}

/**
 * Spawn all historical figures appropriate for the given game year.
 * Some figures arrive later (Rogers in 1718, Anne Bonny in 1718).
 */
export async function spawnHistoricalFiguresForYear(
  year: number,
  tick: number,
): Promise<string[]> {
  const spawned: string[] = [];

  for (const figure of HISTORICAL_FIGURES) {
    if (figure.startYear > year) continue;

    // Check if already spawned
    const existing = await AgentQueries.getById(figure.id);
    if (existing) continue;

    await spawnHistoricalFigure(figure, tick);
    spawned.push(`${figure.nickname ?? figure.name} (${figure.type}) at ${figure.startPort}`);
  }

  return spawned;
}

/**
 * Check if any historical figures should spawn this tick based on game year.
 * Called from a tick handler or the harness.
 */
export async function checkHistoricalSpawns(
  year: number,
  tick: number,
): Promise<string[]> {
  return spawnHistoricalFiguresForYear(year, tick);
}

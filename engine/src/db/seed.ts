import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { getDb, closeDb, execute as dbExecute } from './sqlite.js';
import { PORT_PROFILES, ALL_PORTS, EUROPEAN_CITIES, AFRICAN_POSTS } from '../config/ports.js';
import { SEA_ZONE_DEFINITIONS } from '../config/regions.js';
import { CARGO_TYPES } from '../config/cargo.js';
import { SHIP_CLASSES } from '../config/ships.js';
import { ALL_PLACES, PLACE_TEMPLATES } from '../config/places.js';
import { PLANTATIONS } from '../config/plantations.js';
import { OVERLAND_ROUTES } from '../config/overland-routes.js';
import { PORT_DISTANCES } from '../config/distances.js';
import { WEATHER_PROFILES } from '../config/weather-profiles.js';
import { HISTORICAL_FIGURES } from '../agents/historical-figures.js';
import { rollTraits, buildPersonaProfile } from '../agents/persona-engine.js';
import { generateFullName, generateShipName } from '../agents/name-generator.js';
import { AGENT_TYPE_CONFIGS } from '../config/agents.js';

dotenv.config();

async function seed() {
  console.log('=== BUCCANEER LIFE — FULL PHYSICAL WORLD SEED ===\n');

  const db = getDb();

  // 1. Run schema
  console.log('Creating schema...');
  const schemaPath = path.join(import.meta.dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const statements = schema.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    await dbExecute(stmt);
  }
  console.log(`  Executed ${statements.length} schema statements`);

  // 1b. Clear all data for clean re-seed (tables accumulate across runs)
  console.log('Clearing existing data...');
  // Order matters: foreign key dependencies
  const clearOrder = [
    'crew', 'cargo', 'intel', 'bounties', 'navy_cases', 'agent_relationships',
    'wounds', 'skills', 'reputation', 'haven_investments', 'fences', 'ship_code',
    'world_events', 'documents', 'hideouts', 'ships', 'agents',
    'market_prices', 'places', 'plantations', 'ports', 'sea_zones',
    'overland_routes', 'rivers', 'weather',
  ];
  await dbExecute('PRAGMA foreign_keys = OFF');
  for (const table of clearOrder) {
    try { await dbExecute(`DELETE FROM ${table}`); } catch { /* table may not exist yet */ }
  }
  await dbExecute('PRAGMA foreign_keys = ON');
  console.log('  Cleared all tables');

  // 2. Seed sea zones (25 zones)
  console.log('Seeding sea zones...');
  for (const zone of Object.values(SEA_ZONE_DEFINITIONS)) {
    await dbExecute(
      'INSERT OR IGNORE INTO sea_zones (id, name, description, zone_type, traffic_density, patrol_level, hazards, current_direction, current_speed, wind_pattern, encounter_chance, adjacent_zones, accessible_ports, pirate_value, named_features, hurricane_season) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [zone.id, zone.name, zone.description, zone.zoneType, zone.trafficDensity, zone.patrolLevel, JSON.stringify(zone.hazards), zone.currentDirection, zone.currentSpeed, zone.windPattern, zone.encounterChance, JSON.stringify(zone.adjacentZones), JSON.stringify(zone.accessiblePorts), zone.pirateValue, JSON.stringify(zone.namedFeatures ?? []), zone.hurricaneSeason]
    );
  }
  console.log(`  Seeded ${Object.keys(SEA_ZONE_DEFINITIONS).length} sea zones`);

  // 3. Seed all ports (14 Caribbean + 3 European + 3 African)
  console.log('Seeding ports...');
  const allPorts = { ...PORT_PROFILES, ...EUROPEAN_CITIES, ...AFRICAN_POSTS };
  for (const port of Object.values(allPorts)) {
    await dbExecute(
      'INSERT OR IGNORE INTO ports (id, name, sea_zone_id, controller, port_type, corruption, prosperity, population, fort_strength, disease_profile, tavern_quality, shipyard_quality, market_size, pirate_friendly, latitude, longitude, entrance_width, entrance_depth, max_draft, tidal_range, anchorage_capacity, approach_directions, defenses, terrain, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        port.id, port.name, port.seaZoneId, port.controller, port.portType,
        port.corruption, port.prosperity, port.population, port.fortStrength,
        JSON.stringify(port.diseaseProfile), port.tavernQuality, port.shipyardQuality,
        port.marketSize, port.pirateFriendly, port.latitude, port.longitude,
        port.harbor.entranceWidth ?? null, port.harbor.entranceDepth ?? null,
        port.harbor.maxDraft ?? null, port.harbor.tidalRange,
        port.harbor.anchorageCapacity, JSON.stringify(port.harbor.approachDirections),
        port.harbor.defenses, port.terrain, port.description,
      ]
    );
  }
  console.log(`  Seeded ${Object.keys(allPorts).length} ports`);

  // 4. Seed all places (200+ named locations)
  console.log('Seeding places...');
  for (const place of ALL_PLACES) {
    const template = PLACE_TEMPLATES[place.type];
    await dbExecute(
      'INSERT OR IGNORE INTO places (id, name, port_id, type, capacity, quality, safety, corruption, visibility, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        place.id, place.name, place.portId, place.type,
        place.capacity ?? template.defaultCapacity,
        place.quality ?? template.defaultQuality,
        place.safety ?? template.defaultSafety,
        place.corruption ?? template.defaultCorruption,
        place.visibility ?? template.defaultVisibility,
        place.description,
      ]
    );
  }
  console.log(`  Seeded ${ALL_PLACES.length} places`);

  // 5. Seed plantations
  console.log('Seeding plantations...');
  for (const p of PLANTATIONS) {
    await dbExecute(
      'INSERT OR IGNORE INTO plantations (id, name, port_id, type, established, acres, enslaved_workers, annual_output, primary_cargo, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [p.id, p.name, p.portId, p.type, p.established, p.acres, p.enslavedWorkers, p.annualOutput, p.primaryCargo, p.description]
    );
  }
  console.log(`  Seeded ${PLANTATIONS.length} plantations`);

  // 6. Seed overland routes
  console.log('Seeding overland routes...');
  for (const r of OVERLAND_ROUTES) {
    await dbExecute(
      'INSERT OR IGNORE INTO overland_routes (id, name, from_port_id, to_location, distance_km, travel_time_days, terrain, hazards, passable_months, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.name, r.fromPortId, r.toLocation, r.distanceKm, r.travelTimeDays, r.terrain, JSON.stringify(r.hazards), r.passableMonths ? JSON.stringify(r.passableMonths) : null, r.description]
    );
  }
  console.log(`  Seeded ${OVERLAND_ROUTES.length} overland routes`);

  // 7. Seed river systems
  console.log('Seeding rivers...');
  const rivers = [
    { id: 'ozama', name: 'Ozama River', portId: 'santo_domingo', navigableKm: 20, description: 'Ships anchor at the river mouth below Fortaleza Ozama. Plantation access upriver.', strategicValue: 'Fortress on the river bluff controls all waterborne approach. Fresh water source for the city.' },
    { id: 'chagres', name: 'Chagres River', portId: 'portobelo', navigableKm: 50, description: 'Navigable from Caribbean coast to Cruces. Part of the treasure transit route.', strategicValue: 'Fort San Lorenzo guards the river mouth on an 80-foot cliff. Alternative to the Camino Real overland route.' },
    { id: 'ashley', name: 'Ashley River', portId: 'charles_town', navigableKm: 30, description: 'Navigable for miles upriver. Rice plantations line both banks.', strategicValue: 'River access provides multiple approaches to Charles Town — and multiple escape routes.' },
    { id: 'cooper', name: 'Cooper River', portId: 'charles_town', navigableKm: 30, description: 'Navigable for miles upriver. Rice plantations and the wealth of Charles Town.', strategicValue: 'Main commercial docking is on Cooper River wharves.' },
    { id: 'guadalquivir', name: 'Guadalquivir River', portId: 'seville_cadiz', navigableKm: 100, description: 'Treasure fleet terminus. Ships sailed upriver from Atlantic coast to Seville.', strategicValue: 'By 1715, silting makes navigation difficult for large ships — WHY Casa de Contratación moves to Cádiz in 1717.' },
  ];
  for (const r of rivers) {
    await dbExecute(
      'INSERT OR IGNORE INTO rivers (id, name, port_id, navigable_km, description, strategic_value) VALUES (?, ?, ?, ?, ?, ?)',
      [r.id, r.name, r.portId, r.navigableKm, r.description, r.strategicValue]
    );
  }
  console.log(`  Seeded ${rivers.length} rivers`);

  // 8. Seed pirate hideouts
  console.log('Seeding hideouts...');
  const hideouts = [
    // Pirate hideouts
    { id: 'ocracoke', name: 'Ocracoke Inlet', seaZoneId: 'carolina_shelf', lat: 35.07, lng: -75.98, type: 'barrier_island_inlet', maxDraft: 2.5, freshWater: true, careening: true, description: 'Narrow inlet in the Outer Banks. Shallow water hides pirates from the ocean side. Teach\'s Hole — Blackbeard\'s anchorage. Pamlico Sound behind the barrier islands.', historical: 'November 22, 1718: Lt. Robert Maynard cornered Blackbeard here. The battle ended with Blackbeard\'s death — his head hung from Maynard\'s bowsprit.' },
    { id: 'cape_fear', name: 'Cape Fear River', seaZoneId: 'carolina_shelf', lat: 33.89, lng: -78.00, type: 'river_estuary', maxDraft: 3.0, freshWater: true, careening: true, description: 'Wide river estuary with shallow sandbars. Multiple channels for escape. Dense forest along riverbanks. Sandy beaches ideal for careening.', historical: 'September 1718: Stede Bonnet was careening here when Colonel Rhett arrived. The Battle of the Sandbars — a six-hour fight — ended with Bonnet\'s capture.' },

    // Uninhabited islands
    { id: 'eleuthera', name: 'Eleuthera', seaZoneId: 'great_bahama_bank', lat: 25.13, lng: -76.15, type: 'uninhabited_island', maxDraft: 3.0, freshWater: true, careening: true, description: 'Some settlement, good careening beaches. Part of the Bahamas cays.', historical: '' },
    { id: 'cat_island', name: 'Cat Island', seaZoneId: 'great_bahama_bank', lat: 24.38, lng: -75.45, type: 'uninhabited_island', maxDraft: 2.5, freshWater: true, careening: false, description: 'Fresh water, remote, good hiding.', historical: '' },
    { id: 'exuma_cays', name: 'Exuma Cays', seaZoneId: 'great_bahama_bank', lat: 23.95, lng: -76.10, type: 'uninhabited_island', maxDraft: 1.5, freshWater: false, careening: false, description: 'Chain of tiny islands, shallow waters, labyrinth navigation. Only shallow-draft vessels can navigate.', historical: '' },
    { id: 'andros_island', name: 'Andros Island', seaZoneId: 'great_bahama_bank', lat: 24.70, lng: -78.00, type: 'uninhabited_island', maxDraft: 2.0, freshWater: true, careening: true, description: 'Largest island in the Bahamas. Heavily forested, fresh water, maroon communities possible.', historical: '' },
    { id: 'grand_cayman', name: 'Grand Cayman', seaZoneId: 'cayman_trench', lat: 19.33, lng: -81.24, type: 'uninhabited_island', maxDraft: 3.0, freshWater: true, careening: true, description: 'Turtle hunting grounds, fresh water, careening. Largely uninhabited — used by pirates, turtle hunters, fishermen.', historical: '' },
    { id: 'norman_island', name: 'Norman Island', seaZoneId: 'anegada_passage', lat: 18.32, lng: -64.62, type: 'uninhabited_island', maxDraft: 4.0, freshWater: false, careening: false, description: 'Uninhabited British Virgin Islands. Hidden caves for stashing plunder. Sheltered anchorages. Inspiration for Treasure Island.', historical: '' },
    { id: 'isla_juventud', name: 'Isla de la Juventud', seaZoneId: 'cayman_trench', lat: 21.70, lng: -82.85, type: 'uninhabited_island', maxDraft: 3.5, freshWater: true, careening: true, description: 'Isle of Pines, south of Cuba. Used by pirates for careening and hiding. Remote from Spanish patrols.', historical: '' },

    // 1715 Fleet Wreck Sites
    { id: 'wreck_1715', name: '1715 Fleet Wreck Sites', seaZoneId: 'florida_straits', lat: 27.70, lng: -80.35, type: 'wreck_site', maxDraft: null, freshWater: false, careening: false, description: 'String of 11 wrecks along the Florida coast between Sebastian Inlet and Fort Pierce. ~$400 million in modern value. Spanish salvage camp on the beach — raided by Henry Jennings.', historical: 'The 1715 Treasure Fleet disaster triggered the golden age of piracy. Jennings\' raid on the salvage camp in 1716 was one of the first major pirate acts of the era.' },

    // Maroon territories
    { id: 'nanny_town', name: 'Nanny Town', seaZoneId: 'kingston_approaches', lat: 18.10, lng: -76.40, type: 'maroon_stronghold', maxDraft: null, freshWater: true, careening: false, description: 'Windward Maroon stronghold led by Queen Nanny in the Blue Mountains. Fortified, nearly inaccessible. ~300-500 inhabitants. Farming, hunting, raiding plantations to free enslaved people.', historical: 'Queen Nanny is one of the most revered figures in Jamaican history. Her warriors used guerrilla tactics to defeat British expeditions repeatedly.' },
    { id: 'trelawny_town', name: 'Trelawny Town', seaZoneId: 'kingston_approaches', lat: 18.25, lng: -77.55, type: 'maroon_stronghold', maxDraft: null, freshWater: true, careening: false, description: 'Leeward Maroon community led by Captain Cudjoe in Cockpit Country. Karst limestone terrain — sinkholes, caves, impossible for regular troops to navigate. Guerrilla warfare specialists.', historical: 'Cudjoe eventually signed a peace treaty with the British in 1739, ending the First Maroon War.' },

    // Mosquito Coast
    { id: 'mosquito_coast', name: 'Mosquito Coast', seaZoneId: 'darien_coast', lat: 14.00, lng: -83.50, type: 'wild_coast', maxDraft: 2.5, freshWater: true, careening: true, description: 'Miskito indigenous territory (Honduras/Nicaragua). English pirates maintain alliance with Miskito people. Hidden coves, river mouths, turtle grounds. Not a port — a wild coastline.', historical: 'Miskito warriors were valued crew members on pirate and privateer vessels. Their knowledge of the coast was unmatched.' },
  ];
  for (const h of hideouts) {
    await dbExecute(
      'INSERT OR IGNORE INTO hideouts (id, name, sea_zone_id, latitude, longitude, hideout_type, max_draft, fresh_water, careening, description, historical_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [h.id, h.name, h.seaZoneId, h.lat, h.lng, h.type, h.maxDraft, h.freshWater, h.careening, h.description, h.historical]
    );
  }
  console.log(`  Seeded ${hideouts.length} hideouts`);

  // 9. Seed market prices for all Caribbean ports
  console.log('Seeding market prices...');
  let priceCount = 0;
  for (const port of Object.values(PORT_PROFILES)) {
    for (const cargo of Object.values(CARGO_TYPES)) {
      const isOrigin = cargo.origins.includes(port.id);
      const isDest = cargo.destinations.includes(port.id);
      const priceMultiplier = isOrigin ? 0.7 : isDest ? 1.3 : 1.0;
      const supplyMultiplier = isOrigin ? 1.5 : isDest ? 0.5 : 1.0;

      const buyPrice = Math.round(cargo.basePrice * priceMultiplier * 100) / 100;
      const sellPrice = Math.round(buyPrice * 0.85 * 100) / 100;

      await dbExecute(
        'INSERT OR IGNORE INTO market_prices (id, port_id, cargo_type, buy_price, sell_price, supply, demand, last_updated_tick) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        [uuid(), port.id, cargo.id, buyPrice, sellPrice, Math.round(100 * supplyMultiplier), Math.round(100 / supplyMultiplier)]
      );
      priceCount++;
    }
  }
  console.log(`  Seeded ${priceCount} market prices`);

  // 10. Seed initial weather state per sea zone
  console.log('Seeding initial weather...');
  let weatherCount = 0;
  for (const zone of Object.values(SEA_ZONE_DEFINITIONS)) {
    const baseCondition = zone.hurricaneSeason ? 'clear' : 'clear';
    // Default trade wind direction (ENE = ~67 degrees)
    const windDir = zone.currentDirection === 'west' ? 67 : 0;
    const windSpeed = 10;

    await dbExecute(
      'INSERT OR IGNORE INTO weather (id, sea_zone_id, "condition", wind_speed, wind_direction, visibility, storm_intensity, temperature, tick) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
      [uuid(), zone.id, baseCondition, windSpeed, windDir, 0.8, 0, 28]
    );
    weatherCount++;
  }
  console.log(`  Seeded ${weatherCount} initial weather states`);

  // 11. Seed historical figures
  console.log('Seeding historical figures...');
  for (const fig of HISTORICAL_FIGURES) {
    const persona = buildPersonaProfile(fig.traits, fig.name, fig.type);
    const port = ALL_PORTS[fig.startPort];
    const seaZoneId = port?.seaZoneId ?? 'great_bahama_bank';

    const agentId = fig.id;
    await dbExecute(
      `INSERT OR IGNORE INTO agents (id, type, name, port_id, sea_zone_id, ship_id, status, nationality, persona, cash, infamy, last_decision_tick, cooldown_until_tick) VALUES (?, ?, ?, ?, ?, ?, 'in_port', 'english', ?, ?, ?, 0, 0)`,
      [agentId, fig.type, fig.name, fig.startPort, seaZoneId, null, JSON.stringify(persona), 5000, 50]
    );

    if (fig.shipName && fig.shipClass) {
      const shipClass = SHIP_CLASSES[fig.shipClass];
      if (shipClass) {
        const shipId = uuid();
        await dbExecute(
          `INSERT OR IGNORE INTO ships (id, name, class, captain_id, hull, sails, guns, max_guns, crew_count, crew_capacity, cargo_used, cargo_capacity, speed_base, maneuverability, port_id, sea_zone_id, status, barnacle_level, rot_level, powder_stores, food_stores, water_stores) VALUES (?, ?, ?, ?, 100, 100, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'docked', 0, 0, 80, 100, 100)`,
          [shipId, fig.shipName, fig.shipClass, agentId, shipClass.maxGuns, shipClass.maxGuns, Math.floor(shipClass.crewMax * 0.6), shipClass.crewMax, shipClass.cargoCapacity, shipClass.speed, shipClass.maneuverability, fig.startPort, seaZoneId]
        );
        await dbExecute('UPDATE agents SET ship_id = ? WHERE id = ?', [shipId, agentId]);
      }
    }
  }
  console.log(`  Seeded ${HISTORICAL_FIGURES.length} historical figures`);

  // 12. Seed generic agents
  console.log('Seeding generic agents...');
  let agentCount = 0;
  const ports = Object.values(PORT_PROFILES);

  for (const [typeId, config] of Object.entries(AGENT_TYPE_CONFIGS)) {
    for (const port of ports) {
      const count = config.spawnConfig.minPerRegion;
      for (let i = 0; i < count; i++) {
        const name = generateFullName(port.seaZoneId);
        const traits = rollTraits(
          config.requiredTraits ? { min: config.requiredTraits } : undefined
        );
        const persona = buildPersonaProfile(traits, name, typeId);
        const agentId = uuid();

        await dbExecute(
          `INSERT INTO agents (id, type, name, port_id, sea_zone_id, status, nationality, persona, cash, infamy, last_decision_tick, cooldown_until_tick) VALUES (?, ?, ?, ?, ?, 'in_port', ?, ?, ?, 0, 0, 0)`,
          [agentId, typeId, name, port.id, port.seaZoneId, 'english', JSON.stringify(persona), Math.floor(Math.random() * 2000 + 100)]
        );

        if (typeId.includes('captain') || typeId === 'pirate_hunter' || typeId === 'naval_officer') {
          const shipClasses = typeId === 'naval_officer'
            ? ['frigate']
            : ['sloop', 'schooner', 'brigantine'];
          const shipClassName = shipClasses[Math.floor(Math.random() * shipClasses.length)]!;
          const shipClass = SHIP_CLASSES[shipClassName]!;
          const shipId = uuid();
          const shipName = generateShipName();

          await dbExecute(
            `INSERT INTO ships (id, name, class, captain_id, hull, sails, guns, max_guns, crew_count, crew_capacity, cargo_used, cargo_capacity, speed_base, maneuverability, port_id, sea_zone_id, status, barnacle_level, rot_level, powder_stores, food_stores, water_stores) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'docked', ?, 0, ?, ?, ?)`,
            [shipId, shipName, shipClassName, agentId,
              70 + Math.floor(Math.random() * 30),
              70 + Math.floor(Math.random() * 30),
              Math.floor(shipClass.maxGuns * 0.7),
              shipClass.maxGuns,
              Math.floor(shipClass.crewMin + Math.random() * (shipClass.crewMax - shipClass.crewMin) * 0.5),
              shipClass.crewMax,
              shipClass.cargoCapacity,
              shipClass.speed,
              shipClass.maneuverability,
              port.id, port.seaZoneId,
              Math.floor(Math.random() * 20),
              40 + Math.floor(Math.random() * 60),
              60 + Math.floor(Math.random() * 40),
              60 + Math.floor(Math.random() * 40),
            ]
          );

          await dbExecute('UPDATE agents SET ship_id = ? WHERE id = ?', [shipId, agentId]);
        }

        agentCount++;
      }
    }
  }
  console.log(`  Seeded ${agentCount} generic agents`);

  // 13. Seed fence infrastructure at all major pirate-accessible ports
  console.log('Seeding port fences...');
  const fencePorts = [
    'port_royal', 'havana', 'bridgetown', 'petit_goave', 'tortuga',
    'charles_town', 'basseterre', 'santo_domingo', 'willemstad',
    'veracruz', 'cartagena',
  ];
  let fenceCount = 0;
  for (const portId of fencePorts) {
    const numFences = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < numFences; i++) {
      const fenceId = uuid();
      await dbExecute(
        `INSERT OR IGNORE INTO fences (id, port_id, agent_id, tier, trust, availability, cut_percentage, last_transaction_tick)
         VALUES (?, ?, NULL, 1, 30, 80, 30, 0)`,
        [fenceId, portId]
      );
      fenceCount++;
    }
  }
  console.log(`  Seeded ${fenceCount} port fences across ${fencePorts.length} ports`);

  // Summary
  const totalAgents = HISTORICAL_FIGURES.length + agentCount;
  console.log(`\n=== SEED COMPLETE ===`);
  console.log(`  Sea zones: ${Object.keys(SEA_ZONE_DEFINITIONS).length}`);
  console.log(`  Ports: ${Object.keys(allPorts).length} (${Object.keys(PORT_PROFILES).length} Caribbean + ${Object.keys(EUROPEAN_CITIES).length} European + ${Object.keys(AFRICAN_POSTS).length} African)`);
  console.log(`  Places: ${ALL_PLACES.length}`);
  console.log(`  Plantations: ${PLANTATIONS.length}`);
  console.log(`  Overland routes: ${OVERLAND_ROUTES.length}`);
  console.log(`  Rivers: ${rivers.length}`);
  console.log(`  Hideouts: ${hideouts.length}`);
  console.log(`  Market prices: ${priceCount}`);
  console.log(`  Weather states: ${weatherCount}`);
  console.log(`  Agents: ${totalAgents}`);
  console.log(`====================\n`);

  await closeDb();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

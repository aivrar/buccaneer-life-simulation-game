import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { v4 as uuid } from 'uuid';
import { IntelQueries, ShipQueries, SeaZoneQueries, PortQueries, AgentQueries } from '../db/queries.js';
import type { Ship, Intel } from '../db/models.js';

// Cache dead captain IDs per tick to avoid repeated DB queries
let deadCaptainCache: Set<string> | null = null;
let deadCaptainCacheTick = -1;

async function isCaptainDead(captainId: string | null, tick: number): Promise<boolean> {
  if (!captainId) return false;
  if (deadCaptainCacheTick !== tick) {
    deadCaptainCache = new Set();
    deadCaptainCacheTick = tick;
  }
  if (deadCaptainCache!.has(captainId)) return true;
  const agent = await AgentQueries.getById(captainId);
  if (!agent || agent.status === 'dead') {
    deadCaptainCache!.add(captainId);
    return true;
  }
  return false;
}
import { generateTavernRumors } from '../engine/actions/intel-actions.js';

export const intelTickHandler: TickHandler = {
  name: 'intel-tick',
  phase: TickPhase.AGENTS,

  async execute(tick: TickContext): Promise<void> {
    // 1. Generate sightings from shared sea zones
    const zones = await SeaZoneQueries.getAll();
    for (const zone of zones) {
      const ships = await ShipQueries.getByZone(zone.id);
      const sailingShips = ships.filter(s => s.status === 'sailing');

      // Ships in the same zone can see each other
      for (let i = 0; i < sailingShips.length; i++) {
        for (let j = i + 1; j < sailingShips.length; j++) {
          const s1 = sailingShips[i]!;
          const s2 = sailingShips[j]!;

          // Only generate sightings occasionally
          if (Math.random() > 0.1) continue;

          // s1 sees s2 (skip dead captains)
          if (s1.captain_id && !(await isCaptainDead(s1.captain_id, tick.tickNumber))) {
            if (!(await isCaptainDead(s2.captain_id, tick.tickNumber))) {
              await createSighting(s1, s2, zone.id, tick.tickNumber);
            }
          }
          // s2 sees s1 (skip dead captains)
          if (s2.captain_id && !(await isCaptainDead(s2.captain_id, tick.tickNumber))) {
            if (!(await isCaptainDead(s1.captain_id, tick.tickNumber))) {
              await createSighting(s2, s1, zone.id, tick.tickNumber);
            }
          }
        }
      }

      // 2. Generate manifests from docked ships at accessible ports
      const accessiblePorts: string[] = JSON.parse(zone.accessible_ports);
      for (const portId of accessiblePorts) {
        const dockedShips = await ShipQueries.getByPort(portId);
        for (const ship of dockedShips) {
          if (Math.random() > 0.05) continue; // 5% chance per tick
          if (!ship.captain_id) continue;
          if (await isCaptainDead(ship.captain_id, tick.tickNumber)) continue;

          await IntelQueries.insert({
            id: uuid(),
            source_agent_id: ship.captain_id,
            subject_agent_id: null,
            subject_ship_id: ship.id,
            type: 'manifest',
            content: `${ship.name} (${ship.class}) docked at ${portId}`,
            accuracy: 90,
            freshness: 100,
            port_id: portId,
            price: null,
            created_tick: tick.tickNumber,
          });
        }
      }
    }

    // 3. Generate tavern rumors from world events (every 12 ticks)
    if (tick.tickNumber % 12 === 0) {
      const ports = await PortQueries.getAll();
      for (const port of ports) {
        await generateTavernRumors(port.id, tick.tickNumber);
      }
    }

    // 4. Propagate intel to connected ports (with delay and accuracy loss)
    const activeIntel = await IntelQueries.getActive();
    for (const intel of activeIntel) {
      // Only propagate fresh intel
      if (intel.freshness < 80) continue;
      if (Math.random() > 0.02) continue; // slow propagation

      // Find adjacent zones' ports
      const zone = zones.find(z => {
        const ports: string[] = JSON.parse(z.accessible_ports);
        return ports.includes(intel.port_id);
      });
      if (!zone) continue;

      const adjacentZones = await SeaZoneQueries.getAdjacent(zone.id);
      for (const adjZone of adjacentZones) {
        const adjPorts: string[] = JSON.parse(adjZone.accessible_ports);
        for (const adjPort of adjPorts) {
          if (adjPort === intel.port_id) continue;

          await IntelQueries.insert({
            id: uuid(),
            source_agent_id: intel.source_agent_id,
            subject_agent_id: intel.subject_agent_id,
            subject_ship_id: intel.subject_ship_id,
            type: intel.type,
            content: intel.content,
            accuracy: Math.round(intel.accuracy * 0.8),
            freshness: Math.round(intel.freshness * 0.7),
            port_id: adjPort,
            price: intel.price,
            created_tick: tick.tickNumber,
          });
        }
      }
    }
  },
};

async function createSighting(observer: Ship, target: Ship, zoneId: string, tick: number): Promise<void> {
  // Find a port in this zone to attach the intel to
  const zone = await SeaZoneQueries.getById(zoneId);
  const ports: string[] = zone ? JSON.parse(zone.accessible_ports) : [];
  const portId = ports[0] ?? 'nassau'; // fallback

  await IntelQueries.insert({
    id: uuid(),
    source_agent_id: observer.captain_id ?? 'unknown',
    subject_agent_id: target.captain_id,
    subject_ship_id: target.id,
    type: 'sighting',
    content: `${target.name} (${target.class}) spotted in ${zoneId}`,
    accuracy: 80,
    freshness: 100,
    port_id: portId,
    price: null,
    created_tick: tick,
  });
}

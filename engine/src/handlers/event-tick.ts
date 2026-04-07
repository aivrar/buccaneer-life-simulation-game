import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { drainWeatherEventQueue } from './weather-tick.js';
import { EventQueries } from '../db/queries.js';
import type { StormUpdate } from '../world/storm-tracker.js';
import { v4 as uuidv4 } from 'uuid';

// Severity scale for storms
function stormSeverity(category: number): number {
  // tropical storm = 5, Cat 1 = 6, Cat 2 = 7, Cat 3 = 8, Cat 4 = 9, Cat 5 = 10
  return category === 0 ? 5 : Math.min(10, 5 + category);
}

export const eventTickHandler: TickHandler = {
  name: 'event-tick',
  phase: TickPhase.EVENTS,

  async execute(tick: TickContext): Promise<void> {
    // Drain weather event queue from weather-tick
    const weatherUpdates = drainWeatherEventQueue();

    for (const update of weatherUpdates) {
      // Only process storm updates as world events (not regular weather event start/end)
      if (!('storm' in update)) continue;

      const stormUpdate = update as StormUpdate;
      const { storm, zoneId, category } = stormUpdate;

      // Only record significant storm events
      if (stormUpdate.type === 'storm_spawned' || stormUpdate.type === 'storm_entered_zone') {
        const typeLabel = category >= 1 ? `Category ${category} Hurricane` : 'Tropical Storm';
        const description = stormUpdate.type === 'storm_spawned'
          ? `${typeLabel} "${storm.name}" has formed and threatens the region.`
          : `${typeLabel} "${storm.name}" has entered ${zoneId}.`;

        try {
          await EventQueries.insert({
            id: uuidv4(),
            type: 'weather_storm',
            description,
            agent_ids: '[]',
            ship_ids: '[]',
            port_id: null,
            sea_zone_id: zoneId,
            severity: stormSeverity(category),
            tick: tick.tickNumber,
            data: JSON.stringify({
              stormId: storm.id,
              stormName: storm.name,
              category,
              peakCategory: storm.peakCategory,
              updateType: stormUpdate.type,
              trackZoneIds: storm.trackZoneIds,
            }),
          });
        } catch {
          // DB may not be available in all contexts — fail silently
        }
      }

      // Log world event to JSONL
      if (tick.logger) {
        tick.logger.counters.worldEventsGenerated++;
        tick.logger.log('world-events', { type: stormUpdate.type, stormName: storm.name, zoneId, category });
      }

      if (stormUpdate.type === 'storm_dissipated') {
        try {
          await EventQueries.insert({
            id: uuidv4(),
            type: 'weather_storm',
            description: `${storm.name} has dissipated after reaching peak Category ${storm.peakCategory}.`,
            agent_ids: '[]',
            ship_ids: '[]',
            port_id: null,
            sea_zone_id: zoneId,
            severity: stormSeverity(storm.peakCategory),
            tick: tick.tickNumber,
            data: JSON.stringify({
              stormId: storm.id,
              stormName: storm.name,
              category: 0,
              peakCategory: storm.peakCategory,
              updateType: 'storm_dissipated',
              trackZoneIds: storm.trackZoneIds,
            }),
          });
        } catch {
          // DB may not be available
        }
      }
    }
  },
};

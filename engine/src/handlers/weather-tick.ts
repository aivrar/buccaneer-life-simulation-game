import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { generateWeather } from '../world/weather.js';
import { deriveSeaState } from '../world/sea-state.js';
import { getAllSeaZoneIds } from '../world/regions.js';
import { WeatherQueries } from '../db/queries.js';
import {
  advanceStorms,
  advanceWeatherEvents,
  maybeSpawnHurricane,
  maybeSpawnWeatherEvent,
  type StormUpdate,
  type EventUpdate,
} from '../world/storm-tracker.js';

// In-memory weather state (will be persisted to DB)
const currentWeather = new Map<string, ReturnType<typeof generateWeather>>();
const currentSeaState = new Map<string, ReturnType<typeof deriveSeaState>>();

// Queue of storm/event updates for event-tick to consume
let _weatherEventQueue: (StormUpdate | EventUpdate)[] = [];

export const weatherTickHandler: TickHandler = {
  name: 'weather-tick',
  phase: TickPhase.WORLD,

  async execute(tick: TickContext): Promise<void> {
    const queue: (StormUpdate | EventUpdate)[] = [];

    // 1. Advance existing storms
    const stormUpdates = advanceStorms(tick.gameTime);
    queue.push(...stormUpdates);

    // 2. Advance existing weather events (tick down durations)
    const eventUpdates = advanceWeatherEvents(tick.gameTime);
    queue.push(...eventUpdates);

    // 3. Maybe spawn new hurricane
    const newStorm = maybeSpawnHurricane(tick.gameTime);
    if (newStorm) queue.push(newStorm);

    // 4. Maybe spawn new weather events
    const newEvents = maybeSpawnWeatherEvent(tick.gameTime);
    queue.push(...newEvents);

    // 5. Generate weather per zone (now storm-aware + temp-aware)
    const regions = getAllSeaZoneIds();
    for (const seaZoneId of regions) {
      const previous = currentWeather.get(seaZoneId);
      const weather = generateWeather(seaZoneId, tick.gameTime, previous);
      currentWeather.set(seaZoneId, weather);

      // 6. Derive sea state (unchanged)
      const seaState = deriveSeaState(weather);
      currentSeaState.set(seaZoneId, seaState);
    }

    // 6b. Persist weather to DB every 6 ticks (slow tick)
    if (tick.tickNumber % 6 === 0) {
      for (const [zoneId, w] of currentWeather) {
        await WeatherQueries.upsert(
          zoneId, w.condition, w.windSpeed, w.windDirection,
          w.visibility, w.stormIntensity, w.temperature, tick.tickNumber
        );
      }
    }

    // 7. Queue storm updates for event-tick to process
    _weatherEventQueue = queue;

    // 8. Log weather summary
    if (tick.logger) {
      let stormsActive = 0;
      let hurricanesActive = 0;
      for (const w of currentWeather.values()) {
        if (w.condition === 'storm') stormsActive++;
        if (w.condition === 'hurricane') hurricanesActive++;
      }
      tick.logger.counters.stormsActive = stormsActive;
      tick.logger.counters.hurricanesActive = hurricanesActive;
      if (queue.length > 0) {
        tick.logger.log('weather', { events: queue.map((q: any) => ({ type: q.type, zoneId: q.zoneId ?? q.affectedZoneIds })) });
      }
    }
  },
};

export function getWeatherState() { return currentWeather; }
export function getSeaStateMap() { return currentSeaState; }
export function drainWeatherEventQueue(): (StormUpdate | EventUpdate)[] {
  const queue = _weatherEventQueue;
  _weatherEventQueue = [];
  return queue;
}

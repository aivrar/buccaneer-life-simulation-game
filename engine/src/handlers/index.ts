import type { TickHandler } from '../runtime/types.js';
import { weatherTickHandler } from './weather-tick.js';
import { economyTickHandler } from './economy-tick.js';
import { navyTickHandler } from './navy-tick.js';
import { crewTickHandler } from './crew-tick.js';
import { travelTickHandler } from './travel-tick.js';
import { diseaseTickHandler } from './disease-tick.js';
import { havenTickHandler } from './haven-tick.js';
import { intelTickHandler } from './intel-tick.js';
import { agentTickHandler } from './agent-tick.js';
import { interactionTickHandler } from './interaction-tick.js';
import { decayTickHandler } from './decay-tick.js';
import { skillTransferTickHandler } from './skill-transfer-tick.js';
import { reputationTickHandler } from './reputation-tick.js';
import { combatTickHandler } from './combat-tick.js';
import { encounterTickHandler } from './encounter-tick.js';
import { eventTickHandler } from './event-tick.js';

/**
 * Tick orchestrator — returns all handlers in execution order.
 *
 * Phase execution order:
 * 1. WORLD — Weather, sea state, time, disease pressure
 * 2. DECAY — Heat, loyalty, food, condition decay
 * 3. ECONOMY — Market fluctuation, trade route activity
 * 4. AGENTS — Agent decision scheduling + execution
 * 5. EVENTS — Event queue processing + cascades
 * 6. CLEANUP — Post-tick cleanup
 */
export function getAllHandlers(): TickHandler[] {
  return [
    // Phase 1: World simulation
    weatherTickHandler,
    diseaseTickHandler,
    travelTickHandler,

    // Phase 2: Decay
    decayTickHandler,
    crewTickHandler,
    skillTransferTickHandler,
    reputationTickHandler,

    // Phase 3: Economy
    economyTickHandler,
    havenTickHandler,

    // Phase 4: Agents
    navyTickHandler,
    intelTickHandler,
    agentTickHandler,
    interactionTickHandler,

    // Phase 5: Events
    combatTickHandler,      // Process active battles (before encounter detection)
    encounterTickHandler,
    eventTickHandler,
  ];
}

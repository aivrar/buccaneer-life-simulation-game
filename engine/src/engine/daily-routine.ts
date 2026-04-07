/**
 * Daily routine system — where agents go based on type and time of day.
 * Returns place types (tavern, dock, market, shipyard, etc.)
 * that map to actual places at a port.
 */

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

// Place type preferences by agent type and time of day
// Each entry is a weighted list — first match with the port's available places wins
const ROUTINES: Record<string, Record<TimeOfDay, string[]>> = {
  pirate_captain: {
    morning: ['dock', 'shipyard', 'market'],
    afternoon: ['tavern', 'dock', 'market'],
    evening: ['tavern', 'brothel'],
    night: ['tavern', 'dock'],
  },
  merchant_captain: {
    morning: ['dock', 'market', 'warehouse'],
    afternoon: ['market', 'dock', 'government'],
    evening: ['tavern', 'residential'],
    night: ['residential', 'dock'],
  },
  naval_officer: {
    morning: ['fort', 'dock', 'government'],
    afternoon: ['dock', 'government', 'fort'],
    evening: ['tavern', 'government'],
    night: ['fort', 'residential'],
  },
  port_governor: {
    morning: ['government'],
    afternoon: ['government', 'fort'],
    evening: ['government', 'residential'],
    night: ['residential'],
  },
  fence: {
    morning: ['warehouse', 'market'],
    afternoon: ['tavern', 'warehouse', 'dock'],
    evening: ['tavern', 'warehouse'],
    night: ['tavern', 'warehouse'],
  },
  crew_member: {
    morning: ['dock', 'market'],
    afternoon: ['dock', 'tavern'],
    evening: ['tavern', 'brothel'],
    night: ['tavern', 'dock'],
  },
  quartermaster: {
    morning: ['dock', 'market', 'warehouse'],
    afternoon: ['dock', 'market', 'tavern'],
    evening: ['tavern'],
    night: ['dock', 'tavern'],
  },
  informant: {
    morning: ['market', 'dock'],
    afternoon: ['tavern', 'dock', 'government'],
    evening: ['tavern', 'brothel'],
    night: ['tavern'],
  },
  privateer_captain: {
    morning: ['dock', 'government', 'shipyard'],
    afternoon: ['dock', 'market', 'tavern'],
    evening: ['tavern', 'government'],
    night: ['tavern', 'dock'],
  },
  tavern_keeper: {
    morning: ['tavern', 'market'],
    afternoon: ['tavern'],
    evening: ['tavern'],
    night: ['tavern'],
  },
  shipwright: {
    morning: ['shipyard'],
    afternoon: ['shipyard'],
    evening: ['tavern', 'shipyard'],
    night: ['residential', 'tavern'],
  },
  surgeon: {
    morning: ['hospital', 'dock'],
    afternoon: ['hospital', 'dock'],
    evening: ['tavern', 'residential'],
    night: ['residential'],
  },
  pirate_hunter: {
    morning: ['dock', 'fort', 'tavern'],
    afternoon: ['tavern', 'dock', 'government'],
    evening: ['tavern'],
    night: ['tavern', 'dock'],
  },
  harbor_master: {
    morning: ['dock'],
    afternoon: ['dock', 'government'],
    evening: ['tavern', 'residential'],
    night: ['residential'],
  },
  plantation_owner: {
    morning: ['government', 'market'],
    afternoon: ['market', 'warehouse'],
    evening: ['tavern', 'residential'],
    night: ['residential'],
  },
};

const DEFAULT_ROUTINE: Record<TimeOfDay, string[]> = {
  morning: ['market', 'dock'],
  afternoon: ['tavern', 'market'],
  evening: ['tavern'],
  night: ['tavern', 'residential'],
};

/**
 * Get where an agent of this type would be at this hour.
 * Returns a place type string.
 */
export function getAgentPlacePreference(agentType: string, hour: number): string {
  const timeOfDay = getTimeOfDay(hour);
  const routine = ROUTINES[agentType] ?? DEFAULT_ROUTINE;
  const preferences = routine[timeOfDay];

  // Add some randomness — 70% chance of first preference, 20% second, 10% third
  const roll = Math.random();
  if (roll < 0.7 || preferences.length === 1) return preferences[0]!;
  if (roll < 0.9 || preferences.length === 2) return preferences[1] ?? preferences[0]!;
  return preferences[2] ?? preferences[1] ?? preferences[0]!;
}

/**
 * Get the preferred actions for an agent type at this time of day.
 * Used by player-ai to make time-appropriate decisions.
 */
export function getTimeBasedActionWeights(
  agentType: string,
  hour: number,
): Record<string, number> {
  const timeOfDay = getTimeOfDay(hour);
  const weights: Record<string, number> = {};

  switch (timeOfDay) {
    case 'morning':
      weights['buy_provisions'] = 1.5;
      weights['repair_ship'] = 1.5;
      weights['buy_cargo'] = 1.3;
      weights['sail_to'] = 1.2;
      weights['visit_tavern'] = 0.5;
      break;
    case 'afternoon':
      weights['trade_cargo'] = 1.5;
      weights['sell_cargo'] = 1.3;
      weights['sail_to'] = 1.0;
      weights['recruit_crew'] = 1.2;
      weights['negotiate'] = 1.2;
      break;
    case 'evening':
      weights['visit_tavern'] = 2.0;
      weights['recruit_crew'] = 1.5;
      weights['gather_intel'] = 1.5;
      weights['negotiate'] = 1.3;
      weights['sail_to'] = 0.3;
      break;
    case 'night':
      weights['lay_low'] = 1.5;
      weights['visit_tavern'] = 1.2;
      weights['do_nothing'] = 1.5;
      weights['sail_to'] = 0.1;
      break;
  }

  return weights;
}

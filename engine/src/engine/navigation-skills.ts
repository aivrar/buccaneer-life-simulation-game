/**
 * Navigation skill checks — how crew skill affects voyages.
 *
 * - Getting lost: low skill = chance of adding ticks to voyage
 * - Hazard detection: low skill = chance of running aground (hull damage)
 * - Weather reading: skill determines how far ahead weather can be predicted
 * - Shallow water: draft depth check against navigator skill
 */

import { SkillQueries } from '../db/queries.js';
import type { SeaCondition } from '../runtime/types.js';

export interface NavigationCheck {
  lostTicks: number;          // extra ticks added to voyage from poor navigation
  hazardDamage: number;       // hull damage from hitting a reef/shoal
  weatherReadingHours: number; // how many hours ahead weather can be predicted
}

/**
 * Roll navigation checks for a voyage tick.
 * Called from travel-tick to apply skill-based modifiers.
 */
export async function rollNavigationChecks(
  captainId: string,
  seaCondition: SeaCondition | undefined,
  zoneHazardLevel: number,  // 0-100 from sea zone config
): Promise<NavigationCheck> {
  // Get the captain's navigation skill
  const skills = await SkillQueries.getByAgent(captainId);
  const navSkill = skills.find(s => s.sub_skill === 'navigation');
  const weatherSkill = skills.find(s => s.sub_skill === 'weather_reading');
  const navLevel = navSkill?.level ?? 10;
  const weatherLevel = weatherSkill?.level ?? 10;

  let lostTicks = 0;
  let hazardDamage = 0;

  // Getting lost check — low visibility + low skill = danger
  const visibility = seaCondition?.visibility ?? 0.8;
  if (visibility < 0.5) {
    // In poor visibility, low-skill navigators get lost
    const lostChance = Math.max(0, (50 - navLevel) / 100) * (1 - visibility);
    if (Math.random() < lostChance) {
      lostTicks = 1 + Math.floor(Math.random() * 3); // 1-3 extra ticks
    }
  }

  // Hazard check — reefs and shoals in hazardous zones
  if (zoneHazardLevel > 0) {
    // Skill reduces hazard risk. At nav 0: full risk. At nav 80+: nearly zero.
    const hazardChance = (zoneHazardLevel / 100) * Math.max(0, (80 - navLevel) / 100) * 0.02;
    if (Math.random() < hazardChance) {
      // Hit a reef — damage scales inversely with skill
      hazardDamage = Math.floor((100 - navLevel) * 0.2 * Math.random());
    }
  }

  // Weather reading — determines forecast horizon
  // 0-20: no forecast, 20-40: obvious signs, 40-60: 12hrs, 60-80: 24-48hrs, 80+: 2-3 days
  let weatherReadingHours = 0;
  if (weatherLevel >= 80) weatherReadingHours = 72;
  else if (weatherLevel >= 60) weatherReadingHours = 36;
  else if (weatherLevel >= 40) weatherReadingHours = 12;
  else if (weatherLevel >= 20) weatherReadingHours = 3;

  return { lostTicks, hazardDamage, weatherReadingHours };
}

/**
 * Get the hazard level for a sea zone from its hazards JSON.
 */
export function getZoneHazardLevel(hazardsJson: string): number {
  try {
    const hazards: string[] = JSON.parse(hazardsJson);
    // Each hazard type contributes to overall danger
    let level = 0;
    for (const h of hazards) {
      if (h.includes('reef') || h.includes('shoal')) level += 20;
      if (h.includes('shallow')) level += 15;
      if (h.includes('current') || h.includes('rip')) level += 10;
      if (h.includes('rock')) level += 15;
    }
    return Math.min(100, level);
  } catch {
    return 0;
  }
}

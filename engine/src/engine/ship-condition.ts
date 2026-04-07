/**
 * Ship condition tracking: hull, sails, powder, rot, and barnacles.
 * Models degradation over time, damage from combat and weather,
 * and the effects of poor condition on performance.
 */

export interface ShipCondition {
  shipId: string;
  hullIntegrity: number;    // 0-100
  sailCondition: number;    // 0-100
  powderDry: number;        // 0-100 (affects gunnery)
  rotLevel: number;         // 0-100 (wood rot accumulation)
  barnacleLevel: number;    // 0-100 (speed penalty)
}

export function applyDegradation(condition: ShipCondition, elapsedDays: number): ShipCondition {
  // TODO: Degrade condition over time
  // - Rot increases in tropical waters
  // - Barnacles accumulate below waterline
  // - Sails wear from heavy use
  return {
    ...condition,
    rotLevel: Math.min(100, condition.rotLevel + elapsedDays * 0.2),
    barnacleLevel: Math.min(100, condition.barnacleLevel + elapsedDays * 0.3),
    sailCondition: Math.max(0, condition.sailCondition - elapsedDays * 0.1),
  };
}

export function getSpeedModifier(condition: ShipCondition): number {
  // TODO: Barnacles and sail damage reduce speed
  const sailFactor = condition.sailCondition / 100;
  const barnaclePenalty = condition.barnacleLevel * 0.005;
  return Math.max(0.1, sailFactor - barnaclePenalty);
}

export function applyDamage(condition: ShipCondition, hullDmg: number, sailDmg: number): ShipCondition {
  // TODO: Apply combat or storm damage
  return {
    ...condition,
    hullIntegrity: Math.max(0, condition.hullIntegrity - hullDmg),
    sailCondition: Math.max(0, condition.sailCondition - sailDmg),
  };
}

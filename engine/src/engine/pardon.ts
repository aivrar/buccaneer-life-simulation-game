/**
 * King's Pardon mechanics.
 * Models royal pardons including eligibility, conditions,
 * reputation reset effects, and pardon expiration.
 */

export interface Pardon {
  pardonId: string;
  recipientId: string;
  issuedTick: number;
  expirationTick: number | null;
  conditions: PardonCondition[];
  accepted: boolean;
  violated: boolean;
}

export type PardonCondition = 'cease_piracy' | 'serve_navy' | 'inform_on_pirates' | 'pay_fine' | 'surrender_ship';

export interface PardonEffect {
  infamyReset: number;     // new infamy level after pardon
  casesDropped: boolean;
  reputationChange: number;
  crewLoyaltyImpact: number;
}

export function issuePardon(recipientId: string, tick: number, conditions: PardonCondition[], durationTicks?: number): Pardon {
  // TODO: Create a pardon offer
  return {
    pardonId: `pardon_${recipientId}_${tick}`,
    recipientId,
    issuedTick: tick,
    expirationTick: durationTicks ? tick + durationTicks : null,
    conditions,
    accepted: false,
    violated: false,
  };
}

export function acceptPardon(pardon: Pardon): PardonEffect {
  // TODO: Calculate effects of accepting a pardon
  // - Infamy drops substantially but not to zero
  // - Active cases are dropped
  // - Crew may resent going straight
  return {
    infamyReset: 10,
    casesDropped: true,
    reputationChange: -5,
    crewLoyaltyImpact: -15,
  };
}

export function checkViolation(pardon: Pardon, pirateActCommitted: boolean): Pardon {
  // TODO: Check if pardon conditions have been violated
  if (pirateActCommitted && pardon.accepted) {
    return { ...pardon, violated: true };
  }
  return pardon;
}

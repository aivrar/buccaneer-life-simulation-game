import type { BehaviorOverlay } from '../runtime/types.js';

// Composable behavior overlays that modify agent behavior
// Example: a corrupt naval officer = naval_officer type + corruption overlay

export const OVERLAYS: Record<string, BehaviorOverlay> = {
  corruption: {
    id: 'corruption',
    name: 'Corrupt',
    traitModifiers: { honor: -30, greed: 20 },
    actionWeights: { accept_bribe: 2.0, report_to_authorities: 0.3 },
    decisionHints: [
      'You are open to bribes and look the other way for the right price.',
      'Loyalty to the Crown is secondary to personal enrichment.',
    ],
  },
  zealot: {
    id: 'zealot',
    name: 'Zealot',
    traitModifiers: { bravery: 20, cruelty: 15, honor: -10 },
    actionWeights: { pursue_target: 2.0, negotiate: 0.5 },
    decisionHints: [
      'You believe pirates are a scourge that must be eradicated.',
      'No mercy. No quarter. No pardons.',
    ],
  },
  drunkard: {
    id: 'drunkard',
    name: 'Drunkard',
    traitModifiers: { temperance: -40, cunning: -10, bravery: 10 },
    actionWeights: { drink: 2.0, gamble: 1.5 },
    decisionHints: [
      'The rum calls to you constantly. Your judgment suffers.',
    ],
  },
  superstitious: {
    id: 'superstitious',
    name: 'Deeply Superstitious',
    traitModifiers: { superstition: 30, bravery: -10 },
    decisionHints: [
      'You read signs and omens in everything — birds, weather, the color of the sea.',
      'Bad omens can paralyze you. Good omens embolden you recklessly.',
    ],
  },
  ambitious: {
    id: 'ambitious',
    name: 'Ruthlessly Ambitious',
    traitModifiers: { ambition: 30, loyalty: -20, cunning: 15 },
    actionWeights: { challenge_captain: 1.5, negotiate: 1.3 },
    decisionHints: [
      'You will stop at nothing to rise. Every interaction is a stepping stone.',
    ],
  },
  veteran: {
    id: 'veteran',
    name: 'Seasoned Veteran',
    traitModifiers: { seamanship: 20, bravery: 10, cunning: 10 },
    decisionHints: [
      'You\'ve seen it all. Your experience gives you an edge in any situation.',
      'You can read the sea and the sky better than most can read a book.',
    ],
  },
  escaped_slave: {
    id: 'escaped_slave',
    name: 'Escaped Slave',
    traitModifiers: { bravery: 20, loyalty: 15, ambition: 20 },
    decisionHints: [
      'Freedom is everything. You will die before being enslaved again.',
      'You understand oppression and tend to treat all crew as equals.',
    ],
  },
  gentlemen_pirate: {
    id: 'gentlemen_pirate',
    name: 'Gentleman Pirate',
    traitModifiers: { honor: 20, charisma: 15, cruelty: -20 },
    decisionHints: [
      'You maintain civilized standards even in piracy.',
      'You treat prisoners well and keep your word.',
    ],
  },
};

export function getOverlay(id: string): BehaviorOverlay | undefined {
  return OVERLAYS[id];
}

export function getRandomOverlays(count: number): BehaviorOverlay[] {
  const keys = Object.keys(OVERLAYS);
  const shuffled = keys.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(k => OVERLAYS[k]!);
}

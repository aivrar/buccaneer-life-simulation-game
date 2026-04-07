import type { PersonaTraits, PersonaProfile } from '../runtime/types.js';

export interface TraitConstraints {
  min?: Partial<PersonaTraits>;
  max?: Partial<PersonaTraits>;
}

export function rollTraits(constraints?: TraitConstraints, overrides?: Partial<PersonaTraits>): PersonaTraits {
  const traits: PersonaTraits = {
    bravery: rollTrait('bravery', constraints),
    cruelty: rollTrait('cruelty', constraints),
    greed: rollTrait('greed', constraints),
    loyalty: rollTrait('loyalty', constraints),
    cunning: rollTrait('cunning', constraints),
    superstition: rollTrait('superstition', constraints),
    charisma: rollTrait('charisma', constraints),
    seamanship: rollTrait('seamanship', constraints),
    ambition: rollTrait('ambition', constraints),
    temperance: rollTrait('temperance', constraints),
    honor: rollTrait('honor', constraints),
  };

  if (overrides) {
    Object.assign(traits, overrides);
  }

  return traits;
}

function rollTrait(name: keyof PersonaTraits, constraints?: TraitConstraints): number {
  const min = constraints?.min?.[name] ?? 0;
  const max = constraints?.max?.[name] ?? 100;
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function buildPersonaProfile(traits: PersonaTraits, name: string, agentType: string): PersonaProfile {
  const paragraph = buildParagraph(traits, name, agentType);
  const ambitions = rankAmbitions(traits);
  const strategyHint = deriveStrategy(traits);
  const background = buildBackground(traits, agentType);

  return { traits, paragraph, ambitions, strategyHint, background };
}

function buildParagraph(traits: PersonaTraits, name: string, agentType: string): string {
  const parts: string[] = [];

  parts.push(`${name} is a ${agentType.replace(/_/g, ' ')}.`);

  if (traits.bravery > 70) parts.push('Known for fearless action in the face of danger.');
  else if (traits.bravery < 30) parts.push('Cautious by nature, preferring to avoid unnecessary risk.');

  if (traits.cruelty > 70) parts.push('Has a reputation for ruthlessness.');
  else if (traits.cruelty < 30) parts.push('Shows unusual mercy for these waters.');

  if (traits.greed > 70) parts.push('Driven by an insatiable hunger for wealth.');
  else if (traits.greed < 30) parts.push('Values things beyond mere gold.');

  if (traits.cunning > 70) parts.push('A schemer who always has a plan within a plan.');
  else if (traits.cunning < 30) parts.push('Straightforward in dealings, for better or worse.');

  if (traits.charisma > 70) parts.push('Commands attention in any room.');
  else if (traits.charisma < 30) parts.push('Not one for speeches or grand gestures.');

  if (traits.honor > 70) parts.push('A person of their word — rare in these waters.');
  else if (traits.honor < 30) parts.push('Will betray anyone if the price is right.');

  if (traits.superstition > 70) parts.push('Deeply superstitious, reading omens in everything.');
  if (traits.temperance < 30) parts.push('Given to excess in drink and indulgence.');

  return parts.join(' ');
}

function rankAmbitions(traits: PersonaTraits): string[] {
  const ambitionScores = [
    { name: 'wealth', score: traits.greed * 2 + traits.ambition },
    { name: 'power', score: traits.ambition * 2 + traits.bravery },
    { name: 'fame', score: traits.charisma * 2 + traits.bravery },
    { name: 'survival', score: (100 - traits.bravery) * 2 + traits.cunning },
    { name: 'respect', score: traits.honor * 2 + traits.charisma },
    { name: 'freedom', score: (100 - traits.loyalty) + traits.bravery + traits.ambition },
    { name: 'revenge', score: traits.cruelty + traits.ambition },
    { name: 'legacy', score: traits.honor + traits.ambition + traits.loyalty },
  ];

  return ambitionScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(a => a.name);
}

function deriveStrategy(traits: PersonaTraits): string {
  if (traits.bravery > 70 && traits.cruelty > 60) return 'aggressive';
  if (traits.cunning > 70 && traits.greed > 60) return 'opportunistic';
  if (traits.bravery < 40 && traits.cunning > 50) return 'cautious';
  if (traits.charisma > 70 && traits.honor > 60) return 'diplomatic';
  if (traits.greed > 70 && traits.temperance > 50) return 'mercantile';
  if (traits.loyalty > 70) return 'loyal';
  if (traits.ambition > 80) return 'ambitious';
  return 'balanced';
}

function buildBackground(traits: PersonaTraits, agentType: string): string {
  const backgrounds: Record<string, string[]> = {
    pirate_captain: [
      'Former merchant sailor turned to piracy after being cheated by employers.',
      'Born to poverty, took to the sea young and learned the ways of the account.',
      'A naval deserter who refused to serve tyrants any longer.',
      'Escaped slavery and vowed never to be subject to another man\'s will.',
      'A gentleman adventurer fallen from grace, seeking fortune on the waves.',
    ],
    merchant_captain: [
      'Third-generation trader following family routes.',
      'Self-made captain who scraped enough to buy a vessel.',
      'Former navy man gone into private enterprise.',
    ],
    naval_officer: [
      'Career navy man from a family of officers.',
      'Rose through the ranks from midshipman by merit.',
      'Political appointment with connections at the Admiralty.',
    ],
  };

  const options = backgrounds[agentType] ?? ['A person of uncertain origins who appeared in the Caribbean.'];
  return options[Math.floor(Math.random() * options.length)]!;
}

// Dynasty system: spawn child with parent trait influence
export function rollDynastyTraits(parentTraits: PersonaTraits, jitter = 15): PersonaTraits {
  const child: Partial<PersonaTraits> = {};

  for (const key of Object.keys(parentTraits) as Array<keyof PersonaTraits>) {
    const parentVal = parentTraits[key];
    const min = Math.max(0, parentVal - jitter);
    const max = Math.min(100, parentVal + jitter);
    child[key] = Math.floor(min + Math.random() * (max - min + 1));
  }

  return child as PersonaTraits;
}

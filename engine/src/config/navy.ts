export const NAVY_CONFIG = {
  ranks: [
    { id: 'midshipman', name: 'Midshipman', authority: 10, shipClass: 'sloop' },
    { id: 'lieutenant', name: 'Lieutenant', authority: 25, shipClass: 'brig' },
    { id: 'commander', name: 'Commander', authority: 40, shipClass: 'frigate' },
    { id: 'post_captain', name: 'Post Captain', authority: 60, shipClass: 'frigate' },
    { id: 'commodore', name: 'Commodore', authority: 75, shipClass: 'man_of_war' },
    { id: 'rear_admiral', name: 'Rear Admiral', authority: 90, shipClass: 'man_of_war' },
    { id: 'vice_admiral', name: 'Vice Admiral', authority: 95, shipClass: 'man_of_war' },
    { id: 'admiral', name: 'Admiral', authority: 100, shipClass: 'man_of_war' },
  ],

  attitudes: [
    { id: 'by_the_book', name: 'By the Book', description: 'Follows orders strictly. No leniency.' },
    { id: 'methodical', name: 'Methodical', description: 'Builds cases slowly but thoroughly.' },
    { id: 'aggressive', name: 'Aggressive', description: 'Shoots first, asks questions later.' },
    { id: 'corrupt', name: 'Corrupt', description: 'Can be bribed. Looks the other way for a price.' },
    { id: 'zealous', name: 'Zealous', description: 'Hates pirates with a passion. Relentless pursuer.' },
    { id: 'pragmatic', name: 'Pragmatic', description: 'Works with privateers. Understands gray areas.' },
  ],

  caseBuilding: {
    evidencePerSighting: 5,
    evidencePerWitness: 10,
    evidencePerIntel: 8,
    evidencePerCapture: 25,
    evidenceDecayPerTick: 0.5,
    warrantThreshold: 50,
    convictionThreshold: 75,
    hangingThreshold: 90,
  },

  pardons: {
    kingsPardeonAvailable: true,     // King's Pardon was 1718
    pardonClearsBelow: 70,           // clears evidence below this
    pardonCooldownTicks: 1000,       // can't get pardoned again quickly
    pardonRequiresPort: true,        // must be in a Crown port
    pardonInfamyThreshold: 80,      // too infamous = no pardon
  },

  patrols: {
    basePatrolSpeed: 5,
    pursuitSpeedMultiplier: 1.3,
    searchRadiusNm: 50,
    engagementRange: 10,
    patrolDurationTicks: 100,
    restDurationTicks: 30,
  },
} as const;

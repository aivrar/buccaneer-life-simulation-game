// Hurricane track configuration for historically accurate Caribbean storms (1715-1725)

export const STORM_NAMES = [
  'San Felipe', 'Santa Ana', 'The Great Gale', 'El Furioso', 'San Lorenzo',
  'Santa Rosa', 'San Martín', 'The Tempest', 'San Cristóbal', 'La Tormenta',
  'San Miguel', 'Santa Clara', 'El Destructor', 'San Juan', 'The Dreadful Storm',
  'San Pedro', 'Santa María', 'The Dark Wind', 'San Nicolás', 'La Furia',
  'San Andrés', 'Santa Bárbara', 'El Azote', 'San Francisco', 'The Devil Wind',
  'San Rafael', 'Santa Lucía', 'El Huracán', 'San Diego', 'The Wrath of God',
];

export interface HurricaneTrack {
  name: string;
  zoneIds: string[];
  weight: number;
  minCategory: number;
  maxCategory: number;
}

export const HURRICANE_TRACKS: HurricaneTrack[] = [
  {
    name: 'Eastern Caribbean Arc',
    zoneIds: ['atlantic_approach', 'windward_islands_waters', 'leeward_islands_waters', 'caribbean_deep_basin', 'jamaica_channel', 'windward_passage', 'bahama_channel'],
    weight: 25,
    minCategory: 1,
    maxCategory: 3,
  },
  {
    name: 'Windward Passage',
    zoneIds: ['caribbean_deep_basin', 'windward_passage', 'old_bahama_channel', 'florida_straits'],
    weight: 15,
    minCategory: 1,
    maxCategory: 2,
  },
  {
    name: 'Jamaica Direct',
    zoneIds: ['caribbean_deep_basin', 'kingston_approaches', 'jamaica_channel'],
    weight: 15,
    minCategory: 1,
    maxCategory: 3,
  },
  {
    name: 'Gulf Runner',
    zoneIds: ['caribbean_deep_basin', 'cayman_trench', 'yucatan_channel', 'gulf_of_mexico'],
    weight: 12,
    minCategory: 1,
    maxCategory: 2,
  },
  {
    name: 'Bahamas Track',
    zoneIds: ['turks_passage', 'providence_channel', 'great_bahama_bank', 'bahama_channel', 'carolina_shelf'],
    weight: 12,
    minCategory: 1,
    maxCategory: 2,
  },
  {
    name: 'Florida Straits (1715 Fleet)',
    zoneIds: ['caribbean_deep_basin', 'havana_roads', 'florida_straits', 'bahama_channel'],
    weight: 10,
    minCategory: 2,
    maxCategory: 4,
  },
  {
    name: 'Lesser Antilles Graze',
    zoneIds: ['atlantic_approach', 'windward_islands_waters', 'leeward_islands_waters', 'atlantic_approach'],
    weight: 6,
    minCategory: 1,
    maxCategory: 2,
  },
  {
    name: 'Carolina Recurve',
    zoneIds: ['bahama_channel', 'carolina_shelf', 'boston_waters'],
    weight: 5,
    minCategory: 1,
    maxCategory: 2,
  },
];

// Zones where storms can intensify over deep warm water
export const ZONE_CATEGORY_MODIFIERS: Record<string, number> = {
  caribbean_deep_basin: 1,
  cayman_trench: 1,
  atlantic_approach: 1,
  // Coastal/shallow zones weaken storms on exit
  great_bahama_bank: -1,
  kingston_approaches: -1,
  havana_roads: -1,
  spanish_main_coast: -1,
  darien_coast: -1,
  west_african_coast: -1,
};

// Risk multipliers for hurricaneRisk values from weather profiles
export const HURRICANE_RISK_MULTIPLIER: Record<string, number> = {
  none: 0,
  low: 0.3,
  moderate: 0.6,
  high: 0.85,
  very_high: 1.0,
};

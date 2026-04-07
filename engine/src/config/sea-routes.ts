// Pre-computed routes between ports as sequences of sea zones
// From PHYSICAL_WORLD.md route planning section

export interface SeaRoute {
  from: string;
  to: string;
  zones: string[];          // ordered sequence of sea zones
  distanceNm: number;
  typicalDays: [number, number]; // [min, max]
  notes?: string;
}

export const SEA_ROUTES: SeaRoute[] = [
  // Nassau routes
  { from: 'nassau', to: 'port_royal', zones: ['great_bahama_bank', 'old_bahama_channel', 'windward_passage', 'jamaica_channel', 'kingston_approaches'], distanceNm: 500, typicalDays: [3, 5], notes: 'Crosses the dangerous Windward Passage.' },
  { from: 'nassau', to: 'havana', zones: ['great_bahama_bank', 'old_bahama_channel', 'havana_roads'], distanceNm: 300, typicalDays: [2, 3] },
  { from: 'nassau', to: 'charles_town', zones: ['great_bahama_bank', 'providence_channel', 'bahama_channel', 'carolina_shelf'], distanceNm: 600, typicalDays: [3, 5] },
  { from: 'nassau', to: 'tortuga', zones: ['great_bahama_bank', 'old_bahama_channel', 'windward_passage', 'tortuga_waters'], distanceNm: 400, typicalDays: [3, 4] },
  { from: 'nassau', to: 'bridgetown', zones: ['great_bahama_bank', 'providence_channel', 'atlantic_approach', 'windward_islands_waters'], distanceNm: 900, typicalDays: [5, 8] },
  { from: 'nassau', to: 'santo_domingo', zones: ['great_bahama_bank', 'turks_passage', 'silver_bank', 'tortuga_waters'], distanceNm: 450, typicalDays: [3, 5] },
  { from: 'nassau', to: 'boston', zones: ['great_bahama_bank', 'providence_channel', 'bahama_channel', 'carolina_shelf', 'boston_waters'], distanceNm: 1200, typicalDays: [7, 12] },
  { from: 'nassau', to: 'cartagena', zones: ['great_bahama_bank', 'old_bahama_channel', 'windward_passage', 'jamaica_channel', 'caribbean_deep_basin', 'spanish_main_coast'], distanceNm: 950, typicalDays: [6, 9] },
  { from: 'nassau', to: 'portobelo', zones: ['great_bahama_bank', 'old_bahama_channel', 'windward_passage', 'jamaica_channel', 'caribbean_deep_basin', 'darien_coast'], distanceNm: 1000, typicalDays: [6, 10] },
  { from: 'nassau', to: 'willemstad', zones: ['great_bahama_bank', 'old_bahama_channel', 'windward_passage', 'jamaica_channel', 'caribbean_deep_basin', 'spanish_main_coast'], distanceNm: 1000, typicalDays: [6, 10] },
  { from: 'nassau', to: 'veracruz', zones: ['great_bahama_bank', 'florida_straits', 'gulf_of_mexico'], distanceNm: 800, typicalDays: [5, 8] },
  { from: 'nassau', to: 'petit_goave', zones: ['great_bahama_bank', 'old_bahama_channel', 'windward_passage', 'jamaica_channel'], distanceNm: 450, typicalDays: [3, 5] },
  { from: 'nassau', to: 'basseterre', zones: ['great_bahama_bank', 'turks_passage', 'silver_bank', 'mona_passage', 'leeward_islands_waters'], distanceNm: 850, typicalDays: [5, 8] },

  // Port Royal routes
  { from: 'port_royal', to: 'havana', zones: ['kingston_approaches', 'jamaica_channel', 'old_bahama_channel', 'havana_roads'], distanceNm: 350, typicalDays: [2, 4] },
  { from: 'port_royal', to: 'bridgetown', zones: ['kingston_approaches', 'jamaica_channel', 'caribbean_deep_basin', 'windward_islands_waters'], distanceNm: 600, typicalDays: [4, 6] },
  { from: 'port_royal', to: 'tortuga', zones: ['kingston_approaches', 'jamaica_channel', 'windward_passage', 'tortuga_waters'], distanceNm: 300, typicalDays: [2, 3] },
  { from: 'port_royal', to: 'cartagena', zones: ['kingston_approaches', 'jamaica_channel', 'caribbean_deep_basin', 'spanish_main_coast'], distanceNm: 500, typicalDays: [3, 5] },
  { from: 'port_royal', to: 'portobelo', zones: ['kingston_approaches', 'jamaica_channel', 'caribbean_deep_basin', 'darien_coast'], distanceNm: 550, typicalDays: [4, 6] },
  { from: 'port_royal', to: 'charles_town', zones: ['kingston_approaches', 'jamaica_channel', 'windward_passage', 'old_bahama_channel', 'bahama_channel', 'carolina_shelf'], distanceNm: 1100, typicalDays: [7, 10] },
  { from: 'port_royal', to: 'santo_domingo', zones: ['kingston_approaches', 'jamaica_channel', 'windward_passage', 'tortuga_waters'], distanceNm: 350, typicalDays: [2, 4] },
  { from: 'port_royal', to: 'petit_goave', zones: ['kingston_approaches', 'jamaica_channel'], distanceNm: 150, typicalDays: [1, 2] },
  { from: 'port_royal', to: 'willemstad', zones: ['kingston_approaches', 'jamaica_channel', 'caribbean_deep_basin', 'spanish_main_coast'], distanceNm: 550, typicalDays: [4, 6] },

  // Havana routes
  { from: 'havana', to: 'veracruz', zones: ['havana_roads', 'yucatan_channel', 'gulf_of_mexico'], distanceNm: 500, typicalDays: [3, 5] },
  { from: 'havana', to: 'cartagena', zones: ['havana_roads', 'caribbean_deep_basin', 'spanish_main_coast'], distanceNm: 750, typicalDays: [5, 7] },
  { from: 'havana', to: 'portobelo', zones: ['havana_roads', 'caribbean_deep_basin', 'cayman_trench', 'darien_coast'], distanceNm: 800, typicalDays: [5, 8], notes: 'Treasure fleet route — heavily laden and vulnerable.' },
  { from: 'havana', to: 'charles_town', zones: ['havana_roads', 'florida_straits', 'bahama_channel', 'carolina_shelf'], distanceNm: 750, typicalDays: [4, 7] },

  // Bridgetown routes
  { from: 'bridgetown', to: 'basseterre', zones: ['windward_islands_waters', 'leeward_islands_waters'], distanceNm: 250, typicalDays: [1, 2] },
  { from: 'bridgetown', to: 'cartagena', zones: ['windward_islands_waters', 'caribbean_deep_basin', 'spanish_main_coast'], distanceNm: 500, typicalDays: [3, 5] },
  { from: 'bridgetown', to: 'santo_domingo', zones: ['windward_islands_waters', 'leeward_islands_waters', 'mona_passage', 'tortuga_waters'], distanceNm: 400, typicalDays: [3, 5] },
  { from: 'bridgetown', to: 'willemstad', zones: ['windward_islands_waters', 'tobago_channel', 'spanish_main_coast'], distanceNm: 400, typicalDays: [2, 4] },

  // Charles Town routes
  { from: 'charles_town', to: 'boston', zones: ['carolina_shelf', 'boston_waters'], distanceNm: 600, typicalDays: [3, 5] },

  // Portobelo to Havana (treasure route)
  { from: 'portobelo', to: 'havana', zones: ['darien_coast', 'caribbean_deep_basin', 'cayman_trench', 'havana_roads'], distanceNm: 800, typicalDays: [5, 8], notes: 'Treasure-laden and vulnerable.' },

  // Cartagena routes
  { from: 'cartagena', to: 'portobelo', zones: ['spanish_main_coast', 'darien_coast'], distanceNm: 200, typicalDays: [1, 2] },

  // West Africa routes (Middle Passage)
  { from: 'cape_coast_castle', to: 'bridgetown', zones: ['west_african_coast', 'atlantic_approach', 'windward_islands_waters'], distanceNm: 3000, typicalDays: [42, 84], notes: 'The Middle Passage.' },
  { from: 'cape_coast_castle', to: 'port_royal', zones: ['west_african_coast', 'atlantic_approach', 'windward_islands_waters', 'caribbean_deep_basin', 'jamaica_channel', 'kingston_approaches'], distanceNm: 3500, typicalDays: [49, 90] },
  { from: 'whydah', to: 'bridgetown', zones: ['west_african_coast', 'atlantic_approach', 'windward_islands_waters'], distanceNm: 3200, typicalDays: [42, 84] },

  // Transatlantic (treasure fleet return)
  { from: 'havana', to: 'seville_cadiz', zones: ['havana_roads', 'florida_straits', 'bahama_channel', 'atlantic_approach'], distanceNm: 4500, typicalDays: [42, 70], notes: 'Treasure fleet return route via Gulf Stream.' },
];

// Build a quick lookup index
const routeIndex = new Map<string, SeaRoute>();
for (const route of SEA_ROUTES) {
  routeIndex.set(`${route.from}→${route.to}`, route);
}

export function getRoute(from: string, to: string): SeaRoute | null {
  // Check direct
  const direct = routeIndex.get(`${from}→${to}`);
  if (direct) return direct;

  // Check reverse (zones reversed)
  const reverse = routeIndex.get(`${to}→${from}`);
  if (reverse) {
    return {
      from,
      to,
      zones: [...reverse.zones].reverse(),
      distanceNm: reverse.distanceNm,
      typicalDays: reverse.typicalDays,
      notes: reverse.notes,
    };
  }

  return null;
}

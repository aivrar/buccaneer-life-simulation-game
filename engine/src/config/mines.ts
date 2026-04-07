// Mines, fisheries, and natural resource extraction sites — 1715-1725
// These are the sources of precious metals, gems, and animal products
// that flow through the Caribbean trade network.
//
// Unlike crops, most extraction sites are far inland. Weather affects
// the trans-shipment ports, not the mines themselves. Output rates
// reflect the historical record for 1715-1725.

// ============================================================
// Extraction Site Definition
// ============================================================

export type ExtractionType = 'silver_mine' | 'gold_mine' | 'gold_alluvial' | 'emerald_mine' | 'pearl_fishery' | 'ivory_trade' | 'whaling' | 'turtle_fishery' | 'ambergris';

export interface ExtractionSite {
  id: string;
  name: string;
  type: ExtractionType;
  cargoId: string;                       // links to CARGO_TYPES
  transShipmentPort: string;             // the port where this product enters the trade network
  annualOutput: number;                  // units per year (same scale as plantations)
  peakMonths: number[];                  // months of highest output/availability
  lowMonths: number[];                   // months of lowest output (monsoon, winter, etc.)
  weatherVulnerability: number;          // 0-1 how much weather at the port affects output
  fleetDependent: boolean;               // true = output only flows when treasure fleet is present
  description: string;
}

export const EXTRACTION_SITES: ExtractionSite[] = [
  // ══════════════════════════════════════════════════════════
  // SILVER — the engine of the Spanish Empire
  // ══════════════════════════════════════════════════════════

  {
    id: 'potosi_silver',
    name: 'Potosí Silver Mines',
    type: 'silver_mine',
    cargoId: 'silver',
    transShipmentPort: 'portobelo',
    annualOutput: 400,
    peakMonths: [4, 5, 6, 7],             // dry season in Andes = easier transport
    lowMonths: [12, 1, 2],                // rainy season blocks mountain roads
    weatherVulnerability: 0.3,            // mine is inland; weather affects mule trains to coast
    fleetDependent: true,                  // silver sits in Portobelo until the fleet arrives
    description: 'Cerro Rico de Potosí in Upper Peru (modern Bolivia). The richest silver deposit ever found. By 1715 past its peak but still producing massively. Silver is minted into coins, loaded onto mule trains, shipped to Panama, portaged across the isthmus, and stored at Portobelo for the Tierra Firme fleet.',
  },
  {
    id: 'zacatecas_silver',
    name: 'Zacatecas Silver Mines',
    type: 'silver_mine',
    cargoId: 'silver',
    transShipmentPort: 'veracruz',
    annualOutput: 350,
    peakMonths: [11, 12, 1, 2, 3, 4],    // dry season in Mexico = better road transport
    lowMonths: [7, 8, 9],                 // rainy season floods roads
    weatherVulnerability: 0.2,            // inland mine; northers at Veracruz delay shipping
    fleetDependent: true,                  // waits for New Spain fleet
    description: 'Zacatecas and the surrounding mines of San Luis Potosí, Guanajuato, and Real de Catorce. Mexico\'s silver heartland. Mule trains carry silver bars and coins south to Mexico City, then east over the mountains to Veracruz. The silver sits in San Juan de Ulúa fortress until the New Spain fleet departs.',
  },

  // ══════════════════════════════════════════════════════════
  // GOLD
  // ══════════════════════════════════════════════════════════

  {
    id: 'new_granada_gold',
    name: 'New Granada Gold Mines',
    type: 'gold_mine',
    cargoId: 'gold',
    transShipmentPort: 'cartagena',
    annualOutput: 80,
    peakMonths: [12, 1, 2, 3],            // dry season = easier river/mule transport
    lowMonths: [5, 6, 7, 8],              // rainy season floods rivers and roads
    weatherVulnerability: 0.3,
    fleetDependent: true,                  // waits for Tierra Firme fleet at Cartagena
    description: 'Alluvial and vein gold from the Chocó, Antioquia, and Popayán regions of New Granada (modern Colombia). Enslaved Africans and indigenous people work the mines. Gold is transported by mule and river to Cartagena. New Granada produces more gold than any other Spanish territory.',
  },
  {
    id: 'gold_coast_gold',
    name: 'Gold Coast Alluvial Gold',
    type: 'gold_alluvial',
    cargoId: 'gold',
    transShipmentPort: 'cape_coast_castle',
    annualOutput: 40,
    peakMonths: [11, 12, 1, 2],           // dry season = mining possible
    lowMonths: [5, 6, 7, 8],              // rainy season floods mining sites
    weatherVulnerability: 0.4,            // rainy season shuts down alluvial operations
    fleetDependent: false,                 // traded year-round with arriving ships
    description: 'Alluvial gold panned and mined by Akan peoples in the interior (Ashanti, Denkyira). Traded through intermediary merchants to European forts on the coast. The Gold Coast is named for this trade. The Ashanti Empire\'s wealth is built on it. Gold dust is the currency of the region.',
  },
  {
    id: 'elmina_gold',
    name: 'Elmina Gold Trade',
    type: 'gold_alluvial',
    cargoId: 'gold',
    transShipmentPort: 'elmina',
    annualOutput: 25,
    peakMonths: [11, 12, 1, 2],
    lowMonths: [5, 6, 7, 8],
    weatherVulnerability: 0.4,
    fleetDependent: false,
    description: 'Dutch-controlled gold trade at Elmina. The Portuguese built the castle in 1482 specifically for the gold trade. By 1715 the Dutch have held it for 80 years. Gold from the interior Akan kingdoms flows through Elmina alongside the slave trade.',
  },

  // ══════════════════════════════════════════════════════════
  // EMERALDS — Colombian world monopoly
  // ══════════════════════════════════════════════════════════

  {
    id: 'muzo_emeralds',
    name: 'Muzo & Chivor Emerald Mines',
    type: 'emerald_mine',
    cargoId: 'emeralds',
    transShipmentPort: 'cartagena',
    annualOutput: 15,                      // small volume, enormous value
    peakMonths: [12, 1, 2, 3],            // dry season
    lowMonths: [5, 6, 7, 8],
    weatherVulnerability: 0.2,            // stones are small and durable
    fleetDependent: true,                  // shipped with the treasure fleet
    description: 'The Muzo and Chivor mines in the mountains of New Granada are the world\'s only significant source of emeralds. The finest stones are a deep green found nowhere else. Mined by indigenous and enslaved labor in dangerous mountain tunnels. Emeralds travel with gold to Cartagena, then join the Tierra Firme fleet.',
  },

  // ══════════════════════════════════════════════════════════
  // PEARLS — Venezuelan pearl fisheries
  // ══════════════════════════════════════════════════════════

  {
    id: 'margarita_pearls',
    name: 'Isla Margarita Pearl Fisheries',
    type: 'pearl_fishery',
    cargoId: 'pearls',
    transShipmentPort: 'cartagena',        // pearls shipped via Cartagena
    annualOutput: 20,
    peakMonths: [1, 2, 3, 4, 5],          // calm seas, good diving weather
    lowMonths: [7, 8, 9, 10],             // hurricane season, rough seas
    weatherVulnerability: 0.6,            // diving requires calm seas
    fleetDependent: false,                 // pearls traded year-round
    description: 'Pearl fisheries off Isla Margarita and Cubagua, Venezuela. Once the richest pearl beds in the world — now declining after two centuries of exploitation but still producing. Enslaved and indigenous divers free-dive to harvest oysters. Pearls shipped to Cartagena for the treasure fleet, or smuggled to Dutch Curaçao.',
  },

  // ══════════════════════════════════════════════════════════
  // IVORY — West African trade
  // ══════════════════════════════════════════════════════════

  {
    id: 'gold_coast_ivory',
    name: 'Gold Coast Ivory Trade',
    type: 'ivory_trade',
    cargoId: 'ivory',
    transShipmentPort: 'cape_coast_castle',
    annualOutput: 30,
    peakMonths: [11, 12, 1, 2, 3],        // dry season = easier transport from interior
    lowMonths: [6, 7, 8],                 // rainy season blocks forest paths
    weatherVulnerability: 0.3,
    fleetDependent: false,
    description: 'Elephant tusks traded from the interior of West Africa through coastal intermediaries to European forts. The Ivory Coast gets its name from this trade. By 1715, elephant populations are already declining near the coast, pushing hunters deeper inland.',
  },
  {
    id: 'whydah_ivory',
    name: 'Dahomey Ivory Trade',
    type: 'ivory_trade',
    cargoId: 'ivory',
    transShipmentPort: 'whydah',
    annualOutput: 20,
    peakMonths: [11, 12, 1, 2],
    lowMonths: [6, 7, 8],
    weatherVulnerability: 0.3,
    fleetDependent: false,
    description: 'The Kingdom of Dahomey controls ivory trade through Whydah. Royal hunters supply tusks that are traded alongside enslaved people to European ships. Dahomey\'s king takes a cut of everything.',
  },

  // ══════════════════════════════════════════════════════════
  // WHALING & WHALE PRODUCTS
  // ══════════════════════════════════════════════════════════

  {
    id: 'nantucket_whaling',
    name: 'New England Whaling',
    type: 'whaling',
    cargoId: 'whale_products',
    transShipmentPort: 'boston',
    annualOutput: 60,
    peakMonths: [4, 5, 6, 7, 8, 9, 10],  // spring through fall whaling season
    lowMonths: [12, 1, 2],                // winter too dangerous
    weatherVulnerability: 0.5,            // storms keep whalers in port
    fleetDependent: false,
    description: 'Nantucket and Cape Cod whalers hunt right whales and sperm whales off the New England coast and increasingly into the Atlantic. Whale oil for lamps, spermaceti for candles, baleen for corset stays and tools. The industry is booming — Nantucket has 6 whaling sloops by 1715.',
  },
  {
    id: 'silver_bank_whaling',
    name: 'Silver Bank Whale Grounds',
    type: 'whaling',
    cargoId: 'whale_products',
    transShipmentPort: 'port_royal',       // nearest major port
    annualOutput: 15,
    peakMonths: [1, 2, 3, 4],             // humpback breeding season
    lowMonths: [6, 7, 8, 9, 10, 11],
    weatherVulnerability: 0.5,
    fleetDependent: false,
    description: 'Humpback whales breed on Silver Bank north of Hispaniola every winter. Caribbean whalers hunt them in the calving grounds. Opportunistic — not an organized industry like New England, but whale products are valuable and the whales are easy targets while breeding.',
  },

  // ══════════════════════════════════════════════════════════
  // AMBERGRIS — floating treasure
  // ══════════════════════════════════════════════════════════

  {
    id: 'caribbean_ambergris',
    name: 'Caribbean Ambergris',
    type: 'ambergris',
    cargoId: 'ambergris',
    transShipmentPort: 'nassau',           // beachcombers, pirates find it
    annualOutput: 2,                       // extremely rare
    peakMonths: [1, 2, 3, 4, 11, 12],    // found on beaches after winter storms
    lowMonths: [6, 7, 8],                 // hurricane season — too dangerous to beachcomb
    weatherVulnerability: 0.7,            // storms wash it ashore but also destroy searchers
    fleetDependent: false,
    description: 'Sperm whale intestinal secretion found floating at sea or washed ashore. Worth its weight in gold — literally. Used as a perfume fixative in Europe. Any beachcomber, fisherman, or pirate who finds a lump of ambergris has found a fortune. Pure luck.',
  },

  // ══════════════════════════════════════════════════════════
  // TURTLE — Caribbean protein source
  // ══════════════════════════════════════════════════════════

  {
    id: 'cayman_turtle',
    name: 'Cayman Islands Turtle Fishery',
    type: 'turtle_fishery',
    cargoId: 'turtle',
    transShipmentPort: 'port_royal',
    annualOutput: 100,
    peakMonths: [5, 6, 7, 8],             // nesting season — turtles on beaches
    lowMonths: [11, 12, 1, 2],            // fewer turtles
    weatherVulnerability: 0.5,            // storms prevent fishing
    fleetDependent: false,
    description: 'The Cayman Islands are THE green sea turtle capital of the Caribbean. Turtles nest on the beaches May-August, making them easy to catch. Jamaican sloops make regular runs to the Caymans specifically for turtle. Live turtles are kept in kraals (pens) at Port Royal — fresh meat that keeps itself alive. Turtle soup is the Caribbean\'s signature dish.',
  },
  {
    id: 'caribbean_turtle',
    name: 'Caribbean Turtle Fishing',
    type: 'turtle_fishery',
    cargoId: 'turtle',
    transShipmentPort: 'nassau',
    annualOutput: 40,
    peakMonths: [5, 6, 7, 8],
    lowMonths: [11, 12, 1, 2],
    weatherVulnerability: 0.5,
    fleetDependent: false,
    description: 'Green sea turtles caught throughout the Bahamas and Caribbean by fishermen and pirates alike. Live turtles kept on deck as fresh meat. Every pirate sloop carries turtle. The best ship provision — fresh meat that stores itself.',
  },

  // ══════════════════════════════════════════════════════════
  // TORTOISESHELL — luxury export
  // ══════════════════════════════════════════════════════════

  {
    id: 'caribbean_tortoiseshell',
    name: 'Caribbean Hawksbill Turtle',
    type: 'turtle_fishery',
    cargoId: 'tortoiseshell',
    transShipmentPort: 'port_royal',
    annualOutput: 15,
    peakMonths: [5, 6, 7, 8, 9],          // nesting season
    lowMonths: [12, 1, 2],
    weatherVulnerability: 0.5,
    fleetDependent: false,
    description: 'Hawksbill sea turtles are hunted for their beautiful mottled shell plates. Tortoiseshell is a luxury material in Europe — used for combs, spectacle frames, jewelry boxes, and decorative inlay. The Caymans, Bahamas, and Mosquito Coast are the main sources. The meat is considered inferior to green turtle.',
  },
];

// ============================================================
// Utility
// ============================================================

export function getExtractionSitesForPort(portId: string): ExtractionSite[] {
  return EXTRACTION_SITES.filter(s => s.transShipmentPort === portId);
}

export function getFleetDependentSites(): ExtractionSite[] {
  return EXTRACTION_SITES.filter(s => s.fleetDependent);
}

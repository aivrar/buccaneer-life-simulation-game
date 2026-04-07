// Crop and organic product definitions — what grows where in 1715-1725
// Cross-referenced against weather profiles for historical/climate accuracy
//
// Climate verification key (from weather-profiles.ts):
//   Caribbean ports:  75-90°F, rainy May-Nov, dry Dec-Apr
//   Charles Town:     40-90°F, rainy Jun-Sep, dry Oct-May
//   Boston:           25-85°F, rainy Mar-Apr, dry Jun-Sep
//   Veracruz:         65-95°F, rainy Jun-Oct, dry Nov-May
//   London:           35-75°F, rainy Oct-Jan, dry May-Aug
//   Seville/Cadiz:    45-95°F, rainy Oct-Mar, dry Jun-Sep
//   Amsterdam:        30-72°F, rainy Oct-Jan, dry Apr-Jun
//   West Africa:      75-92°F, rainy Mar-Oct, dry Nov-Feb (harmattan Dec-Feb)

// ============================================================
// Crop Definition
// ============================================================

export interface CropDefinition {
  id: string;
  name: string;
  category: 'export_crop' | 'provision' | 'timber' | 'spice' | 'fruit' | 'fiber' | 'dye' | 'forage';
  cargoId?: string;                   // links to CARGO_TYPES for tradeable goods
  tempRangeF: [number, number];       // survivable temperature range
  idealTempF: [number, number];       // optimal growing range
  rainfallNeed: 'arid' | 'low' | 'moderate' | 'heavy' | 'very_heavy';
  growingMonths: number[];            // months of active growth (1-12)
  harvestMonths: number[];            // peak harvest months
  perennial: boolean;                 // tree/perennial vs annual replanting
  hurricaneVulnerability: number;     // 0-1 damage from hurricane
  droughtVulnerability: number;       // 0-1 damage from extended dry/becalmed
  floodVulnerability: number;         // 0-1 damage from heavy rain/flooding
  frostVulnerability: number;         // 0-1 damage from cold (northers, winter)
  description: string;
}

export const CROP_DEFINITIONS: Record<string, CropDefinition> = {
  // ══════════════════════════════════════════════════════════
  // EXPORT CROPS — plantation agriculture, the wealth of empire
  // ══════════════════════════════════════════════════════════

  sugar: {
    id: 'sugar',
    name: 'Sugarcane',
    category: 'export_crop',
    cargoId: 'sugar',
    tempRangeF: [60, 100],
    idealTempF: [75, 90],
    rainfallNeed: 'heavy',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 5],     // dry season harvest (Jan-May)
    perennial: true,                      // ratoon cropping — regrows from stumps
    hurricaneVulnerability: 0.7,          // tall cane flattened by wind
    droughtVulnerability: 0.6,            // needs heavy rainfall
    floodVulnerability: 0.3,              // tolerates wet but not standing water
    frostVulnerability: 0.9,              // tropical, killed by frost
    description: 'King Sugar. 12-18 month growth cycle, harvested in dry season. Requires massive labor force (enslaved), capital for mills, and heavy rainfall. Yields sugar, molasses, and rum.',
  },

  tobacco: {
    id: 'tobacco',
    name: 'Tobacco',
    category: 'export_crop',
    cargoId: 'tobacco',
    tempRangeF: [55, 95],
    idealTempF: [68, 85],
    rainfallNeed: 'moderate',
    growingMonths: [3, 4, 5, 6, 7, 8],
    harvestMonths: [7, 8, 9],             // late summer harvest, then drying
    perennial: false,                      // annual replanting
    hurricaneVulnerability: 0.8,           // delicate leaves destroyed by wind/rain
    droughtVulnerability: 0.5,
    floodVulnerability: 0.7,               // needs well-drained soil
    frostVulnerability: 0.7,
    description: 'Cuban tobacco from the Vuelta Abajo is the finest in the world. The leaves need rich, well-drained soil and careful drying in barns. A skilled and labor-intensive crop.',
  },

  rice: {
    id: 'rice',
    name: 'Rice',
    category: 'export_crop',
    cargoId: 'rice',
    tempRangeF: [50, 100],
    idealTempF: [70, 95],
    rainfallNeed: 'very_heavy',
    growingMonths: [4, 5, 6, 7, 8, 9],
    harvestMonths: [9, 10],               // fall harvest
    perennial: false,
    hurricaneVulnerability: 0.4,           // low-lying, flexible
    droughtVulnerability: 0.9,             // needs flooded paddies
    floodVulnerability: 0.1,               // thrives in water
    frostVulnerability: 0.6,
    description: 'Carolina Gold rice, cultivated using West African knowledge brought by enslaved people. Grown in flooded tidal paddies along the Ashley and Cooper Rivers. One of Carolina\'s most valuable exports.',
  },

  cotton: {
    id: 'cotton',
    name: 'Sea Island Cotton',
    category: 'fiber',
    cargoId: 'cotton',
    tempRangeF: [60, 100],
    idealTempF: [70, 90],
    rainfallNeed: 'moderate',
    growingMonths: [3, 4, 5, 6, 7, 8],
    harvestMonths: [8, 9, 10],            // needs dry harvest period
    perennial: false,
    hurricaneVulnerability: 0.6,           // bolls destroyed by rain at harvest
    droughtVulnerability: 0.4,
    floodVulnerability: 0.7,               // root rot in wet soil
    frostVulnerability: 0.7,
    description: 'Long-staple Sea Island cotton grown in the Caribbean and Carolina. Superseded by sugar on most islands but still cultivated where sugar won\'t grow. Needs a dry period for boll opening and harvest.',
  },

  indigo: {
    id: 'indigo',
    name: 'Indigo',
    category: 'dye',
    cargoId: 'indigo',
    tempRangeF: [60, 95],
    idealTempF: [70, 85],
    rainfallNeed: 'moderate',
    growingMonths: [4, 5, 6, 7, 8, 9],
    harvestMonths: [7, 8, 9],             // multiple cuttings possible
    perennial: false,                      // treated as annual
    hurricaneVulnerability: 0.5,
    droughtVulnerability: 0.3,             // fairly drought-tolerant
    floodVulnerability: 0.6,
    frostVulnerability: 0.6,
    description: 'Blue gold. The dye plant is cut, fermented in vats, and the blue precipitate dried into cakes. Grown in Carolina, Saint-Domingue, and the Spanish Main. Foul-smelling processing but enormously valuable.',
  },

  cacao: {
    id: 'cacao',
    name: 'Cacao',
    category: 'export_crop',
    cargoId: 'cacao',
    tempRangeF: [64, 95],
    idealTempF: [70, 85],
    rainfallNeed: 'heavy',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [10, 11, 12, 1, 2, 3], // two harvests per year
    perennial: true,                       // tree crop, 3-5 years to first harvest
    hurricaneVulnerability: 0.6,           // shade trees protect somewhat
    droughtVulnerability: 0.7,             // needs constant moisture
    floodVulnerability: 0.4,
    frostVulnerability: 0.95,              // extremely cold-sensitive
    description: 'Chocolate tree. Grows in the shade of taller canopy trees. Pods harvested, beans fermented and dried. Venezuela (Caracas cacao) produces the finest. Also grown in Trinidad, Hispaniola, and Central America.',
  },

  // ══════════════════════════════════════════════════════════
  // SPICES — Jamaica\'s gift to the world
  // ══════════════════════════════════════════════════════════

  pimento: {
    id: 'pimento',
    name: 'Pimento (Allspice)',
    category: 'spice',
    cargoId: 'pimento',
    tempRangeF: [65, 95],
    idealTempF: [75, 88],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [6, 7, 8, 9],          // berries picked green, then dried
    perennial: true,                       // large tree, decades of production
    hurricaneVulnerability: 0.3,           // deep-rooted tree, wind-resistant
    droughtVulnerability: 0.3,
    floodVulnerability: 0.3,
    frostVulnerability: 0.8,
    description: 'Jamaica holds a near-monopoly on the world supply. Called "allspice" because it tastes of clove, cinnamon, and nutmeg combined. The berries are picked green from wild and cultivated trees and dried in the sun.',
  },

  ginger: {
    id: 'ginger',
    name: 'Ginger',
    category: 'spice',
    cargoId: 'ginger',
    tempRangeF: [60, 95],
    idealTempF: [75, 90],
    rainfallNeed: 'heavy',
    growingMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    harvestMonths: [10, 11, 12, 1],       // 8-10 months after planting
    perennial: false,                      // rhizome replanted annually
    hurricaneVulnerability: 0.3,           // low-growing, wind-resistant
    droughtVulnerability: 0.7,             // needs heavy moisture
    floodVulnerability: 0.5,
    frostVulnerability: 0.8,
    description: 'Jamaica was the first Caribbean ginger exporter. The rhizome is dug up, cleaned, and dried or preserved. Grown in rich, well-watered soils. Also cultivated in Barbados and St. Kitts.',
  },

  // ══════════════════════════════════════════════════════════
  // TIMBER & FOREST PRODUCTS
  // ══════════════════════════════════════════════════════════

  logwood: {
    id: 'logwood',
    name: 'Logwood',
    category: 'dye',
    cargoId: 'logwood',
    tempRangeF: [65, 95],
    idealTempF: [75, 90],
    rainfallNeed: 'heavy',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 11, 12],  // dry season cutting easier
    perennial: true,                        // wild tree, not plantation-grown
    hurricaneVulnerability: 0.2,            // sturdy tree
    droughtVulnerability: 0.2,              // swamp tree
    floodVulnerability: 0.05,               // thrives in wet
    frostVulnerability: 0.7,
    description: 'Haematoxylum campechianum. Harvested from coastal swamps in Honduras, Campeche Bay, and Jamaica. The heartwood yields a valuable black-purple dye for the European textile industry. Baymen (English logwood cutters) live rough lives in the swamps.',
  },

  mahogany: {
    id: 'mahogany',
    name: 'Mahogany',
    category: 'timber',
    cargoId: 'mahogany',
    tempRangeF: [65, 95],
    idealTempF: [75, 90],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [11, 12, 1, 2, 3, 4],  // dry season felling and transport
    perennial: true,                        // slow-growing hardwood
    hurricaneVulnerability: 0.3,            // massive tree, deep roots
    droughtVulnerability: 0.2,
    floodVulnerability: 0.2,
    frostVulnerability: 0.7,
    description: 'Swietenia mahagoni. The Caribbean luxury timber. Massive trees felled in the interior of Jamaica, Honduras, and Cuba, then floated downriver to the coast. Just beginning to be fashionable in European furniture in this period.',
  },

  cedar: {
    id: 'cedar',
    name: 'West Indian Cedar',
    category: 'timber',
    cargoId: 'timber',
    tempRangeF: [65, 95],
    idealTempF: [75, 88],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [11, 12, 1, 2, 3],
    perennial: true,
    hurricaneVulnerability: 0.3,
    droughtVulnerability: 0.3,
    floodVulnerability: 0.3,
    frostVulnerability: 0.7,
    description: 'Cedrela odorata. Aromatic, rot-resistant timber used in shipbuilding, cigar boxes, and fine carpentry. Found throughout the Caribbean. The Spanish prize it for ship construction at Havana\'s astillero.',
  },

  pine: {
    id: 'pine',
    name: 'Longleaf Pine',
    category: 'timber',
    cargoId: 'naval_stores',
    tempRangeF: [25, 95],
    idealTempF: [50, 85],
    rainfallNeed: 'moderate',
    growingMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    harvestMonths: [4, 5, 6, 7, 8, 9],    // tar and pitch production year-round
    perennial: true,
    hurricaneVulnerability: 0.5,
    droughtVulnerability: 0.3,
    floodVulnerability: 0.4,
    frostVulnerability: 0.1,               // cold-hardy
    description: 'Pinus palustris. The source of naval stores — tar, pitch, turpentine, and rosin. Carolina\'s pine forests supply the Royal Navy. Trees are tapped for resin or burned in tar kilns. Essential for waterproofing ships.',
  },

  lignum_vitae: {
    id: 'lignum_vitae',
    name: 'Lignum Vitae',
    category: 'timber',
    cargoId: 'lignum_vitae',
    tempRangeF: [65, 95],
    idealTempF: [75, 88],
    rainfallNeed: 'low',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    perennial: true,
    hurricaneVulnerability: 0.15,           // extremely dense, short tree
    droughtVulnerability: 0.1,              // drought-tolerant
    floodVulnerability: 0.3,
    frostVulnerability: 0.8,
    description: 'Guaiacum officinale. "Wood of Life" — the hardest, densest wood known. Used for ship propeller shaft bearings, pulleys, and mallets. Self-lubricating from natural resin. Jamaica is the primary source. Also used medicinally.',
  },

  // ══════════════════════════════════════════════════════════
  // PROVISIONS — what feeds the Caribbean
  // ══════════════════════════════════════════════════════════

  cassava: {
    id: 'cassava',
    name: 'Cassava (Manioc)',
    category: 'provision',
    cargoId: 'provisions',
    tempRangeF: [65, 100],
    idealTempF: [75, 90],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // harvest anytime after 8 months
    perennial: false,
    hurricaneVulnerability: 0.2,           // root crop, underground
    droughtVulnerability: 0.2,             // very drought-resistant
    floodVulnerability: 0.5,               // tubers rot in standing water
    frostVulnerability: 0.9,
    description: 'The Caribbean staple. The starchy root is processed into bread, flour, and starch. Bitter cassava must be processed to remove cyanide. Every Caribbean settlement depends on it. Grows in poor soil where nothing else will.',
  },

  plantain: {
    id: 'plantain',
    name: 'Plantain & Banana',
    category: 'provision',
    cargoId: 'provisions',
    tempRangeF: [60, 100],
    idealTempF: [75, 90],
    rainfallNeed: 'heavy',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // year-round fruiting
    perennial: true,
    hurricaneVulnerability: 0.85,          // tall, shallow roots — destroyed by wind
    droughtVulnerability: 0.7,
    floodVulnerability: 0.3,
    frostVulnerability: 0.95,
    description: 'Fried, boiled, roasted — plantain is food at every meal. Banana plants grow fast but are devastated by hurricanes. Every settlement has plantain groves. After a hurricane, it takes 9-12 months for new plants to fruit.',
  },

  maize: {
    id: 'maize',
    name: 'Corn (Maize)',
    category: 'provision',
    cargoId: 'provisions',
    tempRangeF: [50, 95],
    idealTempF: [65, 85],
    rainfallNeed: 'moderate',
    growingMonths: [3, 4, 5, 6, 7, 8],
    harvestMonths: [7, 8, 9],
    perennial: false,
    hurricaneVulnerability: 0.7,           // tall stalks flattened by wind
    droughtVulnerability: 0.6,
    floodVulnerability: 0.5,
    frostVulnerability: 0.5,
    description: 'The original American grain. Grown in every Caribbean settlement and throughout the mainland colonies. Ground into meal for bread and porridge. A fast-growing crop that feeds sailors and slaves alike.',
  },

  sweet_potato: {
    id: 'sweet_potato',
    name: 'Sweet Potato',
    category: 'provision',
    cargoId: 'provisions',
    tempRangeF: [60, 100],
    idealTempF: [70, 90],
    rainfallNeed: 'moderate',
    growingMonths: [3, 4, 5, 6, 7, 8, 9],
    harvestMonths: [8, 9, 10, 11],
    perennial: false,
    hurricaneVulnerability: 0.15,          // underground tuber
    droughtVulnerability: 0.4,
    floodVulnerability: 0.5,
    frostVulnerability: 0.7,
    description: 'A Caribbean and American native. The tuber grows underground, protected from storms. Easy to cultivate, nutritious, stores reasonably well. A reliable food source for settlements and ship provisions.',
  },

  yam: {
    id: 'yam',
    name: 'Yam',
    category: 'provision',
    cargoId: 'provisions',
    tempRangeF: [65, 100],
    idealTempF: [77, 90],
    rainfallNeed: 'heavy',
    growingMonths: [4, 5, 6, 7, 8, 9, 10],
    harvestMonths: [10, 11, 12],
    perennial: false,
    hurricaneVulnerability: 0.2,           // underground tuber, vine regrows
    droughtVulnerability: 0.6,
    floodVulnerability: 0.4,
    frostVulnerability: 0.9,
    description: 'Dioscorea — brought from West Africa. The preferred starch of enslaved Africans. Large tubers harvested after 6-8 months. Vines can be trained up poles or trees. A culturally important food crop.',
  },

  coconut: {
    id: 'coconut',
    name: 'Coconut Palm',
    category: 'provision',
    cargoId: 'provisions',
    tempRangeF: [65, 100],
    idealTempF: [75, 90],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // year-round fruiting
    perennial: true,                       // palm tree, decades of production
    hurricaneVulnerability: 0.4,           // flexible trunk bends, but fronds rip off
    droughtVulnerability: 0.3,             // deep-rooted, salt-tolerant
    floodVulnerability: 0.2,
    frostVulnerability: 0.9,
    description: 'Lines every Caribbean shore. Provides food (meat, milk, oil), drink (water), fiber (coir), and building material (fronds for thatch, trunk for timber). Salt-tolerant, grows right on the beach.',
  },

  citrus: {
    id: 'citrus',
    name: 'Citrus (Lime, Orange, Lemon)',
    category: 'fruit',
    cargoId: 'citrus',
    tempRangeF: [55, 100],
    idealTempF: [70, 90],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [11, 12, 1, 2, 3],     // winter citrus season
    perennial: true,                       // tree crop
    hurricaneVulnerability: 0.5,           // trees survive but fruit knocked off
    droughtVulnerability: 0.4,
    floodVulnerability: 0.5,
    frostVulnerability: 0.6,
    description: 'Introduced by the Spanish. Limes and oranges grow in every Caribbean garden. Lime juice prevents scurvy — smart captains provision with citrus. Seville oranges from Spain are bitter marmalade oranges.',
  },

  pineapple: {
    id: 'pineapple',
    name: 'Pineapple',
    category: 'fruit',
    cargoId: 'provisions',
    tempRangeF: [60, 95],
    idealTempF: [70, 85],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [5, 6, 7, 8],
    perennial: false,                      // 18-month cycle
    hurricaneVulnerability: 0.3,           // low-growing
    droughtVulnerability: 0.5,
    floodVulnerability: 0.6,
    frostVulnerability: 0.8,
    description: 'Ananas comosus — native Caribbean fruit. A luxury in Europe where it symbolizes hospitality and wealth. Ships carry them as gifts. Grown in Barbados, Jamaica, and throughout the islands.',
  },

  // ══════════════════════════════════════════════════════════
  // WEST AFRICAN CROPS
  // ══════════════════════════════════════════════════════════

  palm_oil: {
    id: 'palm_oil',
    name: 'Oil Palm',
    category: 'export_crop',
    cargoId: 'palm_oil',
    tempRangeF: [70, 100],
    idealTempF: [77, 92],
    rainfallNeed: 'heavy',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    perennial: true,
    hurricaneVulnerability: 0.3,
    droughtVulnerability: 0.5,
    floodVulnerability: 0.2,
    frostVulnerability: 0.95,
    description: 'Elaeis guineensis. West African staple — the fruit yields both palm oil (cooking, soap, candles) and palm kernel oil. Every village has palm groves. Also produces palm wine.',
  },

  kola: {
    id: 'kola',
    name: 'Kola Nut',
    category: 'spice',
    cargoId: 'kola_nuts',
    tempRangeF: [70, 95],
    idealTempF: [75, 88],
    rainfallNeed: 'heavy',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [7, 8, 9, 10],
    perennial: true,
    hurricaneVulnerability: 0.2,
    droughtVulnerability: 0.5,
    floodVulnerability: 0.3,
    frostVulnerability: 0.95,
    description: 'Cola nitida. The bitter, caffeine-rich nut is chewed as a stimulant and offered as a sign of hospitality throughout West Africa. Important in local trade networks. Carried by enslaved people as a cultural lifeline.',
  },

  // ══════════════════════════════════════════════════════════
  // EUROPEAN CROPS — imported to the Caribbean
  // ══════════════════════════════════════════════════════════

  grapes: {
    id: 'grapes',
    name: 'Grapes (Wine)',
    category: 'export_crop',
    cargoId: 'wine',
    tempRangeF: [40, 100],
    idealTempF: [60, 85],
    rainfallNeed: 'low',                   // Mediterranean climate
    growingMonths: [3, 4, 5, 6, 7, 8, 9],
    harvestMonths: [8, 9, 10],
    perennial: true,
    hurricaneVulnerability: 0.6,
    droughtVulnerability: 0.3,             // vines are deep-rooted
    floodVulnerability: 0.7,
    frostVulnerability: 0.4,               // dormant in winter, spring frost risk
    description: 'Vitis vinifera. Wine grapes grown in Spain, Portugal, France. Spanish sherry and Canary wine are the Caribbean favorites. Wine doesn\'t grow in the tropics — it\'s entirely imported. Every ship carries wine.',
  },

  wheat: {
    id: 'wheat',
    name: 'Wheat',
    category: 'provision',
    cargoId: 'flour',
    tempRangeF: [30, 85],
    idealTempF: [50, 75],
    rainfallNeed: 'moderate',
    growingMonths: [10, 11, 12, 1, 2, 3, 4, 5],   // winter wheat
    harvestMonths: [5, 6, 7],
    perennial: false,
    hurricaneVulnerability: 0.6,
    droughtVulnerability: 0.6,
    floodVulnerability: 0.5,
    frostVulnerability: 0.2,               // cold-hardy
    description: 'Does not grow in the tropics. All flour in the Caribbean is imported — from the mainland colonies, England, or Spain. Flour spoils quickly in tropical heat and humidity. A constant provision challenge.',
  },

  olives: {
    id: 'olives',
    name: 'Olives',
    category: 'provision',
    cargoId: undefined,                    // part of general provisions/wine trade
    tempRangeF: [40, 100],
    idealTempF: [55, 85],
    rainfallNeed: 'low',
    growingMonths: [3, 4, 5, 6, 7, 8, 9],
    harvestMonths: [10, 11, 12],
    perennial: true,
    hurricaneVulnerability: 0.3,
    droughtVulnerability: 0.1,             // extremely drought-tolerant
    floodVulnerability: 0.6,
    frostVulnerability: 0.3,
    description: 'Mediterranean tree. Olive oil is essential for cooking, lighting, and soap in Spanish colonies. All imported from Spain. The olive tree does not survive Caribbean humidity.',
  },

  // ══════════════════════════════════════════════════════════
  // OTHER ORGANIC PRODUCTS
  // ══════════════════════════════════════════════════════════

  aloe: {
    id: 'aloe',
    name: 'Aloe Vera',
    category: 'export_crop',
    cargoId: 'medicine',
    tempRangeF: [55, 100],
    idealTempF: [70, 90],
    rainfallNeed: 'arid',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    perennial: true,
    hurricaneVulnerability: 0.2,
    droughtVulnerability: 0.05,            // desert plant
    floodVulnerability: 0.8,               // rots in wet soil
    frostVulnerability: 0.6,
    description: 'Aloe barbadensis. Curaçao and Barbados produce the finest aloe. The gel treats burns and wounds; the resin is a powerful purgative. Thrives in the arid conditions of the ABC islands where other crops fail.',
  },

  cochineal: {
    id: 'cochineal',
    name: 'Cochineal (on Nopal Cactus)',
    category: 'dye',
    cargoId: 'cochineal',
    tempRangeF: [55, 100],
    idealTempF: [65, 85],
    rainfallNeed: 'arid',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    perennial: true,
    hurricaneVulnerability: 0.4,
    droughtVulnerability: 0.1,
    floodVulnerability: 0.9,
    frostVulnerability: 0.5,
    description: 'Dactylopius coccus — not a plant but an insect cultivated on nopal (prickly pear) cactus. Crushed to produce carmine red dye. Worth more than gold by weight. Produced exclusively in Mexico (Oaxaca). Spain guards the secret jealously.',
  },

  salt: {
    id: 'salt',
    name: 'Salt (Solar Evaporation)',
    category: 'provision',
    cargoId: 'salt',
    tempRangeF: [60, 110],
    idealTempF: [75, 95],
    rainfallNeed: 'arid',                  // needs dry, sunny conditions
    growingMonths: [1, 2, 3, 4, 5, 11, 12], // dry season only
    harvestMonths: [2, 3, 4, 5],
    perennial: false,
    hurricaneVulnerability: 0.9,           // storm surge destroys salt pans
    droughtVulnerability: 0.0,             // drought IS the production method
    floodVulnerability: 0.95,              // rain ruins the product
    frostVulnerability: 0.0,
    description: 'Produced by solar evaporation in salt pans on arid islands. Turks & Caicos, Bonaire, and Curaçao are major sources. Essential for preserving fish and meat. Bermudian and New England ships come specifically for salt.',
  },

  // ══════════════════════════════════════════════════════════
  // MISSING VEGETATION — filling the botanical gaps
  // ══════════════════════════════════════════════════════════

  vanilla: {
    id: 'vanilla',
    name: 'Vanilla',
    category: 'spice',
    cargoId: 'vanilla',
    tempRangeF: [60, 95],
    idealTempF: [70, 85],
    rainfallNeed: 'heavy',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [11, 12, 1, 2],         // pods mature 8-9 months after flowering
    perennial: true,                        // orchid vine, climbs trees
    hurricaneVulnerability: 0.5,            // vine torn from support trees
    droughtVulnerability: 0.7,              // needs constant moisture and shade
    floodVulnerability: 0.4,
    frostVulnerability: 0.9,
    description: 'Vanilla planifolia — a climbing orchid native to Mexico. The Totonac people of Papantla cultivate it. Each flower must be hand-pollinated. The green pods are cured for months to develop flavor. Mexico has a world monopoly — Spain guards the source. Worth more than silver by weight.',
  },

  annatto: {
    id: 'annatto',
    name: 'Annatto (Achiote)',
    category: 'dye',
    cargoId: 'annatto',
    tempRangeF: [60, 100],
    idealTempF: [72, 90],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [8, 9, 10, 11],          // pods ripen in late summer
    perennial: true,                         // small tree, produces for decades
    hurricaneVulnerability: 0.4,
    droughtVulnerability: 0.3,
    floodVulnerability: 0.3,
    frostVulnerability: 0.8,
    description: 'Bixa orellana. The spiny seed pods contain a red-orange pigment used for dyeing textiles, coloring food, and body paint. Native to the Caribbean and Central America. Grows as a small tree in every settlement. Also used medicinally and as insect repellent.',
  },

  guava: {
    id: 'guava',
    name: 'Guava',
    category: 'fruit',
    cargoId: 'provisions',
    tempRangeF: [60, 100],
    idealTempF: [73, 90],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [6, 7, 8, 9, 10, 11],    // main crop rainy season, but fruits year-round
    perennial: true,
    hurricaneVulnerability: 0.3,             // resilient tree, regrows quickly
    droughtVulnerability: 0.3,
    floodVulnerability: 0.3,
    frostVulnerability: 0.7,
    description: 'Psidium guajava. Native Caribbean fruit tree found growing wild and in every garden. Sweet pink flesh, intensely fragrant. Makes preserves, jellies, and a paste (guava cheese) that keeps well at sea. A reliable food source — virtually indestructible.',
  },

  mango: {
    id: 'mango',
    name: 'Mango',
    category: 'fruit',
    cargoId: 'provisions',
    tempRangeF: [60, 105],
    idealTempF: [75, 95],
    rainfallNeed: 'moderate',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [5, 6, 7, 8],             // fruiting in early rainy season
    perennial: true,                          // large tree, decades of production
    hurricaneVulnerability: 0.3,              // strong trunk and root system
    droughtVulnerability: 0.2,                // deep-rooted, drought-tolerant once established
    floodVulnerability: 0.3,
    frostVulnerability: 0.8,
    description: 'Mangifera indica. Introduced to the Caribbean from South Asia via Portuguese traders and the African slave trade. By 1715 established in gardens across the islands. Large shade trees that produce abundantly. The fruit does not ship well — consumed locally.',
  },

  tamarind: {
    id: 'tamarind',
    name: 'Tamarind',
    category: 'fruit',
    cargoId: 'provisions',
    tempRangeF: [60, 105],
    idealTempF: [75, 95],
    rainfallNeed: 'low',                     // drought-tolerant
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [3, 4, 5],                // pods ripen in dry season
    perennial: true,
    hurricaneVulnerability: 0.2,              // massive, deep-rooted tree
    droughtVulnerability: 0.1,                // extremely drought-tolerant
    floodVulnerability: 0.3,
    frostVulnerability: 0.7,
    description: 'Tamarindus indica. Introduced from Africa. The sour-sweet pulp is used in drinks (agua de tamarindo), cooking, and medicine. The pods keep for months. A massive shade tree found in every Caribbean town square and plantation yard. The wood is extremely hard.',
  },

  capsicum: {
    id: 'capsicum',
    name: 'Pepper (Scotch Bonnet & Habanero)',
    category: 'spice',
    cargoId: 'spices',
    tempRangeF: [60, 100],
    idealTempF: [70, 90],
    rainfallNeed: 'moderate',
    growingMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    harvestMonths: [7, 8, 9, 10, 11],        // continuous harvest once fruiting
    perennial: false,                          // treated as annual, but can persist
    hurricaneVulnerability: 0.5,
    droughtVulnerability: 0.5,
    floodVulnerability: 0.5,
    frostVulnerability: 0.8,
    description: 'Capsicum chinense. Native to the Caribbean. The scotch bonnet is in every pot and on every plate. Enslaved Africans, indigenous Taino, Spanish, English, French — everyone uses it. Grows in any garden, any soil. Dried peppers ship well and add fire to the blandest ship provisions.',
  },

  sarsaparilla: {
    id: 'sarsaparilla',
    name: 'Sarsaparilla',
    category: 'export_crop',
    cargoId: 'medicine',
    tempRangeF: [65, 95],
    idealTempF: [75, 88],
    rainfallNeed: 'heavy',
    growingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // roots dug year-round
    perennial: true,                          // climbing vine
    hurricaneVulnerability: 0.2,              // low-growing vine, resilient
    droughtVulnerability: 0.5,
    floodVulnerability: 0.2,
    frostVulnerability: 0.7,
    description: 'Smilax regelii. A thorny climbing vine found wild in Jamaica, Honduras, and Central America. The root is dried and exported to Europe as a cure-all — marketed for syphilis, skin diseases, and general debility. One of the most profitable medicinal exports.',
  },
};

// ============================================================
// Port Agriculture Profiles — what grows where
// Cross-referenced against weather profiles for accuracy
// ============================================================

export interface PortAgricultureProfile {
  portId: string;
  exportCrops: string[];        // crop IDs — plantation-scale cash crops
  provisions: string[];         // crop IDs — food crops sustaining the settlement
  timber: string[];             // crop IDs — forest products harvested nearby
  fruits: string[];             // crop IDs — fruits growing in the area
  notGrown: string[];           // explicit notes on what does NOT grow here
  notes: string;
}

export const PORT_AGRICULTURE: Record<string, PortAgricultureProfile> = {
  nassau: {
    portId: 'nassau',
    exportCrops: [],                       // pirates don't farm
    provisions: ['cassava', 'sweet_potato', 'maize', 'coconut', 'capsicum'],
    timber: [],                            // scrubland, no timber
    fruits: ['citrus', 'pineapple', 'coconut', 'guava', 'tamarind'],
    notGrown: ['sugar', 'tobacco', 'rice', 'wheat'],
    notes: 'Nassau has no plantation agriculture — pirates import or steal everything. Subsistence crops in small gardens. The soil is thin coral limestone. Fresh water is scarce. Guava and tamarind trees grow wild.',
  },

  port_royal: {
    portId: 'port_royal',
    // Weather: 75-90°F, rainy May-Nov, dry Dec-Apr, hurricane high
    exportCrops: ['sugar', 'pimento', 'ginger', 'indigo', 'cotton', 'sarsaparilla', 'annatto'],
    provisions: ['cassava', 'plantain', 'maize', 'yam', 'sweet_potato', 'coconut', 'capsicum'],
    timber: ['mahogany', 'cedar', 'lignum_vitae', 'logwood'],
    fruits: ['citrus', 'pineapple', 'coconut', 'guava', 'mango', 'tamarind'],
    notGrown: ['rice', 'wheat', 'grapes', 'olives', 'vanilla'],
    notes: 'Jamaica is the richest agricultural island. Sugar dominates but pimento (allspice) is Jamaica\'s unique product — near world monopoly. Ginger was an early export. Mahogany from the interior is just becoming fashionable. Sarsaparilla root harvested from the wild interior. Guava, mango, and tamarind trees in every yard.',
  },

  havana: {
    portId: 'havana',
    // Weather: 75-90°F, rainy May-Oct, dry Nov-Apr, hurricane high
    exportCrops: ['sugar', 'tobacco', 'annatto'],
    provisions: ['cassava', 'plantain', 'maize', 'sweet_potato', 'coconut', 'capsicum'],
    timber: ['cedar', 'mahogany'],
    fruits: ['citrus', 'pineapple', 'coconut', 'guava', 'mango', 'tamarind'],
    notGrown: ['rice', 'wheat', 'grapes'],
    notes: 'Cuba\'s Vuelta Abajo tobacco is the finest in the world. Sugar ingenios line the rivers near Havana. Cuba also has significant cattle ranching for hides and beef — one of the few Caribbean islands with large livestock. Havana\'s shipyard uses local cedar. Annatto grown for local dye and food coloring.',
  },

  tortuga: {
    portId: 'tortuga',
    // Weather: 75-90°F, rainy May-Nov, dry Dec-Apr, hurricane moderate
    exportCrops: [],
    provisions: ['cassava', 'plantain', 'maize', 'sweet_potato', 'capsicum'],
    timber: [],
    fruits: ['citrus', 'coconut', 'guava', 'mango', 'tamarind'],
    notGrown: ['sugar', 'tobacco', 'rice', 'wheat'],
    notes: 'The original buccaneer island. No plantation agriculture. The buccaneers hunted wild cattle and pigs on Hispaniola and smoked the meat (boucan). Small subsistence gardens. Guava and mango grow wild on the hillsides.',
  },

  bridgetown: {
    portId: 'bridgetown',
    // Weather: 75-90°F, rainy Jun-Nov, dry Jan-May, hurricane high
    exportCrops: ['sugar', 'cotton', 'ginger', 'aloe', 'annatto'],
    provisions: ['cassava', 'plantain', 'yam', 'sweet_potato', 'capsicum'],
    timber: [],                            // deforested for sugar
    fruits: ['citrus', 'pineapple', 'coconut', 'guava', 'tamarind'],
    notGrown: ['rice', 'tobacco', 'wheat', 'mahogany'],
    notes: 'Barbados is almost entirely sugar. Every acre is planted. The island was deforested for cane fields by the 1660s. Cotton was the first cash crop before sugar took over. Aloe grows on the dry southeastern coast. Guava and tamarind provide shade and fruit in plantation yards.',
  },

  charles_town: {
    portId: 'charles_town',
    // Weather: 40-90°F, rainy Jun-Sep, dry Oct-May, hurricane moderate
    exportCrops: ['rice', 'indigo', 'cotton', 'pine'],
    provisions: ['maize', 'sweet_potato', 'wheat'],
    timber: ['pine'],
    fruits: ['citrus'],
    notGrown: ['sugar', 'cacao', 'pimento', 'coconut', 'plantain'],
    notes: 'Carolina Gold rice is the colony\'s fortune, grown using West African knowledge in tidal paddies. Indigo is the second crop, grown on upland fields. Naval stores (tar, pitch, turpentine) from the pine forests are a major export to the Royal Navy. Too cold for sugar or tropical provisions.',
  },

  santo_domingo: {
    portId: 'santo_domingo',
    // Weather: 75-90°F, rainy May-Nov, dry Dec-Apr, hurricane high
    exportCrops: ['sugar', 'cacao', 'ginger', 'tobacco', 'annatto'],
    provisions: ['cassava', 'plantain', 'maize', 'yam', 'sweet_potato', 'capsicum'],
    timber: ['mahogany', 'cedar'],
    fruits: ['citrus', 'pineapple', 'coconut', 'guava', 'mango', 'tamarind'],
    notGrown: ['rice', 'wheat', 'vanilla'],
    notes: 'Hispaniola was the first European sugar colony (1500s). Now eclipsed by Jamaica and Barbados but still producing. Cacao grows in the interior valleys. Wild cattle roam the central plains. Mango trees line the streets of the colonial city. Guava grows wild everywhere.',
  },

  cartagena: {
    portId: 'cartagena',
    // Weather: 75-90°F, rainy Apr-Nov, dry Dec-Mar, hurricane LOW
    exportCrops: ['cacao', 'cotton', 'indigo', 'annatto'],
    provisions: ['cassava', 'plantain', 'maize', 'yam', 'capsicum'],
    timber: [],
    fruits: ['citrus', 'coconut', 'pineapple', 'guava', 'mango', 'tamarind'],
    notGrown: ['sugar', 'rice', 'wheat', 'pimento'],
    notes: 'Cartagena is primarily a trade hub, not an agricultural center. Cacao from Venezuelan haciendas is trans-shipped here. Cotton and indigo from the interior. The low hurricane risk makes it reliable. Mango and tamarind shade the plazas. Annatto (achiote) used throughout local cuisine.',
  },

  portobelo: {
    portId: 'portobelo',
    // Weather: 75-90°F, rainy ALL YEAR, hurricane moderate
    exportCrops: [],                       // trans-shipment point, not production
    provisions: ['cassava', 'plantain', 'capsicum'],
    timber: ['logwood'],
    fruits: ['coconut', 'guava'],
    notGrown: ['sugar', 'tobacco', 'rice', 'wheat', 'cotton', 'salt'],
    notes: 'Portobelo produces almost nothing locally. The year-round rain makes it lush but disease-ridden. Vanilla and cacao from the Pacific side arrive via the Camino Real and Chagres River. Guava grows wild in the jungle. Food must be imported. Between fairs, a ghost settlement.',
  },

  boston: {
    portId: 'boston',
    // Weather: 25-85°F, rainy Mar-Apr, dry Jun-Sep, hurricane low
    exportCrops: ['pine'],
    provisions: ['maize', 'wheat', 'sweet_potato'],
    timber: ['pine'],
    fruits: [],                            // too cold for tropical fruit
    notGrown: ['sugar', 'tobacco', 'rice', 'cacao', 'cassava', 'plantain', 'coconut', 'pimento'],
    notes: 'New England grows no tropical crops. The economy is shipbuilding, fishing, and the provision trade — selling food and lumber to the sugar islands. Boston distills Caribbean molasses into rum. Cod fishing is the backbone.',
  },

  willemstad: {
    portId: 'willemstad',
    // Weather: 75-90°F, rainy Oct-Dec, dry Feb-Jun, hurricane low
    exportCrops: ['aloe', 'salt'],
    provisions: ['maize', 'sweet_potato'],
    timber: [],
    fruits: ['citrus'],
    notGrown: ['sugar', 'rice', 'cacao', 'plantain', 'yam', 'wheat'],
    notes: 'Curaçao is too arid for most agriculture. Aloe thrives in the dry conditions. Salt is produced by solar evaporation. The island\'s economy is trade, not agriculture — it\'s the Dutch entrepôt for the southern Caribbean. The floating market sells Venezuelan produce.',
  },

  veracruz: {
    portId: 'veracruz',
    // Weather: 65-95°F, rainy Jun-Oct, dry Nov-May, hurricane high
    exportCrops: ['cochineal', 'sugar', 'tobacco', 'cacao', 'vanilla', 'annatto', 'sarsaparilla'],
    provisions: ['maize', 'cassava', 'sweet_potato', 'capsicum'],
    timber: ['cedar', 'mahogany'],
    fruits: ['citrus', 'pineapple', 'guava', 'mango', 'tamarind'],
    notGrown: ['rice', 'wheat'],
    notes: 'Veracruz is the funnel for New Spain\'s botanical wealth. Vanilla from Papantla (world monopoly), cochineal from Oaxaca, cacao from Tabasco, sarsaparilla from the jungle interior. Annatto (achiote) is essential to local cuisine. Northers in winter punish the coast.',
  },

  petit_goave: {
    portId: 'petit_goave',
    // Weather: 75-90°F, rainy May-Oct, dry Nov-Apr, hurricane moderate
    exportCrops: ['sugar', 'indigo', 'cotton', 'cacao', 'annatto'],
    provisions: ['cassava', 'plantain', 'maize', 'yam', 'sweet_potato', 'capsicum'],
    timber: ['logwood', 'mahogany'],
    fruits: ['citrus', 'coconut', 'pineapple', 'guava', 'mango', 'tamarind'],
    notGrown: ['rice', 'wheat', 'pimento', 'vanilla'],
    notes: 'Saint-Domingue (French Hispaniola) is on the verge of an agricultural explosion. By 1730, it will be the richest colony in the world. Sugar plantations expanding rapidly. Indigo is the second crop. Mango and tamarind shade the colonial streets. Guava grows wild on every hillside.',
  },

  basseterre: {
    portId: 'basseterre',
    // Weather: 75-90°F, rainy Jul-Nov, dry Jan-Jun, hurricane VERY HIGH
    exportCrops: ['sugar'],
    provisions: ['cassava', 'plantain', 'yam', 'sweet_potato', 'capsicum'],
    timber: [],                            // completely deforested for sugar
    fruits: ['citrus', 'coconut', 'guava', 'tamarind'],
    notGrown: ['tobacco', 'rice', 'wheat', 'cacao', 'pimento'],
    notes: 'St. Kitts is pure sugar monoculture. Every arable acre is planted in cane. Tamarind and guava trees survive in the plantation yards and along roads. Extremely vulnerable to hurricanes — the very high risk means total crop destruction every few years.',
  },

  // ── WEST AFRICAN POSTS ──────────────────────────────────

  cape_coast_castle: {
    portId: 'cape_coast_castle',
    // Weather: 75-90°F, rainy Apr-Oct, dry Nov-Mar
    exportCrops: ['palm_oil'],
    provisions: ['cassava', 'yam', 'maize', 'plantain'],
    timber: [],
    fruits: ['citrus', 'coconut'],
    notGrown: ['sugar', 'tobacco', 'rice', 'wheat'],
    notes: 'The Gold Coast. Agriculture is local African production, not European plantation. Palm oil and kola are the main local crops. The European forts exist solely for the slave and gold trade. Local Fante farmers supply provisions.',
  },

  elmina: {
    portId: 'elmina',
    // Weather: 75-90°F, rainy Mar-Oct, dry Nov-Feb
    exportCrops: ['palm_oil'],
    provisions: ['cassava', 'yam', 'maize', 'plantain'],
    timber: [],
    fruits: ['citrus', 'coconut'],
    notGrown: ['sugar', 'tobacco', 'rice', 'wheat'],
    notes: 'Elmina\'s fishing community is the primary local economy. The Dutch fort exists for trade. Agriculture is similar to Cape Coast — African subsistence farming with palm oil as the main export crop.',
  },

  whydah: {
    portId: 'whydah',
    // Weather: 75-92°F, rainy Mar-Jul + Sep-Oct, dry Aug + Nov-Feb
    exportCrops: ['palm_oil'],
    provisions: ['cassava', 'yam', 'maize'],
    timber: [],
    fruits: ['coconut'],
    notGrown: ['sugar', 'tobacco', 'rice', 'wheat'],
    notes: 'Kingdom of Dahomey controls all trade. The agricultural hinterland is more developed than the Gold Coast — organized farming under royal authority. Palm oil plantations (African-managed), yam cultivation. Kola nut trade is important locally.',
  },

  // ── EUROPEAN CITIES ─────────────────────────────────────

  london: {
    portId: 'london',
    // Weather: 35-75°F, rainy Oct-Jan, dry May-Aug
    exportCrops: ['wheat'],
    provisions: ['wheat'],
    timber: [],
    fruits: [],
    notGrown: ['sugar', 'tobacco', 'rice', 'cotton', 'cacao', 'all tropical crops'],
    notes: 'London does not produce — it consumes, trades, and finances. The surrounding English countryside grows wheat, barley, and livestock. London imports Caribbean sugar, tobacco, and rum, re-exporting processed goods back to the colonies.',
  },

  seville_cadiz: {
    portId: 'seville_cadiz',
    // Weather: 45-95°F, rainy Oct-Mar, dry Jun-Sep
    exportCrops: ['grapes', 'olives'],
    provisions: ['wheat'],
    timber: [],
    fruits: ['citrus'],
    notGrown: ['sugar', 'tobacco', 'rice', 'cotton', 'cacao', 'tropical crops'],
    notes: 'Andalusia produces wine (sherry), olive oil, citrus (Seville oranges), and wheat. These are the European provisions shipped to the Caribbean colonies. The treasure fleet brings silver and gold back. The Casa de Contratación controls everything.',
  },

  amsterdam: {
    portId: 'amsterdam',
    // Weather: 30-72°F, rainy Oct-Jan, dry Apr-Jun
    exportCrops: [],
    provisions: ['wheat'],
    timber: [],
    fruits: [],
    notGrown: ['sugar', 'tobacco', 'rice', 'all tropical and Mediterranean crops'],
    notes: 'Amsterdam produces nothing agricultural of note — it is the financial and trading capital of Europe. Dutch wealth comes from moving other people\'s goods. The WIC processes Caribbean sugar in Amsterdam refineries and re-sells it across Europe.',
  },
};

// ============================================================
// Utility: verify a crop can grow at a port's climate
// ============================================================

export function canCropGrow(cropId: string, tempMinF: number, tempMaxF: number, rainyMonths: number[]): boolean {
  const crop = CROP_DEFINITIONS[cropId];
  if (!crop) return false;

  // Temperature check: port's range must overlap crop's range
  if (tempMaxF < crop.tempRangeF[0] || tempMinF > crop.tempRangeF[1]) return false;

  // Rainfall check: crop needs must match available rainfall
  if (crop.rainfallNeed === 'heavy' || crop.rainfallNeed === 'very_heavy') {
    if (rainyMonths.length < 4) return false; // not enough rainy months
  }
  if (crop.rainfallNeed === 'arid' || crop.rainfallNeed === 'low') {
    if (rainyMonths.length > 8) return false; // too wet
  }

  return true;
}

export function getCropsForPort(portId: string): PortAgricultureProfile | undefined {
  return PORT_AGRICULTURE[portId];
}

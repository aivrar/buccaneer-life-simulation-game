// Prize cargo profiles — what ships carry by type and route
// This is what pirates find when they capture a vessel.
// Each profile defines cargo ranges [min, max] for a typical ship of that type.

// ============================================================
// Prize Profile Definition
// ============================================================

export interface PrizeCargoProfile {
  id: string;
  name: string;
  shipClasses: string[];              // which ship types carry this cargo mix
  routes: string[];                   // typical sea zones where encountered
  frequency: number;                  // relative frequency (0-100) — how common this type is
  cargo: Record<string, [number, number]>;  // cargoId → [min, max] units
  personalValuables: [number, number];      // coins found on passengers/crew [min, max]
  description: string;
}

export const PRIZE_CARGO_PROFILES: PrizeCargoProfile[] = [
  // ══════════════════════════════════════════════════════════
  // SPANISH SHIPPING — the richest targets
  // ══════════════════════════════════════════════════════════

  {
    id: 'treasure_galleon',
    name: 'Spanish Treasure Galleon',
    shipClasses: ['galleon'],
    routes: ['florida_straits', 'bahama_channel', 'caribbean_deep_basin', 'windward_passage'],
    frequency: 5,                          // rare — treasure fleet only
    cargo: {
      silver: [50, 200],
      gold: [5, 30],
      coins: [100, 500],
      emeralds: [0, 5],
      pearls: [0, 8],
      cochineal: [5, 20],
      silk: [5, 15],
      spices: [5, 15],
      vanilla: [0, 5],
      cacao: [10, 30],
      plate: [2, 10],
      jewelry: [1, 5],
    },
    personalValuables: [200, 2000],
    description: 'The ultimate prize. Treasure galleons carry the wealth of the Americas to Spain — silver bars, minted coins, gold, emeralds, and high-value colonial goods. Heavily armed and escorted, but slow. The 1715 fleet lost eleven ships to a hurricane, scattering a king\'s ransom across the Florida coast.',
  },
  {
    id: 'spanish_merchantman',
    name: 'Spanish Colonial Merchantman',
    shipClasses: ['brigantine', 'brig', 'galleon'],
    routes: ['caribbean_deep_basin', 'spanish_main_coast', 'windward_passage', 'yucatan_channel', 'gulf_of_mexico'],
    frequency: 20,
    cargo: {
      sugar: [20, 60],
      tobacco: [5, 20],
      cacao: [5, 15],
      hides: [10, 30],
      indigo: [3, 10],
      cured_tobacco: [3, 10],
      annatto: [2, 8],
      wine: [5, 15],
      textiles: [5, 15],
      coins: [10, 50],
    },
    personalValuables: [20, 200],
    description: 'Inter-colonial Spanish traders carrying plantation goods, European imports, and supplies. Not as rich as the treasure fleet but far more common and less well defended. The Guarda Costa tries to protect them.',
  },
  {
    id: 'spanish_coaster',
    name: 'Spanish Coastal Trader',
    shipClasses: ['sloop', 'schooner', 'periagua'],
    routes: ['spanish_main_coast', 'darien_coast', 'havana_roads', 'yucatan_channel'],
    frequency: 25,
    cargo: {
      provisions: [10, 30],
      cassava: [5, 15],
      sugar: [5, 15],
      tobacco: [2, 8],
      hides: [3, 10],
      salt_meat: [3, 8],
      citrus: [2, 5],
      coins: [2, 15],
    },
    personalValuables: [5, 40],
    description: 'Small Spanish vessels trading between colonial ports. Carrying basic provisions, some cargo, a little money. Easy targets but modest rewards. Often the bread and butter of pirate income.',
  },

  // ══════════════════════════════════════════════════════════
  // ENGLISH SHIPPING
  // ══════════════════════════════════════════════════════════

  {
    id: 'sugar_merchantman',
    name: 'English Sugar Merchantman',
    shipClasses: ['brig', 'brigantine', 'galleon'],
    routes: ['bahama_channel', 'windward_islands_waters', 'leeward_islands_waters', 'atlantic_approach'],
    frequency: 30,
    cargo: {
      sugar: [30, 80],
      molasses: [10, 30],
      rum: [10, 40],
      cotton: [5, 15],
      ginger: [2, 8],
      pimento: [2, 8],
      indigo: [2, 8],
      mahogany: [2, 5],
      logwood: [3, 10],
      tortoiseshell: [0, 3],
      coins: [5, 30],
    },
    personalValuables: [10, 100],
    description: 'The backbone of English Caribbean trade. Sugar hogsheads, barrels of rum and molasses, plus secondary exports. Sailing from Jamaica or Barbados back to London. Moderately defended — some carry 12-20 guns.',
  },
  {
    id: 'provision_sloop',
    name: 'Colonial Provision Sloop',
    shipClasses: ['sloop', 'schooner'],
    routes: ['bahama_channel', 'carolina_shelf', 'providence_channel', 'great_bahama_bank'],
    frequency: 25,
    cargo: {
      provisions: [10, 25],
      flour: [5, 15],
      salt_meat: [5, 15],
      dried_fish: [5, 15],
      salt: [3, 10],
      naval_stores: [5, 10],
      cordage: [2, 5],
      rum: [3, 10],
      citrus: [2, 5],
      coins: [3, 15],
    },
    personalValuables: [5, 30],
    description: 'Small colonial traders carrying food and supplies from New England or Carolina to the sugar islands. Vital for island survival — the Caribbean can\'t feed itself. Not rich but carrying things pirates need: food, rum, ship supplies.',
  },
  {
    id: 'new_england_trader',
    name: 'New England Merchant',
    shipClasses: ['brigantine', 'brig', 'schooner'],
    routes: ['boston_waters', 'carolina_shelf', 'bahama_channel', 'atlantic_approach'],
    frequency: 20,
    cargo: {
      rum: [10, 30],
      dried_fish: [10, 25],
      flour: [5, 15],
      naval_stores: [5, 15],
      whale_products: [5, 15],
      cordage: [3, 8],
      ship_hardware: [2, 5],
      timber: [5, 10],
      textiles: [3, 8],
      coins: [5, 25],
    },
    personalValuables: [10, 60],
    description: 'Boston and New England merchants carrying manufactured goods, provisions, and ship supplies south. Also carrying rum distilled from Caribbean molasses. These ships keep the Caribbean supplied with everything it can\'t grow.',
  },

  // ══════════════════════════════════════════════════════════
  // DUTCH SHIPPING
  // ══════════════════════════════════════════════════════════

  {
    id: 'dutch_trader',
    name: 'Dutch West India Company Trader',
    shipClasses: ['brig', 'brigantine'],
    routes: ['tobago_channel', 'windward_islands_waters', 'leeward_islands_waters', 'atlantic_approach'],
    frequency: 15,
    cargo: {
      sugar: [15, 40],
      salt: [10, 30],
      textiles: [10, 25],
      trade_beads: [5, 15],
      iron_bars: [5, 15],
      muskets: [3, 10],
      wine: [5, 10],
      refined_sugar: [5, 15],
      chocolate: [2, 8],
      coins: [10, 40],
    },
    personalValuables: [15, 80],
    description: 'WIC vessels carrying European manufactured goods to the Caribbean and African posts, returning with colonial products. The Dutch are the middlemen of the Atlantic — everything passes through their hands. Well-armed and well-crewed.',
  },

  // ══════════════════════════════════════════════════════════
  // FRENCH SHIPPING
  // ══════════════════════════════════════════════════════════

  {
    id: 'french_merchantman',
    name: 'French Colonial Merchantman',
    shipClasses: ['brigantine', 'brig'],
    routes: ['windward_passage', 'mona_passage', 'windward_islands_waters', 'atlantic_approach'],
    frequency: 15,
    cargo: {
      sugar: [20, 50],
      indigo: [5, 15],
      cotton: [5, 15],
      cacao: [3, 10],
      rum: [5, 15],
      molasses: [5, 15],
      logwood: [3, 8],
      wine: [5, 10],
      textiles: [5, 10],
      coins: [5, 30],
    },
    personalValuables: [10, 80],
    description: 'French ships carrying Saint-Domingue sugar, indigo, and colonial products back to France. French colonial trade is booming — Hispaniola is becoming the richest colony in the world. Wine and textiles outbound, sugar and dye homeward.',
  },

  // ══════════════════════════════════════════════════════════
  // SLAVE SHIPS — the Africa trade
  // ══════════════════════════════════════════════════════════

  {
    id: 'slave_ship_outbound',
    name: 'Slave Ship (Europe → Africa)',
    shipClasses: ['brig', 'brigantine'],
    routes: ['atlantic_approach', 'west_african_coast'],
    frequency: 10,
    cargo: {
      textiles: [15, 40],
      iron_bars: [10, 30],
      muskets: [10, 25],
      gunpowder: [5, 15],
      trade_beads: [10, 30],
      rum: [10, 25],
      wine: [3, 8],
      cordage: [2, 5],
      coins: [5, 20],
    },
    personalValuables: [10, 50],
    description: 'Ships carrying trade goods from Europe to the African coast. Textiles, iron, guns, beads, and rum — the currency of the slave trade. These goods will be exchanged for enslaved human beings. The outbound leg of the triangular trade.',
  },
  {
    id: 'slave_ship_middle_passage',
    name: 'Slave Ship (Africa → Caribbean)',
    shipClasses: ['brig', 'brigantine'],
    routes: ['atlantic_approach', 'tobago_channel', 'windward_islands_waters'],
    frequency: 10,
    cargo: {
      slaves: [50, 300],
      ivory: [3, 10],
      gold: [1, 5],
      palm_oil: [3, 8],
      provisions: [5, 10],
      coins: [5, 15],
    },
    personalValuables: [10, 40],
    description: 'The Middle Passage. Ships packed with enslaved people, plus ivory, gold dust, and palm oil from the African coast. The most horrific voyage in maritime history. Some pirates freed enslaved people; others sold them.',
  },

  // ══════════════════════════════════════════════════════════
  // SPECIAL VESSELS
  // ══════════════════════════════════════════════════════════

  {
    id: 'naval_supply_ship',
    name: 'Naval Supply Vessel',
    shipClasses: ['brig', 'brigantine'],
    routes: ['bahama_channel', 'windward_passage', 'carolina_shelf', 'boston_waters'],
    frequency: 10,
    cargo: {
      gunpowder: [10, 30],
      cannons: [3, 8],
      muskets: [5, 15],
      cordage: [5, 15],
      sailcloth: [5, 15],
      ship_hardware: [5, 10],
      naval_stores: [5, 15],
      provisions: [10, 20],
      salt_meat: [5, 15],
      flour: [5, 10],
      medicine: [2, 5],
      coins: [10, 30],
    },
    personalValuables: [10, 40],
    description: 'Ships carrying supplies to naval stations and colonial forts. Gunpowder, guns, rope, sails, tar, food — everything a port or fleet needs. Highly valuable to pirates who need the same things navies do.',
  },
  {
    id: 'packet_boat',
    name: 'Mail Packet / Advice Boat',
    shipClasses: ['sloop', 'schooner'],
    routes: ['atlantic_approach', 'bahama_channel', 'florida_straits', 'boston_waters'],
    frequency: 8,
    cargo: {
      coins: [20, 100],
      charts: [1, 3],
      medicine: [1, 3],
      textiles: [2, 5],
    },
    personalValuables: [50, 300],
    description: 'Fast dispatch vessels carrying mail, money, and orders between European governments and their colonies. Small but often carrying coin chests, official dispatches (intelligence gold), and wealthy passengers with personal valuables.',
  },
  {
    id: 'fishing_vessel',
    name: 'Fishing Vessel',
    shipClasses: ['periagua', 'sloop'],
    routes: ['great_bahama_bank', 'silver_bank', 'carolina_shelf', 'boston_waters'],
    frequency: 30,
    cargo: {
      dried_fish: [5, 15],
      salt: [2, 5],
      turtle: [2, 8],
      provisions: [2, 5],
    },
    personalValuables: [1, 10],
    description: 'Small fishing boats — not worth much as prizes but desperate pirates take what they can. Fish, salt, turtle, and whatever the crew has in their pockets. Sometimes the pirates just take the provisions and let them go.',
  },
];

// ============================================================
// Utility
// ============================================================

export function getPrizeProfilesForZone(zoneId: string): PrizeCargoProfile[] {
  return PRIZE_CARGO_PROFILES.filter(p => p.routes.includes(zoneId));
}

export function getPrizeProfilesByShipClass(shipClass: string): PrizeCargoProfile[] {
  return PRIZE_CARGO_PROFILES.filter(p => p.shipClasses.includes(shipClass));
}

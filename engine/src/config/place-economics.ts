/**
 * Place Economic Roles — maps place types to their economic function.
 * Static config that tells agents and the UI WHERE to go to do WHAT.
 */

export interface PlaceEconomicRole {
  buys: string[];        // cargo types this place purchases
  sells: string[];       // cargo types this place offers
  stores: string[];      // cargo types this place can warehouse
  services: string[];    // services offered
  priceModifier: number; // quality-based markup (0.8 to 1.5)
}

type PlaceType =
  | 'tavern' | 'fort' | 'church' | 'dock' | 'market' | 'shipyard'
  | 'brothel' | 'warehouse' | 'government' | 'jail' | 'camp'
  | 'landmark' | 'residential' | 'trading_post' | 'slave_market' | 'hospital';

export const PLACE_ECONOMIC_ROLES: Record<PlaceType, PlaceEconomicRole> = {
  market: {
    buys: ['*'],  // all legal cargo for the port
    sells: ['*'],
    stores: [],
    services: [],
    priceModifier: 1.0,
  },
  warehouse: {
    buys: [],
    sells: [],
    stores: ['*'],  // all cargo — stored here doesn't spoil
    services: ['storage'],
    priceModifier: 1.0,
  },
  dock: {
    buys: [],
    sells: ['provisions', 'citrus', 'salt_meat', 'water', 'cordage', 'sailcloth'],
    stores: [],
    services: ['load', 'unload'],
    priceModifier: 1.1,
  },
  shipyard: {
    buys: ['cordage', 'sailcloth', 'timber', 'naval_stores', 'ship_hardware', 'iron_bars'],
    sells: [],
    stores: [],
    services: ['repair', 'careen', 'refit'],
    priceModifier: 1.2,
  },
  tavern: {
    buys: [],
    sells: ['rum', 'provisions', 'wine'],
    stores: [],
    services: ['recruit', 'intel', 'fence_contact'],
    priceModifier: 1.3,
  },
  trading_post: {
    buys: ['trade_beads', 'textiles', 'muskets', 'gunpowder', 'rum', 'iron_bars'],
    sells: ['ivory', 'palm_oil', 'kola_nuts', 'hides', 'gold', 'annatto'],
    stores: [],
    services: [],
    priceModifier: 0.9,
  },
  slave_market: {
    buys: [],
    sells: [],
    stores: [],
    services: ['slave_trade'],
    priceModifier: 1.0,
  },
  government: {
    buys: [],
    sells: [],
    stores: [],
    services: ['customs', 'letter_of_marque', 'pardon'],
    priceModifier: 1.0,
  },
  fort: {
    buys: [],
    sells: [],
    stores: [],
    services: ['defense'],
    priceModifier: 1.0,
  },
  hospital: {
    buys: [],
    sells: [],
    stores: [],
    services: ['heal'],
    priceModifier: 1.0,
  },
  church: {
    buys: [],
    sells: [],
    stores: [],
    services: ['sanctuary'],
    priceModifier: 1.0,
  },
  brothel: {
    buys: [],
    sells: ['rum', 'wine'],
    stores: [],
    services: ['morale'],
    priceModifier: 1.5,
  },
  jail: {
    buys: [],
    sells: [],
    stores: [],
    services: [],
    priceModifier: 1.0,
  },
  camp: {
    buys: [],
    sells: ['provisions'],
    stores: [],
    services: ['recruit'],
    priceModifier: 0.8,
  },
  landmark: {
    buys: [],
    sells: [],
    stores: [],
    services: [],
    priceModifier: 1.0,
  },
  residential: {
    buys: [],
    sells: [],
    stores: [],
    services: [],
    priceModifier: 1.0,
  },
};

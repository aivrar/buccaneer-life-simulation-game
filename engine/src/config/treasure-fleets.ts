// Treasure Fleet static schedule data
// The two annual Spanish treasure fleets that define Caribbean commerce and piracy

export interface TreasureFleet {
  id: string;
  name: string;
  spanishName: string;
  description: string;

  // Schedule (months, approximate — actual dates vary by year)
  departurePort: string;
  departureMonths: number[];      // typical months of departure from origin
  assemblyPort: string;           // where the fleet assembles before return to Spain
  assemblyMonths: number[];       // when they arrive at assembly port
  returnDepartureMonths: number[];// when they leave for Spain
  returnPort: string;

  // Route
  outboundRoute: string[];        // port sequence
  returnRoute: string[];          // port sequence

  // Composition
  typicalWarships: number;        // escort vessels
  typicalMerchantShips: number;   // cargo vessels
  typicalCargo: Record<string, number>; // cargo type → approximate units

  // Vulnerability windows
  vulnerableZones: string[];      // sea zones where they're most exposed
  vulnerableMonths: number[];     // months when they're at sea and attackable
}

export const TREASURE_FLEETS: TreasureFleet[] = [
  {
    id: 'tierra_firme',
    name: 'Tierra Firme Fleet',
    spanishName: 'Flota de Tierra Firme',
    description: 'The South American treasure fleet. Carries Peruvian silver from Portobelo, Colombian gold from Cartagena, and emeralds, cacao, and spices. The richer of the two fleets.',

    departurePort: 'seville_cadiz',
    departureMonths: [3, 4],            // departs Spain March-April
    assemblyPort: 'havana',
    assemblyMonths: [5, 6],             // arrives Havana May-June
    returnDepartureMonths: [7, 8],      // departs Havana for Spain July-August
    returnPort: 'seville_cadiz',

    outboundRoute: ['seville_cadiz', 'cartagena', 'portobelo', 'havana'],
    returnRoute: ['havana', 'seville_cadiz'],

    typicalWarships: 4,
    typicalMerchantShips: 15,
    typicalCargo: { silver: 500, gold: 100, spices: 50, cochineal: 30, cacao: 80 },

    vulnerableZones: ['florida_straits', 'bahama_channel', 'caribbean_deep_basin', 'spanish_main_coast'],
    vulnerableMonths: [3, 4, 5, 6, 7, 8, 9],
  },
  {
    id: 'nueva_espana',
    name: 'New Spain Fleet',
    spanishName: 'Flota de Nueva España',
    description: 'The Mexican treasure fleet. Carries silver from Mexican mines, silk and spices transshipped from the Manila Galleon (Philippines → Acapulco → overland → Veracruz), plus cochineal dye and cacao.',

    departurePort: 'seville_cadiz',
    departureMonths: [5, 6],            // departs Spain May-June (later than Tierra Firme)
    assemblyPort: 'havana',
    assemblyMonths: [2, 3],             // arrives Havana Feb-March of following year
    returnDepartureMonths: [3, 4],      // departs Havana for Spain March-April
    returnPort: 'seville_cadiz',

    outboundRoute: ['seville_cadiz', 'veracruz'],
    returnRoute: ['veracruz', 'havana', 'seville_cadiz'],

    typicalWarships: 3,
    typicalMerchantShips: 20,
    typicalCargo: { silver: 400, silk: 40, spices: 60, cochineal: 50, cacao: 60 },

    vulnerableZones: ['florida_straits', 'bahama_channel', 'gulf_of_mexico', 'yucatan_channel'],
    vulnerableMonths: [1, 2, 3, 4, 5, 6, 7],
  },
];

// Portobelo Treasure Fair — the single richest trade event in the Americas
export interface TreasureFair {
  id: string;
  name: string;
  portId: string;
  typicalMonths: number[];      // when the fair typically occurs
  durationWeeks: number;
  populationSurge: number;      // population multiplier during fair
  description: string;
  cargoVolume: Record<string, number>; // what flows through
}

export const TREASURE_FAIRS: TreasureFair[] = [
  {
    id: 'portobelo_fair',
    name: 'Portobelo Treasure Fair',
    portId: 'portobelo',
    typicalMonths: [4, 5],
    durationWeeks: 3,
    populationSurge: 15,    // 300 → ~5,000
    description: 'The entire town transforms. Every building becomes a warehouse or trading floor. Peruvian silver flows east, European goods flow west. More wealth per square foot than anywhere on Earth.',
    cargoVolume: { silver: 300, gold: 50, spices: 30, silk: 20 },
  },
];

// When is the treasure fleet at sea and vulnerable?
export function isFleetVulnerable(fleetId: string, month: number): boolean {
  const fleet = TREASURE_FLEETS.find(f => f.id === fleetId);
  return fleet?.vulnerableMonths.includes(month) ?? false;
}

// Is the Portobelo Fair happening?
export function isFairActive(month: number): boolean {
  return TREASURE_FAIRS[0]!.typicalMonths.includes(month);
}

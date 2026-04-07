export const ECONOMY = {
  // Fence tier requirements
  fenceTiers: {
    1: { minTransactions: 0, minTrust: 0, cutPercentage: 30, maxValuePerDeal: 500 },
    2: { minTransactions: 3, minTrust: 20, cutPercentage: 25, maxValuePerDeal: 2000 },
    3: { minTransactions: 10, minTrust: 40, cutPercentage: 20, maxValuePerDeal: 10000 },
    4: { minTransactions: 25, minTrust: 65, cutPercentage: 15, maxValuePerDeal: 50000 },
    5: { minTransactions: 50, minTrust: 85, cutPercentage: 10, maxValuePerDeal: Infinity },
  } as Record<number, { minTransactions: number; minTrust: number; cutPercentage: number; maxValuePerDeal: number }>,

  // Haven investment costs and income
  havenTypes: {
    hideout:   { baseCost: 150,   incomePerTick: 2,   maxLevel: 3, description: 'Safe house for laying low — small smuggling income' },
    warehouse: { baseCost: 400,   incomePerTick: 5,   maxLevel: 5, description: 'Store cargo safely' },
    tavern:    { baseCost: 800,   incomePerTick: 15,  maxLevel: 5, description: 'Gather intel, recruit crew' },
    shipyard:  { baseCost: 5000,  incomePerTick: 25,  maxLevel: 3, description: 'Repair and upgrade ships' },
    fort:      { baseCost: 10000, incomePerTick: 0,    maxLevel: 3, description: 'Defend your haven' },
  } as Record<string, { baseCost: number; incomePerTick: number; maxLevel: number; description: string }>,

  // Plunder heat decay
  heatDecay: {
    baseDecayPerTick: 0.5,
    stolenGoodsMultiplier: 2.0,   // stolen goods heat decays 2x slower
    fenceSaleReduction: 30,        // fence sale reduces heat by 30
    portInspectionChance: 0.05,    // 5% chance per tick at port
  },

  // Market dynamics
  market: {
    priceFluctuationPerTick: 0.02,  // max 2% change per tick
    supplyRegenerationRate: 0.01,   // 1% per tick
    demandDecayRate: 0.005,         // 0.5% per tick
    glutThreshold: 1.5,            // 150% supply = prices crash
    shortageThreshold: 0.3,        // 30% supply = prices spike
    priceMultiplierGlut: 0.5,
    priceMultiplierShortage: 2.5,
  },

  // Crew economics
  crew: {
    baseWagePerTick: 0.1,          // slashed: 0.1 per crew per economy tick (was 0.5) — 45 crew = 4.5g/tick, affordable with fencing
    loyaltyDecayPerTick: 0.05,     // much slower: 0.2/day instead of 0.8/day
    loyaltyBoostFromPay: 5,
    loyaltyBoostFromVictory: 10,
    loyaltyHitFromDefeat: 15,
    loyaltyHitFromHunger: 3,       // reduced from 5 — starvation hurts but doesn't instant-crash loyalty
    mutinyThreshold: 15,           // loyalty below 15 = mutiny risk (was 20)
    deserterionThreshold: 20,      // below 20 = desertion risk (was 30)
  },

  // Ship maintenance
  shipMaintenance: {
    barnacleGrowthPerTick: 0.1,    // per tick at sea
    rotGrowthPerTick: 0.05,        // per tick (faster in tropics)
    foodConsumptionPerCrewPerTick: 0.01,
    waterConsumptionPerCrewPerTick: 0.015,
    careeningCostPerHull: 10,
    repairCostPerHull: 15,
  },
} as const;

/**
 * Haven investments and passive income.
 * Manages pirate haven properties, upgrades, and the
 * passive income they generate between voyages.
 */

export type HavenUpgrade = 'tavern' | 'warehouse' | 'shipyard' | 'fortification' | 'spy_network' | 'market';

export interface Haven {
  id: string;
  portId: string;
  ownerId: string;
  upgrades: HavenUpgrade[];
  investedGold: number;
  incomePerTick: number;
  defenseRating: number;
}

export interface HavenIncome {
  havenId: string;
  grossIncome: number;
  maintenanceCost: number;
  netIncome: number;
}

export function calculateIncome(haven: Haven): HavenIncome {
  // TODO: Compute income from upgrades minus maintenance
  // - Each upgrade type contributes different income
  // - Maintenance scales with number of upgrades
  const gross = haven.upgrades.length * 10;
  const maintenance = haven.upgrades.length * 3;
  return {
    havenId: haven.id,
    grossIncome: gross,
    maintenanceCost: maintenance,
    netIncome: gross - maintenance,
  };
}

export function addUpgrade(haven: Haven, upgrade: HavenUpgrade, cost: number): Haven {
  // TODO: Add upgrade if affordable, increase defense/income
  return {
    ...haven,
    upgrades: [...haven.upgrades, upgrade],
    investedGold: haven.investedGold + cost,
  };
}

/**
 * Pre-computation layer for narrative proprioception.
 * Pure functions that take raw data and produce derived values.
 * All math happens here so narrative builders just reference results.
 */

import type { AgentDataSnapshot } from './narrative-data.js';
import type { Wound, Crew } from '../db/models.js';
import { isHurricaneSeason as checkHurricaneSeason } from '../world/time.js';

export interface ComputedValues {
  // Ship
  effectiveSpeed: number;
  speedLossPercent: number;
  broadsidesRemaining: number;
  daysOfFood: number;
  daysOfWater: number;
  crewShortfall: number;
  crewCount: number;
  crewCapacity: number;
  hullVerdict: string;
  sailVerdict: string;
  cargoValueTotal: number;
  cargoHeatMax: number;
  hotCargoCount: number;
  holdUsedPercent: number;
  holdFreeUnits: number;

  // Crew
  avgLoyalty: number;
  lowestLoyaltyCrew: { name: string; loyalty: number; role: string } | null;
  grievanceCount: number;
  grievanceSummary: string[];
  mutinyRisk: 'none' | 'low' | 'moderate' | 'high' | 'imminent';
  injuredCrewCount: number;

  // Personal
  cash: number;
  totalBounty: number;
  worstWound: Wound | null;
  isWounded: boolean;
  woundCount: number;
  warrantIssued: boolean;
  activeCharges: string[];
  localReputation: number;
  localInfamy: number;
  localHonor: number;

  // Economic
  totalHavenIncome: number;
  fenceTier: number;
  fenceTrust: number;

  // Environment
  isHurricaneSeason: boolean;
  patrolLevel: string;
  nearbyThreatCount: number;
  nearbyMerchantCount: number;
  temperatureDesc: string;

  // Humanized descriptions (pre-computed so LLM does zero math)
  crewStrengthDesc: string;     // "full complement" / "a dozen hands short" / "skeleton crew"
  loyaltyDesc: string;          // "devoted" / "steady" / "restless" / "mutinous"
  foodDesc: string;             // "well provisioned" / "a few days of food" / "nearly starving"
  waterDesc: string;            // "plenty of water" / "water running low" / "almost dry"
  powderDesc: string;           // "well armed" / "a few broadsides" / "nearly out of powder"
  holdDesc: string;             // "empty hold" / "half full" / "bursting at the seams"
  cashDesc: string;             // "penniless" / "a modest purse" / "wealthy"
  barnacleDesc: string;         // "" / "sluggish from barnacles" / "dragging badly"
  evidenceDesc: string;         // "thin" / "mounting" / "damning"
  bountyDesc: string;           // "" / "a small bounty" / "a king's ransom on your head"
  heatDesc: string;             // "" / "warm cargo" / "dangerously hot cargo"

  // Soul layer — attributes and skills as felt experience
  natureDesc: string;           // "powerfully built, sharp-eyed" / "" if no notable attributes
  skillDesc: string;            // "skilled navigator, competent swordsman" / ""
}

export function computeValues(snapshot: AgentDataSnapshot): ComputedValues {
  const { ship, crew, cargo, wounds, reputations, bounties, navyCases,
    havenInvestments, fences, nearbyShips, nearbyAgents, marketPrices } = snapshot;

  // --- Ship computations ---
  const speedLossPercent = ship ? Math.round(ship.barnacle_level / 2) : 0;
  const effectiveSpeed = ship ? ship.speed_base * (1 - ship.barnacle_level / 200) : 0;
  const broadsidesRemaining = (ship && ship.guns > 0) ? Math.floor(ship.powder_stores / ship.guns) : 0;
  const crewCount = ship?.crew_count ?? 0;
  const crewCapacity = ship?.crew_capacity ?? 0;
  // food_stores is 0-100, consumed at crewCount * 0.01 per tick, 24 ticks/day
  const foodBurnPerDay = crewCount * 0.01 * 24;
  const waterBurnPerDay = crewCount * 0.01 * 24;
  const daysOfFood = (foodBurnPerDay > 0 && ship) ? Math.round((ship.food_stores / foodBurnPerDay) * 10) / 10 : 0;
  const daysOfWater = (waterBurnPerDay > 0 && ship) ? Math.round((ship.water_stores / waterBurnPerDay) * 10) / 10 : 0;
  const crewShortfall = ship ? Math.max(0, ship.crew_capacity - ship.crew_count) : 0;

  const hullVerdict = !ship ? '' :
    ship.hull >= 80 ? 'sound' :
    ship.hull >= 60 ? 'battered but seaworthy' :
    ship.hull >= 40 ? 'damaged and leaking' :
    ship.hull >= 20 ? 'barely holding together' :
    'falling apart';

  const sailVerdict = !ship ? '' :
    ship.sails >= 80 ? 'full and tight' :
    ship.sails >= 60 ? 'patched but serviceable' :
    ship.sails >= 40 ? 'torn and slow' :
    'in tatters';

  // Cargo value estimate
  let cargoValueTotal = 0;
  let cargoHeatMax = 0;
  let hotCargoCount = 0;
  for (const c of cargo) {
    const marketPrice = marketPrices.find(m => m.cargo_type === c.type);
    cargoValueTotal += c.quantity * (marketPrice?.sell_price ?? 10);
    if (c.heat > cargoHeatMax) cargoHeatMax = c.heat;
    if ((c.heat > 0 || c.seized_from) && c.quantity > 0) hotCargoCount++;
  }
  cargoValueTotal = Math.round(cargoValueTotal);

  const holdUsedPercent = ship && ship.cargo_capacity > 0
    ? Math.round((ship.cargo_used / ship.cargo_capacity) * 100)
    : 0;
  const holdFreeUnits = ship ? Math.max(0, ship.cargo_capacity - ship.cargo_used) : 0;

  // --- Crew computations ---
  const activeCrew = crew.filter(c => c.status === 'active');
  // Default to 60 (steady) when no crew records exist — freshly spawned ships aren't mutinous
  const avgLoyalty = activeCrew.length > 0
    ? Math.round(activeCrew.reduce((sum, c) => sum + c.loyalty, 0) / activeCrew.length)
    : 60;

  let lowestLoyaltyCrew: ComputedValues['lowestLoyaltyCrew'] = null;
  if (activeCrew.length > 0) {
    const lowest = activeCrew.reduce((min, c) => c.loyalty < min.loyalty ? c : min, activeCrew[0]!);
    if (lowest.loyalty < 50) {
      // Look up agent name for this crew member
      const crewAgent = nearbyAgents.find(a => a.id === lowest.agent_id);
      lowestLoyaltyCrew = {
        name: crewAgent?.name ?? `the ${lowest.role.replace(/_/g, ' ')}`,
        loyalty: lowest.loyalty,
        role: lowest.role.replace(/_/g, ' '),
      };
    }
  }

  let grievanceCount = 0;
  const grievanceSummary: string[] = [];
  for (const c of activeCrew) {
    try {
      const grievances = JSON.parse(c.grievances || '[]') as Array<{ type: string; severity?: number }>;
      grievanceCount += grievances.length;
      for (const g of grievances) {
        const crewAgent = nearbyAgents.find(a => a.id === c.agent_id);
        const name = crewAgent?.name ?? `the ${c.role.replace(/_/g, ' ')}`;
        grievanceSummary.push(`${name}: ${g.type.replace(/_/g, ' ')}`);
      }
    } catch { /* ignore parse errors */ }
  }

  const mutinyRisk: ComputedValues['mutinyRisk'] =
    avgLoyalty <= 15 ? 'imminent' :
    avgLoyalty <= 25 ? 'high' :
    avgLoyalty <= 40 ? 'moderate' :
    avgLoyalty <= 55 ? 'low' :
    'none';

  const injuredCrewCount = crew.filter(c => c.status === 'injured' || c.status === 'sick').length;

  // --- Personal computations ---
  const cash = snapshot.agentDb?.cash ?? 0;
  const totalBounty = bounties.reduce((sum, b) => sum + b.amount, 0);
  const worstWound = wounds.length > 0
    ? wounds.reduce((worst, w) => w.severity > worst.severity ? w : worst, wounds[0]!)
    : null;
  const isWounded = wounds.length > 0;
  const woundCount = wounds.length;

  const warrantIssued = navyCases.some(c => c.status === 'warrant_issued');
  const activeCharges: string[] = [];
  for (const nc of navyCases) {
    if (nc.status === 'open' || nc.status === 'warrant_issued') {
      try {
        const charges = JSON.parse(nc.charges || '[]') as string[];
        activeCharges.push(...charges);
      } catch { /* ignore */ }
    }
  }

  // Reputation in current zone
  const localRep = reputations.find(r => r.sea_zone_id === snapshot.agent.seaZoneId);
  const localReputation = localRep?.reputation ?? 0;
  const localInfamy = localRep?.infamy ?? snapshot.agentDb?.infamy ?? 0;
  const localHonor = localRep?.honor ?? 50;

  // --- Economic ---
  const totalHavenIncome = havenInvestments.reduce((sum, h) => sum + h.income_per_tick, 0);
  const bestFence = fences.length > 0
    ? fences.reduce((best, f) => f.tier > best.tier ? f : best, fences[0]!)
    : null;
  const fenceTier = bestFence?.tier ?? 0;
  const fenceTrust = bestFence?.trust ?? 0;

  // --- Environment ---
  const season = snapshot.agent.persona?.strategyHint ? undefined : undefined; // just use worldState
  // Use actual game time — zone.hurricaneSeason is just "can this zone get hurricanes", not seasonal
  const isHurricaneSeason = snapshot.gameTime ? checkHurricaneSeason(snapshot.gameTime) : false;
  const patrolLevel = snapshot.zone?.patrolLevel ?? 'unknown';

  // Nearby threats: naval ships, pirate hunters
  const nearbyThreatCount = nearbyShips.filter(s => {
    // Ships with navy or pirate_hunter captains are threats to pirates
    return s.status === 'sailing' || s.status === 'docked';
  }).length;

  // Nearby merchants (potential targets or trade partners)
  const nearbyMerchantCount = nearbyAgents.filter(a =>
    a.type === 'merchant_captain'
  ).length;

  // Temperature description
  const tempF = snapshot.temperatureF;
  const temperatureDesc =
    tempF >= 95 ? 'brutally hot' :
    tempF >= 88 ? 'sweltering' :
    tempF >= 80 ? 'warm and humid' :
    tempF >= 72 ? 'pleasant' :
    tempF >= 60 ? 'cool' :
    tempF >= 45 ? 'cold' :
    'bitterly cold';

  // --- Humanized descriptions ---
  // Crew strength relative to minimum sailing crew (capacity * 0.2), not max capacity
  const minCrew = Math.max(5, Math.floor(crewCapacity * 0.2));
  const crewRatio = crewCount / minCrew;
  const crewStrengthDesc = !ship ? '' :
    crewRatio >= 2.0 ? 'full complement' :
    crewRatio >= 1.5 ? 'well crewed' :
    crewRatio >= 1.0 ? 'adequately crewed' :
    crewRatio >= 0.7 ? `short-handed (need ${Math.ceil(minCrew - crewCount)} more)` :
    crewRatio >= 0.4 ? 'seriously undermanned' :
    'skeleton crew';

  const loyaltyDesc =
    avgLoyalty >= 80 ? 'devoted' :
    avgLoyalty >= 60 ? 'steady' :
    avgLoyalty >= 40 ? 'restless' :
    avgLoyalty >= 25 ? 'discontented and dangerous' :
    'on the verge of mutiny';

  const foodDesc =
    daysOfFood >= 14 ? 'well provisioned' :
    daysOfFood >= 7 ? 'enough food for about a week' :
    daysOfFood >= 3 ? 'only a few days of food left' :
    daysOfFood >= 1 ? 'almost out of food' :
    'starving';

  const waterDesc =
    daysOfWater >= 14 ? 'plenty of water' :
    daysOfWater >= 7 ? 'water for about a week' :
    daysOfWater >= 3 ? 'water running low' :
    daysOfWater >= 1 ? 'almost out of water' :
    'no fresh water';

  const powderDesc =
    broadsidesRemaining >= 10 ? 'well supplied with powder' :
    broadsidesRemaining >= 5 ? 'enough powder for several engagements' :
    broadsidesRemaining >= 3 ? 'only a few broadsides of powder left' :
    broadsidesRemaining >= 1 ? 'barely enough powder for one fight' :
    'out of powder';

  const holdDesc =
    holdUsedPercent === 0 ? 'empty hold' :
    holdUsedPercent <= 25 ? 'mostly empty hold' :
    holdUsedPercent <= 50 ? 'hold about half full' :
    holdUsedPercent <= 75 ? 'hold three-quarters full' :
    holdUsedPercent <= 90 ? 'hold nearly full' :
    'hold bursting at the seams';

  const cashDesc =
    cash <= 0 ? 'penniless' :
    cash < 50 ? 'nearly broke' :
    cash < 200 ? 'a thin purse' :
    cash < 500 ? 'a modest purse' :
    cash < 1000 ? 'comfortable funds' :
    cash < 3000 ? 'well funded' :
    cash < 10000 ? 'wealthy' :
    'rich beyond most men\'s dreams';

  const barnacleDesc = !ship ? '' :
    ship.barnacle_level <= 15 ? '' :
    ship.barnacle_level <= 30 ? 'slightly sluggish from growth on the hull' :
    ship.barnacle_level <= 50 ? 'noticeably slow — barnacles dragging at the hull' :
    ship.barnacle_level <= 70 ? 'badly fouled — she handles like a barge' :
    'crippled by barnacles, barely making way';

  const worstEvidence = navyCases.reduce((max, nc) => Math.max(max, nc.evidence_level), 0);
  const evidenceDesc =
    worstEvidence <= 20 ? 'thin' :
    worstEvidence <= 40 ? 'circumstantial' :
    worstEvidence <= 60 ? 'mounting' :
    worstEvidence <= 80 ? 'strong' :
    'damning';

  const bountyDesc =
    totalBounty <= 0 ? '' :
    totalBounty < 100 ? 'a small bounty on your head' :
    totalBounty < 500 ? 'a meaningful bounty on your head' :
    totalBounty < 2000 ? 'a serious bounty — enough to tempt friends into betrayal' :
    'a king\'s ransom on your head';

  const heatDesc =
    cargoHeatMax <= 10 ? '' :
    cargoHeatMax <= 30 ? 'some of your cargo is warm — someone may have reported it' :
    cargoHeatMax <= 60 ? 'your cargo runs hot — authorities are looking for it' :
    'your cargo is dangerously hot — every port inspector is a threat';

  // --- Nature: HumanAttributes as felt experience ---
  const natureDesc = humanizeAttributes(snapshot);

  // --- Skills as competence awareness ---
  const skillDesc = humanizeSkills(snapshot);

  return {
    effectiveSpeed, speedLossPercent, broadsidesRemaining,
    daysOfFood, daysOfWater, crewShortfall, crewCount, crewCapacity,
    hullVerdict, sailVerdict, cargoValueTotal, cargoHeatMax, hotCargoCount,
    holdUsedPercent, holdFreeUnits,
    avgLoyalty, lowestLoyaltyCrew, grievanceCount, grievanceSummary,
    mutinyRisk, injuredCrewCount,
    cash, totalBounty, worstWound, isWounded, woundCount,
    warrantIssued, activeCharges, localReputation, localInfamy, localHonor,
    totalHavenIncome, fenceTier, fenceTrust,
    isHurricaneSeason, patrolLevel, nearbyThreatCount, nearbyMerchantCount,
    temperatureDesc,
    crewStrengthDesc, loyaltyDesc, foodDesc, waterDesc, powderDesc,
    holdDesc, cashDesc, barnacleDesc, evidenceDesc, bountyDesc, heatDesc,
    natureDesc, skillDesc,
  };
}

// ── Soul layer helpers ────────────────────────────────────

/** Parse HumanAttributes from DB JSON and humanize the 2-3 most extreme. */
function humanizeAttributes(snapshot: AgentDataSnapshot): string {
  const raw = snapshot.agentDb?.attributes;
  if (!raw || raw === '{}') return '';

  let attrs: Record<string, number>;
  try { attrs = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return ''; }

  const DESCRIPTORS: Record<string, { high: string; low: string }> = {
    strength:    { high: 'You are powerfully built — your hands can crush what lesser men cannot grip.',
                   low: 'You are slight of frame. Strength has never been your weapon.' },
    endurance:   { high: 'You can march, row, and fight long after other men have collapsed.',
                   low: 'You tire quickly. Long efforts drain you.' },
    agility:     { high: 'You are quick on your feet — nimble in a fight, sure on the rigging.',
                   low: 'You are slow and clumsy. The rigging is not your friend.' },
    constitution:{ high: 'Sickness and poison find it hard to take hold of you.',
                   low: 'Your body is fragile. Every fever, every bad meal hits you harder than most.' },
    appearance:  { high: 'People notice you when you enter a room. Your face commands attention.',
                   low: 'You are easy to overlook. Sometimes that is an advantage.' },
    intellect:   { high: 'Your mind is sharp. You see patterns where others see chaos.',
                   low: 'Words and scheming have never been your way.' },
    perception:  { high: 'Your eyes miss nothing. You notice the tell in a man\'s face before he speaks.',
                   low: 'Details escape you. You miss what sharper eyes would catch.' },
    willpower:   { high: 'You do not break. Others break around you.',
                   low: 'Your resolve wavers under pressure. Fear and temptation find you easily.' },
    creativity:  { high: 'You think sideways. When others see a wall, you see a door.',
                   low: '' },
    memory:      { high: 'You forget nothing. Names, faces, debts — they are carved into you.',
                   low: '' },
    eloquence:   { high: 'Your tongue is your sharpest weapon. You can talk a man into anything.',
                   low: 'You struggle with words. Let your actions speak.' },
    empathy:     { high: 'You read men like charts — their fears, their hungers, their breaking points.',
                   low: '' },
    presence:    { high: 'You command attention without raising your voice.',
                   low: '' },
  };

  const notable: string[] = [];
  for (const [attr, value] of Object.entries(attrs)) {
    const desc = DESCRIPTORS[attr];
    if (!desc) continue;
    if (value >= 75 && desc.high) notable.push(desc.high);
    else if (value <= 25 && desc.low) notable.push(desc.low);
  }

  return notable.slice(0, 2).join(' ');
}

/** Humanize top skills as competence awareness. */
function humanizeSkills(snapshot: AgentDataSnapshot): string {
  const { skills } = snapshot;
  if (skills.length === 0) return '';

  const sorted = [...skills].sort((a, b) => b.level - a.level);
  const top = sorted.filter(s => s.level > 40).slice(0, 3);
  if (top.length === 0) return '';

  const descs = top.map(s => {
    const word = s.level > 80 ? 'a master of' : s.level > 60 ? 'skilled in' : 'competent at';
    const domain = s.sub_skill ? s.sub_skill.replace(/_/g, ' ') : s.domain.replace(/_/g, ' ');
    return `${word} ${domain}`;
  });

  return `You are ${descs.join(', ')}.`;
}

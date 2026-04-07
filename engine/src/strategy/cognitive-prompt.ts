/**
 * Cognitive Prompt Builder — gives each agent a thinking mind.
 *
 * Five sections, all narrative, all pre-computed:
 *   1. WHAT YOU REMEMBER  — last 5 actions + outcomes + reasoning
 *   2. WHERE YOU ARE      — scene, ship, threats, weather
 *   3. WHAT YOU COULD DO  — options with consequence previews
 *   4. WHAT'S AHEAD       — planning horizon (what opens up next)
 *   5. System prompt      — identity + persona (separate message)
 *
 * Token budget: ~1200 tokens user message, ~150 system, ~100 output = ~1450 total.
 * Fits comfortably in 2048.
 */

import type { AgentState, WorldState } from '../runtime/types.js';
import type { MemoryStore } from '../runtime/memory-store.js';
import { gatherAgentData } from './narrative-data.js';
import { computeValues } from './narrative-compute.js';
import { buildConsequencePreviews } from './consequence-preview.js';
import { buildFuturePlanner } from './future-planner.js';
import type { AgentMemoryEntry } from './agent-memory.js';

// ── Section Builders ─────────────────────────────────────

function buildMemorySection(memories: AgentMemoryEntry[]): string {
  if (memories.length === 0) return '';
  const lines = memories.map(m => `- ${m.narrative}`);
  return `== WHAT YOU REMEMBER ==\n${lines.join('\n')}`;
}

function buildStateSection(
  agent: AgentState,
  snapshot: ReturnType<typeof computeValues>,
  data: Awaited<ReturnType<typeof gatherAgentData>>,
): string {
  const parts: string[] = [];

  // Location
  const portName = data.port?.name ?? agent.portId ?? 'unknown waters';
  if (agent.status === 'in_port' || agent.status === 'active') {
    parts.push(`${portName}.`);
  } else if (agent.status === 'at_sea') {
    parts.push(`At sea, ${agent.seaZoneId?.replace(/_/g, ' ') ?? 'open water'}.`);
  } else if (agent.status === 'imprisoned') {
    parts.push(`Imprisoned at ${portName}. Walls close in.`);
  }

  // Weather
  if (data.weather) {
    const w = data.weather;
    const windDesc = w.windSpeed > 30 ? 'howling gale' : w.windSpeed > 20 ? 'strong winds' :
      w.windSpeed > 10 ? 'steady breeze' : 'light airs';
    const skyDesc = w.visibility > 0.8 ? 'clear skies' : w.visibility > 0.5 ? 'hazy' :
      w.visibility > 0.3 ? 'fog rolling in' : 'thick fog';
    parts.push(`${skyDesc}, ${windDesc}.`);
  }

  // Ship
  if (data.ship) {
    const s = data.ship;
    const hull = snapshot.hullVerdict;
    const crew = snapshot.crewStrengthDesc;
    parts.push(`Your ${s.class} "${s.name}" — hull ${hull}, ${s.guns} guns, ${crew}.`);

    // Stores urgency
    if (snapshot.daysOfFood < 3 && snapshot.daysOfFood > 0) {
      parts.push(`Food running low — ${Math.round(snapshot.daysOfFood)} days left.`);
    }
    if (snapshot.daysOfWater < 2 && snapshot.daysOfWater > 0) {
      parts.push(`Water almost gone.`);
    }
    if (snapshot.broadsidesRemaining < 2 && data.ship.guns > 0) {
      parts.push(`Nearly out of powder.`);
    }
  } else if (['pirate_captain', 'merchant_captain', 'privateer_captain', 'pirate_hunter', 'naval_officer'].includes(agent.type)) {
    parts.push(`You have no ship.`);
  }

  // Cash
  parts.push(`${snapshot.cashDesc}.`);

  // Cargo (hot)
  if (snapshot.hotCargoCount > 0) {
    parts.push(`${snapshot.hotCargoCount} stolen goods in the hold — ${snapshot.heatDesc}.`);
  } else if (data.cargo.length > 0) {
    const totalQty = data.cargo.reduce((sum, c) => sum + c.quantity, 0);
    if (totalQty > 0) parts.push(`Carrying ${totalQty} units of cargo.`);
  }

  // Threats
  const threats: string[] = [];
  if (snapshot.totalBounty > 0) threats.push(snapshot.bountyDesc);
  if (snapshot.warrantIssued) threats.push(`warrant out for your arrest`);
  if (snapshot.mutinyRisk === 'imminent' || snapshot.mutinyRisk === 'high') {
    threats.push(`crew ${snapshot.mutinyRisk === 'imminent' ? 'about to mutiny' : 'restless and dangerous'}`);
  }
  if (threats.length > 0) parts.push(`Danger: ${threats.join(', ')}.`);

  // Nearby ships (compressed)
  if (data.nearbyShips && data.nearbyShips.length > 0) {
    const merchants = data.nearbyShips.filter(s => !s.captain_id || (s as any).captainType === 'merchant_captain');
    const navy = data.nearbyShips.filter(s => (s as any).captainType === 'naval_officer' || (s as any).captainType === 'pirate_hunter');
    const pirates = data.nearbyShips.filter(s => (s as any).captainType === 'pirate_captain' || (s as any).captainType === 'privateer_captain');
    const nearby: string[] = [];
    if (merchants.length > 0) nearby.push(`${merchants.length} merchant${merchants.length > 1 ? 's' : ''}`);
    if (navy.length > 0) nearby.push(`${navy.length} navy vessel${navy.length > 1 ? 's' : ''}`);
    if (pirates.length > 0) nearby.push(`${pirates.length} pirate${pirates.length > 1 ? 's' : ''}`);
    if (nearby.length > 0) parts.push(`Nearby: ${nearby.join(', ')}.`);
  }

  // Wounds
  if (data.wounds && data.wounds.length > 0) {
    const active = data.wounds.filter(w => w.healing_progress < 100);
    if (active.length > 0) {
      const worst = active.reduce((a, b) => a.severity > b.severity ? a : b);
      const sevWord = worst.severity >= 8 ? 'critical' : worst.severity >= 6 ? 'serious' : worst.severity >= 4 ? 'painful' : 'minor';
      parts.push(`Suffering from a ${sevWord} ${worst.type ?? 'wound'}.`);
    }
  }

  // Market prices — only for merchant-adjacent types, top 3 profitable goods
  const TRADE_TYPES = new Set(['merchant_captain', 'plantation_owner', 'fence']);
  if (TRADE_TYPES.has(agent.type) && data.marketPrices.length > 0 && agent.portId) {
    const localPrices = data.marketPrices.filter(p => p.port_id === agent.portId && p.supply > 5 && p.cargo_type !== 'coins');
    const profitable = localPrices
      .map(p => ({ type: p.cargo_type, buy: p.buy_price, sell: p.sell_price, supply: p.supply }))
      .sort((a, b) => b.sell - a.sell)
      .slice(0, 3);
    if (profitable.length > 0) {
      const lines = profitable.map(p => `${p.type.replace(/_/g, ' ')} — buy ${Math.round(p.buy)}g, sell ${Math.round(p.sell)}g, ${p.supply} avail`);
      parts.push(`Market: ${lines.join('; ')}.`);
    }
  }

  return `== WHERE YOU ARE ==\n${parts.join(' ')}`;
}

function buildActionsSection(
  validActions: string[],
  previews: Map<string, string | null>,
): { text: string; shownActions: string[] } {
  // Filter out actions where the preview returned null (impossible/wasted)
  // Note: previews.get() returns undefined for missing keys — treat both null and undefined as "hide"
  const possible = validActions.filter(a => {
    const p = previews.get(a);
    return p !== null && p !== undefined;
  });

  // Ensure at least do_nothing survives
  if (possible.length === 0 || (!possible.includes('do_nothing') && !possible.includes('sail_to'))) {
    if (!possible.includes('do_nothing')) possible.push('do_nothing');
  }

  // Reorder: do_nothing last
  const ordered = possible.filter(a => a !== 'do_nothing');
  if (possible.includes('do_nothing')) ordered.push('do_nothing');

  // Force sell_plunder to position 1 when it's in the list (agent has stolen cargo)
  const spIdx = ordered.indexOf('sell_plunder');
  if (spIdx > 0) {
    ordered.splice(spIdx, 1);
    ordered.unshift('sell_plunder');
  }

  const lines = ordered.map((action, i) => {
    const preview = previews.get(action) ?? '';
    const label = action.replace(/_/g, ' ');
    return preview ? `${i + 1}. ${label} — ${preview}` : `${i + 1}. ${label}`;
  });
  return {
    text: `== WHAT YOU COULD DO ==\n${lines.join('\n')}`,
    shownActions: ordered,
  };
}

function buildFutureSection(futureLines: string[]): string {
  if (futureLines.length === 0) return '';
  return `== WHAT'S AHEAD ==\n${futureLines.join('\n')}`;
}

// ── Main Builder ─────────────────────────────────────────

export async function buildCognitivePrompt(
  agent: AgentState,
  worldState: WorldState,
  memoryStore: MemoryStore,
  validActions: string[],
  memories: AgentMemoryEntry[],
): Promise<{ prompt: string; shownActions: string[] }> {
  // Gather and compute all data (reuses existing computation layer)
  const snapshot = await gatherAgentData(agent, worldState, memoryStore);
  const computed = computeValues(snapshot);

  // Build consequence previews for each action
  const previews = buildConsequencePreviews(agent, validActions, snapshot, computed, worldState);

  // Build future planning hints
  const futureLines = buildFuturePlanner(agent, computed, snapshot, worldState);

  // Build the actions section and get the filtered+ordered list
  const { text: actionsText, shownActions } = buildActionsSection(validActions, previews);

  // Assemble sections
  const sections: string[] = [];

  const memSection = buildMemorySection(memories);
  if (memSection) sections.push(memSection);

  sections.push(buildStateSection(agent, computed, snapshot));
  sections.push(actionsText);

  const futureSection = buildFutureSection(futureLines);
  if (futureSection) sections.push(futureSection);

  // Instruction
  sections.push('What do you do? Reply with ONLY the number.');

  return { prompt: sections.join('\n\n'), shownActions };
}

// ── System Prompt Builder ────────────────────────────────

export function buildCognitiveSystemPrompt(agent: AgentState, worldState: WorldState): string {
  const role = agent.type.replace(/_/g, ' ');
  const year = worldState.gameTime.year;
  const persona = agent.persona?.paragraph ?? '';
  const bg = agent.persona?.background ?? '';

  return `You are ${agent.name}, ${role}. ${persona} ${bg}\nCaribbean, ${year}. When asked what you do, reply with ONLY the number of your choice. Nothing else.`.trim();
}

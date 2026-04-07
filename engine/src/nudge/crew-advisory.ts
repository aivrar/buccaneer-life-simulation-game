/**
 * Crew advisory nudge: the quartermaster's voice.
 * ALL numbers humanized — the LLM reads words, not stats.
 */

import type { AgentDataSnapshot } from '../strategy/narrative-data.js';
import type { ComputedValues } from '../strategy/narrative-compute.js';

const CAPTAIN_TYPES = new Set([
  'pirate_captain', 'merchant_captain', 'naval_officer', 'privateer_captain', 'pirate_hunter',
]);

export function buildCrewAdvisory(snapshot: AgentDataSnapshot, computed: ComputedValues): string {
  if (!CAPTAIN_TYPES.has(snapshot.agent.type) && snapshot.agent.type !== 'quartermaster') {
    return '';
  }

  if (!snapshot.ship) return '';

  const lines: string[] = [];

  // Crew strength — humanized
  lines.push(`Crew: ${computed.crewStrengthDesc}${computed.crewShortfall > 0 ? ', and everyone knows it' : ''}.`);

  // Loyalty — humanized
  const loyaltyLines: Record<string, string> = {
    devoted: 'The crew believes in you. They would follow you into hell.',
    steady: 'Crew morale is steady. Not inspired, but not trouble either.',
    restless: 'The crew is restless. The murmur is there if you listen for it.',
    'discontented and dangerous': 'The crew is angry and dangerous. Something must be done.',
    'on the verge of mutiny': 'The crew is ready to move against you. Act now or lose your ship.',
  };
  lines.push(loyaltyLines[computed.loyaltyDesc] ?? `The crew is ${computed.loyaltyDesc}.`);

  // Named problem crew
  if (computed.lowestLoyaltyCrew) {
    const { name, role } = computed.lowestLoyaltyCrew;
    lines.push(`${name}, your ${role}, is the most disaffected. Watch that one.`);
  }

  // Grievances
  if (computed.grievanceCount > 0) {
    const topGrievances = computed.grievanceSummary.slice(0, 3);
    const word = computed.grievanceCount === 1 ? 'One grievance' :
      computed.grievanceCount <= 3 ? 'A few grievances' :
      'Many grievances';
    lines.push(`${word} unresolved:`);
    for (const g of topGrievances) {
      lines.push(`  — ${g}`);
    }
  }

  // Injured
  if (computed.injuredCrewCount > 0) {
    const word = computed.injuredCrewCount === 1 ? 'One man' :
      computed.injuredCrewCount <= 3 ? 'A few men' :
      'Several men';
    lines.push(`${word} injured or sick.`);
  }

  // Mutiny risk
  if (computed.mutinyRisk !== 'none') {
    const riskText: Record<string, string> = {
      low: 'There is grumbling, but nothing organised.',
      moderate: 'The talk below decks has an edge to it. Address the grievances before it hardens.',
      high: 'Mutiny is being discussed openly. The next wrong move could trigger it.',
      imminent: 'The crew is ready to move against you. Act now or lose your ship.',
    };
    lines.push(riskText[computed.mutinyRisk] ?? '');
  }

  // Ship code — reminds the captain of their articles
  if (snapshot.shipCode) {
    const code = snapshot.shipCode as any;
    if (code.plunder_split) {
      lines.push('Your articles bind you. The crew expects fair shares and compensation for wounds.');
    }
  }

  if (lines.length === 0) return '';
  return lines.join(' ');
}

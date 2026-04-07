/**
 * Twelve narrative section builders for agent proprioception.
 * Each returns prose text or empty string if not applicable.
 *
 * ALL math is pre-computed in narrative-compute.ts.
 * ALL numbers are humanized — the LLM sees words, not percentages.
 * "hull at 62%" → "hull battered and leaking"
 * "loyalty 50/100" → "restless crew"
 * "food for 2.5 days" → "almost out of food"
 */

import type { AgentDataSnapshot } from './narrative-data.js';
import type { ComputedValues } from './narrative-compute.js';
/** Recent action record passed from harness for history section. */
interface RecentActionRecord {
  action: string;
  result: string;
  wasStub: boolean;
  failed: boolean;
}
import { getSeaStateDescription } from '../world/sea-state.js';
import { buildSelfNudge } from '../nudge/self-nudge.js';
import { buildCrewAdvisory } from '../nudge/crew-advisory.js';
import { buildPlanningNudge } from '../nudge/planning-nudge.js';

// ─── Agent type sets ─────────────────────────────────────────
const SHIP_OWNER_TYPES = new Set([
  'pirate_captain', 'merchant_captain', 'naval_officer', 'privateer_captain', 'pirate_hunter',
]);
const ABOARD_SHIP_TYPES = new Set(['crew_member', 'quartermaster']);
const CAPTAIN_TYPES = new Set([
  'pirate_captain', 'merchant_captain', 'naval_officer', 'privateer_captain', 'pirate_hunter',
]);

// ─── Section interface ──────────────────────────────────────
export interface NarrativeSection {
  id: string;
  priority: number;       // 1 = never trim, 12 = trim first
  content: string;
  shortContent?: string;
  canTrim: boolean;
}

// ─── Master builder ─────────────────────────────────────────
export function buildAllSections(
  snapshot: AgentDataSnapshot,
  computed: ComputedValues,
  validActions: string[],
  recentActions?: RecentActionRecord[],
): NarrativeSection[] {
  const sections: NarrativeSection[] = [];
  const type = snapshot.agent.type;

  // 0. IDENTITY (unique per agent — prevents vLLM cross-contamination between batched requests)
  const role = snapshot.agent.type.replace(/_/g, ' ');
  const location = snapshot.agent.portId || snapshot.agent.seaZoneId;
  const identity = `[${snapshot.agent.name} | ${role} | ${location}]`;
  sections.push({ id: 'identity', priority: 1, content: identity, canTrim: false });

  // 1. SCENE (never trimmed)
  const scene = buildScene(snapshot, computed);
  if (scene) sections.push({ id: 'scene', priority: 1, content: scene, canTrim: false });

  // 2. BODY (never trimmed)
  const body = buildBody(snapshot, computed);
  if (body) sections.push({ id: 'body', priority: 1, content: body, canTrim: false });

  // 2b. NATURE — attributes and skills as felt experience (trimmable)
  const natureParts = [computed.natureDesc, computed.skillDesc].filter(Boolean);
  if (natureParts.length > 0) {
    sections.push({ id: 'nature', priority: 2, content: natureParts.join(' '), canTrim: true });
  }

  // 3. SHIP
  if (SHIP_OWNER_TYPES.has(type) && snapshot.ship) {
    const ship = buildShipFull(snapshot, computed);
    const shipShort = buildShipShort(snapshot, computed);
    if (ship) sections.push({ id: 'ship', priority: 3, content: ship, shortContent: shipShort, canTrim: true });
  } else if (ABOARD_SHIP_TYPES.has(type) && snapshot.ship) {
    const ship = buildShipLite(snapshot, computed);
    if (ship) sections.push({ id: 'ship', priority: 3, content: ship, canTrim: true });
  }

  // 3b. SIGHTINGS (at sea — what ships can you see?)
  if (CAPTAIN_TYPES.has(type) && snapshot.agent.status === 'at_sea') {
    const sightings = buildSightings(snapshot);
    if (sightings) sections.push({ id: 'sightings', priority: 3, content: sightings, canTrim: true });
  }

  // 4. CREW
  if (CAPTAIN_TYPES.has(type) && snapshot.crew.length > 0) {
    const crew = buildCrewAdvisory(snapshot, computed);
    const crewShort = buildCrewShort(computed);
    if (crew) sections.push({ id: 'crew', priority: 4, content: crew, shortContent: crewShort, canTrim: true });
  }

  // 5. SELF (inner voice)
  const self = buildSelfNudge(snapshot, computed);
  if (self) sections.push({ id: 'self', priority: 5, content: self, shortContent: buildSelfShort(snapshot), canTrim: true });

  // 6. LEGAL
  const legal = buildLegal(snapshot, computed);
  if (legal) sections.push({ id: 'legal', priority: 6, content: legal, canTrim: true });

  // 7. INTEL
  const intel = buildIntel(snapshot);
  const intelShort = buildIntelShort(snapshot);
  if (intel) sections.push({ id: 'intel', priority: 7, content: intel, shortContent: intelShort, canTrim: true });

  // 8. MEMORIES
  const memories = buildMemories(snapshot);
  const memoriesShort = buildMemoriesShort(snapshot);
  if (memories) sections.push({ id: 'memories', priority: 8, content: memories, shortContent: memoriesShort, canTrim: true });

  // 9. RELATIONSHIPS
  const relationships = buildRelationships(snapshot);
  if (relationships) sections.push({ id: 'relationships', priority: 9, content: relationships, canTrim: true });

  // 10. ECONOMIC
  const economic = buildEconomic(snapshot, computed);
  if (economic) sections.push({ id: 'economic', priority: 10, content: economic, canTrim: true });

  // 10b. WORK CONTEXT (non-captain agents get info about what they can work on)
  const workContext = buildWorkContext(snapshot);
  if (workContext) sections.push({ id: 'work_context', priority: 10, content: workContext, canTrim: true });

  // 11. PLANNING
  const planning = buildPlanningNudge(snapshot, computed);
  if (planning) sections.push({ id: 'planning', priority: 11, content: planning, canTrim: true });

  // 12. RECENT HISTORY (trimmable — inside budget, not appended after)
  if (recentActions && recentActions.length > 0) {
    const history = buildRecentHistory(recentActions, validActions);
    if (history) sections.push({ id: 'history', priority: 2, content: history, canTrim: true });
  }

  // 13. ACTIONS (never trimmed)
  const actions = buildActions(validActions, snapshot, computed);
  sections.push({ id: 'actions', priority: 1, content: actions, canTrim: false });

  return sections;
}

// ═══════════════════════════════════════════════════════════
// Section 1: SCENE
// ═══════════════════════════════════════════════════════════

function buildScene(snapshot: AgentDataSnapshot, computed: ComputedValues): string {
  const { agent, seaState } = snapshot;
  const parts: string[] = [];

  if (agent.status === 'at_sea' && snapshot.weatherAmbient) {
    parts.push(snapshot.weatherAmbient);
  } else if (snapshot.placeAmbient) {
    parts.push(snapshot.placeAmbient);
  } else if (snapshot.weatherAmbient) {
    parts.push(snapshot.weatherAmbient);
  }

  // Only add seasonal ambient if weather/place ambient didn't already cover it
  if (snapshot.seasonalAmbient && !parts.some(p =>
    p.toLowerCase().includes('season') || p.toLowerCase().includes('hurricane') ||
    p.toLowerCase().includes('trade wind') || p.toLowerCase().includes('harmattan'))) {
    parts.push(snapshot.seasonalAmbient);
  }

  if (parts.length === 0) {
    const location = agent.status === 'at_sea'
      ? `at sea in the ${snapshot.zone?.name ?? 'open waters'}`
      : `in ${snapshot.port?.name ?? 'port'}`;
    parts.push(`You are ${location}. The air is ${computed.temperatureDesc}.`);
  }

  if (agent.status === 'at_sea' && seaState) {
    const seaDesc = getSeaStateDescription(seaState);
    if (seaDesc && !parts.some(p => p.toLowerCase().includes('sea'))) {
      parts.push(`The sea is ${seaDesc.toLowerCase()}.`);
    }
  }

  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════
// Section 2: BODY
// ═══════════════════════════════════════════════════════════

function buildBody(snapshot: AgentDataSnapshot, _computed: ComputedValues): string {
  const { wounds } = snapshot;

  if (wounds.length === 0) {
    return 'You are hale. No wounds trouble you, no fever clouds your mind.';
  }

  // Deduplicate wounds by (type, location) — merge identical entries
  const uniqueWounds = deduplicateWounds(wounds);

  const parts: string[] = [];
  const woundDescriptors: Record<string, string> = {
    cut: 'a blade wound', gunshot: 'a gunshot wound', burn: 'a burn',
    broken_bone: 'a broken bone', disease: 'sickness', scurvy: 'the scurvy',
    fever: 'fever', infection: 'infection',
  };

  for (const w of uniqueWounds.slice(0, 3)) {
    const desc = woundDescriptors[w.type] ?? w.type;
    const location = w.location ? ` in your ${w.location}` : '';
    const countPrefix = w.count > 1 ? `${w.count} bouts of ` : '';
    const severityWord =
      w.severity >= 8 ? 'critical' : w.severity >= 6 ? 'serious' :
      w.severity >= 4 ? 'painful' : 'minor';

    const healingWord =
      w.healing_progress > 80 ? 'nearly mended' :
      w.healing_progress > 50 ? 'healing slowly' :
      w.healing_progress > 20 ? 'still raw' :
      'fresh';

    if (w.count > 1) {
      // Grouped: "two bouts of sickness — painful, the worst untreated"
      if (w.treated) {
        parts.push(`${countPrefix}${desc}${location} — ${severityWord}, treated and ${healingWord}.`);
      } else {
        parts.push(`${countPrefix}${desc}${location} — ${severityWord} and untreated. ${w.severity >= 6 ? 'This could kill you.' : ''}`);
      }
    } else {
      if (w.treated) {
        parts.push(`${desc}${location} — ${severityWord}, treated and ${healingWord}.`);
      } else {
        parts.push(`${desc}${location} — ${severityWord} and untreated. ${w.severity >= 6 ? 'This could kill you.' : 'It aches.'}`);
      }
    }
  }

  const remaining = uniqueWounds.length - 3;
  if (remaining > 0) {
    parts.push(`And ${remaining} more wound${remaining > 1 ? 's' : ''} besides.`);
  }

  return 'Your body tells you this: ' + parts.join(' ');
}

/** Merge wounds with identical (type, location) into counted groups. Keeps highest severity. */
function deduplicateWounds(wounds: Array<{ type: string; location?: string | null; severity: number; healing_progress: number; treated: boolean }>):
  Array<{ type: string; location?: string | null; severity: number; healing_progress: number; treated: boolean; count: number }> {
  const map = new Map<string, { type: string; location?: string | null; severity: number; healing_progress: number; treated: boolean; count: number }>();
  for (const w of wounds) {
    const key = `${w.type}:${w.location ?? 'body'}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      if (w.severity > existing.severity) {
        existing.severity = w.severity;
        existing.healing_progress = w.healing_progress;
        existing.treated = w.treated;
      }
    } else {
      map.set(key, { ...w, count: 1 });
    }
  }
  return Array.from(map.values());
}

// ═══════════════════════════════════════════════════════════
// Section 3: SHIP (full, lite, short variants)
// ═══════════════════════════════════════════════════════════

function buildShipFull(snapshot: AgentDataSnapshot, computed: ComputedValues): string {
  const ship = snapshot.ship!;
  const lines: string[] = [];

  const shipName = ship.name.startsWith('The ') ? ship.name : `The ${ship.name}`;
  lines.push(`${shipName} is ${shipClassArticle(ship.class)} ${ship.class.replace(/_/g, ' ')} of ${ship.guns} guns.`);

  // Hull — humanized
  lines.push(`Her hull is ${computed.hullVerdict}.${ship.hull < 50 ? ' She cannot take heavy weather or a sustained broadside.' : ''}`);

  // Sails — humanized
  lines.push(`Sails ${computed.sailVerdict}.`);

  // Barnacles — only mention if notable
  if (computed.barnacleDesc) {
    lines.push(`She is ${computed.barnacleDesc}.${ship.barnacle_level > 50 ? ' She needs careening.' : ''}`);
  }

  // Rot — only mention if notable
  if (ship.rot_level > 20) {
    const rotWord = ship.rot_level > 50 ? 'The tropics are eating her alive' : 'Rot is creeping into the timbers';
    lines.push(`${rotWord}.`);
  }

  // Stores — humanized
  lines.push(`Below decks: ${computed.foodDesc}, ${computed.waterDesc}, ${computed.powderDesc}.`);

  // Cargo — humanized
  if (snapshot.cargo.length > 0) {
    const cargoSummary = snapshot.cargo.slice(0, 4).map(c => {
      return `${c.quantity} ${c.type.replace(/_/g, ' ')}`;
    }).join(', ');
    lines.push(`In the hold (${computed.holdDesc}): ${cargoSummary}.${computed.heatDesc ? ' ' + computed.heatDesc + '.' : ''}`);
  } else {
    lines.push(`The hold is empty.`);
  }

  return lines.join(' ');
}

function buildShipLite(snapshot: AgentDataSnapshot, computed: ComputedValues): string {
  const ship = snapshot.ship!;
  const lines: string[] = [];
  const shipName = ship.name.startsWith('The ') ? ship.name : `the ${ship.name}`;
  lines.push(`You serve aboard ${shipName}, ${shipClassArticle(ship.class)} ${ship.class.replace(/_/g, ' ')}.`);
  lines.push(`She feels ${computed.hullVerdict} beneath your feet.`);
  if (computed.crewShortfall > 0) {
    lines.push(`The crew is ${computed.crewStrengthDesc}. Everyone works harder for it.`);
  }
  return lines.join(' ');
}

function buildShipShort(snapshot: AgentDataSnapshot, computed: ComputedValues): string {
  const ship = snapshot.ship!;
  const sn = ship.name.startsWith('The ') ? ship.name : `The ${ship.name}`;
  return `${sn}: hull ${computed.hullVerdict}, sails ${computed.sailVerdict}, ${ship.guns} guns. ${computed.crewStrengthDesc}. ${computed.foodDesc}, ${computed.powderDesc}.`;
}

function shipClassArticle(cls: string): string {
  return /^[aeiou]/i.test(cls) ? 'an' : 'a';
}

// ═══════════════════════════════════════════════════════════
// Section 3b: SIGHTINGS (ships visible at sea)
// ═══════════════════════════════════════════════════════════

function buildSightings(snapshot: AgentDataSnapshot): string {
  const { nearbyShips, nearbyTargetIntel, agent, ship: myShip } = snapshot;
  if (nearbyShips.length === 0 && nearbyTargetIntel.length === 0) {
    return 'The horizon is empty. No sails in sight. You are safe to sail freely.';
  }

  const myGuns = myShip?.guns ?? 0;
  const myType = agent.type;
  const lines: string[] = ['On the horizon you see:'];
  const shown = new Set<string>();

  // Ships with full target intel (bounties, warrants, infamy)
  for (const target of nearbyTargetIntel.slice(0, 5)) {
    shown.add(target.agentId);
    const cls = target.shipClass.replace(/_/g, ' ');
    const role = target.type.replace(/_/g, ' ');

    const gunDesc = target.guns > 30 ? 'heavily armed' : target.guns > 15 ? 'well armed' : target.guns > 5 ? 'lightly armed' : 'barely armed';
    const crewDesc = target.crewCount > 150 ? 'large crew' : target.crewCount > 50 ? 'decent crew' : 'small crew';
    const hullDesc = target.hull < 40 ? ', hull battered' : target.hull < 60 ? ', hull damaged' : '';
    const sailDesc = target.sails < 40 ? ', sails torn' : '';

    const infamyDesc = target.infamy >= 50 ? 'Notorious' : target.infamy >= 25 ? 'Known' : target.infamy >= 10 ? 'Minor reputation' : '';
    const bountyDesc = target.bountyTotal > 0 ? `Bounty: ${target.bountyTotal} gold.` : '';
    const warrantDesc = target.warrantIssued ? 'WANTED by the Crown.' : '';

    // Threat assessment based on viewer's type and relative strength
    const threatTag = assessThreat(myType, myGuns, target.type, target.guns, target.warrantIssued, target.infamy);

    let line = `— [${threatTag}] ${target.shipName}, ${shipClassArticle(cls)} ${cls}, ${gunDesc}, ${crewDesc}${hullDesc}${sailDesc}. Captained by ${target.name}, a ${role}.`;
    if (infamyDesc) line += ` ${infamyDesc}.`;
    if (bountyDesc) line += ` ${bountyDesc}`;
    if (warrantDesc) line += ` ${warrantDesc}`;

    lines.push(line);
  }

  // Ships without intel (unknown vessels)
  for (const ship of nearbyShips.slice(0, 5)) {
    if (ship.captain_id && shown.has(ship.captain_id)) continue;
    if (shown.size >= 5) break;

    const cls = ship.class.replace(/_/g, ' ');
    const gunDesc = ship.guns > 30 ? 'heavily armed' : ship.guns > 15 ? 'well armed' : ship.guns > 5 ? 'lightly armed' : 'barely armed';
    const crewDesc = ship.crew_count > 150 ? 'large crew' : ship.crew_count > 50 ? 'decent crew' : 'small crew';
    const threatTag = ship.guns > myGuns * 1.5 ? 'DANGER' : 'UNKNOWN';

    lines.push(`— [${threatTag}] ${ship.name}, ${shipClassArticle(cls)} ${cls}, ${gunDesc}, ${crewDesc} — identity unknown`);
    shown.add(ship.captain_id ?? ship.id);
  }

  // Tactical summary
  const threats = nearbyTargetIntel.filter(t => t.guns > myGuns * 1.3).length;
  const targets = nearbyTargetIntel.filter(t => t.guns < myGuns * 0.7).length;
  if (threats === 0 && nearbyTargetIntel.length > 0) {
    lines.push('None of these ships pose a serious threat to you.');
  } else if (threats > 0 && targets === 0) {
    lines.push('These waters are dangerous. Consider avoiding engagement.');
  }

  return lines.join('\n');
}

/** Assess threat level of a spotted ship relative to the viewer */
function assessThreat(
  viewerType: string, viewerGuns: number,
  targetType: string, targetGuns: number,
  targetWanted: boolean, targetInfamy: number,
): string {
  const isNavy = viewerType === 'naval_officer' || viewerType === 'pirate_hunter';
  const isPrivateer = viewerType === 'privateer_captain';
  const isPirate = viewerType === 'pirate_captain';
  const isMerchant = viewerType === 'merchant_captain';

  const targetIsPirate = targetType === 'pirate_captain' || targetType === 'privateer_captain';
  const targetIsNavy = targetType === 'naval_officer' || targetType === 'pirate_hunter';
  const targetIsMerchant = targetType === 'merchant_captain';

  // Navy/hunter sees wanted pirate → PRIZE
  if (isNavy && targetIsPirate && (targetWanted || targetInfamy > 10)) {
    return targetGuns > viewerGuns * 1.3 ? 'DANGEROUS PRIZE' : 'PRIZE — engage';
  }
  // Navy sees merchant → FRIENDLY
  if (isNavy && targetIsMerchant) return 'FRIENDLY';
  // Navy sees navy → ALLIED
  if (isNavy && targetIsNavy) return 'ALLIED';

  // Privateer sees merchant of enemy nation → LAWFUL TARGET
  if (isPrivateer && targetIsMerchant) {
    return targetGuns > viewerGuns * 1.3 ? 'LAWFUL TARGET — well defended' : 'LAWFUL TARGET';
  }
  // Privateer sees pirate → could be ally or rival
  if (isPrivateer && targetIsPirate) return 'RIVAL';
  // Privateer sees navy → CAUTION (don't attack them)
  if (isPrivateer && targetIsNavy) return 'CAUTION — Royal Navy';

  // Pirate sees merchant → PREY
  if (isPirate && targetIsMerchant) {
    return targetGuns > viewerGuns * 1.3 ? 'RISKY PREY' : 'PREY';
  }
  // Pirate sees navy → DANGER
  if (isPirate && targetIsNavy) return 'DANGER — Navy';
  // Pirate sees pirate → NEUTRAL (unless rival)
  if (isPirate && targetIsPirate) return 'NEUTRAL — fellow pirate';

  // Merchant sees pirate → THREAT
  if (isMerchant && targetIsPirate) {
    return targetGuns > viewerGuns ? 'THREAT — pirate' : 'THREAT — pirate (but weaker)';
  }
  // Merchant sees navy → PROTECTION
  if (isMerchant && targetIsNavy) return 'FRIENDLY — Navy escort';
  // Merchant sees merchant → NEUTRAL
  if (isMerchant && targetIsMerchant) return 'NEUTRAL — fellow trader';

  // Default: compare guns
  if (targetGuns > viewerGuns * 1.5) return 'DANGER';
  if (targetGuns < viewerGuns * 0.5) return 'WEAKER';
  return 'NEUTRAL';
}

// ═══════════════════════════════════════════════════════════
// Section 4: CREW (short variant for trimming)
// ═══════════════════════════════════════════════════════════

function buildCrewShort(computed: ComputedValues): string {
  return `Crew ${computed.crewStrengthDesc}, ${computed.loyaltyDesc}. ${computed.mutinyRisk !== 'none' ? 'Mutiny risk: ' + computed.mutinyRisk + '.' : ''}`;
}

// ═══════════════════════════════════════════════════════════
// Section 5: SELF (short variant)
// ═══════════════════════════════════════════════════════════

function buildSelfShort(snapshot: AgentDataSnapshot): string {
  const strategy = snapshot.agent.persona?.strategyHint ?? 'balanced';
  const ambition = snapshot.agent.persona?.ambitions?.[0] ?? 'survival';
  return `Your nature is ${strategy}. Your deepest drive: ${ambition}.`;
}

// ═══════════════════════════════════════════════════════════
// Section 6: LEGAL
// ═══════════════════════════════════════════════════════════

function buildLegal(snapshot: AgentDataSnapshot, computed: ComputedValues): string {
  if (snapshot.bounties.length === 0 && snapshot.navyCases.length === 0) return '';

  const lines: string[] = [];

  if (computed.bountyDesc) {
    lines.push(`${computed.bountyDesc}.`);
  }

  for (const nc of snapshot.navyCases.slice(0, 2)) {
    if (nc.status === 'warrant_issued') {
      lines.push(`A warrant has been issued for your arrest. The evidence against you is ${computed.evidenceDesc}. Any Navy vessel that identifies you will try to take you.`);
    } else if (nc.status === 'open') {
      lines.push(`The Navy is building a case against you. The evidence is ${computed.evidenceDesc} — not enough for a warrant yet, but they are watching.`);
    } else if (nc.status === 'arrested') {
      lines.push('You are under arrest, awaiting trial.');
    } else if (nc.status === 'trial') {
      lines.push('You are standing trial. Your fate is in the hands of the court.');
    }
  }

  return lines.join(' ');
}

// ═══════════════════════════════════════════════════════════
// Section 7: INTEL
// ═══════════════════════════════════════════════════════════

function buildIntel(snapshot: AgentDataSnapshot): string {
  const hasIntel = snapshot.intel.length > 0;
  const hasEvents = snapshot.worldEvents.length > 0;
  if (!hasIntel && !hasEvents) return '';

  const lines = ['What you have heard:'];

  // World events first (more impactful)
  for (const event of snapshot.worldEvents.slice(0, 3)) {
    const severity = event.severity >= 8 ? 'Major' : event.severity >= 5 ? 'Notable' : 'Minor';
    lines.push(`— [${severity} event] ${event.description}`);
  }

  for (const item of snapshot.intel.slice(0, 5)) {
    const confidence =
      item.accuracy >= 80 ? 'reliable' :
      item.accuracy >= 50 ? 'probable' :
      'rumor';
    const freshness =
      item.freshness >= 80 ? 'fresh' :
      item.freshness >= 50 ? 'a few days old' :
      'getting stale';
    lines.push(`— [${confidence}, ${freshness}] ${item.content}`);
  }
  return lines.join('\n');
}

function buildIntelShort(snapshot: AgentDataSnapshot): string {
  if (snapshot.intel.length === 0) return '';
  const items = snapshot.intel.slice(0, 2).map(i => {
    const tag = i.accuracy >= 80 ? 'reliable' : i.accuracy >= 50 ? 'probable' : 'rumor';
    return `[${tag}] ${i.content}`;
  });
  return 'Intel: ' + items.join(' | ');
}

// ═══════════════════════════════════════════════════════════
// Section 8: MEMORIES
// ═══════════════════════════════════════════════════════════

function buildMemories(snapshot: AgentDataSnapshot): string {
  const { workingMemory, episodicMemory } = snapshot;
  if (workingMemory.length === 0 && episodicMemory.length === 0) {
    return 'You are new to these waters. No memories yet shape your judgment.';
  }

  const lines: string[] = ['You remember:'];
  for (const m of workingMemory.slice(0, 5)) {
    lines.push(`— [Recent] ${m.content}`);
  }
  for (const m of episodicMemory.slice(0, 5)) {
    const tag = m.isTraumatic ? 'VIVID' : 'Memory';
    lines.push(`— [${tag}] ${m.content}`);
  }
  return lines.join('\n');
}

function buildMemoriesShort(snapshot: AgentDataSnapshot): string {
  const { workingMemory, episodicMemory } = snapshot;
  if (workingMemory.length === 0 && episodicMemory.length === 0) return '';
  const items = [
    ...workingMemory.slice(0, 2).map(m => `[Recent] ${m.content}`),
    ...episodicMemory.slice(0, 1).map(m => `[${m.isTraumatic ? 'VIVID' : 'Memory'}] ${m.content}`),
  ];
  return items.join('\n');
}

// ═══════════════════════════════════════════════════════════
// Section 9: RELATIONSHIPS
// ═══════════════════════════════════════════════════════════

function buildRelationships(snapshot: AgentDataSnapshot): string {
  const { allies, rivals, relationshipAgents, nearbyAgents } = snapshot;
  if (allies.length === 0 && rivals.length === 0) return '';

  // Build lookup from resolved relationship agents, fall back to nearbyAgents
  const allKnown = [...relationshipAgents, ...nearbyAgents];
  const agentMap = new Map(allKnown.map(a => [a.id, a]));

  const lines: string[] = [];

  if (allies.length > 0) {
    const allyDescs = allies.slice(0, 3).map(r => {
      const target = agentMap.get(r.target_agent_id);
      if (!target) return null; // skip unresolvable — don't say "someone"
      const role = target.type.replace(/_/g, ' ');
      const bond =
        r.trust > 70 ? 'a trusted ally' :
        r.fondness > 70 ? 'a close friend' :
        'a friend';
      const fearNote = r.fear > 60 ? ' — though you fear them' : '';
      return `${target.name}, a ${role}, is ${bond}${fearNote}`;
    }).filter(Boolean);
    if (allyDescs.length > 0) {
      lines.push(`Your allies: ${allyDescs.join('; ')}.`);
    }
  }

  if (rivals.length > 0) {
    const rivalDescs = rivals.slice(0, 2).map(r => {
      const target = agentMap.get(r.target_agent_id);
      if (!target) return null;
      const role = target.type.replace(/_/g, ' ');
      const tension =
        r.fear > 60 ? 'You fear them' :
        r.rivalry > 70 ? 'is a blood enemy' :
        'is a rival';
      return `${target.name}, a ${role}, ${tension}`;
    }).filter(Boolean);
    if (rivalDescs.length > 0) {
      lines.push(`Your rivals: ${rivalDescs.join('; ')}.`);
    }
  }

  return lines.join(' ');
}

// ═══════════════════════════════════════════════════════════
// Section 10: ECONOMIC
// ═══════════════════════════════════════════════════════════

function buildEconomic(snapshot: AgentDataSnapshot, computed: ComputedValues): string {
  const lines: string[] = [];

  lines.push(`Your purse: ${computed.cashDesc}.`);

  if (computed.cargoValueTotal > 0 && SHIP_OWNER_TYPES.has(snapshot.agent.type)) {
    const valueWord =
      computed.cargoValueTotal < 100 ? 'a pittance' :
      computed.cargoValueTotal < 500 ? 'a decent haul' :
      computed.cargoValueTotal < 2000 ? 'a valuable cargo' :
      'a fortune in the hold';
    lines.push(`Cargo aboard is worth ${valueWord}.`);
  }

  if (computed.totalHavenIncome > 0) {
    lines.push('Your haven investments bring steady income.');
  }

  if (computed.fenceTier > 0 && (snapshot.agent.type === 'pirate_captain' || snapshot.agent.type === 'fence')) {
    const fenceWord =
      computed.fenceTier >= 4 ? 'a powerful fence connection' :
      computed.fenceTier >= 3 ? 'a reliable fence' :
      computed.fenceTier >= 2 ? 'a decent fence contact' :
      'a low-level fence contact';
    lines.push(`You have ${fenceWord}.`);
  }

  if (lines.length <= 1 && computed.cash === 0) return '';
  return lines.join(' ');
}

// ═══════════════════════════════════════════════════════════
// Section 12: ACTIONS (never trimmed)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Section 10b: WORK CONTEXT (role-specific port information)
// ═══════════════════════════════════════════════════════════

function buildWorkContext(snapshot: AgentDataSnapshot): string {
  const { agent, nearbyShips, nearbyAgents, wounds } = snapshot;
  const type = agent.type;
  const lines: string[] = [];

  // Helper: count nearby agents by type
  const countByType = (types: string[]) => nearbyAgents.filter(a => a.status === 'in_port' && types.includes(a.type)).length;

  switch (type) {
    case 'surgeon': {
      const atPort = nearbyAgents.filter(a => a.status === 'in_port');
      lines.push(`The port has ${atPort.length} souls. Sailors come to you with cuts, fever, and worse.`);
      if (wounds.length > 0) {
        lines.push(`You tend to ${wounds.length} case${wounds.length > 1 ? 's' : ''}.`);
      } else {
        lines.push('No one has come to you yet. Make yourself known, or seek a crew that needs a surgeon.');
      }
      break;
    }
    case 'fence': {
      const docked = nearbyShips.filter(s => s.status === 'docked');
      const pirateCount = countByType(['pirate_captain', 'privateer_captain']);
      const merchantCount = countByType(['merchant_captain']);
      if (docked.length > 0) {
        lines.push(`${docked.length} ships docked.`);
        if (pirateCount > 0) lines.push(`${pirateCount} pirate captain${pirateCount > 1 ? 's' : ''} in port — likely carrying plunder they cannot sell openly.`);
        if (merchantCount > 0) lines.push(`${merchantCount} merchant${merchantCount > 1 ? 's' : ''} — legitimate cargo, but some captains need discreet services.`);
        if (pirateCount === 0 && merchantCount === 0) lines.push('No captains ashore. Wait for ships to arrive, or use this time to build contacts.');
      } else {
        lines.push('The harbor is empty. No ships means no business. Bribe officials or gather intelligence for when the ships return.');
      }
      if (snapshot.port?.corruption && snapshot.port.corruption > 50) {
        lines.push(snapshot.port.corruption > 75
          ? 'The officials here are deeply corrupt — excellent for your trade.'
          : 'The officials can be bought. Useful.');
      }
      break;
    }
    case 'shipwright': {
      const docked = nearbyShips.filter(s => s.status === 'docked');
      const needsWork = docked.filter(s => s.hull < 80 || s.sails < 80 || s.barnacle_level > 30);
      if (needsWork.length > 0) {
        const details = needsWork.slice(0, 2).map(s => {
          const issues: string[] = [];
          if (s.hull < 60) issues.push('hull damaged');
          else if (s.hull < 80) issues.push('hull scuffed');
          if (s.sails < 60) issues.push('sails torn');
          if (s.barnacle_level > 50) issues.push('barnacles thick');
          else if (s.barnacle_level > 30) issues.push('needs careening');
          return `The ${s.name} — ${issues.join(', ')}.`;
        });
        lines.push(`${needsWork.length} ship${needsWork.length > 1 ? 's' : ''} in port need your skills.`);
        lines.push(...details);
      } else if (docked.length > 0) {
        lines.push(`${docked.length} ships docked, all in fair shape. Offer assessments or upgrades.`);
      } else {
        lines.push('No ships in port. Quiet times for a shipwright.');
      }
      break;
    }
    case 'harbor_master': {
      const docked = nearbyShips.filter(s => s.status === 'docked');
      lines.push(`${docked.length} ships docked in your harbor.`);
      if (docked.length > 0) {
        const unnamed = docked.filter(s => !s.name.startsWith('HMS'));
        if (unnamed.length > 0) {
          const sample = unnamed[0]!;
          lines.push(`The ${sample.name} — inspect or clear? Every ship owes fees and every cargo wants scrutiny.`);
        }
      }
      break;
    }
    case 'tavern_keeper': {
      const atPort = nearbyAgents.filter(a => a.status === 'in_port');
      const pirateCount = countByType(['pirate_captain', 'privateer_captain']);
      const merchantCount = countByType(['merchant_captain']);
      const navyCount = countByType(['naval_officer', 'pirate_hunter']);
      lines.push(`${atPort.length} souls in port tonight.`);
      if (pirateCount > 0) lines.push(`${pirateCount} pirate captain${pirateCount > 1 ? 's' : ''} drinking — recruitment and deal-brokering opportunities.`);
      if (merchantCount > 0) lines.push(`${merchantCount} merchant${merchantCount > 1 ? 's' : ''} — they pay well for drinks and gossip.`);
      if (navyCount > 0) lines.push('Navy officers present — careful what you say, but they pay for intelligence.');
      if (atPort.length === 0) lines.push('Empty tavern. Quiet night — spread a rumor or gather intel to stir things up.');
      break;
    }
    case 'informant': {
      const intelCount = snapshot.intel.length;
      const freshIntel = snapshot.intel.filter(i => i.freshness > 70).length;
      if (intelCount > 0) {
        lines.push(`You hold ${intelCount} pieces of intelligence, ${freshIntel} still fresh enough to sell.`);
      } else {
        lines.push('Your ears are empty. Eavesdrop, plant a rumor, or bribe someone to loosen tongues.');
      }
      break;
    }
    case 'plantation_owner': {
      const docked = nearbyShips.filter(s => s.status === 'docked');
      lines.push('Your crops grow in the fields. The harvest depends on weather and labor.');
      if (docked.length > 0) {
        lines.push(`${docked.length} ship${docked.length > 1 ? 's' : ''} in port — you could hire shipping for your goods.`);
      } else {
        lines.push('No ships in port. Your harvest sits in the warehouse.');
      }
      const pirateCount = countByType(['pirate_captain', 'privateer_captain']);
      if (pirateCount > 0) lines.push(`${pirateCount} pirate${pirateCount > 1 ? 's' : ''} in port — a threat to your shipments, or a customer for your rum.`);
      break;
    }
    case 'crew_member': {
      if (snapshot.ship) {
        lines.push(`You serve aboard the ${snapshot.ship.name}. Your duties are what the captain and quartermaster demand.`);
        if (snapshot.ship.food_stores < 30) lines.push('Rations are short. The crew is hungry.');
        if (snapshot.ship.hull < 50) lines.push('The ship is in poor shape — every hand is needed for repairs.');
      } else {
        lines.push('You have no ship. You are ashore, looking for a berth or making your own way.');
      }
      break;
    }
    case 'quartermaster': {
      if (snapshot.ship) {
        const crewCount = snapshot.ship.crew_count;
        lines.push(`You are quartermaster of the ${snapshot.ship.name}. ${crewCount} souls aboard look to you for fair shares and honest dealing.`);
        if (snapshot.ship.food_stores < 40) lines.push('Provisions are running low — the crew will notice soon.');
        if (snapshot.shipCode) {
          const code = snapshot.shipCode as any;
          if (code.articles) lines.push('Your articles bind the crew. Enforce them, or watch discipline crumble.');
        }
      } else {
        lines.push('You are a quartermaster without a ship. Seek a captain who needs order among his crew.');
      }
      break;
    }
    case 'port_governor': {
      const docked = nearbyShips.filter(s => s.status === 'docked');
      const atPort = nearbyAgents.filter(a => a.status === 'in_port');
      const pirateCount = countByType(['pirate_captain', 'privateer_captain']);
      lines.push(`You govern this port. ${docked.length} ships in harbor, ${atPort.length} souls ashore.`);
      if (pirateCount > 0) lines.push(`${pirateCount} pirate${pirateCount > 1 ? 's' : ''} in your port — collect fees, deny entry, or post a bounty.`);
      if (snapshot.port) {
        const p = snapshot.port;
        lines.push(`Fort strength: ${p.fort_strength > 70 ? 'formidable' : p.fort_strength > 40 ? 'adequate' : 'weak'}. Corruption: ${p.corruption > 70 ? 'rampant' : p.corruption > 40 ? 'present' : 'under control'}.`);
        if (p.prosperity < 40) lines.push('Trade is sluggish. The port needs investment.');
      }
      break;
    }
  }

  return lines.join(' ');
}

// ═══════════════════════════════════════════════════════════
// Section 12: RECENT HISTORY (inside budget, trimmable)
// ═══════════════════════════════════════════════════════════

function buildRecentHistory(recentActions: RecentActionRecord[], validActions: string[]): string {
  const FAIL_SIGNALS = ['No ', 'Insufficient', 'Cannot afford', 'Not on', 'Not assigned', 'No one',
    'nothing to', 'No fresh', 'No ships nearby', 'No stolen', 'No amputations', 'No cases',
    'No prisoners', 'No bounties', 'No active bounties', 'No pirates warrant', 'No profitable',
    'No merchant ships', 'No suspicious', 'No captains seeking', 'No fugitives', 'No disputes',
    'No plunder', 'need a patron', 'No active investigations'];

  const validSet = new Set(validActions);
  const lines: string[] = [];

  for (const r of recentActions) {
    const name = r.action.replace(/_/g, ' ');
    // Skip history for actions no longer available — avoids confusing the model
    if (!validSet.has(r.action) && r.action !== 'do_nothing' && !r.action.startsWith('sail')) continue;

    if (r.wasStub) {
      lines.push(`— You tried to ${name} — nothing came of it. Try something different.`);
    } else if (r.failed || FAIL_SIGNALS.some(sig => r.result.includes(sig))) {
      lines.push(`— You tried to ${name} — it did not work. Try a different approach.`);
    } else if (r.result.includes('Departed')) {
      lines.push(`— You sailed — ${r.result.slice(0, 60)}`);
    } else {
      lines.push(`— You ${name} — ${r.result.slice(0, 60)}`);
    }
  }

  if (lines.length === 0) return '';
  return 'Your recent actions:\n' + lines.join('\n');
}

function buildActions(
  validActions: string[],
  snapshot: AgentDataSnapshot,
  computed: ComputedValues,
): string {
  // validActions arrives pre-shuffled from harness; keep do_nothing last
  // Filter out sell_plunder when agent has no hot cargo (prevents wasted LLM turns)
  const filtered = computed.hotCargoCount > 0
    ? validActions
    : validActions.filter(a => a !== 'sell_plunder');
  const main = filtered.filter(a => a !== 'do_nothing');
  let ordered = [...main];

  // For pirate/privateer captains in port, force sail_to to position 1
  // so the 4B model sees it first and is more likely to pick it
  const isPirateType = snapshot.agent.type === 'pirate_captain' || snapshot.agent.type === 'privateer_captain';
  if (isPirateType && snapshot.agent.status === 'in_port') {
    const sailIdx = ordered.indexOf('sail_to');
    if (sailIdx > 0) {
      ordered.splice(sailIdx, 1);
      ordered.unshift('sail_to');
    }
  }

  // Pirates/privateers/merchants don't get do_nothing — they have lay_low for idling
  // The 4B model picks do_nothing 26% of the time otherwise, wasting turns
  const skipDoNothing = isPirateType || snapshot.agent.type === 'merchant_captain';
  if (validActions.includes('do_nothing') && !skipDoNothing) ordered.push('do_nothing');

  const lines = [`Pick a number (1-${ordered.length}). Reply ONLY with the number.`];
  for (let i = 0; i < ordered.length; i++) {
    const action = ordered[i]!;
    const label = getActionLabel(action, snapshot, computed);
    lines.push(`${i + 1}. ${action} — ${label}`);
  }

  return lines.join('\n');
}

function getActionLabel(
  action: string,
  snapshot: AgentDataSnapshot,
  computed: ComputedValues,
): string {
  const { agent, port, nearbyShips, nearbyAgents, cargo, marketPrices, intel, ship, wounds } = snapshot;
  const portName = port?.name ?? agent.portId ?? 'port';
  const zoneName = snapshot.zone?.name ?? 'these waters';

  switch (action) {
    // ── Navigation ──
    case 'sail_to': {
      if (agent.status === 'at_sea') return 'change course to a new destination';
      if (agent.type === 'pirate_captain' || agent.type === 'privateer_captain') {
        return `SET SAIL — hunt for prizes on the open sea`;
      }
      return `set sail from ${portName}`;
    }
    case 'flee': {
      const threats = nearbyShips.filter(s => s.captain_id !== agent.id).length;
      return threats > 0 ? `run from ${threats} nearby vessel${threats > 1 ? 's' : ''}` : 'flee to open water';
    }

    // ── Combat ──
    case 'attack_ship':
    case 'engage_ship': {
      const targets = nearbyShips.filter(s => s.captain_id !== agent.id).length;
      if (targets > 0 && (agent.type === 'pirate_captain' || agent.type === 'privateer_captain')) {
        return `ATTACK — ${targets} prize${targets > 1 ? 's' : ''} in range, cargo for the taking`;
      }
      return targets > 0 ? `attack (${targets} ship${targets > 1 ? 's' : ''} in range)` : 'engage a vessel';
    }
    case 'board_ship':
      return 'board and take a prize';
    case 'surrender':
      return 'strike your colours';

    // ── Trade & Economy ──
    case 'trade_cargo':
    case 'buy_cargo':
    case 'sell_cargo': {
      if (cargo.length > 0) {
        const top = cargo[0]!;
        return `trade ${top.type.replace(/_/g, ' ')} in ${portName}`;
      }
      return `buy or sell goods in ${portName}`;
    }
    case 'sell_plunder': {
      const val = computed.cargoValueTotal;
      if (computed.hotCargoCount > 0) {
        return `SELL STOLEN CARGO NOW — ${computed.hotCargoCount} hot goods worth ~${val} gold, authorities closing in`;
      }
      return val > 0 ? `sell plunder (~${val} gold)` : 'sell plunder at market';
    }
    case 'buy_provisions': {
      if (computed.daysOfFood < 3) return 'buy food — running dangerously low';
      if (computed.daysOfWater < 3) return 'buy water — almost dry';
      return 'stock up on provisions';
    }

    // ── Ship Maintenance ──
    case 'repair_ship':
      return `repair hull (${computed.hullVerdict})`;
    case 'careen_ship':
      return computed.barnacleDesc ? `careen — ${computed.barnacleDesc}` : 'careen the hull';
    case 'upgrade_ship':
      return 'upgrade your vessel';
    case 'assess_damage':
      return 'survey ship for damage';
    case 'build_vessel':
      return 'commission a new vessel';

    // ── Crew ──
    case 'recruit_crew': {
      if (computed.crewShortfall > 0) return `hire crew (${computed.crewShortfall} short)`;
      return 'recruit more hands';
    }
    case 'work':
      return 'steady duties aboard';
    case 'grumble': {
      if (computed.grievanceSummary.length > 0) return `complain — ${computed.grievanceSummary[0]}`;
      return 'grumble about conditions';
    }
    case 'support_captain':
      return 'back the captain publicly';
    case 'challenge_captain':
      return computed.mutinyRisk !== 'none' ? `challenge the captain (crew ${computed.loyaltyDesc})` : 'challenge the captain';
    case 'desert':
      return 'leave the crew';
    case 'steal':
      return 'pilfer from the ship stores';
    case 'fight':
      return 'pick a fight with a crewmate';
    case 'gamble':
      return 'dice or cards with the crew';
    case 'drink':
      return 'drink with the lads';
    case 'join_crew':
      return 'sign aboard a ship';

    // ── Quartermaster ──
    case 'distribute_shares':
      return 'divide the plunder among the crew';
    case 'settle_dispute':
      return computed.grievanceCount > 0 ? `settle crew disputes (${computed.grievanceCount} grievances)` : 'mediate between crewmates';
    case 'advise_captain':
      return 'counsel the captain';
    case 'call_vote':
      return 'call a crew vote';
    case 'manage_provisions':
      return `manage stores (${computed.foodDesc})`;
    case 'discipline_crew':
      return 'enforce discipline';

    // ── Medical ──
    case 'treat_wound': {
      const woundedCrew = computed.injuredCrewCount;
      return woundedCrew > 0 ? `treat wounds (${woundedCrew} injured)` : 'tend to the wounded';
    }
    case 'treat_disease':
      return 'treat sickness aboard';
    case 'amputate':
      return 'amputate — last resort surgery';
    case 'prescribe_remedy':
      return 'prescribe medicine';

    // ── Social / Intel ──
    case 'visit_tavern':
      return `drink and listen in ${portName}`;
    case 'gather_intel':
      return 'ask around for news';
    case 'sell_intel': {
      const freshIntel = intel.filter(i => i.freshness > 50).length;
      return freshIntel > 0 ? `sell intelligence (${freshIntel} fresh)` : 'sell what you know';
    }
    case 'eavesdrop':
      return 'listen in on conversations';
    case 'plant_rumor':
    case 'spread_rumor':
      return 'spread a rumor';
    case 'negotiate':
      return 'negotiate a deal';
    case 'bribe':
    case 'bribe_official':
      return port?.corruption && port.corruption > 50 ? 'bribe — officials are receptive' : 'grease some palms';
    case 'accept_bribe':
      return 'accept a bribe';

    // ── Naval ──
    case 'patrol_region':
      return `patrol ${zoneName}`;
    case 'pursue_target': {
      const wanted = snapshot.nearbyTargetIntel?.filter(t => t.warrantIssued).length ?? 0;
      return wanted > 0 ? `pursue wanted vessel (${wanted} in range)` : 'hunt a target';
    }
    case 'escort_convoy':
      return 'escort merchant convoy';
    case 'arrest': {
      const suspects = nearbyAgents.filter(a => a.type === 'pirate_captain').length;
      return suspects > 0 ? `arrest (${suspects} pirate${suspects > 1 ? 's' : ''} in port)` : 'make an arrest';
    }
    case 'build_case':
      return computed.evidenceDesc ? `build case (evidence: ${computed.evidenceDesc})` : 'gather evidence';
    case 'report_to_admiralty':
    case 'report_to_governor':
      return 'file a report with command';
    case 'track_target':
      return 'track a wanted vessel';
    case 'claim_bounty':
      return 'claim a bounty reward';

    // ── Governor ──
    case 'host_trial':
      return 'hold a trial';
    case 'grant_pardon':
      return 'grant a pardon';
    case 'issue_letter_of_marque':
      return 'issue a letter of marque';
    case 'increase_patrols': {
      const pirates = nearbyAgents.filter(a => a.type === 'pirate_captain').length;
      return pirates > 0 ? `increase patrols (${pirates} pirates reported)` : 'step up naval patrols';
    }
    case 'lower_tariffs':
      return 'lower tariffs to attract trade';
    case 'raise_tariffs':
      return 'raise tariffs for revenue';
    case 'post_bounty':
      return 'post a bounty on a pirate';
    case 'fortify_port':
      return port?.fort_strength && port.fort_strength < 50 ? 'fortify — defenses are weak' : 'strengthen port defenses';

    // ── Fence ──
    case 'buy_stolen_goods': {
      const pirates = nearbyAgents.filter(a => a.type === 'pirate_captain' && a.status === 'in_port').length;
      return pirates > 0 ? `buy stolen goods (${pirates} captain${pirates > 1 ? 's' : ''} with plunder)` : 'buy stolen goods';
    }
    case 'sell_goods':
      return 'sell goods through your network';
    case 'establish_contact':
      return 'make a new underworld contact';
    case 'set_prices':
      return 'set your buying prices';
    case 'refuse_deal':
      return 'refuse a deal — too risky';

    // ── Tavern Keeper ──
    case 'serve_drinks': {
      const patrons = nearbyAgents.filter(a => a.status === 'in_port').length;
      return patrons > 0 ? `serve drinks (${patrons} in port)` : 'serve drinks';
    }
    case 'broker_deal':
      return 'broker a deal between parties';
    case 'recruit_for':
      return 'recruit sailors for a captain';
    case 'shelter_fugitive':
      return 'hide a fugitive';
    case 'report_to_authorities':
      return 'tip off the authorities';

    // ── Harbor Master ──
    case 'inspect_ship': {
      const docked = nearbyShips.filter(s => s.status === 'docked').length;
      return docked > 0 ? `inspect a ship (${docked} docked)` : 'inspect a vessel';
    }
    case 'collect_fees':
      return 'collect harbor fees';
    case 'deny_entry':
      return 'deny a ship entry to port';
    case 'issue_clearance':
      return 'issue clearance to depart';
    case 'report_suspicious':
      return 'report suspicious activity';

    // ── Commerce / Plantation ──
    case 'hire_shipping':
      return 'hire a ship for your cargo';
    case 'sell_crop':
      return 'sell your harvest';
    case 'hire_guards':
      return 'hire guards for protection';
    case 'hire_escort':
      return 'hire an armed escort';
    case 'invest':
      return `invest in ${portName}`;

    // ── Haven ──
    case 'invest_haven':
      return computed.totalHavenIncome > 0 ? 'expand your haven investments' : 'invest in a safe haven';

    // ── Legal ──
    case 'accept_pardon':
      return computed.totalBounty > 0 ? `accept pardon (bounty: ${computed.totalBounty} gold)` : 'accept a royal pardon';
    case 'negotiate_pardon':
      return 'negotiate terms of a pardon';
    case 'report_piracy':
      return 'report piracy to authorities';

    // ── Idle (downplayed for pirates — sitting idle wastes time and money) ──
    case 'lay_low': {
      if (computed.isWounded) return 'rest and recover from wounds';
      if (agent.type === 'pirate_captain' || agent.type === 'privateer_captain') {
        return 'waste time hiding (crew gets restless, provisions drain)';
      }
      if (computed.warrantIssued) return 'lay low — warrant out for your arrest';
      if (computed.totalBounty > 0) return 'lay low — bounty hunters are looking';
      return 'lay low and wait';
    }
    case 'claim_prize': {
      return 'CLAIM A CAPTURED SHIP as your new flagship — upgrade to a bigger vessel';
    }
    case 'do_nothing': {
      if (agent.type === 'pirate_captain' || agent.type === 'privateer_captain') {
        return 'do nothing (idle — the crew will lose patience)';
      }
      return 'wait and watch';
    }

    // ── Fallback ──
    default:
      return action.replace(/_/g, ' ');
  }
}

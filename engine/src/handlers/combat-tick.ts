/**
 * Combat Tick Handler — processes active engagements each tick.
 *
 * For each active engagement:
 *   1. Build combat prompts for both captains
 *   2. Fire LLM calls in parallel
 *   3. Parse combat actions
 *   4. Resolve the round mechanically
 *   5. If resolved: apply final results to DB
 *
 * Runs every tick (combat is urgent — no skipping).
 */

import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { getActiveEngagements, resolveRound, resolveEngagement, type CombatEngagement, clearResolvedEngagements } from '../engine/combat-engagement.js';
import { buildCombatPrompt } from '../engine/combat-prompt.js';
import { getSeaStateMap } from './weather-tick.js';
import { LLMClient } from '../runtime/llm-client.js';
import { parseAgentResponse } from '../strategy/response-parser.js';
import * as fs from 'fs';

// Shared LLM client for combat calls
let combatLLM: LLMClient | null = null;

function getLLMClient(): LLMClient {
  if (!combatLLM) {
    combatLLM = new LLMClient({ maxConcurrent: 10 });
  }
  return combatLLM;
}

export const combatTickHandler: TickHandler = {
  name: 'combat-tick',
  phase: TickPhase.EVENTS,

  async execute(tick: TickContext): Promise<void> {
    const engagements = getActiveEngagements();
    if (engagements.length === 0) return;

    const seaStateMap = getSeaStateMap();
    const llm = getLLMClient();

    for (const engagement of engagements) {
      if (engagement.phase === 'resolved') continue;

      const seaCondition = seaStateMap.get(engagement.zoneId);

      // Build prompts for both captains in parallel
      const [attackerPrompt, defenderPrompt] = await Promise.all([
        buildCombatPrompt(engagement, engagement.attackerCaptainId, seaCondition),
        buildCombatPrompt(engagement, engagement.defenderCaptainId, seaCondition),
      ]);

      // Fire LLM calls in parallel
      const [attackerResponse, defenderResponse] = await Promise.allSettled([
        llm.chatCompletion({
          messages: [
            { role: 'system', content: attackerPrompt.systemPrompt },
            { role: 'user', content: attackerPrompt.userPrompt },
          ],
          temperature: 0.7,
          maxTokens: 80,
        }),
        llm.chatCompletion({
          messages: [
            { role: 'system', content: defenderPrompt.systemPrompt },
            { role: 'user', content: defenderPrompt.userPrompt },
          ],
          temperature: 0.7,
          maxTokens: 80,
        }),
      ]);

      // Parse actions
      const attackerContent = attackerResponse.status === 'fulfilled' ? attackerResponse.value.content : '';
      const defenderContent = defenderResponse.status === 'fulfilled' ? defenderResponse.value.content : '';

      const attackerParsed = parseAgentResponse(attackerContent, attackerPrompt.validActions);
      const defenderParsed = parseAgentResponse(defenderContent, defenderPrompt.validActions);

      const attackerAction = attackerParsed?.action ?? getDefaultCombatAction(engagement.phase, true);
      const defenderAction = defenderParsed?.action ?? getDefaultCombatAction(engagement.phase, false);

      // Log combat decisions
      logCombatDecision(engagement, attackerAction, defenderAction, attackerContent, defenderContent, tick.tickNumber);

      // Resolve the round (resolveRound calls resolveEngagement internally when phase becomes 'resolved')
      await resolveRound(engagement, attackerAction, defenderAction, seaCondition, tick.tickNumber);

      // If engagement resolved, log it (resolveEngagement already called by resolveRound)
      if ((engagement.phase as string) === 'resolved') {
        tick.logger?.logCombat?.({
          engagementId: engagement.id,
          attackerShipId: engagement.attackerShipId,
          defenderShipId: engagement.defenderShipId,
          rounds: engagement.round,
          phase: engagement.phase,
          log: engagement.log,
          tick: tick.tickNumber,
        });
      }
    }

    // Clean up resolved engagements
    clearResolvedEngagements();
  },
};

/** Default combat action when LLM fails or returns unparseable response */
function getDefaultCombatAction(phase: string, isAttacker: boolean): string {
  switch (phase) {
    case 'closing': return 'fire_broadside';
    case 'broadside': return isAttacker ? 'fire_broadside' : 'fire_broadside';
    case 'boarding': return isAttacker ? 'board' : 'repel_boarders';
    case 'chase': return isAttacker ? 'pursue' : 'flee';
    default: return 'fire_broadside';
  }
}

/** Log combat LLM decisions to prompt-debug.jsonl */
function logCombatDecision(
  engagement: CombatEngagement,
  attackerAction: string,
  defenderAction: string,
  attackerRaw: string,
  defenderRaw: string,
  tick: number,
): void {
  const entry = {
    type: 'combat_decision',
    tick,
    engagementId: engagement.id,
    phase: engagement.phase,
    round: engagement.round,
    attacker: {
      captainId: engagement.attackerCaptainId,
      shipId: engagement.attackerShipId,
      action: attackerAction,
      rawResponse: attackerRaw.slice(0, 200),
    },
    defender: {
      captainId: engagement.defenderCaptainId,
      shipId: engagement.defenderShipId,
      action: defenderAction,
      rawResponse: defenderRaw.slice(0, 200),
    },
  };
  try {
    fs.mkdirSync('sim-output', { recursive: true });
    fs.appendFileSync('sim-output/prompt-debug.jsonl', JSON.stringify(entry) + '\n');
  } catch { /* ignore */ }
}

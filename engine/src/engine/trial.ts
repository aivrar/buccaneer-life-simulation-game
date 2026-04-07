/**
 * Justice pipeline — trial resolution, sentencing, and execution.
 */

import { v4 as uuid } from 'uuid';
import { NavyCaseQueries, AgentQueries, EventQueries, BountyQueries } from '../db/queries.js';
import { NAVY_CONFIG } from '../config/navy.js';

export type Verdict = 'guilty' | 'not_guilty';
export type Sentence = 'hanging' | 'imprisonment' | 'fine' | 'acquitted';

export interface TrialResult {
  caseId: string;
  defendantId: string;
  verdict: Verdict;
  sentence: Sentence;
  fineAmount?: number;
}

export async function resolveTrial(
  caseId: string,
  portId: string,
  tick: number,
): Promise<TrialResult | null> {
  const navyCase = await NavyCaseQueries.getById(caseId);
  if (!navyCase || navyCase.status !== 'arrested') return null;

  const defendant = await AgentQueries.getById(navyCase.target_agent_id);
  if (!defendant) return null;

  const { convictionThreshold, hangingThreshold } = NAVY_CONFIG.caseBuilding;

  // Verdict based on evidence vs defense
  // Defense: corruption at the port reduces effective evidence
  const portCorruption = 30; // simplified — would come from port DB
  const effectiveEvidence = navyCase.evidence_level * (1 - portCorruption / 200);

  const witnesses: string[] = JSON.parse(navyCase.witnesses || '[]');
  const witnessBonus = witnesses.length * 5;
  const totalCase = effectiveEvidence + witnessBonus;

  const verdict: Verdict = totalCase >= convictionThreshold ? 'guilty' : 'not_guilty';

  let sentence: Sentence;
  let fineAmount: number | undefined;

  if (verdict === 'not_guilty') {
    sentence = 'acquitted';
    // Release the defendant
    await AgentQueries.updateStatus(navyCase.target_agent_id, 'in_port');
    await NavyCaseQueries.updateStatus(caseId, 'acquitted', tick);
  } else {
    // Sentence based on severity
    if (totalCase >= hangingThreshold) {
      sentence = 'hanging';
      await AgentQueries.updateStatus(navyCase.target_agent_id, 'dead');
      await NavyCaseQueries.updateStatus(caseId, 'convicted', tick);

      // Hanging is a world event
      await EventQueries.insert({
        id: uuid(),
        type: 'execution',
        description: `${defendant.name} hanged for piracy at ${portId}`,
        agent_ids: JSON.stringify([navyCase.target_agent_id]),
        ship_ids: '[]',
        port_id: portId,
        sea_zone_id: null,
        severity: 9,
        tick,
        data: JSON.stringify({ sentence: 'hanging', evidence: totalCase }),
      });
    } else if (totalCase >= convictionThreshold + 10) {
      sentence = 'imprisonment';
      // Already imprisoned from arrest — stays that way
      await NavyCaseQueries.updateStatus(caseId, 'convicted', tick);
    } else {
      sentence = 'fine';
      fineAmount = Math.round(totalCase * 10);
      await AgentQueries.addCash(navyCase.target_agent_id, -fineAmount);
      await AgentQueries.updateStatus(navyCase.target_agent_id, 'in_port');
      await NavyCaseQueries.updateStatus(caseId, 'convicted', tick);
    }
  }

  return {
    caseId,
    defendantId: navyCase.target_agent_id,
    verdict,
    sentence,
    fineAmount,
  };
}

export async function postBounty(
  targetAgentId: string,
  posterId: string | null,
  posterNation: string | null,
  amount: number,
  reason: string,
  tick: number,
  expiresTick?: number,
): Promise<void> {
  await BountyQueries.insert({
    id: uuid(),
    target_agent_id: targetAgentId,
    posted_by_agent_id: posterId,
    posted_by_nation: posterNation,
    amount,
    reason,
    status: 'active',
    created_tick: tick,
    expires_tick: expiresTick ?? null,
  });

  await EventQueries.insert({
    id: uuid(),
    type: 'bounty_posted',
    description: `Bounty of ${amount} posted for ${targetAgentId}: ${reason}`,
    agent_ids: JSON.stringify([targetAgentId, posterId].filter(Boolean)),
    ship_ids: '[]',
    port_id: null,
    sea_zone_id: null,
    severity: 5,
    tick,
    data: JSON.stringify({ amount, reason }),
  });
}

import type { AgentState } from '../runtime/types.js';
import { executeSailTo, type ActionResult } from './actions/sail-to.js';
import { executeBuyCargo, executeSellCargo, executeTradeCargo, executeSellPlunder } from './actions/trade-actions.js';
import { executeRepairShip, executeCareenShip, executeBuyProvisions, executeRecruitCrew, executeVisitTavern, executeHealAgent } from './actions/port-actions.js';
import { executeAttackShip, executeFlee, executeSurrender, executeClaimPrize } from './actions/combat-actions.js';
import { executeInvestHaven } from './actions/haven-actions.js';
import { executeGatherIntel, executeSellIntel } from './actions/intel-actions.js';
import { executeBribe } from './actions/corruption-actions.js';
import { executeBuyVessel } from './actions/shipwright-actions.js';

// New action implementations
import { executeWork, executeGrumble, executeSupportCaptain, executeChallengeCaptain, executeDesert, executeSteal, executeFight, executeGamble, executeDrink, executeJoinCrew } from './actions/crew-actions.js';
import { executeDistributeShares, executeSettleDispute, executeAdviseCaptain, executeCallVote, executeManageProvisions, executeDisciplineCrew } from './actions/qm-actions.js';
import { executeTreatWound, executeTreatDisease, executeAmputate, executePrescribeRemedy } from './actions/medical-actions.js';
import { executeHostTrial, executeGrantPardon, executeIssueLetterOfMarque, executeIncreasePatrols, executeLowerTariffs, executeRaiseTariffs, executePostBounty, executeFortifyPort } from './actions/governor-actions.js';
import { executePatrolRegion, executePursueTarget, executeBuildCase, executeArrest, executeEscortConvoy, executeReportToAdmiralty, executeTrackTarget, executeClaimBounty } from './actions/naval-actions.js';
import { executeBuyStolenGoods, executeSellGoods, executeEstablishContact, executeSetPrices, executeRefuseDeal } from './actions/fence-actions.js';
import { executeServeDrinks, executeBrokerDeal, executeRecruitFor, executeShelterFugitive, executeReportToAuthorities } from './actions/tavern-actions.js';
import { executeInspectShip, executeCollectFees, executeDenyEntry, executeIssueClearance, executeReportSuspicious } from './actions/harbor-actions.js';
import { executeUpgradeShip, executeAssessDamage, executeBuildVessel } from './actions/shipwright-actions.js';
import { executeHireShipping, executeSellCrop, executeHireGuards, executeHireEscort, executeInvest, executeNegotiate, executeSpreadRumor, executePlantRumor, executeEavesdrop, executeReportPiracy, executeReportToGovernor, executeAcceptPardon, executeNegotiatePardon } from './actions/commerce-actions.js';

export type { ActionResult } from './actions/sail-to.js';

export async function executeAction(
  agent: AgentState,
  action: string,
  params: Record<string, unknown>,
  tick: number,
): Promise<ActionResult> {
  switch (action) {
    // ── Movement ──────────────────────────────────────────
    case 'sail_to':
      return executeSailTo(agent, { destination_port: (params.destination_port ?? params.destination ?? params.port) as string }, tick);

    // ── Trade ─────────────────────────────────────────────
    case 'buy_cargo':
      return executeBuyCargo(agent, params);
    case 'sell_cargo':
      return executeSellCargo(agent, params);
    case 'trade_cargo':
      return executeTradeCargo(agent, params);
    case 'sell_plunder':
      return executeSellPlunder(agent, params, tick);

    // ── Port services ─────────────────────────────────────
    case 'repair_ship':
      return executeRepairShip(agent);
    case 'careen_ship':
      return executeCareenShip(agent);
    case 'buy_provisions':
      return executeBuyProvisions(agent, params);
    case 'recruit_crew':
      return executeRecruitCrew(agent, params);
    case 'visit_tavern':
      return executeVisitTavern(agent);

    // ── Combat ────────────────────────────────────────────
    case 'attack_ship':
    case 'board_ship':
    case 'engage_ship':
      return executeAttackShip(agent, params, tick);
    case 'flee':
      return executeFlee(agent, tick);
    case 'surrender':
      return executeSurrender(agent);

    // ── Intel ─────────────────────────────────────────────
    case 'gather_intel':
      return executeGatherIntel(agent);
    case 'sell_intel':
      return executeSellIntel(agent, params);
    case 'betray_source':
      return executeGatherIntel(agent); // mechanically same as gather_intel — sells out a source

    // ── Corruption ────────────────────────────────────────
    case 'bribe':
    case 'bribe_official':
    case 'bribe_governor':
      return executeBribe(agent, params);
    case 'accept_bribe': {
      // Official RECEIVES a bribe — earns gold, increases port corruption
      const { AgentQueries: AQ, PortQueries: PQ } = await import('../db/queries.js');
      const { execute: exec } = await import('../db/sqlite.js');
      const bribeAmount = 5 + Math.floor(Math.random() * 11); // 5-15g
      await AQ.addCash(agent.id, bribeAmount);
      if (agent.portId) await exec('UPDATE ports SET corruption = MIN(100, corruption + 2) WHERE id = ?', [agent.portId]);
      return { success: true, message: `Accepted a bribe of ${bribeAmount} gold — corruption deepens`, data: { amount: bribeAmount } };
    }

    // ── Haven ─────────────────────────────────────────────
    case 'invest_haven':
      return executeInvestHaven(agent, params);

    // ── Ship Acquisition ────────────────────────────────
    case 'buy_vessel':
      return executeBuyVessel(agent, params, tick);
    case 'claim_prize':
      return executeClaimPrize(agent, params, tick);

    // ── Crew actions ──────────────────────────────────────
    case 'work':
      return executeWork(agent, params, tick);
    case 'grumble':
      return executeGrumble(agent, params, tick);
    case 'support_captain':
      return executeSupportCaptain(agent);
    case 'challenge_captain':
      return executeChallengeCaptain(agent, params, tick);
    case 'desert':
      return executeDesert(agent);
    case 'steal':
      return executeSteal(agent, params, tick);
    case 'fight':
      return executeFight(agent, params, tick);
    case 'gamble':
      return executeGamble(agent);
    case 'drink':
      return executeDrink(agent);
    case 'join_crew':
      return executeJoinCrew(agent, params, tick);

    // ── Quartermaster actions (all take only agent) ──────
    case 'distribute_shares':
      return executeDistributeShares(agent);
    case 'settle_dispute':
      return executeSettleDispute(agent);
    case 'advise_captain':
      return executeAdviseCaptain(agent);
    case 'call_vote':
      return executeCallVote(agent);
    case 'manage_provisions':
      return executeManageProvisions(agent);
    case 'discipline_crew':
      return executeDisciplineCrew(agent);

    // ── Medical actions ───────────────────────────────────
    case 'treat_wound':
      return executeTreatWound(agent);
    case 'treat_disease':
      return executeTreatDisease(agent);
    case 'amputate':
      return executeAmputate(agent, params, tick);
    case 'prescribe_remedy':
      return executePrescribeRemedy(agent);

    // ── Governor actions (all take agent, params, tick) ───
    case 'host_trial':
      return executeHostTrial(agent, params, tick);
    case 'grant_pardon':
      return executeGrantPardon(agent, params, tick);
    case 'issue_letter_of_marque':
      return executeIssueLetterOfMarque(agent, params, tick);
    case 'increase_patrols':
      return executeIncreasePatrols(agent, params, tick);
    case 'lower_tariffs':
      return executeLowerTariffs(agent, params, tick);
    case 'raise_tariffs':
      return executeRaiseTariffs(agent, params, tick);
    case 'post_bounty':
      return executePostBounty(agent, params, tick);
    case 'fortify_port':
      return executeFortifyPort(agent, params, tick);

    // ── Naval actions (all take agent, params, tick) ──────
    case 'patrol_region':
      return executePatrolRegion(agent, params, tick);
    case 'pursue_target':
      return executePursueTarget(agent, params, tick);
    case 'build_case':
      return executeBuildCase(agent, params, tick);
    case 'arrest':
      return executeArrest(agent, params, tick);
    case 'escort_convoy':
      return executeEscortConvoy(agent, params, tick);
    case 'report_to_admiralty':
      return executeReportToAdmiralty(agent, params, tick);
    case 'track_target':
      return executeTrackTarget(agent, params, tick);
    case 'claim_bounty':
      return executeClaimBounty(agent, params, tick);

    // ── Fence actions (all take only agent) ───────────────
    case 'buy_stolen_goods':
      return executeBuyStolenGoods(agent);
    case 'sell_goods':
      return executeSellGoods(agent);
    case 'establish_contact':
      return executeEstablishContact(agent);
    case 'set_prices':
      return executeSetPrices(agent);
    case 'refuse_deal':
      return executeRefuseDeal(agent);

    // ── Tavern actions (all take only agent) ──────────────
    case 'serve_drinks':
      return executeServeDrinks(agent);
    case 'broker_deal':
      return executeBrokerDeal(agent);
    case 'recruit_for':
      return executeRecruitFor(agent);
    case 'shelter_fugitive':
      return executeShelterFugitive(agent);
    case 'report_to_authorities':
      return executeReportToAuthorities(agent);

    // ── Harbor master actions (all take only agent) ───────
    case 'inspect_ship':
      return executeInspectShip(agent);
    case 'collect_fees':
      return executeCollectFees(agent);
    case 'deny_entry':
      return executeDenyEntry(agent);
    case 'issue_clearance':
      return executeIssueClearance(agent);
    case 'report_suspicious':
      return executeReportSuspicious(agent);

    // ── Shipwright actions (all take agent, params, tick) ─
    case 'upgrade_ship':
      return executeUpgradeShip(agent, params, tick);
    case 'assess_damage':
      return executeAssessDamage(agent, params, tick);
    case 'build_vessel':
      return executeBuildVessel(agent, params, tick);

    // ── Commerce / plantation (all take only agent) ───────
    case 'hire_shipping':
      return executeHireShipping(agent);
    case 'sell_crop':
      return executeSellCrop(agent);
    case 'hire_guards':
      return executeHireGuards(agent);
    case 'hire_escort':
      return executeHireEscort(agent);
    case 'invest':
      return executeInvest(agent);

    // ── Social actions (all take only agent) ──────────────
    case 'negotiate':
      return executeNegotiate(agent);
    case 'spread_rumor':
      return executeSpreadRumor(agent);
    case 'plant_rumor':
      return executePlantRumor(agent);
    case 'eavesdrop':
      return executeEavesdrop(agent);
    case 'report_piracy':
      return executeReportPiracy(agent);
    case 'report_to_governor':
      return executeReportToGovernor(agent);

    // ── Pardon actions (all take only agent) ──────────────
    case 'accept_pardon':
      return executeAcceptPardon(agent);
    case 'negotiate_pardon':
      return executeNegotiatePardon(agent);

    // ── Idle ──────────────────────────────────────────────
    case 'do_nothing':
    case 'lay_low':
      return { success: true, message: 'Waiting' };

    default:
      // Truly unknown actions — should be rare now
      return { success: true, message: `${action} (not yet implemented)` };
  }
}

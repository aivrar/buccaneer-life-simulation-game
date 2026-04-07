import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { v4 as uuid } from 'uuid';
import { NavyCaseQueries, AgentQueries, ShipQueries, CargoQueries, EventQueries, PortQueries, BountyQueries } from '../db/queries.js';
import { query } from '../db/sqlite.js';
import { NAVY_CONFIG } from '../config/navy.js';
import { getDetectionRisk } from '../engine/cargo-heat.js';
import { resolveTrial, postBounty } from '../engine/trial.js';
import { getCorruptionModifiers } from '../engine/corruption.js';

const NAVY_AGENT_TYPES = new Set(['naval_officer', 'pirate_hunter']);

export const navyTickHandler: TickHandler = {
  name: 'navy-tick',
  phase: TickPhase.AGENTS,

  async execute(tick: TickContext): Promise<void> {
    // 1. Process existing cases (evidence decay, warrants, arrests)
    await processExistingCases(tick);

    // 2. Process arrested agents — trial after delay
    await processTrials(tick);

    // 3. Post bounties for warranted agents with high infamy
    if (tick.tickNumber % 24 === 0) {
      await postBountiesForWarranted(tick);
    }

    // 4. Hot cargo inspection — open new cases (every 6 ticks)
    if (tick.tickNumber % 6 === 0) {
      await inspectDockedShips(tick);
    }
  },
};

async function processExistingCases(tick: TickContext): Promise<void> {
  const openCases = await NavyCaseQueries.getOpen();
  const { evidenceDecayPerTick, warrantThreshold } = NAVY_CONFIG.caseBuilding;

  for (const navyCase of openCases) {
    // Decay evidence
    const newEvidence = Math.max(0, navyCase.evidence_level - evidenceDecayPerTick);

    if (newEvidence <= 0) {
      await NavyCaseQueries.updateStatus(navyCase.id, 'dismissed', tick.tickNumber);
      continue;
    }

    await NavyCaseQueries.updateEvidence(navyCase.id, Math.round(newEvidence * 10) / 10, tick.tickNumber);

    // Issue warrants
    if (navyCase.status === 'open' && newEvidence >= warrantThreshold) {
      await NavyCaseQueries.updateStatus(navyCase.id, 'warrant_issued', tick.tickNumber);

      await EventQueries.insert({
        id: uuid(),
        type: 'warrant_issued',
        description: `Warrant issued for agent ${navyCase.target_agent_id}`,
        agent_ids: JSON.stringify([navyCase.target_agent_id, navyCase.investigating_agent_id]),
        ship_ids: '[]',
        port_id: null,
        sea_zone_id: null,
        severity: 6,
        tick: tick.tickNumber,
        data: JSON.stringify({ caseId: navyCase.id, evidence: newEvidence }),
      });
    }

    // Arrest attempts
    if (navyCase.status === 'warrant_issued') {
      const target = await AgentQueries.getById(navyCase.target_agent_id);
      if (!target || target.status === 'dead' || target.status === 'imprisoned') continue;

      if (target.port_id) {
        const hasNavyPresence = await checkNavyPresenceAtPort(target.port_id);

        if (hasNavyPresence) {
          const port = await PortQueries.getById(target.port_id);
          const corruptionMods = getCorruptionModifiers(port?.corruption ?? 30);
          const arrestChance = 0.3 * corruptionMods.arrestChanceMod;
          if (Math.random() < arrestChance) {
            await NavyCaseQueries.updateStatus(navyCase.id, 'arrested', tick.tickNumber);
            await AgentQueries.updateStatus(navyCase.target_agent_id, 'imprisoned');

            await EventQueries.insert({
              id: uuid(),
              type: 'arrest',
              description: `${target.name} arrested at ${target.port_id}`,
              agent_ids: JSON.stringify([navyCase.target_agent_id, navyCase.investigating_agent_id]),
              ship_ids: '[]',
              port_id: target.port_id,
              sea_zone_id: null,
              severity: 7,
              tick: tick.tickNumber,
              data: JSON.stringify({ caseId: navyCase.id }),
            });
          }
        }
      }
    }
  }
}

async function inspectDockedShips(tick: TickContext): Promise<void> {
  const ports = await PortQueries.getAll();
  const { evidencePerCapture, portInspectionChance } = { ...NAVY_CONFIG.caseBuilding, portInspectionChance: 0.05 };

  for (const port of ports) {
    // Only inspect at ports with navy presence
    const hasNavy = await checkNavyPresenceAtPort(port.id);
    if (!hasNavy) continue;

    // Find navy agents at this port for investigator assignment
    const portAgents = await AgentQueries.getByPort(port.id);
    const navyAgent = portAgents.find(a => NAVY_AGENT_TYPES.has(a.type));
    if (!navyAgent) continue;

    // Check docked ships for hot cargo
    const dockedShips = await ShipQueries.getByPort(port.id);

    for (const ship of dockedShips) {
      if (!ship.captain_id) continue;

      // Only investigate pirate-type captains — merchants and naval officers are not suspects
      const captain = await AgentQueries.getById(ship.captain_id);
      if (!captain) continue;
      const SUSPECT_TYPES = new Set(['pirate_captain', 'privateer_captain', 'pirate_hunter']);
      if (!SUSPECT_TYPES.has(captain.type)) continue;

      const cargo = await CargoQueries.getByShip(ship.id);
      const hotCargo = cargo.filter(c => c.heat > 20);
      if (hotCargo.length === 0) continue;

      // Detection based on cargo heat
      const maxHeat = Math.max(...hotCargo.map(c => c.heat));
      const detectionRisk = getDetectionRisk(maxHeat);

      const corruptionMods = getCorruptionModifiers(port.corruption);
      if (Math.random() > detectionRisk * corruptionMods.inspectionChanceMod) continue;

      // Check if there's already an open case for this agent
      const existingCases = await NavyCaseQueries.getByTarget(ship.captain_id);
      const openCase = existingCases.find(c => c.status === 'open' || c.status === 'warrant_issued');

      if (openCase) {
        // Add evidence to existing case
        const newEvidence = Math.min(100, openCase.evidence_level + evidencePerCapture * (maxHeat / 100));
        await NavyCaseQueries.updateEvidence(openCase.id, Math.round(newEvidence), tick.tickNumber);
      } else {
        // Open new case
        const evidence = Math.round(evidencePerCapture * (maxHeat / 100));
        await NavyCaseQueries.insert({
          id: uuid(),
          target_agent_id: ship.captain_id,
          investigating_agent_id: navyAgent.id,
          evidence_level: evidence,
          charges: JSON.stringify(['possession_of_stolen_goods']),
          witnesses: '[]',
          status: 'open',
          opened_tick: tick.tickNumber,
          last_updated_tick: tick.tickNumber,
        });
      }
    }
  }
}

async function processTrials(tick: TickContext): Promise<void> {
  const arrestedCases = await NavyCaseQueries.getArrested();
  const TRIAL_DELAY = 48; // ~1 day before trial begins

  for (const navyCase of arrestedCases) {
    // Wait for trial delay
    if (tick.tickNumber - navyCase.last_updated_tick < TRIAL_DELAY) continue;

    // Find the port where the agent is held
    const target = await AgentQueries.getById(navyCase.target_agent_id);
    if (!target) continue;
    const portId = target.port_id || 'port_royal'; // default trial location

    const result = await resolveTrial(navyCase.id, portId, tick.tickNumber);
    if (!result) continue;

    // Log trial result
    if (result.verdict === 'guilty' && result.sentence === 'hanging') {
      // Hanging already logged by resolveTrial as world event
    }
  }
}

async function postBountiesForWarranted(tick: TickContext): Promise<void> {
  const warrantedCases = await NavyCaseQueries.getWarranted();

  for (const navyCase of warrantedCases) {
    // Skip dead targets — no point bounty-hunting a corpse
    const target = await query<{ status: string }[]>(
      'SELECT status FROM agents WHERE id = ? LIMIT 1',
      [navyCase.target_agent_id],
    );
    if (target.length === 0 || target[0].status === 'dead') continue;

    // Check if ANY bounty exists (active, expired, or claimed) — prevents re-posting churn
    const allBounties = await query<{ id: string }[]>(
      'SELECT id FROM bounties WHERE target_agent_id = ? LIMIT 1',
      [navyCase.target_agent_id],
    );
    if (allBounties.length > 0) continue;

    // Post bounty proportional to evidence
    const amount = Math.round(navyCase.evidence_level * 5);
    if (amount < 50) continue; // not worth posting

    await postBounty(
      navyCase.target_agent_id,
      navyCase.investigating_agent_id,
      'english', // simplified — would come from investigator's nationality
      amount,
      'Wanted for piracy',
      tick.tickNumber,
      tick.tickNumber + 2400, // expires in ~50 days
    );
  }
}

async function checkNavyPresenceAtPort(portId: string): Promise<boolean> {
  const portAgents = await AgentQueries.getByPort(portId);
  return portAgents.some(a => NAVY_AGENT_TYPES.has(a.type));
}

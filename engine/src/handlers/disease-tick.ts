import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { v4 as uuid } from 'uuid';
import { AgentQueries, ShipQueries, WoundQueries } from '../db/queries.js';
import { execute } from '../db/sqlite.js';
import { getPortDiseaseRisks, getVoyageDiseaseRisks } from '../world/disease.js';
import type { Wound } from '../db/models.js';

export const diseaseTickHandler: TickHandler = {
  name: 'disease-tick',
  phase: TickPhase.WORLD,

  async execute(tick: TickContext): Promise<void> {
    const agents = await AgentQueries.getActive();

    for (const agent of agents) {
      // Skip dead agents — they can't get sicker
      if (agent.status === 'dead') continue;

      // 1. Port disease risk — "seasoning" system
      // New arrivals to the Caribbean are vulnerable (full disease rates)
      // Agents who survive 60+ days gain partial immunity (50% reduction)
      // Historical: 30-50% of European newcomers died in their first year
      if (agent.port_id && agent.status !== 'at_sea') {
        const risks = getPortDiseaseRisks(agent.port_id, tick.gameTime);
        const daysSurvived = (tick.tickNumber - (agent.last_decision_tick || 0)) > 0
          ? tick.tickNumber / 24 // approximate days since sim start
          : 0;
        const seasoned = daysSurvived > 60; // ~2 months survival = partial immunity
        const seasoningReduction = seasoned ? 0.5 : 1.0;
        for (const risk of risks) {
          if (Math.random() < risk.chance * seasoningReduction) {
            // Check if agent already has this disease (compare mapped wound type, not raw disease name)
            const existing = await WoundQueries.getByAgent(agent.id);
            const activeWounds = existing.filter(w => w.healing_progress < 100);
            const mappedType = mapDiseaseToWoundType(risk.disease);
            const alreadyHas = activeWounds.some(w => w.type === mappedType);
            if (!alreadyHas && activeWounds.length < 5) {
              await WoundQueries.insert({
                id: uuid(),
                agent_id: agent.id,
                type: mapDiseaseToWoundType(risk.disease),
                severity: risk.severity,
                location: 'body',
                treated: false,
                healing_progress: 0,
                created_tick: tick.tickNumber,
              });
              if (tick.logger) {
                tick.logger.counters.diseasesContracted++;
                tick.logger.log('wounds-disease', { type: 'disease_contracted', agentId: agent.id, agentName: agent.name, disease: risk.disease, severity: risk.severity, source: 'port', portId: agent.port_id });
              }
            }
          }
        }
      }

      // 2. At-sea disease risk
      if (agent.ship_id && agent.status === 'at_sea') {
        const ship = await ShipQueries.getById(agent.ship_id);
        if (ship && ship.status === 'sailing') {
          const departureTick = ship.arrival_tick
            ? tick.tickNumber - (ship.arrival_tick - tick.tickNumber)
            : tick.tickNumber - 100;
          const daysAtSea = Math.max(0, (tick.tickNumber - departureTick) / 48);

          const risks = getVoyageDiseaseRisks(daysAtSea, ship.food_stores, ship.water_stores, ship.crew_count);
          for (const risk of risks) {
            if (Math.random() < risk.chance) {
              const existing = await WoundQueries.getByAgent(agent.id);
              const activeWounds = existing.filter(w => w.healing_progress < 100);
              const mappedSeaType = mapDiseaseToWoundType(risk.disease);
              const alreadyHas = activeWounds.some(w => w.type === mappedSeaType);
              if (!alreadyHas && activeWounds.length < 5) {
                await WoundQueries.insert({
                  id: uuid(),
                  agent_id: agent.id,
                  type: mappedSeaType,
                  severity: risk.severity,
                  location: 'body',
                  treated: false,
                  healing_progress: 0,
                  created_tick: tick.tickNumber,
                });
              }
            }
          }
        }
      }

      // 3. Tick existing wounds — advance healing or worsen (single DB write per wound)
      const wounds = await WoundQueries.getByAgent(agent.id);
      const isInPort = agent.status !== 'at_sea';
      for (const wound of wounds) {
        if (wound.healing_progress >= 100) continue;

        let newSeverity = wound.severity;
        let newProgress = wound.healing_progress;

        if (wound.treated) {
          // Healing: +2 progress per tick
          newProgress = Math.min(100, newProgress + 2);
          if (newSeverity > 1 && newProgress > 50) newSeverity -= 1;
        } else if (isInPort && wound.severity <= 5) {
          // Natural recovery: port agents slowly heal mild ailments even untreated
          // (rest, clean water, basic folk medicine)
          // Covers mild disease (sev <= 5) — severe fever/yellow fever require a surgeon
          newProgress = Math.min(100, newProgress + 2);
        } else if (isInPort && wound.severity > 5 && wound.severity <= 10) {
          // Slow natural recovery for severe untreated wounds in port (fever, yellow fever)
          // Historical: fevers could resolve with rest, clean water, and folk remedies
          // but much slower than with a surgeon. Prevents permanent incurable fevers.
          // +1 progress per tick (vs +2 for mild wounds) — takes 100 ticks to fully heal
          newProgress = Math.min(100, newProgress + 1);
          // Severity drops slowly as recovery progresses
          if (Math.random() < 0.02 && newSeverity > 3) newSeverity -= 1;
        } else {
          // Untreated, severe or at sea: worsening
          // Port agents worsen slowly, at-sea agents faster (salt water, no rest, infection risk)
          // Was 0.2 at sea — too lethal (sev 5→10 in 1 day). Reduced to 0.08 (~2 severity/day).
          const worsenChance = isInPort ? 0.05 : 0.08;
          if (Math.random() < worsenChance) {
            newSeverity = Math.min(10, newSeverity + 1);
          }
        }

        // Single DB write with both updated values (INT columns — no decimals)
        await WoundQueries.updateHealing(
          wound.id,
          Math.round(newProgress),
          Math.round(newSeverity),
        );
      }

      // 4. Death check — if agent has critical untreated wounds stacking up
      const currentWounds = await WoundQueries.getByAgent(agent.id);
      const totalSeverity = currentWounds
        .filter(w => w.healing_progress < 100)
        .reduce((sum, w) => sum + w.severity, 0);
      // Port agents are harder to kill (access to basic care) — threshold 30 vs 25 at sea
      const deathThreshold = isInPort ? 30 : 25;
      if (totalSeverity >= deathThreshold) {
        // Agent dies from accumulated injuries/disease — verify not already dead
        const freshAgent = await AgentQueries.getById(agent.id);
        if (freshAgent && freshAgent.status === 'dead') continue;
        await AgentQueries.updateStatus(agent.id, 'dead');
        if (tick.logger) {
          tick.logger.counters.deathsFromDisease++;
          tick.logger.counters.agentsDied++;
          tick.logger.log('deaths', { agentId: agent.id, agentName: agent.name, cause: 'disease', totalSeverity });
        }
      }
    }

    // 5. Cleanup fully healed wounds every 24 ticks (1 game day)
    // Prevents wound record bloat — one agent accumulated 51+ wound records
    if (tick.tickNumber % 24 === 0) {
      await execute(
        'DELETE FROM wounds WHERE healing_progress >= 100',
        [],
      );
    }
  },
};

function mapDiseaseToWoundType(disease: string): Wound['type'] {
  const mapping: Record<string, Wound['type']> = {
    malaria: 'fever',
    yellow_fever: 'fever',
    scurvy: 'scurvy',
    dysentery: 'disease',
    fever: 'fever',
    infection: 'infection',
  };
  return mapping[disease] ?? 'disease';
}

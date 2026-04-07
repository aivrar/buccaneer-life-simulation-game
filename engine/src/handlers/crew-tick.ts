import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { ShipQueries, CrewQueries, AgentQueries } from '../db/queries.js';
import { ECONOMY } from '../config/economy.js';
import { checkMutiny, type CrewMember, type Grievance } from '../engine/crew-loyalty.js';

export const crewTickHandler: TickHandler = {
  name: 'crew-tick',
  phase: TickPhase.DECAY,

  async execute(tick: TickContext): Promise<void> {
    const ships = await ShipQueries.getAllActive();

    for (const ship of ships) {
      const crewRows = await CrewQueries.getActiveByShip(ship.id);
      if (crewRows.length === 0) continue;

      const { loyaltyDecayPerTick, loyaltyHitFromHunger, baseWagePerTick, loyaltyBoostFromPay } = ECONOMY.crew;
      const desertionThreshold = ECONOMY.crew.deserterionThreshold;

      // Pay crew wages (deduct from captain's cash)
      let wagesPaid = false;
      if (ship.captain_id) {
        const captain = await AgentQueries.getById(ship.captain_id);
        if (captain) {
          const totalWages = crewRows.length * baseWagePerTick;
          if (captain.cash >= totalWages) {
            await AgentQueries.addCash(captain.id, -totalWages);
            wagesPaid = true;
          }
        }
      }

      for (const crew of crewRows) {
        let loyalty = crew.loyalty;
        const grievances: Grievance[] = JSON.parse(crew.grievances || '[]');
        let changed = false;

        // 1. Natural loyalty decay
        loyalty = Math.max(0, loyalty - loyaltyDecayPerTick);

        // 2. Wage effects
        if (wagesPaid) {
          loyalty = Math.min(100, loyalty + loyaltyBoostFromPay * 0.1); // small per-tick boost
        } else {
          // Unpaid wages grievance
          if (!grievances.some(g => g.type === 'unpaid' && tick.tickNumber - g.tickRecorded < 50)) {
            grievances.push({ type: 'unpaid', severity: 3, tickRecorded: tick.tickNumber });
            loyalty = Math.max(0, loyalty - 3);
            changed = true;
          }
        }

        // 3. Food/water check
        if (ship.food_stores <= 0 || ship.water_stores <= 0) {
          loyalty = Math.max(0, loyalty - loyaltyHitFromHunger);
          if (!grievances.some(g => g.type === 'poor_rations' && tick.tickNumber - g.tickRecorded < 100)) {
            grievances.push({ type: 'poor_rations', severity: 5, tickRecorded: tick.tickNumber });
          }
          changed = true;
        }

        if (loyalty !== crew.loyalty) {
          await CrewQueries.updateLoyalty(crew.id, Math.round(loyalty));
          changed = true;
        }

        if (changed) {
          await CrewQueries.updateGrievances(crew.id, JSON.stringify(grievances));
        }

        // 4. Desertion check (only when docked, and only after minimum 72 ticks of service)
        const serviceTime = tick.tickNumber - crew.joined_tick;
        if (ship.status === 'docked' && loyalty < desertionThreshold && serviceTime > 72 && Math.random() < 0.03) {
          await CrewQueries.updateStatus(crew.id, 'deserted');
          await ShipQueries.updateCrewCount(ship.id, Math.max(0, ship.crew_count - 1));
          if (tick.logger) {
            tick.logger.counters.crewDeserted++;
            tick.logger.log('crew-events', { type: 'deserted', shipId: ship.id, shipName: ship.name, crewId: crew.id, loyalty });
          }
        }
      }

      // 5. Mutiny check
      const activeCrewAfter = await CrewQueries.getActiveByShip(ship.id);
      const crewMembers: CrewMember[] = activeCrewAfter.map(c => ({
        id: c.id,
        name: c.agent_id,
        loyalty: c.loyalty,
        share: c.share_agreement,
        grievances: JSON.parse(c.grievances || '[]'),
      }));

      const mutinyResult = checkMutiny(crewMembers);
      if (mutinyResult.occurred) {
        if (tick.logger) {
          tick.logger.counters.mutiniesAttempted++;
          if (mutinyResult.outcome === 'captain_deposed' || mutinyResult.outcome === 'negotiated') tick.logger.counters.mutiniesSucceeded++;
          tick.logger.log('crew-events', { type: 'mutiny', shipId: ship.id, shipName: ship.name, outcome: mutinyResult.outcome });
        }
        if (mutinyResult.outcome === 'captain_deposed') {
          // Captain loses the ship
          if (ship.captain_id) {
            // Mark captain's crew record as marooned
            const captainCrew = activeCrewAfter.find(c => c.role === 'captain');
            if (captainCrew) {
              await CrewQueries.updateStatus(captainCrew.id, 'marooned');
            }
          }
        } else if (mutinyResult.outcome === 'mutiny_crushed') {
          // Ringleaders removed
          for (const rid of mutinyResult.ringleaders) {
            await CrewQueries.updateStatus(rid, 'marooned');
            await ShipQueries.updateCrewCount(ship.id, Math.max(0, ship.crew_count - 1));
          }
        } else if (mutinyResult.outcome === 'negotiated') {
          // Boost loyalty for all remaining crew
          for (const c of activeCrewAfter) {
            await CrewQueries.updateLoyalty(c.id, Math.min(100, c.loyalty + 15));
          }
        }
      }
    }
  },
};

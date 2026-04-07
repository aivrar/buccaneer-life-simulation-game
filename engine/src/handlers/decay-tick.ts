import type { TickHandler, TickContext } from '../runtime/types.js';
import { TickPhase } from '../runtime/types.js';
import { ShipQueries, CargoQueries, ReputationQueries, IntelQueries, AgentQueries, BountyQueries } from '../db/queries.js';
import { ECONOMY } from '../config/economy.js';
import { query as rawQuery, execute as rawExecute } from '../db/sqlite.js';

export const decayTickHandler: TickHandler = {
  name: 'decay-tick',
  phase: TickPhase.DECAY,

  async execute(tick: TickContext): Promise<void> {
    // 1. Ship condition decay (barnacles, rot, sail wear)
    const ships = await ShipQueries.getAllActive();
    for (const ship of ships) {
      const { barnacleGrowthPerTick, rotGrowthPerTick, foodConsumptionPerCrewPerTick, waterConsumptionPerCrewPerTick } = ECONOMY.shipMaintenance;

      let barnacles = ship.barnacle_level;
      let rot = ship.rot_level;
      let sails = ship.sails;
      let conditionChanged = false;

      if (ship.status === 'sailing') {
        barnacles = Math.min(100, barnacles + barnacleGrowthPerTick);
        sails = Math.max(0, sails - 0.02); // slow sail wear from use
        conditionChanged = true;
      }

      // Rot grows on all non-sunk ships, faster in tropics
      const tropicMod = 1.5; // simplified: all Caribbean is tropical
      rot = Math.min(100, rot + rotGrowthPerTick * tropicMod);
      conditionChanged = true;

      if (conditionChanged) {
        await ShipQueries.updateCondition(ship.id, ship.hull, Math.round(sails), Math.round(barnacles * 10) / 10, Math.round(rot * 100) / 100);
      }

      // 1b. Sink check — ships at hull 0 from rot/decay should be marked sunk
      if (ship.hull <= 0 && ship.status !== 'sunk') {
        await ShipQueries.updateStatusFull(ship.id, 'sunk', null, null);
        // If captained, captain is stranded — imprisoned at nearest port (not killed)
        // Historical: a ship rotting in harbor doesn't kill the captain — they just lose their ship
        if (ship.captain_id) {
          const captain = await AgentQueries.getById(ship.captain_id);
          if (captain && captain.status !== 'dead') {
            const port = captain.port_id || ship.port_id || 'port_royal';
            await AgentQueries.updateStatus(ship.captain_id, 'in_port');
            await AgentQueries.updateLocation(ship.captain_id, port, '');
          }
        }
        continue; // skip stores consumption for a sunk ship
      }

      // 1c. Cap stores to 100 (prevent overflow from seeding bugs)
      if (ship.food_stores > 100 || ship.water_stores > 100 || ship.powder_stores > 100) {
        await ShipQueries.updateStores(
          ship.id,
          Math.min(100, ship.food_stores),
          Math.min(100, ship.water_stores),
          Math.min(100, ship.powder_stores),
        );
      }

      // 2. Docked ship stores consumption (half rate)
      if (ship.status === 'docked' && ship.crew_count > 0) {
        const foodUsed = ship.crew_count * foodConsumptionPerCrewPerTick * 0.5;
        const waterUsed = ship.crew_count * waterConsumptionPerCrewPerTick * 0.5;
        const newFood = Math.max(0, ship.food_stores - foodUsed);
        const newWater = Math.max(0, ship.water_stores - waterUsed);
        if (newFood !== ship.food_stores || newWater !== ship.water_stores) {
          await ShipQueries.updateStores(ship.id, newFood, newWater, ship.powder_stores);
        }
      }
    }

    // 3. Cargo heat decay
    const hotCargo = await CargoQueries.getWithHeat();
    for (const cargo of hotCargo) {
      const { baseDecayPerTick, stolenGoodsMultiplier } = ECONOMY.heatDecay;
      const decayRate = cargo.seized_from ? baseDecayPerTick / stolenGoodsMultiplier : baseDecayPerTick;
      const newHeat = Math.max(0, cargo.heat - decayRate);
      if (newHeat !== cargo.heat) {
        await CargoQueries.updateHeat(cargo.id, Math.round(newHeat * 10) / 10);
      }
    }

    // 4. Reputation drift
    const reps = await ReputationQueries.getAll();
    for (const rep of reps) {
      let changed = false;
      let infamy = rep.infamy;
      let honor = rep.honor;

      // Infamy drifts toward 0 — 0.5/tick so it doesn't peg at 100 forever
      // (a +5 merchant_attack decays in 10 ticks, not 50)
      if (infamy > 0) {
        infamy = Math.max(0, infamy - 0.5);
        changed = true;
      }

      // Honor drifts toward 50
      if (honor !== 50) {
        honor += honor < 50 ? 0.05 : -0.05;
        changed = true;
      }

      if (changed) {
        await ReputationQueries.upsert(
          rep.agent_id, rep.sea_zone_id, rep.reputation,
          Math.round(infamy * 10) / 10,
          Math.round(honor * 10) / 10,
          tick.tickNumber,
        );
      }
    }

    // 4b. Sync agents.infamy from reputation table — use max infamy across all zones
    // This keeps the two infamy tracking systems in sync
    type InfamySyncRow = { agent_id: string; max_infamy: number };
    const infamyRows = await rawQuery<InfamySyncRow[]>(
      'SELECT agent_id, MAX(infamy) as max_infamy FROM reputation GROUP BY agent_id',
      [],
    );
    for (const row of infamyRows) {
      await rawExecute('UPDATE agents SET infamy = ? WHERE id = ? AND infamy != ?', [
        Math.round(row.max_infamy),
        row.agent_id,
        Math.round(row.max_infamy),
      ]);
    }

    // 5. Intel freshness decay
    const activeIntel = await IntelQueries.getActive();
    for (const intel of activeIntel) {
      const newFreshness = intel.freshness - 1;
      if (newFreshness <= 0) {
        await IntelQueries.remove(intel.id);
      } else {
        await IntelQueries.updateFreshness(intel.id, newFreshness);
      }
    }

    // 6. Bounty expiration — expire active bounties past their expires_tick
    // Also expire bounties on dead targets (uncollectable)
    type BountyRow = { id: string; target_agent_id: string; expires_tick: number | null; posted_by_agent_id: string | null; amount: number };
    const activeBounties = await rawQuery<BountyRow[]>(
      'SELECT b.id, b.target_agent_id, b.expires_tick, b.posted_by_agent_id, b.amount FROM bounties b WHERE b.status = \'active\'',
      [],
    );
    for (const b of activeBounties) {
      const expired = b.expires_tick !== null && tick.tickNumber >= b.expires_tick;
      let targetDead = false;
      if (!expired) {
        const target = await AgentQueries.getById(b.target_agent_id);
        targetDead = !target || target.status === 'dead';
      }
      if (expired || targetDead) {
        await BountyQueries.updateStatus(b.id, 'expired');
        // Refund poster — gold shouldn't evaporate on expiry
        if (b.posted_by_agent_id) {
          const poster = await AgentQueries.getById(b.posted_by_agent_id);
          if (poster && poster.status !== 'dead') {
            await AgentQueries.addCash(b.posted_by_agent_id, b.amount);
          }
        }
      }
    }
  },
};

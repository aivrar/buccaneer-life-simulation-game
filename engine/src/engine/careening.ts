/**
 * Ship maintenance mechanics (careening).
 * Models the process of beaching a ship to clean the hull,
 * repair timbers, and restore sailing performance.
 */

export interface CareeningJob {
  shipId: string;
  portId: string | null;    // null = beached at wild shore
  startTick: number;
  durationTicks: number;
  tasks: CareeningTask[];
  crewRequired: number;
  vulnerable: boolean;       // ship is defenseless while careened
}

export type CareeningTask = 'scrape_barnacles' | 'patch_hull' | 'replace_planks' | 'caulk_seams' | 'tar_bottom' | 'mend_sails';

export interface CareeningResult {
  barnacleReduction: number;
  hullRepair: number;
  rotReduction: number;
  sailRepair: number;
  goldCost: number;
  ticksElapsed: number;
}

export function startCareening(shipId: string, portId: string | null, tasks: CareeningTask[], tick: number): CareeningJob {
  // TODO: Initialize careening job
  // - More tasks = longer duration
  // - Port careening is faster but costs more
  const durationPerTask = portId ? 3 : 5;
  return {
    shipId,
    portId,
    startTick: tick,
    durationTicks: tasks.length * durationPerTask,
    tasks,
    crewRequired: Math.max(5, tasks.length * 3),
    vulnerable: true,
  };
}

export function completeCareening(job: CareeningJob): CareeningResult {
  // TODO: Calculate condition improvements from completed tasks
  return {
    barnacleReduction: job.tasks.includes('scrape_barnacles') ? 80 : 0,
    hullRepair: job.tasks.includes('patch_hull') ? 30 : 0,
    rotReduction: job.tasks.includes('replace_planks') ? 40 : 0,
    sailRepair: job.tasks.includes('mend_sails') ? 50 : 0,
    goldCost: job.portId ? job.tasks.length * 50 : job.tasks.length * 10,
    ticksElapsed: job.durationTicks,
  };
}

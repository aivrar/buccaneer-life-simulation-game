/**
 * Isthmus Transport Manager — spawns, advances, degrades, and replaces
 * mule trains and river canoes crossing Panama.
 *
 * In-memory state. The spawner regulates active count per economy tick.
 * Transports are disposable: they degrade, deliver, and get replaced.
 */

import {
  TRANSPORT_TYPES,
  getTransportCap,
  getSpawnCondition,
  getCargoTemplate,
  type TransportType,
  type TransportStatus,
  type TransportDirection,
} from '../config/isthmus-transport.js';
import { addSupply, removeSupply, getSupply } from './port-inventory.js';
import type { GameTime, WeatherCondition } from '../runtime/types.js';

// ============================================================
// Transport entity
// ============================================================

export interface IsthmusTransport {
  id: string;
  type: TransportType;
  status: TransportStatus;
  direction: TransportDirection;
  condition: number;              // 0-100
  cargoCapacity: number;
  cargoManifest: Record<string, number>;
  progress: number;               // 0.0 to 1.0 along route
  departureTick: number;
  arrivalTick: number | null;
  statusTick: number;             // tick when current status was set
  crewSlots: number;
  assignedAgents: string[];       // agent IDs (filled later by agent system)
}

// ============================================================
// In-memory state
// ============================================================

const activeTransports = new Map<string, IsthmusTransport>();
const pendingReplacements: { type: TransportType; direction: TransportDirection; spawnAtTick: number }[] = [];
let nextId = 1;

function generateId(type: TransportType): string {
  return `${type}_${nextId++}`;
}

// ============================================================
// Origin/destination mapping
// ============================================================

const ENDPOINTS = {
  eastbound: { origin: 'portobelo', destination: 'portobelo' },  // Panama City → Portobelo
  westbound: { origin: 'portobelo', destination: 'portobelo' },  // Portobelo → Panama City
} as const;

// Panama City isn't a port in the system — cargo originates from/arrives at Portobelo.
// Eastbound: silver "appears" at Portobelo (modeled as production via fleet gating).
// Westbound: European goods leave Portobelo inventory, travel, then get consumed
//            (they supply the interior — abstracted as removal from Portobelo).
//
// For the economy, the key effect is:
//   Eastbound transports DELIVER cargo TO Portobelo inventory (silver arriving from Peru)
//   Westbound transports CONSUME cargo FROM Portobelo inventory (goods going inland)

function getLoadPort(direction: TransportDirection): string {
  // Eastbound loads at "Panama City" (virtual — cargo spawned by template)
  // Westbound loads at Portobelo (draws from port inventory)
  return direction === 'westbound' ? 'portobelo' : '';
}

function getDeliveryPort(direction: TransportDirection): string {
  // Eastbound delivers to Portobelo
  // Westbound delivers to "Panama City" (virtual — cargo despawns, consumed by interior)
  return direction === 'eastbound' ? 'portobelo' : '';
}

// ============================================================
// Spawning
// ============================================================

function spawnTransport(
  type: TransportType,
  direction: TransportDirection,
  tick: number,
  month: number,
  isReplacement: boolean,
): IsthmusTransport {
  const config = TRANSPORT_TYPES[type];
  const condition = getSpawnCondition(type, month, isReplacement);
  const capacityMod = condition / 100;
  const capacity = Math.floor(config.cargoCapacityBase * capacityMod);

  const transport: IsthmusTransport = {
    id: generateId(type),
    type,
    status: 'loading',
    direction,
    condition,
    cargoCapacity: capacity,
    cargoManifest: {},
    progress: 0,
    departureTick: tick + config.loadingTicks,
    arrivalTick: null,
    statusTick: tick,
    crewSlots: config.crewSlots,
    assignedAgents: [],
  };

  activeTransports.set(transport.id, transport);
  return transport;
}

function loadCargo(transport: IsthmusTransport, month: number): void {
  const template = getCargoTemplate(transport.direction, month);
  const loadPort = getLoadPort(transport.direction);

  for (const [cargoType, fraction] of Object.entries(template)) {
    const desiredAmount = Math.floor(transport.cargoCapacity * fraction);
    if (desiredAmount <= 0) continue;

    if (loadPort) {
      // Westbound: draw from Portobelo inventory
      const available = getSupply(loadPort, cargoType);
      const actualAmount = Math.min(desiredAmount, available);
      if (actualAmount > 0) {
        removeSupply(loadPort, cargoType, actualAmount);
        transport.cargoManifest[cargoType] = actualAmount;
      }
    } else {
      // Eastbound: cargo spawned from template (silver from Peru, virtual origin)
      transport.cargoManifest[cargoType] = desiredAmount;
    }
  }
}

function deliverCargo(transport: IsthmusTransport): void {
  const deliveryPort = getDeliveryPort(transport.direction);
  if (!deliveryPort) return; // westbound goes to virtual Panama City — cargo consumed

  for (const [cargoType, amount] of Object.entries(transport.cargoManifest)) {
    if (amount > 0) {
      addSupply(deliveryPort, cargoType, amount);
    }
  }
  transport.cargoManifest = {};
}

// ============================================================
// Per-tick advancement
// ============================================================

function advanceTransport(
  transport: IsthmusTransport,
  tick: number,
  weatherCondition: WeatherCondition,
): void {
  const config = TRANSPORT_TYPES[transport.type];

  switch (transport.status) {
    case 'loading': {
      if (tick >= transport.departureTick) {
        transport.status = 'in_transit';
        transport.statusTick = tick;
      }
      break;
    }

    case 'in_transit': {
      // Degrade condition
      let degrade = config.conditionDegradePerTick;
      if (weatherCondition === 'storm' || weatherCondition === 'hurricane') {
        degrade *= config.stormDegradeMultiplier;
      } else if (weatherCondition === 'rain') {
        degrade *= 1.5;
      }
      transport.condition = Math.max(0, transport.condition - degrade);

      // Advance progress — slower when condition is poor
      const conditionSpeedMod = 0.5 + 0.5 * (transport.condition / 100); // 0.5x at 0, 1.0x at 100
      const progressPerTick = (1.0 / config.travelTicks) * conditionSpeedMod;
      transport.progress = Math.min(1.0, transport.progress + progressPerTick);

      // Check arrival
      if (transport.progress >= 1.0) {
        transport.status = 'unloading';
        transport.statusTick = tick;
        transport.arrivalTick = tick;
        deliverCargo(transport);
      }

      // Breakdown: if condition hits 0, transport is destroyed
      if (transport.condition <= 0) {
        transport.status = 'destroyed';
        transport.statusTick = tick;
        // Cargo is lost (or partially salvageable — future hook)
        transport.cargoManifest = {};
      }
      break;
    }

    case 'unloading': {
      if (tick >= transport.statusTick + config.unloadingTicks) {
        // Decide: recycle or retire
        if (transport.condition > config.retireThreshold) {
          // Flip direction, recycle
          transport.direction = transport.direction === 'eastbound' ? 'westbound' : 'eastbound';
          transport.status = 'loading';
          transport.progress = 0;
          transport.arrivalTick = null;
          transport.departureTick = tick + config.loadingTicks;
          transport.statusTick = tick;
        } else {
          // Too worn — retire, spawner will replace
          activeTransports.delete(transport.id);
        }
      }
      break;
    }

    case 'captured':
    case 'destroyed': {
      // Already handled — spawner will queue replacement
      break;
    }
  }
}

// ============================================================
// Public API — called from economy-tick
// ============================================================

export interface TransportTickResult {
  spawned: string[];
  arrived: string[];
  destroyed: string[];
  retired: string[];
  active: number;
}

export function tickIsthmusTransports(
  tick: number,
  month: number,
  weatherCondition: WeatherCondition,
): TransportTickResult {
  const result: TransportTickResult = {
    spawned: [],
    arrived: [],
    destroyed: [],
    retired: [],
    active: 0,
  };

  // 1. Process pending replacements
  for (let i = pendingReplacements.length - 1; i >= 0; i--) {
    const pending = pendingReplacements[i]!;
    if (tick >= pending.spawnAtTick) {
      const cap = getTransportCap(pending.type, month);
      const activeCount = countActive(pending.type);
      if (activeCount < cap) {
        const t = spawnTransport(pending.type, pending.direction, tick, month, true);
        loadCargo(t, month);
        result.spawned.push(t.id);
      }
      pendingReplacements.splice(i, 1);
    }
  }

  // 2. Advance all active transports
  const toRemove: string[] = [];
  for (const transport of activeTransports.values()) {
    const prevStatus = transport.status;
    advanceTransport(transport, tick, weatherCondition);

    if (transport.status === 'destroyed' && prevStatus !== 'destroyed') {
      result.destroyed.push(transport.id);
      queueReplacement(transport.type, transport.direction, tick);
      toRemove.push(transport.id);
    }
    if (transport.status === 'captured' && prevStatus !== 'captured') {
      queueReplacement(transport.type, transport.direction, tick);
      toRemove.push(transport.id);
    }
    if (transport.status === 'unloading' && prevStatus === 'in_transit') {
      result.arrived.push(transport.id);
    }
  }

  // Clean up destroyed/captured
  for (const id of toRemove) {
    activeTransports.delete(id);
  }

  // Check for retirements (transports that were deleted during unloading)
  // Already handled in advanceTransport — they're simply removed.

  // 3. Spawn new transports to meet cap
  for (const type of ['mule_train', 'river_canoe'] as TransportType[]) {
    const cap = getTransportCap(type, month);
    const activeCount = countActive(type);
    const deficit = cap - activeCount - countPending(type);

    for (let i = 0; i < deficit; i++) {
      // Alternate directions for even flow
      const direction: TransportDirection = (activeCount + i) % 2 === 0 ? 'eastbound' : 'westbound';
      const t = spawnTransport(type, direction, tick, month, false);
      loadCargo(t, month);
      result.spawned.push(t.id);
    }
  }

  result.active = activeTransports.size;
  return result;
}

function queueReplacement(type: TransportType, direction: TransportDirection, tick: number): void {
  const config = TRANSPORT_TYPES[type];
  pendingReplacements.push({
    type,
    direction,
    spawnAtTick: tick + config.replacementDelayTicks,
  });
}

function countActive(type: TransportType): number {
  let count = 0;
  for (const t of activeTransports.values()) {
    if (t.type === type) count++;
  }
  return count;
}

function countPending(type: TransportType): number {
  return pendingReplacements.filter(p => p.type === type).length;
}

// ============================================================
// Query API — for UI, agent decisions, encounter system
// ============================================================

export function getActiveTransports(): IsthmusTransport[] {
  return [...activeTransports.values()];
}

export function getTransportsByType(type: TransportType): IsthmusTransport[] {
  return [...activeTransports.values()].filter(t => t.type === type);
}

export function getTransportById(id: string): IsthmusTransport | undefined {
  return activeTransports.get(id);
}

export function getInTransitTransports(): IsthmusTransport[] {
  return [...activeTransports.values()].filter(t => t.status === 'in_transit');
}

/**
 * Mark a transport as captured (called by future encounter/theft system).
 * Cargo remains on the transport for the captor to claim.
 */
export function markCaptured(id: string, tick: number): Record<string, number> | null {
  const transport = activeTransports.get(id);
  if (!transport || transport.status !== 'in_transit') return null;

  transport.status = 'captured';
  transport.statusTick = tick;
  const loot = { ...transport.cargoManifest };
  // Don't clear manifest — captor claims it via the encounter system
  return loot;
}

export function resetTransportState(): void {
  activeTransports.clear();
  pendingReplacements.length = 0;
  nextId = 1;
}

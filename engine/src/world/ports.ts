import { PORT_PROFILES, ALL_PORTS, type PortProfile } from '../config/ports.js';

export function getPort(portId: string): PortProfile | null {
  return ALL_PORTS[portId] ?? null;
}

export function getAllPortIds(): string[] {
  return Object.keys(PORT_PROFILES);
}

export function getAllPortIdsIncludingBackground(): string[] {
  return Object.keys(ALL_PORTS);
}

export function getPortsByZone(seaZoneId: string): PortProfile[] {
  return Object.values(ALL_PORTS).filter(p => p.seaZoneId === seaZoneId);
}

export function getPortsByController(controller: string): PortProfile[] {
  return Object.values(PORT_PROFILES).filter(p => p.controller === controller);
}

export function getPirateFriendlyPorts(): PortProfile[] {
  return Object.values(PORT_PROFILES).filter(p => p.pirateFriendly);
}

export function getPortCorruption(portId: string): number {
  return ALL_PORTS[portId]?.corruption ?? 0;
}

export function canDockAtPort(portId: string, agentNationality: string, infamy: number): boolean {
  const port = ALL_PORTS[portId];
  if (!port) return false;

  if (port.pirateFriendly) return true;
  if (infamy > 70) return false;
  if (infamy > 40 && port.corruption < 40) return false;

  return true;
}

export function canShipEnterHarbor(portId: string, draftDepth: number): boolean {
  const port = ALL_PORTS[portId];
  if (!port) return false;
  if (!port.harbor.maxDraft) return true; // no restriction
  return draftDepth <= port.harbor.maxDraft;
}

export function getPortsByType(portType: PortProfile['portType']): PortProfile[] {
  return Object.values(ALL_PORTS).filter(p => p.portType === portType);
}

import { ALL_PLACES, PLACE_TEMPLATES, type PlaceDefinition, type PlaceType } from '../config/places.js';

// Get all places in a port
export function getPlacesByPort(portId: string): PlaceDefinition[] {
  return ALL_PLACES.filter(p => p.portId === portId);
}

// Get a specific place by ID
export function getPlace(placeId: string): PlaceDefinition | null {
  return ALL_PLACES.find(p => p.id === placeId) ?? null;
}

// Get all places of a type in a port
export function getPlacesByType(portId: string, type: PlaceType): PlaceDefinition[] {
  return ALL_PLACES.filter(p => p.portId === portId && p.type === type);
}

// Get the best tavern in a port (highest quality)
export function getBestTavern(portId: string): PlaceDefinition | null {
  const taverns = getPlacesByType(portId, 'tavern');
  if (taverns.length === 0) return null;
  return taverns.reduce((best, t) =>
    (t.quality ?? PLACE_TEMPLATES.tavern.defaultQuality) > (best.quality ?? PLACE_TEMPLATES.tavern.defaultQuality)
      ? t : best
  );
}

// Get the shipyard in a port
export function getShipyard(portId: string): PlaceDefinition | null {
  const yards = getPlacesByType(portId, 'shipyard');
  return yards[0] ?? null;
}

// Get effective quality of a place (uses template default if not set)
export function getPlaceQuality(place: PlaceDefinition): number {
  return place.quality ?? PLACE_TEMPLATES[place.type]?.defaultQuality ?? 50;
}

// Get effective safety of a place
export function getPlaceSafety(place: PlaceDefinition): number {
  return place.safety ?? PLACE_TEMPLATES[place.type]?.defaultSafety ?? 50;
}

// Count total places across all ports
export function getTotalPlaceCount(): number {
  return ALL_PLACES.length;
}

// Get all place IDs for a port
export function getPlaceIds(portId: string): string[] {
  return ALL_PLACES.filter(p => p.portId === portId).map(p => p.id);
}

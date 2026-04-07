// Overland routes from PHYSICAL_WORLD.md

export interface OverlandRoute {
  id: string;
  name: string;
  fromPortId: string;
  toLocation: string;
  distanceKm: number;
  travelTimeDays: number;  // by mule/horse
  terrain: string;
  hazards: string[];
  passableMonths: number[] | null;  // null = year-round
  description: string;
}

export const OVERLAND_ROUTES: OverlandRoute[] = [
  {
    id: 'camino_real',
    name: 'Camino Real',
    fromPortId: 'portobelo',
    toLocation: 'Panama City',
    distanceKm: 95,
    travelTimeDays: 4,
    terrain: 'Dense jungle, steep mountain passes, numerous river fords. Stone-paved, 4 feet wide — single mule train.',
    hazards: ['malaria', 'yellow_fever', 'snakes', 'bandits', 'cimarron_communities', 'precipitous_drops'],
    passableMonths: [12, 1, 2, 3, 4], // impassable May-November (rainy season)
    description: 'The Royal Road connecting Portobelo to Panama City. During the Portobelo Fair, this road carries more wealth per mile than anywhere else on Earth.',
  },
  {
    id: 'chagres_river_route',
    name: 'Chagres River Route',
    fromPortId: 'portobelo',
    toLocation: 'Panama City (via Cruces)',
    distanceKm: 75,
    travelTimeDays: 3,
    terrain: 'River by canoe to Cruces (~50km), then overland to Panama City (~25km). Fort San Lorenzo guards the river mouth.',
    hazards: ['flooding', 'rapids', 'malaria', 'fort_san_lorenzo_garrison'],
    passableMonths: null, // year-round but dangerous in rainy season
    description: 'Combined water/land route — faster than pure overland in good conditions. Fort San Lorenzo on an 80-foot cliff controls river access.',
  },
  {
    id: 'port_royal_spanish_town',
    name: 'Port Royal to Spanish Town Road',
    fromPortId: 'port_royal',
    toLocation: 'Spanish Town (Santiago de la Vega)',
    distanceKm: 16,
    travelTimeDays: 0.1, // 2-3 hours by horse
    terrain: 'Flat coastal road, then inland through plantation country.',
    hazards: [],
    passableMonths: null,
    description: 'Connects the naval base to the capital where the Governor resides. Messages between Port Royal and Spanish Town take hours, not minutes.',
  },
  {
    id: 'maroon_trails',
    name: 'Maroon Trails — Blue Mountains',
    fromPortId: 'port_royal',
    toLocation: 'Nanny Town / Trelawny Town',
    distanceKm: 50,
    travelTimeDays: 3,
    terrain: 'Steep mountain terrain, dense rainforest, ravines, hidden caves. Impossible without a Maroon guide.',
    hazards: ['ambush_points', 'getting_lost', 'dehydration', 'hostile_maroons'],
    passableMonths: null,
    description: 'Narrow jungle paths known only to Maroons. Hidden lookout posts, ambush points, cave systems, drum communication posts.',
  },
];

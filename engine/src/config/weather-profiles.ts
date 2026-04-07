// Seasonal weather profiles per port from PHYSICAL_WORLD.md
// Used as baseline for weather generation

export interface WeatherProfile {
  portId: string;
  janWindDir: string;
  janWindSpeed: number;   // knots
  julWindDir: string;
  julWindSpeed: number;   // knots
  hurricaneRisk: 'none' | 'low' | 'moderate' | 'high' | 'very_high';
  rainyMonths: number[];  // 1-12
  dryMonths: number[];    // 1-12
  fogRisk: 'none' | 'low' | 'moderate' | 'high';
  tempMinF: number;
  tempMaxF: number;
}

export const WEATHER_PROFILES: Record<string, WeatherProfile> = {
  nassau: {
    portId: 'nassau',
    janWindDir: 'ENE', janWindSpeed: 12,
    julWindDir: 'E', julWindSpeed: 8,
    hurricaneRisk: 'moderate',
    rainyMonths: [6, 7, 8, 9, 10, 11],
    dryMonths: [12, 1, 2, 3, 4, 5],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  port_royal: {
    portId: 'port_royal',
    janWindDir: 'ENE', janWindSpeed: 10,
    julWindDir: 'E', julWindSpeed: 8,
    hurricaneRisk: 'high',
    rainyMonths: [5, 6, 7, 8, 9, 10, 11],
    dryMonths: [12, 1, 2, 3, 4],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  havana: {
    portId: 'havana',
    janWindDir: 'NE', janWindSpeed: 12,
    julWindDir: 'ESE', julWindSpeed: 8,
    hurricaneRisk: 'high',
    rainyMonths: [5, 6, 7, 8, 9, 10],
    dryMonths: [11, 12, 1, 2, 3, 4],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  tortuga: {
    portId: 'tortuga',
    janWindDir: 'ENE', janWindSpeed: 10,
    julWindDir: 'E', julWindSpeed: 8,
    hurricaneRisk: 'moderate',
    rainyMonths: [5, 6, 7, 8, 9, 10, 11],
    dryMonths: [12, 1, 2, 3, 4],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  bridgetown: {
    portId: 'bridgetown',
    janWindDir: 'ENE', janWindSpeed: 15,
    julWindDir: 'ENE', julWindSpeed: 12,
    hurricaneRisk: 'high',
    rainyMonths: [6, 7, 8, 9, 10, 11],
    dryMonths: [1, 2, 3, 4, 5],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  charles_town: {
    portId: 'charles_town',
    janWindDir: 'N', janWindSpeed: 8,
    julWindDir: 'SW', julWindSpeed: 8,
    hurricaneRisk: 'moderate',
    rainyMonths: [6, 7, 8, 9],
    dryMonths: [10, 11, 12, 1, 2, 3, 4, 5],
    fogRisk: 'moderate',
    tempMinF: 40, tempMaxF: 90,
  },
  santo_domingo: {
    portId: 'santo_domingo',
    janWindDir: 'ENE', janWindSpeed: 10,
    julWindDir: 'ESE', julWindSpeed: 8,
    hurricaneRisk: 'high',
    rainyMonths: [5, 6, 7, 8, 9, 10, 11],
    dryMonths: [12, 1, 2, 3, 4],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  cartagena: {
    portId: 'cartagena',
    janWindDir: 'N', janWindSpeed: 8,
    julWindDir: 'W', julWindSpeed: 5,
    hurricaneRisk: 'low',
    rainyMonths: [4, 5, 6, 7, 8, 9, 10, 11],
    dryMonths: [12, 1, 2, 3],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  portobelo: {
    portId: 'portobelo',
    janWindDir: 'variable', janWindSpeed: 5,
    julWindDir: 'variable', julWindSpeed: 5,
    hurricaneRisk: 'moderate',
    rainyMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // year-round!
    dryMonths: [],
    fogRisk: 'high',
    tempMinF: 75, tempMaxF: 90,
  },
  boston: {
    portId: 'boston',
    janWindDir: 'NW', janWindSpeed: 12,
    julWindDir: 'SW', julWindSpeed: 8,
    hurricaneRisk: 'low',
    rainyMonths: [3, 4],
    dryMonths: [6, 7, 8, 9],
    fogRisk: 'high',
    tempMinF: 25, tempMaxF: 85,
  },
  willemstad: {
    portId: 'willemstad',
    janWindDir: 'ENE', janWindSpeed: 15,
    julWindDir: 'ENE', julWindSpeed: 12,
    hurricaneRisk: 'low',
    rainyMonths: [10, 11, 12],
    dryMonths: [2, 3, 4, 5, 6],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  veracruz: {
    portId: 'veracruz',
    janWindDir: 'N', janWindSpeed: 15,
    julWindDir: 'SE', julWindSpeed: 8,
    hurricaneRisk: 'high',
    rainyMonths: [6, 7, 8, 9, 10],
    dryMonths: [11, 12, 1, 2, 3, 4, 5],
    fogRisk: 'low',
    tempMinF: 65, tempMaxF: 95,
  },
  petit_goave: {
    portId: 'petit_goave',
    janWindDir: 'ENE', janWindSpeed: 8,
    julWindDir: 'E', julWindSpeed: 6,
    hurricaneRisk: 'moderate',
    rainyMonths: [5, 6, 7, 8, 9, 10],
    dryMonths: [11, 12, 1, 2, 3, 4],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  basseterre: {
    portId: 'basseterre',
    janWindDir: 'ENE', janWindSpeed: 15,
    julWindDir: 'ENE', julWindSpeed: 12,
    hurricaneRisk: 'very_high',
    rainyMonths: [7, 8, 9, 10, 11],
    dryMonths: [1, 2, 3, 4, 5, 6],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },

  // === African Ports ===
  cape_coast_castle: {
    portId: 'cape_coast_castle',
    janWindDir: 'NE', janWindSpeed: 8,
    julWindDir: 'SW', julWindSpeed: 10,
    hurricaneRisk: 'none',
    rainyMonths: [4, 5, 6, 7, 8, 9, 10],
    dryMonths: [11, 12, 1, 2, 3],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  elmina: {
    portId: 'elmina',
    janWindDir: 'NE', janWindSpeed: 8,
    julWindDir: 'SW', julWindSpeed: 12,
    hurricaneRisk: 'none',
    rainyMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    dryMonths: [11, 12, 1, 2],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 90,
  },
  whydah: {
    portId: 'whydah',
    janWindDir: 'NE', janWindSpeed: 8,
    julWindDir: 'SW', julWindSpeed: 10,
    hurricaneRisk: 'none',
    rainyMonths: [3, 4, 5, 6, 7, 9, 10],
    dryMonths: [8, 11, 12, 1, 2],
    fogRisk: 'low',
    tempMinF: 75, tempMaxF: 92,
  },

  // === European Ports ===
  london: {
    portId: 'london',
    janWindDir: 'SW', janWindSpeed: 12,
    julWindDir: 'SW', julWindSpeed: 8,
    hurricaneRisk: 'none',
    rainyMonths: [10, 11, 12, 1],
    dryMonths: [5, 6, 7, 8],
    fogRisk: 'high',
    tempMinF: 35, tempMaxF: 75,
  },
  seville_cadiz: {
    portId: 'seville_cadiz',
    janWindDir: 'W', janWindSpeed: 10,
    julWindDir: 'NW', julWindSpeed: 8,
    hurricaneRisk: 'none',
    rainyMonths: [10, 11, 12, 1, 2, 3],
    dryMonths: [6, 7, 8, 9],
    fogRisk: 'low',
    tempMinF: 45, tempMaxF: 95,
  },
  amsterdam: {
    portId: 'amsterdam',
    janWindDir: 'SW', janWindSpeed: 14,
    julWindDir: 'SW', julWindSpeed: 10,
    hurricaneRisk: 'none',
    rainyMonths: [10, 11, 12, 1],
    dryMonths: [4, 5, 6],
    fogRisk: 'high',
    tempMinF: 30, tempMaxF: 72,
  },
};

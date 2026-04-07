import type { HumanAttributes } from '../runtime/types.js';
import type { AgentTypeName } from '../db/models.js';

export interface HeritageProfile {
  id: string;
  name: string;
  attributeRanges: { [K in keyof HumanAttributes]: [number, number] }; // [min, max]
  culturalSkills: Array<{ domain: string; subSkill: string; bonus: number }>;
  languages: string[];
  backgrounds: { male: string[]; female: string[] };
  namePool: string; // maps to name-generator nationality
}

export const HERITAGE_PROFILES: Record<string, HeritageProfile> = {
  english: {
    id: 'english',
    name: 'English',
    attributeRanges: {
      strength: [30, 75], endurance: [30, 75], agility: [30, 70],
      constitution: [30, 70], appearance: [25, 75],
      intellect: [35, 80], perception: [30, 75], willpower: [35, 80],
      creativity: [30, 70], memory: [35, 75],
      eloquence: [35, 80], empathy: [25, 65], presence: [30, 75],
    },
    culturalSkills: [
      { domain: 'scholarship', subSkill: 'literacy', bonus: 15 },
      { domain: 'seamanship', subSkill: 'sail_handling', bonus: 10 },
      { domain: 'combat', subSkill: 'gunnery', bonus: 10 },
    ],
    languages: ['english'],
    backgrounds: {
      male: [
        'Born in the dockyards of London, learning the sea before letters.',
        'A pressed man from Bristol, stolen from his trade by the King\'s navy.',
        'Son of a Plymouth fisherman, the sea was all he ever knew.',
        'A debtor who fled England one step ahead of prison.',
        'A younger son with no inheritance, seeking fortune abroad.',
      ],
      female: [
        'A tavern keeper\'s daughter from Portsmouth who ran away to sea.',
        'A widow who took up her husband\'s trade after he drowned.',
        'Disguised herself as a man to escape an arranged marriage.',
      ],
    },
    namePool: 'english',
  },

  spanish: {
    id: 'spanish',
    name: 'Spanish',
    attributeRanges: {
      strength: [30, 75], endurance: [35, 80], agility: [30, 70],
      constitution: [35, 75], appearance: [30, 75],
      intellect: [30, 75], perception: [30, 70], willpower: [40, 85],
      creativity: [25, 70], memory: [30, 70],
      eloquence: [35, 80], empathy: [30, 70], presence: [35, 80],
    },
    culturalSkills: [
      { domain: 'combat', subSkill: 'swordplay', bonus: 15 },
      { domain: 'scholarship', subSkill: 'literacy', bonus: 10 },
      { domain: 'leadership', subSkill: 'command', bonus: 10 },
    ],
    languages: ['spanish'],
    backgrounds: {
      male: [
        'A soldier of the tercios, sent to guard the treasure fleets.',
        'Born in Seville, raised on tales of conquistadors.',
        'A merchant\'s son from Cadiz, trained in commerce and navigation.',
        'Deserted from the garrison at Havana seeking his own fortune.',
        'A hidalgo with a name but no money, chasing gold in the New World.',
      ],
      female: [
        'A merchant\'s widow managing her late husband\'s affairs in the colonies.',
        'Fled a convent in Santo Domingo, preferring freedom to devotion.',
      ],
    },
    namePool: 'spanish',
  },

  french: {
    id: 'french',
    name: 'French',
    attributeRanges: {
      strength: [25, 70], endurance: [30, 70], agility: [35, 80],
      constitution: [30, 70], appearance: [35, 80],
      intellect: [35, 80], perception: [30, 75], willpower: [30, 70],
      creativity: [40, 85], memory: [30, 75],
      eloquence: [40, 85], empathy: [35, 75], presence: [35, 80],
    },
    culturalSkills: [
      { domain: 'performing', subSkill: 'cooking', bonus: 15 },
      { domain: 'subterfuge', subSkill: 'deception', bonus: 10 },
      { domain: 'trade', subSkill: 'negotiation', bonus: 10 },
      { domain: 'scholarship', subSkill: 'languages', bonus: 10 },
    ],
    languages: ['french'],
    backgrounds: {
      male: [
        'A boucanier from Tortuga who turned from hunting cattle to hunting ships.',
        'A Huguenot refugee with no love for Catholic Spain.',
        'A sailor from Marseille drawn by tales of Caribbean riches.',
        'An adventurer from Normandy following the footsteps of the flibustiers.',
        'A disgraced officer from the Marine Royale.',
      ],
      female: [
        'A Huguenot woman who fled persecution across the Atlantic.',
        'A tavern owner from Petit-Goave, descended from boucaniers.',
      ],
    },
    namePool: 'french',
  },

  dutch: {
    id: 'dutch',
    name: 'Dutch',
    attributeRanges: {
      strength: [30, 70], endurance: [35, 80], agility: [25, 65],
      constitution: [35, 80], appearance: [25, 70],
      intellect: [40, 85], perception: [30, 75], willpower: [35, 80],
      creativity: [30, 75], memory: [35, 80],
      eloquence: [30, 70], empathy: [30, 70], presence: [25, 65],
    },
    culturalSkills: [
      { domain: 'trade', subSkill: 'appraisal', bonus: 15 },
      { domain: 'scholarship', subSkill: 'mathematics', bonus: 15 },
      { domain: 'seamanship', subSkill: 'navigation', bonus: 10 },
      { domain: 'scholarship', subSkill: 'languages', bonus: 10 },
    ],
    languages: ['dutch'],
    backgrounds: {
      male: [
        'A VOC sailor who jumped ship in the Caribbean for better prospects.',
        'From a merchant family in Amsterdam, trading runs in his blood.',
        'A WIC privateer who stayed when the company pulled out.',
        'Born on Curacao, more Caribbean than Dutch.',
      ],
      female: [
        'A merchant\'s wife from Sint Eustatius who took over the business.',
      ],
    },
    namePool: 'dutch',
  },

  african: {
    id: 'african',
    name: 'African',
    attributeRanges: {
      strength: [50, 90], endurance: [55, 95], agility: [35, 80],
      constitution: [50, 85], appearance: [25, 75],
      intellect: [30, 80], perception: [35, 80], willpower: [45, 90],
      creativity: [35, 80], memory: [35, 80],
      eloquence: [25, 70], empathy: [35, 75], presence: [30, 75],
    },
    culturalSkills: [
      { domain: 'agriculture', subSkill: 'fishing', bonus: 15 },
      { domain: 'survival', subSkill: 'swimming', bonus: 20 },
      { domain: 'performing', subSkill: 'music', bonus: 10 },
      { domain: 'performing', subSkill: 'storytelling', bonus: 15 },
      { domain: 'agriculture', subSkill: 'animal_husbandry', bonus: 10 },
    ],
    languages: ['west_african', 'english_creole'],
    backgrounds: {
      male: [
        'Escaped enslavement during a ship raid, joined the pirate crew that freed him.',
        'A free Black sailor who chose the sea over plantation labor.',
        'A Maroon warrior from the Jamaican highlands, fierce and free.',
        'Freed by pirates who took the slave ship carrying him. Swore loyalty to their flag.',
        'Born free in Nassau, son of a freedwoman and a sailor.',
        'Survived the Middle Passage and three masters before winning freedom through skill.',
      ],
      female: [
        'A freedwoman running a tavern in Nassau, nobody\'s property anymore.',
        'Escaped a plantation with knowledge of herbs and healing.',
        'A Maroon woman from the Blue Mountains, skilled in survival.',
      ],
    },
    namePool: 'african',
  },

  portuguese: {
    id: 'portuguese',
    name: 'Portuguese',
    attributeRanges: {
      strength: [30, 70], endurance: [35, 80], agility: [30, 70],
      constitution: [35, 75], appearance: [30, 75],
      intellect: [35, 80], perception: [35, 80], willpower: [30, 75],
      creativity: [30, 70], memory: [30, 75],
      eloquence: [30, 75], empathy: [30, 70], presence: [30, 70],
    },
    culturalSkills: [
      { domain: 'seamanship', subSkill: 'navigation', bonus: 20 },
      { domain: 'scholarship', subSkill: 'cartography', bonus: 15 },
      { domain: 'trade', subSkill: 'negotiation', bonus: 10 },
      { domain: 'scholarship', subSkill: 'languages', bonus: 10 },
    ],
    languages: ['portuguese'],
    backgrounds: {
      male: [
        'A navigator from Lisbon whose skills are valued on any ship.',
        'Jumped ship from a Brazil-bound carrack, preferring Caribbean freedom.',
        'A trader from the Azores with contacts across the Atlantic.',
        'An old salt from the Cape Verde route, weathered by African and Caribbean sun.',
      ],
      female: [
        'A merchant\'s widow from Bahia, shrewd with money and connections.',
      ],
    },
    namePool: 'portuguese',
  },

  indigenous: {
    id: 'indigenous',
    name: 'Indigenous',
    attributeRanges: {
      strength: [35, 75], endurance: [45, 90], agility: [40, 85],
      constitution: [40, 80], appearance: [25, 70],
      intellect: [30, 75], perception: [50, 95], willpower: [40, 80],
      creativity: [35, 80], memory: [40, 80],
      eloquence: [20, 60], empathy: [35, 75], presence: [25, 65],
    },
    culturalSkills: [
      { domain: 'survival', subSkill: 'swimming', bonus: 20 },
      { domain: 'agriculture', subSkill: 'fishing', bonus: 20 },
      { domain: 'seamanship', subSkill: 'weather_reading', bonus: 15 },
      { domain: 'subterfuge', subSkill: 'stealth', bonus: 15 },
      { domain: 'survival', subSkill: 'medicine', bonus: 10 },
    ],
    languages: ['indigenous_caribbean'],
    backgrounds: {
      male: [
        'A Miskito diver and guide, invaluable to any captain.',
        'A Taino fisherman who knows every reef and channel.',
        'Recruited as a guide for his knowledge of the coast and rivers.',
        'A Kalinago warrior whose people fought the colonizers.',
      ],
      female: [
        'A healer with knowledge of Caribbean plants no European possesses.',
        'A Miskito fisherwoman who trades with passing ships.',
      ],
    },
    namePool: 'english', // no dedicated indigenous pool — uses English as proxy
  },
};

// ---- Historical role accessibility matrices ----

type GenderAccess = { allowed: boolean; weight?: number };

export const GENDER_ROLE_ACCESS: Record<AgentTypeName, { male: GenderAccess; female: GenderAccess }> = {
  pirate_captain:     { male: { allowed: true }, female: { allowed: true, weight: 0.05 } },
  merchant_captain:   { male: { allowed: true }, female: { allowed: false } },
  naval_officer:      { male: { allowed: true }, female: { allowed: false } },
  port_governor:      { male: { allowed: true }, female: { allowed: false } },
  privateer_captain:  { male: { allowed: true }, female: { allowed: false } },
  pirate_hunter:      { male: { allowed: true }, female: { allowed: false } },
  fence:              { male: { allowed: true }, female: { allowed: true } },
  crew_member:        { male: { allowed: true }, female: { allowed: true, weight: 0.02 } },
  quartermaster:      { male: { allowed: true }, female: { allowed: true, weight: 0.05 } },
  informant:          { male: { allowed: true }, female: { allowed: true } },
  tavern_keeper:      { male: { allowed: true }, female: { allowed: true } },
  shipwright:         { male: { allowed: true }, female: { allowed: false } },
  surgeon:            { male: { allowed: true }, female: { allowed: false } },
  harbor_master:      { male: { allowed: true }, female: { allowed: false } },
  plantation_owner:   { male: { allowed: true }, female: { allowed: true, weight: 0.10 } },
};

export const HERITAGE_ROLE_ACCESS: Record<string, Set<AgentTypeName>> = {
  english:    new Set(['pirate_captain', 'merchant_captain', 'naval_officer', 'port_governor', 'privateer_captain', 'fence', 'crew_member', 'quartermaster', 'informant', 'tavern_keeper', 'shipwright', 'surgeon', 'harbor_master', 'plantation_owner', 'pirate_hunter']),
  spanish:    new Set(['pirate_captain', 'merchant_captain', 'naval_officer', 'port_governor', 'privateer_captain', 'fence', 'crew_member', 'quartermaster', 'informant', 'tavern_keeper', 'shipwright', 'surgeon', 'harbor_master', 'plantation_owner', 'pirate_hunter']),
  french:     new Set(['pirate_captain', 'merchant_captain', 'naval_officer', 'port_governor', 'privateer_captain', 'fence', 'crew_member', 'quartermaster', 'informant', 'tavern_keeper', 'shipwright', 'surgeon', 'harbor_master', 'plantation_owner', 'pirate_hunter']),
  dutch:      new Set(['pirate_captain', 'merchant_captain', 'naval_officer', 'port_governor', 'privateer_captain', 'fence', 'crew_member', 'quartermaster', 'informant', 'tavern_keeper', 'shipwright', 'surgeon', 'harbor_master', 'plantation_owner', 'pirate_hunter']),
  african:    new Set(['pirate_captain', 'privateer_captain', 'fence', 'crew_member', 'quartermaster', 'informant', 'tavern_keeper', 'shipwright', 'pirate_hunter']),
  portuguese: new Set(['pirate_captain', 'merchant_captain', 'naval_officer', 'port_governor', 'privateer_captain', 'fence', 'crew_member', 'quartermaster', 'informant', 'tavern_keeper', 'shipwright', 'surgeon', 'harbor_master', 'plantation_owner', 'pirate_hunter']),
  indigenous: new Set(['pirate_captain', 'fence', 'crew_member', 'informant']),
};

export function validateSpawnCombo(
  gender: 'male' | 'female',
  heritage: string,
  role: AgentTypeName,
): { valid: boolean; reason?: string } {
  const genderAccess = GENDER_ROLE_ACCESS[role];
  if (!genderAccess) return { valid: false, reason: `Unknown role: ${role}` };

  const genderEntry = genderAccess[gender];
  if (!genderEntry.allowed) {
    return { valid: false, reason: `${gender} cannot be ${role} in this era` };
  }

  const heritageRoles = HERITAGE_ROLE_ACCESS[heritage];
  if (!heritageRoles) return { valid: false, reason: `Unknown heritage: ${heritage}` };

  if (!heritageRoles.has(role)) {
    return { valid: false, reason: `${heritage} heritage cannot be ${role} in this era` };
  }

  return { valid: true };
}

export function rollAttributes(heritage: string, gender: 'male' | 'female'): HumanAttributes {
  const profile = HERITAGE_PROFILES[heritage];
  if (!profile) throw new Error(`Unknown heritage: ${heritage}`);

  const attrs = {} as HumanAttributes;

  for (const [key, [min, max]] of Object.entries(profile.attributeRanges) as Array<[keyof HumanAttributes, [number, number]]>) {
    // Gender variance: slight shift in physical attributes
    let adjMin = min;
    let adjMax = max;
    if (gender === 'female' && (key === 'strength' || key === 'endurance')) {
      adjMin = Math.max(0, min - 5);
      adjMax = Math.max(adjMin, max - 10);
    }
    if (gender === 'female' && (key === 'empathy' || key === 'eloquence')) {
      adjMin = Math.min(100, min + 5);
      adjMax = Math.min(100, max + 5);
    }
    attrs[key] = Math.floor(adjMin + Math.random() * (adjMax - adjMin + 1));
  }

  return attrs;
}

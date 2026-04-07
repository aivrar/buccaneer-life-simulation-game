// Region-aware name generation for the Golden Age of Piracy

interface NamePool {
  male: string[];
  female: string[];
  surnames: string[];
}

const NAME_POOLS: Record<string, NamePool> = {
  english: {
    male: ['Edward', 'Henry', 'William', 'Thomas', 'John', 'James', 'Samuel', 'Benjamin', 'Josiah', 'Caleb',
      'Nathaniel', 'Charles', 'Richard', 'George', 'Robert', 'Francis', 'Daniel', 'Joshua', 'Solomon', 'Bartholomew',
      'Elias', 'Tobias', 'Ezekiel', 'Silas', 'Jeremiah', 'Amos', 'Abel', 'Gideon', 'Phineas', 'Cornelius'],
    female: ['Anne', 'Mary', 'Elizabeth', 'Sarah', 'Margaret', 'Catherine', 'Jane', 'Martha', 'Grace', 'Abigail',
      'Prudence', 'Patience', 'Hope', 'Faith', 'Mercy', 'Hannah', 'Rachel', 'Rebecca', 'Susanna', 'Lydia'],
    surnames: ['Teach', 'Rackham', 'Vane', 'Roberts', 'Hornigold', 'Bonnet', 'Thatch', 'Ward', 'Kidd', 'Morgan',
      'Avery', 'Tew', 'Mason', 'Fletcher', 'Cooper', 'Turner', 'Wright', 'Carpenter', 'Smith', 'Brown',
      'Hawkins', 'Drake', 'Grenville', 'Frobisher', 'Cavendish', 'Dampier', 'Rogers', 'Jennings', 'Barnet', 'Laws'],
  },
  spanish: {
    male: ['Diego', 'Miguel', 'Pedro', 'Juan', 'Carlos', 'Fernando', 'Alejandro', 'Rodrigo', 'Luis', 'Antonio',
      'Hernando', 'Gonzalo', 'Alonso', 'Cristobal', 'Francisco', 'Esteban', 'Domingo', 'Marcos', 'Vicente', 'Rafael'],
    female: ['Isabella', 'Maria', 'Elena', 'Catalina', 'Lucia', 'Ana', 'Beatriz', 'Carmen', 'Dolores', 'Rosa',
      'Pilar', 'Inés', 'Teresa', 'Juana', 'Francisca', 'Margarita'],
    surnames: ['de la Cruz', 'Moreno', 'Alvarez', 'Torres', 'Ramirez', 'Vega', 'Castillo', 'Herrera', 'Medina', 'Vargas',
      'Mendoza', 'Guerrero', 'Silva', 'Flores', 'Cortez', 'Delgado', 'Aguilar', 'Navarro', 'Salazar', 'Romero'],
  },
  french: {
    male: ['Jean', 'Pierre', 'Jacques', 'François', 'Louis', 'Antoine', 'René', 'Henri', 'Claude', 'Étienne',
      'Laurent', 'Michel', 'André', 'Philippe', 'Guillaume', 'Olivier', 'Nicolas', 'Gaston', 'Léon', 'Marcel'],
    female: ['Marie', 'Jeanne', 'Marguerite', 'Louise', 'Françoise', 'Isabelle', 'Colette', 'Hélène', 'Claire', 'Céline'],
    surnames: ['L\'Olonnais', 'Le Vasseur', 'de Grammont', 'Fleury', 'Lafitte', 'Moreau', 'Dubois', 'Laurent', 'Bernard',
      'Leroy', 'Duval', 'Mercier', 'Bonhomme', 'Beaumont', 'Chevalier', 'Renard', 'Marchand', 'Marin', 'Picard', 'Blanchard'],
  },
  dutch: {
    male: ['Piet', 'Hendrik', 'Willem', 'Cornelis', 'Jan', 'Dirk', 'Adriaan', 'Pieter', 'Joost', 'Michiel',
      'Maarten', 'Gerrit', 'Laurens', 'Roel', 'Thijs', 'Bram'],
    female: ['Annika', 'Grietje', 'Marieke', 'Johanna', 'Katrien', 'Liesbeth', 'Hendrika', 'Wilhelmina'],
    surnames: ['van Horn', 'de Ruyter', 'van der Berg', 'Jansen', 'de Vries', 'Bakker', 'Visser', 'de Groot', 'Mulder',
      'de Boer', 'Kuiper', 'Brouwer', 'Vermeer', 'Dekker', 'de Jong', 'van Dijk'],
  },
  african: {
    male: ['Kwame', 'Kofi', 'Yaw', 'Kwesi', 'Osei', 'Anansi', 'Cudjoe', 'Quaco', 'Sambo', 'Cuffee',
      'Mingo', 'Caesar', 'Scipio', 'Pompey', 'Jupiter', 'Olaudah', 'Mongo', 'Juba', 'Zumbi', 'Toussaint'],
    female: ['Nana', 'Ama', 'Efua', 'Akua', 'Adjoa', 'Abena', 'Afua', 'Akosua'],
    surnames: ['', '', '', '', '', '', '', ''], // Many freed/escaped people used single names or adopted new ones
  },
  portuguese: {
    male: ['Bartolomeu', 'Vasco', 'Gonçalo', 'Afonso', 'Manuel', 'Diogo', 'Rui', 'Nuno', 'Álvaro', 'Tomé'],
    female: ['Maria', 'Isabel', 'Ana', 'Catarina', 'Leonor', 'Beatriz', 'Filipa'],
    surnames: ['da Silva', 'Santos', 'Ferreira', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Carvalho',
      'Mendes', 'Oliveira', 'Teixeira', 'Barbosa', 'Pinto', 'Lopes'],
  },
};

// Sea zone → primary nationality pool for name generation
const ZONE_NATIONALITIES: Record<string, string[]> = {
  // English-dominated zones
  great_bahama_bank: ['english', 'african', 'dutch'],
  providence_channel: ['english', 'african'],
  bahama_channel: ['english', 'african'],
  kingston_approaches: ['english', 'african', 'spanish'],
  jamaica_channel: ['english', 'african', 'spanish'],
  carolina_shelf: ['english', 'african'],
  boston_waters: ['english', 'dutch'],
  windward_islands_waters: ['english', 'french', 'african'],
  leeward_islands_waters: ['english', 'french', 'african'],
  // Spanish-dominated zones
  havana_roads: ['spanish', 'african'],
  spanish_main_coast: ['spanish', 'african', 'dutch'],
  darien_coast: ['spanish', 'african'],
  gulf_of_mexico: ['spanish', 'african'],
  yucatan_channel: ['spanish', 'english'],
  // French-dominated zones
  tortuga_waters: ['french', 'spanish', 'african'],
  // Contested / mixed zones
  florida_straits: ['spanish', 'english'],
  windward_passage: ['english', 'french', 'spanish'],
  old_bahama_channel: ['spanish', 'english'],
  caribbean_deep_basin: ['english', 'spanish', 'french'],
  cayman_trench: ['english', 'spanish'],
  mona_passage: ['spanish', 'english'],
  anegada_passage: ['english', 'french'],
  tobago_channel: ['english', 'french', 'spanish'],
  silver_bank: ['spanish', 'english'],
  turks_passage: ['english', 'spanish'],
  atlantic_approach: ['english', 'spanish', 'french', 'dutch'],
  west_african_coast: ['african', 'english', 'dutch', 'portuguese'],
};

export function generateName(seaZoneId?: string, gender: 'male' | 'female' = 'male'): { firstName: string; lastName: string; nationality: string } {
  const nationalities = seaZoneId ? (ZONE_NATIONALITIES[seaZoneId] ?? ['english']) : ['english'];
  const nationality = nationalities[Math.floor(Math.random() * nationalities.length)]!;

  const pool = NAME_POOLS[nationality] ?? NAME_POOLS.english!;
  const firstNames = gender === 'male' ? pool.male : pool.female;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]!;

  let lastName = pool.surnames[Math.floor(Math.random() * pool.surnames.length)]!;

  // African names may not have surnames — generate a descriptive one
  if (!lastName && nationality === 'african') {
    const descriptors = ['the Bold', 'One-Eye', 'Ironhand', 'Blackwater', 'Stormborn', 'of Nassau', 'the Free'];
    lastName = descriptors[Math.floor(Math.random() * descriptors.length)]!;
  }

  return { firstName, lastName, nationality };
}

export function generateFullName(seaZoneId?: string, gender?: 'male' | 'female'): string {
  const { firstName, lastName } = generateName(seaZoneId, gender);
  return lastName ? `${firstName} ${lastName}` : firstName;
}

export function generateNameByNationality(nationality: string, gender: 'male' | 'female' = 'male'): { firstName: string; lastName: string; nationality: string } {
  const pool = NAME_POOLS[nationality] ?? NAME_POOLS.english!;
  const firstNames = gender === 'male' ? pool.male : pool.female;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]!;

  let lastName = pool.surnames[Math.floor(Math.random() * pool.surnames.length)]!;

  if (!lastName && nationality === 'african') {
    const descriptors = ['the Bold', 'One-Eye', 'Ironhand', 'Blackwater', 'Stormborn', 'of Nassau', 'the Free'];
    lastName = descriptors[Math.floor(Math.random() * descriptors.length)]!;
  }

  return { firstName, lastName, nationality };
}

// Ship name deduplication — prevents "Revenge" appearing 6 times
const usedShipNames = new Set<string>();

/** Reset ship name tracking (call at sim start) */
export function resetShipNames(): void {
  usedShipNames.clear();
}

/** Quick random fallback — used when LLM is unavailable */
export function generateShipName(): string {
  const prefixes = ['', 'HMS ', 'The '];
  const adjectives = ['Black', 'Red', 'Golden', 'Silver', 'Dark', 'Royal', 'Flying', 'Crimson', 'Iron', 'Swift',
    'Dread', 'Midnight', 'Storm', 'Phantom', 'Blood', 'Sea', 'Thunder', 'Shadow', 'Vengeful', 'Wicked'];
  const nouns = ['Pearl', 'Revenge', 'Fortune', 'Star', 'Dragon', 'Serpent', 'Raven', 'Wolf', 'Rose', 'Queen',
    'Duchess', 'Ranger', 'Adventure', 'Fancy', 'Delight', 'Endeavour', 'Surprise', 'Victory', 'Defiance', 'Fury',
    'Hound', 'Tempest', 'Maelstrom', 'Leviathan', 'Kraken', 'Barracuda', 'Corsair', 'Buccaneer', 'Marauder', 'Sovereign'];

  const useAdjective = Math.random() > 0.3;
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]!;
  const noun = nouns[Math.floor(Math.random() * nouns.length)]!;

  if (useAdjective) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]!;
    return `${prefix}${adj} ${noun}`.trim();
  }

  return `${prefix}${noun}`.trim();
}

/**
 * LLM-generated ship name — rich, era-appropriate, unique.
 * Uses captain identity, ship class, home port, and nationality to generate
 * a name that feels like it belongs in 1710-1725 Caribbean waters.
 * Falls back to random formula if LLM fails.
 */
export async function generateShipNameLLM(
  llmClient: { chatCompletion: (req: any) => Promise<any> },
  context: {
    captainName: string;
    captainType: string;
    shipClass: string;
    portId: string;
    nationality: string;
    persona?: string;
  },
): Promise<string> {
  const { captainName, captainType, shipClass, portId, nationality, persona } = context;

  const role = captainType.replace(/_/g, ' ');
  const cls = shipClass.replace(/_/g, ' ');
  const port = portId.replace(/_/g, ' ');

  const prompt = `You are naming a ship in the Golden Age of Piracy, 1710-1725 Caribbean.

Captain: ${captainName}, a ${nationality} ${role}
Ship class: ${cls}
Home port: ${port}
${persona ? `Captain's character: ${persona}` : ''}

Give this ship a name that fits the era and the captain's character. Consider:
- Pirates often named ships after concepts (revenge, fortune, defiance) or women
- Naval ships used HMS prefix and formal names (HMS Swallow, HMS Pearl)
- Merchant ships used practical or aspirational names (Endeavour, Providence, Good Hope)
- Spanish ships: San/Santa prefix (San Martín, Santa Rosa)
- French ships: Le/La prefix (La Concorde, Le Griffon)
- Dutch ships: De prefix (De Vliegende Draak)

Reply with ONLY the ship name. Nothing else. No quotes, no explanation. Just the name.`;

  try {
    const response = await llmClient.chatCompletion({
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      maxTokens: 20,
    });

    // Extract just the name — strip quotes, newlines, explanations
    let name = response.content.trim()
      .split('\n')[0]!             // first line only
      .replace(/^["']|["']$/g, '') // strip quotes
      .replace(/\.$/, '')          // strip trailing period
      .trim();

    // Sanity check — should be 1-5 words, no weird characters, not an LLM artifact
    if (name.length >= 3 && name.length <= 50 && !/[{}[\]<>]/.test(name) && !isLLMArtifact(name)) {
      if (!usedShipNames.has(name.toLowerCase())) {
        usedShipNames.add(name.toLowerCase());
        return name;
      }
      // Duplicate — try appending captain's first name
      const suffix = context.captainName.split(' ')[0] ?? '';
      const variant = `${suffix}'s ${name.split(' ').pop() ?? name}`;
      if (!usedShipNames.has(variant.toLowerCase())) {
        usedShipNames.add(variant.toLowerCase());
        return variant;
      }
    }
  } catch {
    // LLM failed — fall through to random
  }

  // Random fallback with dedup (up to 10 attempts)
  for (let i = 0; i < 10; i++) {
    const fallback = generateShipName();
    if (!usedShipNames.has(fallback.toLowerCase())) {
      usedShipNames.add(fallback.toLowerCase());
      return fallback;
    }
  }
  // Last resort: use captain name + ship class
  const lastResort = `${context.captainName.split(' ')[0]}'s ${context.shipClass.replace(/_/g, ' ')}`;
  usedShipNames.add(lastResort.toLowerCase());
  return lastResort;
}

/** Blocklist of common LLM response artifacts that are NOT valid ship names */
const LLM_ARTIFACT_BLOCKLIST = new Set([
  'assistant', 'user', 'system', 'hello', 'hi', 'hey', 'sure', 'okay',
  'certainly', 'of course', 'here is', 'here you go', 'i think',
  'the ship', 'a ship', 'ship name', 'name', 'unknown', 'none',
  'yes', 'no', 'thanks', 'thank you', 'response', 'answer', 'output',
]);

function isLLMArtifact(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (LLM_ARTIFACT_BLOCKLIST.has(lower)) return true;
  // Catch "Assistant:" or "Here is the name:" style prefixes
  if (/^(assistant|user|system)\s*:/i.test(name)) return true;
  // Catch bare "I" responses or meta-text
  if (/^(i |i'm |i'll |let me |here |sure,)/i.test(name)) return true;
  return false;
}

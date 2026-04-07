import { v4 as uuidv4 } from 'uuid';
import type { PersonaTraits, HumanAttributes, PersonaProfile } from '../runtime/types.js';
import type { AgentTypeName, Agent } from '../db/models.js';
import { AgentQueries, SkillQueries } from '../db/queries.js';
import { generateNameByNationality } from './name-generator.js';
import { rollTraits, buildPersonaProfile } from './persona-engine.js';
import { HERITAGE_PROFILES, rollAttributes, validateSpawnCombo } from '../config/heritage.js';
import { AGENT_TYPE_CONFIGS } from '../config/agents.js';
import { SKILL_DOMAINS } from '../config/skills.js';
import { LLMClient } from '../runtime/llm-client.js';

export interface HumanSpawnConfig {
  gender: 'male' | 'female';
  heritage: string;
  role: AgentTypeName;
  portId: string;
  seaZoneId: string;
  tick: number;
  nameOverride?: string;
  traitOverrides?: Partial<PersonaTraits>;
  attributeOverrides?: Partial<HumanAttributes>;
  skillOverrides?: Record<string, number>; // subSkillId -> starting level
  overlays?: string[];
}

// Role-specific skill baselines
const ROLE_SKILL_BASELINES: Record<string, Array<{ domain: string; subSkill: string; level: number }>> = {
  pirate_captain: [
    { domain: 'combat', subSkill: 'swordplay', level: 40 },
    { domain: 'combat', subSkill: 'tactics', level: 30 },
    { domain: 'leadership', subSkill: 'command', level: 35 },
    { domain: 'leadership', subSkill: 'intimidation', level: 30 },
    { domain: 'seamanship', subSkill: 'sail_handling', level: 25 },
  ],
  merchant_captain: [
    { domain: 'trade', subSkill: 'negotiation', level: 45 },
    { domain: 'trade', subSkill: 'appraisal', level: 40 },
    { domain: 'scholarship', subSkill: 'mathematics', level: 30 },
    { domain: 'seamanship', subSkill: 'navigation', level: 25 },
    { domain: 'survival', subSkill: 'provisioning', level: 20 },
  ],
  naval_officer: [
    { domain: 'combat', subSkill: 'tactics', level: 40 },
    { domain: 'combat', subSkill: 'gunnery', level: 35 },
    { domain: 'leadership', subSkill: 'command', level: 40 },
    { domain: 'seamanship', subSkill: 'navigation', level: 30 },
    { domain: 'leadership', subSkill: 'diplomacy', level: 20 },
  ],
  surgeon: [
    { domain: 'survival', subSkill: 'medicine', level: 60 },
    { domain: 'survival', subSkill: 'carpentry', level: 20 },
    { domain: 'scholarship', subSkill: 'literacy', level: 40 },
    { domain: 'scholarship', subSkill: 'mathematics', level: 20 },
  ],
  shipwright: [
    { domain: 'survival', subSkill: 'carpentry', level: 60 },
    { domain: 'craftsmanship', subSkill: 'blacksmithing', level: 40 },
    { domain: 'scholarship', subSkill: 'mathematics', level: 25 },
    { domain: 'craftsmanship', subSkill: 'ropemaking', level: 30 },
  ],
  tavern_keeper: [
    { domain: 'performing', subSkill: 'cooking', level: 45 },
    { domain: 'trade', subSkill: 'negotiation', level: 30 },
    { domain: 'performing', subSkill: 'storytelling', level: 25 },
    { domain: 'subterfuge', subSkill: 'intelligence', level: 20 },
    { domain: 'performing', subSkill: 'music', level: 15 },
  ],
  crew_member: [
    { domain: 'seamanship', subSkill: 'sail_handling', level: 20 },
    { domain: 'survival', subSkill: 'swimming', level: 15 },
  ],
  fence: [
    { domain: 'trade', subSkill: 'appraisal', level: 50 },
    { domain: 'subterfuge', subSkill: 'deception', level: 40 },
    { domain: 'trade', subSkill: 'negotiation', level: 35 },
    { domain: 'subterfuge', subSkill: 'intelligence', level: 30 },
  ],
  informant: [
    { domain: 'subterfuge', subSkill: 'intelligence', level: 50 },
    { domain: 'subterfuge', subSkill: 'deception', level: 35 },
    { domain: 'subterfuge', subSkill: 'stealth', level: 30 },
    { domain: 'scholarship', subSkill: 'literacy', level: 20 },
  ],
  plantation_owner: [
    { domain: 'agriculture', subSkill: 'planting', level: 40 },
    { domain: 'agriculture', subSkill: 'animal_husbandry', level: 30 },
    { domain: 'scholarship', subSkill: 'mathematics', level: 35 },
    { domain: 'scholarship', subSkill: 'literacy', level: 45 },
    { domain: 'trade', subSkill: 'negotiation', level: 25 },
  ],
  port_governor: [
    { domain: 'leadership', subSkill: 'diplomacy', level: 50 },
    { domain: 'scholarship', subSkill: 'literacy', level: 60 },
    { domain: 'leadership', subSkill: 'command', level: 35 },
    { domain: 'trade', subSkill: 'negotiation', level: 40 },
    { domain: 'scholarship', subSkill: 'mathematics', level: 30 },
  ],
  quartermaster: [
    { domain: 'survival', subSkill: 'provisioning', level: 40 },
    { domain: 'scholarship', subSkill: 'mathematics', level: 30 },
    { domain: 'leadership', subSkill: 'command', level: 25 },
    { domain: 'trade', subSkill: 'negotiation', level: 30 },
    { domain: 'trade', subSkill: 'appraisal', level: 25 },
  ],
  harbor_master: [
    { domain: 'scholarship', subSkill: 'mathematics', level: 40 },
    { domain: 'trade', subSkill: 'appraisal', level: 35 },
    { domain: 'scholarship', subSkill: 'literacy', level: 40 },
    { domain: 'trade', subSkill: 'negotiation', level: 25 },
  ],
  privateer_captain: [
    { domain: 'combat', subSkill: 'swordplay', level: 35 },
    { domain: 'combat', subSkill: 'tactics', level: 30 },
    { domain: 'seamanship', subSkill: 'navigation', level: 30 },
    { domain: 'leadership', subSkill: 'command', level: 25 },
    { domain: 'leadership', subSkill: 'diplomacy', level: 20 },
  ],
  pirate_hunter: [
    { domain: 'combat', subSkill: 'tactics', level: 35 },
    { domain: 'combat', subSkill: 'gunnery', level: 30 },
    { domain: 'subterfuge', subSkill: 'intelligence', level: 25 },
    { domain: 'leadership', subSkill: 'intimidation', level: 30 },
  ],
};

let llmClient: LLMClient | null = null;

function getLLMClient(): LLMClient {
  if (!llmClient) {
    llmClient = new LLMClient({ maxConcurrent: 4, timeoutMs: 30000, maxRetries: 1 });
  }
  return llmClient;
}

export async function spawnHuman(config: HumanSpawnConfig): Promise<Agent> {
  // 1. Validate combo
  const validation = validateSpawnCombo(config.gender, config.heritage, config.role);
  if (!validation.valid) {
    throw new Error(`Invalid spawn combo: ${validation.reason}`);
  }

  // 2. Generate name
  const name = config.nameOverride ?? generateSpawnName(config.heritage, config.gender);

  // 3. Roll attributes
  let attributes = rollAttributes(config.heritage, config.gender);
  if (config.attributeOverrides) {
    attributes = { ...attributes, ...config.attributeOverrides };
  }

  // 4. Roll persona traits
  const typeConfig = AGENT_TYPE_CONFIGS[config.role];
  const traitConstraints = typeConfig?.requiredTraits
    ? { min: typeConfig.requiredTraits }
    : undefined;
  const traits = rollTraits(traitConstraints, config.traitOverrides);

  // 5. Build starting skills
  const skills = buildStartingSkills(config.role, config.heritage, config.skillOverrides);

  // 6. Generate backstory via LLM
  const backstory = await generateBackstory(name, config.gender, config.heritage, config.role, traits, attributes, config.portId);

  // 7. Build persona profile (uses existing system, but inject LLM backstory)
  const persona = buildPersonaProfile(traits, name, config.role);
  persona.background = backstory;

  // 8. Create agent record
  const agentId = uuidv4();
  const agent: Omit<Agent, 'created_at' | 'updated_at'> = {
    id: agentId,
    type: config.role,
    name,
    port_id: config.portId,
    sea_zone_id: config.seaZoneId,
    ship_id: null,
    status: 'in_port',
    nationality: config.heritage,
    gender: config.gender,
    heritage: config.heritage,
    nickname: null,
    attributes: JSON.stringify(attributes),
    persona: JSON.stringify(persona),
    cash: 0,
    infamy: 0,
    last_decision_tick: 0,
    cooldown_until_tick: 0,
  };

  await AgentQueries.insert(agent);

  // 9. Insert skills
  for (const skill of skills) {
    await SkillQueries.upsert(
      agentId,
      skill.domain,
      skill.subSkill,
      skill.level,
      0,
      config.tick,
    );
  }

  return { ...agent, created_at: new Date(), updated_at: new Date() };
}

// Track used names across all spawns to prevent duplicates
const usedNames = new Set<string>();

/** Reset used names (call between sim runs if reseeding) */
export function resetUsedNames(): void { usedNames.clear(); }

function generateSpawnName(heritage: string, gender: 'male' | 'female'): string {
  const profile = HERITAGE_PROFILES[heritage];
  const namePool = profile?.namePool ?? 'english';

  // Try up to 20 times to get a unique name
  for (let attempt = 0; attempt < 20; attempt++) {
    const { firstName, lastName } = generateNameByNationality(namePool, gender);
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    if (!usedNames.has(fullName)) {
      usedNames.add(fullName);
      return fullName;
    }
  }

  // Fallback: append a number
  const { firstName, lastName } = generateNameByNationality(namePool, gender);
  const base = lastName ? `${firstName} ${lastName}` : firstName;
  let suffix = 2;
  while (usedNames.has(`${base} ${suffix}`)) suffix++;
  const uniqueName = `${base} ${suffix}`;
  usedNames.add(uniqueName);
  return uniqueName;
}

function buildStartingSkills(
  role: AgentTypeName,
  heritage: string,
  overrides?: Record<string, number>,
): Array<{ domain: string; subSkill: string; level: number }> {
  const skillMap = new Map<string, { domain: string; subSkill: string; level: number }>();

  // 1. Role baselines
  const baselines = ROLE_SKILL_BASELINES[role] ?? [];
  for (const skill of baselines) {
    const key = `${skill.domain}:${skill.subSkill}`;
    skillMap.set(key, { ...skill });
  }

  // 2. Heritage cultural bonuses (stack on top)
  const profile = HERITAGE_PROFILES[heritage];
  if (profile) {
    for (const cultural of profile.culturalSkills) {
      const key = `${cultural.domain}:${cultural.subSkill}`;
      const existing = skillMap.get(key);
      if (existing) {
        existing.level = Math.min(100, existing.level + cultural.bonus);
      } else {
        skillMap.set(key, { domain: cultural.domain, subSkill: cultural.subSkill, level: cultural.bonus });
      }
    }
  }

  // 3. Random jitter +/- 5
  for (const skill of skillMap.values()) {
    const jitter = Math.floor(Math.random() * 11) - 5; // -5 to +5
    skill.level = Math.max(0, Math.min(100, skill.level + jitter));
  }

  // 4. Apply overrides
  if (overrides) {
    for (const [subSkillId, level] of Object.entries(overrides)) {
      const existing = Array.from(skillMap.values()).find(s => s.subSkill === subSkillId);
      if (existing) {
        existing.level = level;
      } else {
        // Look up the correct domain from SKILL_DOMAINS
        const domain = findDomainForSubSkill(subSkillId);
        if (domain) {
          skillMap.set(`${domain}:${subSkillId}`, { domain, subSkill: subSkillId, level });
        }
      }
    }
  }

  return Array.from(skillMap.values());
}

function findDomainForSubSkill(subSkillId: string): string | null {
  for (const domain of Object.values(SKILL_DOMAINS)) {
    if (domain.subSkills.some(s => s.id === subSkillId)) {
      return domain.id;
    }
  }
  return null;
}

async function generateBackstory(
  name: string,
  gender: 'male' | 'female',
  heritage: string,
  role: AgentTypeName,
  traits: PersonaTraits,
  attributes: HumanAttributes,
  portId: string,
): Promise<string> {
  const profile = HERITAGE_PROFILES[heritage];
  const heritageName = profile?.name ?? heritage;

  // Build trait summary
  const traitSummary = Object.entries(traits)
    .filter(([, v]) => v > 65 || v < 35)
    .map(([k, v]) => `${k}: ${v > 65 ? 'high' : 'low'}`)
    .join(', ') || 'balanced temperament';

  // Build attribute summary
  const attrSummary = Object.entries(attributes)
    .filter(([, v]) => (v as number) > 70 || (v as number) < 30)
    .map(([k, v]) => `${k}: ${(v as number) > 70 ? 'exceptional' : 'poor'}`)
    .join(', ') || 'average build and mind';

  const roleName = role.replace(/_/g, ' ');
  const portName = portId.replace(/_/g, ' ');

  const prompt = `Generate a 2-3 paragraph backstory for a ${heritageName} ${gender} ${roleName} named ${name} in the Caribbean, circa 1715. Their personality: ${traitSummary}. Their physical/mental nature: ${attrSummary}. They are currently at ${portName}. Write in third person past tense. Include: their origin, how they came to the Caribbean, and a defining moment that shaped who they are. Keep it historically grounded. Do not use any markdown formatting.`;

  try {
    const client = getLLMClient();
    const response = await client.chatCompletion({
      messages: [
        { role: 'system', content: 'You are a historical fiction writer specializing in the Golden Age of Piracy (1710-1725). Write concise, vivid character backstories.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      maxTokens: 300,
    });
    return response.content.trim();
  } catch {
    // Fallback: use heritage background pool
    const backgrounds = profile?.backgrounds[gender] ?? ['A person of uncertain origins who appeared in the Caribbean.'];
    return backgrounds[Math.floor(Math.random() * backgrounds.length)]!;
  }
}

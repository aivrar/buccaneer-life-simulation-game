/**
 * Skill development through use.
 * Characters improve skills by exercising them; tracks XP
 * accumulation, level thresholds, and skill-based modifiers.
 */

export type SkillName =
  | 'gunnery'
  | 'sailing'
  | 'navigation'
  | 'swordplay'
  | 'tactics'
  | 'intimidation'
  | 'negotiation'
  | 'carpentry'
  | 'medicine'
  | 'leadership';

export interface Skill {
  name: SkillName;
  level: number;    // 1-10
  xp: number;       // current XP within level
  xpToNext: number; // XP required for next level
}

export interface SkillSet {
  agentId: string;
  skills: Map<SkillName, Skill>;
}

export function exerciseSkill(skill: Skill, xpGained: number): Skill {
  // TODO: Add XP, check for level-up
  // - Diminishing returns at higher levels
  const newXp = skill.xp + xpGained;
  if (newXp >= skill.xpToNext && skill.level < 10) {
    return {
      ...skill,
      level: skill.level + 1,
      xp: newXp - skill.xpToNext,
      xpToNext: Math.floor(skill.xpToNext * 1.5),
    };
  }
  return { ...skill, xp: newXp };
}

export function getSkillModifier(skill: Skill): number {
  // TODO: Convert skill level to a multiplier for relevant checks
  // Returns 0.5 (unskilled) to 2.0 (master)
  return 0.5 + skill.level * 0.15;
}

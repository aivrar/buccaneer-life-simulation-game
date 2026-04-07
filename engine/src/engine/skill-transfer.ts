import type { HumanAttributes } from '../runtime/types.js';

const BASE_LEARNING_RATE = 0.01;
const MIN_TEACHER_LEVEL = 30;

export interface SkillTransferInput {
  teacherSkillLevel: number;
  teacherPresence: number;
  studentSkillLevel: number;
  studentIntellect: number;
  familiarity: number;
}

export function calculateSkillTransfer(input: SkillTransferInput): number {
  const { teacherSkillLevel, teacherPresence, studentSkillLevel, studentIntellect, familiarity } = input;

  if (teacherSkillLevel < MIN_TEACHER_LEVEL) return 0;
  if (studentSkillLevel >= teacherSkillLevel) return 0;

  // Minimum effective familiarity of 10 — you learn something just by being near someone
  const effectiveFamiliarity = Math.max(10, familiarity);

  const rate = BASE_LEARNING_RATE
    * (teacherSkillLevel / 100)
    * (studentIntellect / 100)
    * (effectiveFamiliarity / 100);

  // Presence bonus: good teachers transfer faster
  const presenceMultiplier = 0.8 + (teacherPresence / 100) * 0.4; // 0.8 to 1.2

  const gain = rate * presenceMultiplier;

  // Cap: student can never exceed teacher's level via transfer
  const maxGain = teacherSkillLevel - studentSkillLevel;
  return Math.min(gain, maxGain);
}

export interface SkillTransferPair {
  teacherAgentId: string;
  studentAgentId: string;
  domain: string;
  subSkill: string;
  teacherLevel: number;
  studentLevel: number;
  gain: number;
}

export function findTransferOpportunities(
  agents: Array<{
    id: string;
    skills: Array<{ domain: string; sub_skill: string; level: number }>;
    attributes: HumanAttributes;
    familiarity: Map<string, number>; // agentId -> familiarity
  }>,
): SkillTransferPair[] {
  const pairs: SkillTransferPair[] = [];

  for (let i = 0; i < agents.length; i++) {
    for (let j = 0; j < agents.length; j++) {
      if (i === j) continue;

      const teacher = agents[i]!;
      const student = agents[j]!;
      const familiarity = teacher.familiarity.get(student.id) ?? 0;

      for (const tSkill of teacher.skills) {
        if (tSkill.level < MIN_TEACHER_LEVEL) continue;

        const sSkill = student.skills.find(
          s => s.domain === tSkill.domain && s.sub_skill === tSkill.sub_skill,
        );
        const studentLevel = sSkill?.level ?? 0;

        if (studentLevel >= tSkill.level) continue;

        const gain = calculateSkillTransfer({
          teacherSkillLevel: tSkill.level,
          teacherPresence: teacher.attributes.presence,
          studentSkillLevel: studentLevel,
          studentIntellect: student.attributes.intellect,
          familiarity,
        });

        if (gain > 0) {
          pairs.push({
            teacherAgentId: teacher.id,
            studentAgentId: student.id,
            domain: tSkill.domain,
            subSkill: tSkill.sub_skill,
            teacherLevel: tSkill.level,
            studentLevel,
            gain,
          });
        }
      }
    }
  }

  return pairs;
}

/**
 * Evidence accumulation and arrest thresholds.
 * Tracks the legal case building against pirate agents,
 * evidence quality, witness reliability, and arrest warrants.
 */

export type EvidenceType = 'witness' | 'cargo_match' | 'flag_report' | 'survivor_testimony' | 'informant' | 'captured_log';

export interface Evidence {
  type: EvidenceType;
  weight: number;        // 1-10 strength of evidence
  reliability: number;   // 0.0-1.0
  tickRecorded: number;
  portId: string;
}

export interface NavyCase {
  caseId: string;
  suspectId: string;
  evidence: Evidence[];
  totalWeight: number;
  warrantIssued: boolean;
  warrantTick: number | null;
  jurisdiction: string[];  // port IDs where warrant is active
}

export function addEvidence(navyCase: NavyCase, evidence: Evidence): NavyCase {
  // TODO: Add evidence, recalculate total weight
  const newEvidence = [...navyCase.evidence, evidence];
  const totalWeight = newEvidence.reduce((sum, e) => sum + e.weight * e.reliability, 0);
  return { ...navyCase, evidence: newEvidence, totalWeight };
}

export function checkWarrantThreshold(navyCase: NavyCase, threshold: number): NavyCase {
  // TODO: Issue warrant if evidence exceeds threshold
  if (navyCase.totalWeight >= threshold && !navyCase.warrantIssued) {
    return { ...navyCase, warrantIssued: true, warrantTick: Date.now() };
  }
  return navyCase;
}

export function createCase(suspectId: string): NavyCase {
  // TODO: Initialize an empty case file
  return {
    caseId: `case_${suspectId}`,
    suspectId,
    evidence: [],
    totalWeight: 0,
    warrantIssued: false,
    warrantTick: null,
    jurisdiction: [],
  };
}

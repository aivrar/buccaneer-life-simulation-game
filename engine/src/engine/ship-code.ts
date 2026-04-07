/**
 * Ship's code creation, enforcement, and amendments.
 * The articles of agreement that govern crew conduct,
 * share distribution, discipline, and decision-making.
 */

export interface ShipCode {
  shipId: string;
  articles: Article[];
  ratifiedTick: number;
  amendments: Amendment[];
}

export interface Article {
  id: string;
  topic: 'shares' | 'discipline' | 'combat_duty' | 'desertion' | 'plunder_division' | 'voting' | 'succession';
  text: string;
  severity: 'mild' | 'moderate' | 'harsh';
}

export interface Amendment {
  articleId: string;
  previousText: string;
  newText: string;
  proposedBy: string;
  voteTick: number;
  passed: boolean;
}

export function createDefaultCode(shipId: string, tick: number): ShipCode {
  // TODO: Generate a standard set of pirate articles
  return {
    shipId,
    articles: [],
    ratifiedTick: tick,
    amendments: [],
  };
}

export function proposeAmendment(code: ShipCode, articleId: string, newText: string, proposerId: string, tick: number): Amendment {
  // TODO: Create amendment proposal for crew vote
  return {
    articleId,
    previousText: '',
    newText,
    proposedBy: proposerId,
    voteTick: tick,
    passed: false,
  };
}

export function enforceCode(code: ShipCode, violation: string): number {
  // TODO: Determine punishment severity for a code violation
  // Returns loyalty penalty to apply
  return 0;
}

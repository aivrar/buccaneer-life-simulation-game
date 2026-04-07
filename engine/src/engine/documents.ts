/**
 * Documents and paperwork — the paper trail of the Caribbean.
 *
 * Letters of Marque: issued by governors, authorize attacking enemy shipping.
 *   - Specify which nations can be attacked
 *   - Have expiration dates
 *   - Can be forged (forgery skill)
 *   - Validated by navy during encounters
 *
 * Ship Papers: prove ship identity and ownership.
 *   - Carried by all legitimate vessels
 *   - Absence is suspicious (evidence for navy cases)
 *   - Can be forged
 */

import { v4 as uuid } from 'uuid';
import { execute, query } from '../db/sqlite.js';

export interface LetterOfMarque {
  id: string;
  holder_agent_id: string;
  issuing_nation: string;
  target_nations: string[];    // nations that can be legally attacked
  issued_tick: number;
  expires_tick: number;
  issuing_port_id: string;
  is_forged: boolean;
  forgery_quality: number;     // 0-100, only relevant if forged
}

export interface ShipPapers {
  id: string;
  ship_id: string;
  registered_name: string;
  registered_nation: string;
  registered_port: string;
  is_forged: boolean;
  forgery_quality: number;
}

// ---- Letter of Marque ----

export async function issueLetterOfMarque(
  holderId: string,
  issuingNation: string,
  targetNations: string[],
  issuingPortId: string,
  tick: number,
  durationTicks: number = 2400, // ~50 game days
): Promise<LetterOfMarque> {
  const letter: LetterOfMarque = {
    id: uuid(),
    holder_agent_id: holderId,
    issuing_nation: issuingNation,
    target_nations: targetNations,
    issued_tick: tick,
    expires_tick: tick + durationTicks,
    issuing_port_id: issuingPortId,
    is_forged: false,
    forgery_quality: 0,
  };

  await execute(
    'INSERT INTO documents (id, type, holder_agent_id, data, created_tick, expires_tick) VALUES (?, ?, ?, ?, ?, ?)',
    [letter.id, 'letter_of_marque', holderId, JSON.stringify(letter), tick, letter.expires_tick],
  );

  return letter;
}

export async function forgeLetterOfMarque(
  holderId: string,
  issuingNation: string,
  targetNations: string[],
  forgerySkill: number,
  tick: number,
): Promise<LetterOfMarque> {
  const quality = Math.min(95, forgerySkill + Math.floor(Math.random() * 20) - 10);

  const letter: LetterOfMarque = {
    id: uuid(),
    holder_agent_id: holderId,
    issuing_nation: issuingNation,
    target_nations: targetNations,
    issued_tick: tick,
    expires_tick: tick + 2400,
    issuing_port_id: 'unknown',
    is_forged: true,
    forgery_quality: quality,
  };

  await execute(
    'INSERT INTO documents (id, type, holder_agent_id, data, created_tick, expires_tick) VALUES (?, ?, ?, ?, ?, ?)',
    [letter.id, 'letter_of_marque', holderId, JSON.stringify(letter), tick, letter.expires_tick],
  );

  return letter;
}

export async function getLetterOfMarque(agentId: string, tick: number): Promise<LetterOfMarque | null> {
  const rows = await query<{ data: string }[]>(
    'SELECT data FROM documents WHERE holder_agent_id = ? AND type = \'letter_of_marque\' AND (expires_tick IS NULL OR expires_tick > ?)',
    [agentId, tick],
  );
  if (rows.length === 0) return null;
  return JSON.parse(rows[0]!.data);
}

/**
 * Validate a letter of marque during an encounter.
 * Returns whether the letter protects against the given target nation.
 * Forged letters have a chance of being detected.
 */
export function validateLetterOfMarque(
  letter: LetterOfMarque,
  targetNation: string,
  inspectorPerception: number,
  tick: number,
): { valid: boolean; detected: boolean; reason: string } {
  // Check expiration
  if (tick > letter.expires_tick) {
    return { valid: false, detected: false, reason: 'Letter has expired' };
  }

  // Check target nation
  if (!letter.target_nations.includes(targetNation)) {
    return { valid: false, detected: false, reason: `Letter does not authorize action against ${targetNation}` };
  }

  // Check forgery detection
  if (letter.is_forged) {
    // Detection chance: inspector perception vs forgery quality
    const detectionChance = Math.max(0, (inspectorPerception - letter.forgery_quality) / 100);
    if (Math.random() < detectionChance) {
      return { valid: false, detected: true, reason: 'Forged letter detected' };
    }
  }

  return { valid: true, detected: false, reason: 'Letter valid' };
}

// ---- Ship Papers ----

export async function registerShipPapers(
  shipId: string,
  name: string,
  nation: string,
  portId: string,
  tick: number,
): Promise<ShipPapers> {
  const papers: ShipPapers = {
    id: uuid(),
    ship_id: shipId,
    registered_name: name,
    registered_nation: nation,
    registered_port: portId,
    is_forged: false,
    forgery_quality: 0,
  };

  await execute(
    'INSERT INTO documents (id, type, holder_agent_id, data, created_tick, expires_tick) VALUES (?, ?, ?, ?, ?, ?)',
    [papers.id, 'ship_papers', shipId, JSON.stringify(papers), tick, null],
  );

  return papers;
}

export async function getShipPapers(shipId: string): Promise<ShipPapers | null> {
  const rows = await query<{ data: string }[]>(
    'SELECT data FROM documents WHERE holder_agent_id = ? AND type = \'ship_papers\' ORDER BY created_tick DESC LIMIT 1',
    [shipId],
  );
  if (rows.length === 0) return null;
  return JSON.parse(rows[0]!.data);
}

export async function forgeShipPapers(
  shipId: string,
  fakeName: string,
  fakeNation: string,
  fakePort: string,
  forgerySkill: number,
  tick: number,
): Promise<ShipPapers> {
  const quality = Math.min(95, forgerySkill + Math.floor(Math.random() * 20) - 10);

  const papers: ShipPapers = {
    id: uuid(),
    ship_id: shipId,
    registered_name: fakeName,
    registered_nation: fakeNation,
    registered_port: fakePort,
    is_forged: true,
    forgery_quality: quality,
  };

  await execute(
    'INSERT INTO documents (id, type, holder_agent_id, data, created_tick, expires_tick) VALUES (?, ?, ?, ?, ?, ?)',
    [papers.id, 'ship_papers', shipId, JSON.stringify(papers), tick, null],
  );

  return papers;
}

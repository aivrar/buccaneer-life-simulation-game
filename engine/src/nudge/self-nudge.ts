/**
 * Self-nudge: the agent's inner voice.
 * Narrative gut feeling injected at zero LLM cost.
 * Replaces bracket-tagged warnings with character-voice prose.
 *
 * Strategy and ambition voices are TYPE-AWARE — a fence thinks like a fence,
 * not like a pirate captain. This is critical for small-model inference quality.
 */

import type { AgentDataSnapshot } from '../strategy/narrative-data.js';
import type { ComputedValues } from '../strategy/narrative-compute.js';
import { getAgentType } from '../agents/registry.js';

// ── Agent type groups for voice selection ─────────────────
type AgentGroup = 'sea_captain' | 'port_authority' | 'port_trade' | 'healer' | 'aboard_ship' | 'landowner';

const TYPE_TO_GROUP: Record<string, AgentGroup> = {
  pirate_captain: 'sea_captain',
  merchant_captain: 'sea_captain',
  naval_officer: 'sea_captain',
  privateer_captain: 'sea_captain',
  pirate_hunter: 'sea_captain',
  port_governor: 'port_authority',
  harbor_master: 'port_authority',
  fence: 'port_trade',
  tavern_keeper: 'port_trade',
  shipwright: 'port_trade',
  informant: 'port_trade',
  surgeon: 'healer',
  crew_member: 'aboard_ship',
  quartermaster: 'aboard_ship',
  plantation_owner: 'landowner',
};

// ── Strategy voices (8 strategies × 6 groups) ────────────
const STRATEGY_VOICES: Record<string, Record<AgentGroup, string>> = {
  aggressive: {
    sea_captain: 'Your blood runs hot. You want action — a target, a fight, a prize. Sitting still is dying slowly.',
    port_authority: 'You rule with an iron hand. Weakness invites disobedience, and disobedience invites chaos.',
    port_trade: 'You press every advantage. When a desperate captain walks through your door, you squeeze.',
    healer: 'You are not gentle. You cut fast, sew hard, and waste no time on men who will not fight to live.',
    aboard_ship: 'You itch for action. Every calm day is a wasted day. You want blood, plunder, glory.',
    landowner: 'You expand. More acres, more labour, more ships carrying your goods. Rivals are obstacles to crush.',
  },
  cautious: {
    sea_captain: 'Caution has kept you alive this long. Move carefully. The grave is full of bold men.',
    port_authority: 'You govern carefully. Every decision has consequences — for the port, and for your neck.',
    port_trade: 'You survive by reading the room. Know who pays, who threatens, and when to disappear.',
    healer: 'Measure twice, cut once. A steady hand and a calm mind save more lives than bravery.',
    aboard_ship: 'Keep your head down. The men who volunteer for danger are the first ones buried at sea.',
    landowner: 'You protect what you have. The harvest comes to those who plan, not those who gamble.',
  },
  mercantile: {
    sea_captain: 'Profit is what matters. Find the margin, work the trade, let others bleed for glory.',
    port_authority: 'Tariffs, fees, licences — every ship that enters your harbour fills your coffers. That is governance.',
    port_trade: 'Every transaction is an opportunity. Buy low, sell high, and let the gold do the talking.',
    healer: 'Your skills are valuable. Charge what they are worth — a surgeon who works for free dies poor.',
    aboard_ship: 'You are here for the shares. Nothing more. When the shares dry up, so does your loyalty.',
    landowner: 'The land produces. The market consumes. You sit between them and take your cut.',
  },
  diplomatic: {
    sea_captain: 'Words are your weapons. Alliances, deals, arrangements — build the web that catches the flies.',
    port_authority: 'Balance every faction. Pirates, merchants, the Crown — keep them all useful and none too powerful.',
    port_trade: 'Connections are your trade. Every friend is a future favour. Every enemy is a closed door.',
    healer: 'You heal bodies, but you also mend trust. A surgeon who listens is trusted with secrets.',
    aboard_ship: 'You keep the peace between captain and crew. That is worth more than any sword.',
    landowner: 'Neighbours, governors, shipping agents — every relationship is an investment in your harvest.',
  },
  opportunistic: {
    sea_captain: 'Watch. Wait. When the moment comes, strike fast and take everything.',
    port_authority: 'Every crisis is an opportunity. When others panic, you profit.',
    port_trade: 'The desperate pay double. When the storm clears, you will own what they sold cheap.',
    healer: 'When plague strikes, you are the most important person in the port. Price accordingly.',
    aboard_ship: 'Watch the captain. Watch the crew. When the moment comes to move up, you will be ready.',
    landowner: 'When the price is right, you buy. When the crop is scarce, you sell. Timing is everything.',
  },
  loyal: {
    sea_captain: 'You stand by your people. Loyalty is the only currency that never inflates.',
    port_authority: 'You serve the Crown and your people. Duty is not a burden — it is who you are.',
    port_trade: 'Your regulars trust you. That trust took years to build and seconds to destroy. Honour it.',
    healer: 'You do not choose your patients. Rich or poor, pirate or merchant — you heal who needs healing.',
    aboard_ship: 'You stand by your shipmates. When the broadside comes, they are the only ones who matter.',
    landowner: 'Your workers depend on you. Your word is your bond. That is how empires are built.',
  },
  ambitious: {
    sea_captain: 'You were not born for small things. Every voyage is a step toward the fleet you will command.',
    port_authority: 'This port is a stepping stone. One day, a governorship. One day, a seat at the table of power.',
    port_trade: 'You will not stay small. One shop becomes a network. One contact becomes an empire.',
    healer: 'You will be the surgeon that governors send for. The one whose name opens doors.',
    aboard_ship: 'You were not born to take orders forever. Every voyage teaches you what the captain does wrong.',
    landowner: 'More land. More crops. More ships. You will be the richest name on this island.',
  },
  balanced: {
    sea_captain: 'Read the situation. Adapt. The captain who survives is the one who knows when to fight and when to run.',
    port_authority: 'A wise governor balances the ledger against the law, and knows when to look the other way.',
    port_trade: 'Read the room. Know who pays, who threatens, and when to look the other way.',
    healer: 'Steady hands and a clear mind. Do what must be done, no more, no less.',
    aboard_ship: 'Keep your head down, do your work, and watch which way the wind blows among the crew.',
    landowner: 'The harvest comes to those who plan. Force nothing. Let the seasons and the market do their work.',
  },
};

// ── Ambition voices (8 ambitions × 6 groups) ─────────────
const AMBITION_VOICES: Record<string, Record<AgentGroup, string>> = {
  wealth: {
    sea_captain: 'What you want, underneath it all, is gold. Enough gold that no one can ever touch you again.',
    port_authority: 'What you want is wealth. Enough that when the Crown forgets you, your purse remembers.',
    port_trade: 'What you want, underneath it all, is gold. Enough that you never need another man\'s favour.',
    healer: 'Skill should be rewarded. You want enough gold to retire in comfort, far from blood and bone.',
    aboard_ship: 'You are here for the plunder. When your share is fat enough, you walk away rich.',
    landowner: 'What drives you is wealth. More land, more crop, more ships — until your name means money itself.',
  },
  power: {
    sea_captain: 'What drives you is power — the kind that makes men lower their colours at the sight of your flag.',
    port_authority: 'What drives you is power — the kind that makes merchants beg and captains bow.',
    port_trade: 'What drives you is influence — the kind where nothing moves through this port without your say.',
    healer: 'Life and death pass through your hands. That is the truest power there is.',
    aboard_ship: 'What drives you is ambition. One day you will give the orders, not take them.',
    landowner: 'What drives you is power. The governor listens when you speak because your crop feeds the colony.',
  },
  fame: {
    sea_captain: 'You want your name spoken in every port from Nassau to Madagascar. Fame is immortality.',
    port_authority: 'You want to be remembered. The governor who tamed the pirates. The name in the history books.',
    port_trade: 'You want a reputation — the one everyone comes to, the name whispered in every back room.',
    healer: 'You want to be known as the finest surgeon in the Caribbean. The one they send for when all hope is lost.',
    aboard_ship: 'You want to be known. The sailor with the story. The one they sing about in taverns.',
    landowner: 'You want your estate spoken of across the colonies. The finest plantation in the islands.',
  },
  survival: {
    sea_captain: 'Survival. That is what matters. Let the glory-seekers die young. You intend to grow old.',
    port_authority: 'Survive the politics, survive the pirates, survive the Crown\'s displeasure. Everything else is secondary.',
    port_trade: 'Survive. That is what matters. Let the bold ones hang. You intend to die in your own bed.',
    healer: 'Keep yourself alive first. A dead surgeon heals no one.',
    aboard_ship: 'Survive. That is all. This ship, this captain, this voyage — just get through it alive.',
    landowner: 'Survive the hurricanes, survive the pirates, survive the market. Your land will outlast them all.',
  },
  respect: {
    sea_captain: 'What you hunger for is respect — to be the kind of captain men choose to follow.',
    port_authority: 'What you hunger for is respect — the kind where men obey because they trust you, not fear you.',
    port_trade: 'What you hunger for is a name. The one everyone comes to. The one everyone trusts.',
    healer: 'What you hunger for is respect. The surgeon whose word is law in matters of life and death.',
    aboard_ship: 'What you hunger for is respect from your mates. To be the one they trust when it matters.',
    landowner: 'What you hunger for is respect. The planter whose word carries weight in the assembly.',
  },
  freedom: {
    sea_captain: 'Freedom. No king, no master, no chain. That is worth dying for.',
    port_authority: 'What you want is autonomy. To govern as you see fit, without the Crown breathing down your neck.',
    port_trade: 'What you want is independence. No debts, no obligations, no man holding your strings.',
    healer: 'You answer to no captain and no governor. Your skill is your freedom. Guard it.',
    aboard_ship: 'You dream of your own ship, your own course. No one to answer to but the sea.',
    landowner: 'What drives you is independence. No creditor, no governor, no pirate lord tells you what to grow.',
  },
  revenge: {
    sea_captain: 'There is a debt to be paid. You will not rest until it is settled — in blood or gold.',
    port_authority: 'Someone wronged you. You have not forgotten. Power is the best revenge, and you have power.',
    port_trade: 'There is a score to settle. You remember every slight, and you repay them all.',
    healer: 'Someone let a patient die who should have lived. You carry that weight. You will not forget.',
    aboard_ship: 'Someone wronged you. On this ship or the last. The debt remains.',
    landowner: 'Someone took from you — land, reputation, or blood. You will have it back.',
  },
  legacy: {
    sea_captain: 'You want to build something that outlasts you. A name. A fleet. An empire.',
    port_authority: 'You want to build something that outlasts you. A port that thrives for generations.',
    port_trade: 'You want to build something that outlasts you. A network. A reputation that survives your death.',
    healer: 'You want to teach what you know. To leave behind surgeons who learned from the best.',
    aboard_ship: 'You want to be remembered by your shipmates. The one who stood firm when it mattered.',
    landowner: 'You want to build a dynasty. Land that passes to your children and their children after.',
  },
};

// ── Main builder ──────────────────────────────────────────

export function buildSelfNudge(snapshot: AgentDataSnapshot, computed: ComputedValues): string {
  const { agent, port, zone } = snapshot;
  const lines: string[] = [];
  const group = TYPE_TO_GROUP[agent.type] ?? 'port_trade';

  // --- Imprisonment ---
  if (agent.status === 'imprisoned') {
    lines.push('You are in chains. The walls are close, the air is foul, and your options are few. Every moment here is a moment closer to the noose — or a chance to bargain your way free.');
    return lines.join(' ');
  }

  // --- Location danger assessment ---
  if (port && !port.pirate_friendly && isPirateType(agent.type)) {
    if (port.corruption > 60) {
      const corruptionWord = port.corruption > 80 ? 'deeply corrupt' : 'corrupt enough';
      lines.push(`${port.name} is ${port.controller} territory, and you are not welcome — but the officials here are ${corruptionWord}. Coin might keep you safe. Might.`);
    } else {
      lines.push(`${port.name} is ${port.controller} territory. You should not be here. The fort guns could turn on you, and the harbormaster knows a pirate when he sees one. Move quickly or not at all.`);
    }
  } else if (port && port.pirate_friendly && isPirateType(agent.type)) {
    lines.push(`${port.name} is friendly ground — for now.`);
  }

  // --- Patrol level ---
  if (computed.patrolLevel === 'high' || computed.patrolLevel === 'very_high') {
    const zoneName = zone?.name ?? 'these waters';
    lines.push(`Navy patrols are thick in ${zoneName}. Every sail on the horizon could be a man-of-war.`);
  }

  // --- Weather danger ---
  if (snapshot.weather) {
    const condition = snapshot.weather.condition;
    if (condition === 'hurricane') {
      lines.push('A hurricane is upon you. God help you if you are at sea.');
    } else if (condition === 'storm') {
      if (group === 'sea_captain' || group === 'aboard_ship') {
        lines.push('A storm is building. The smart captain finds shelter; the reckless one finds the bottom.');
      } else {
        lines.push('A storm is building. Ships will seek port. Trouble — or opportunity — comes with them.');
      }
    } else if (condition === 'becalmed') {
      if (group === 'sea_captain' || group === 'aboard_ship') {
        lines.push('The wind has died. No sailing until it returns. The water stores will not last forever.');
      } else {
        lines.push('The wind has died. Ships are trapped at sea. Trade will slow until the breeze returns.');
      }
    } else if (condition === 'fog') {
      lines.push('Fog blankets everything. It hides you, but it hides everyone else too.');
    }
  }

  // --- Hurricane season ---
  if (computed.isHurricaneSeason) {
    lines.push('Hurricane season hangs over everything. The sky can turn murderous with half a day\'s warning.');
  }

  // --- Ship condition urgency (only for agents with ships) ---
  if (snapshot.ship && (group === 'sea_captain' || group === 'aboard_ship')) {
    if (snapshot.ship.hull < 30) {
      lines.push('Your ship is dying beneath you. Without repairs, the next heavy sea will finish her.');
    }
    if (computed.daysOfFood < 3) {
      lines.push(`${computed.foodDesc}. After that, the crew eats their anger.`);
    }
    if (computed.daysOfWater < 2) {
      lines.push('Water is almost gone. This is no longer a problem to solve tomorrow.');
    }
  }

  // --- Bounty/warrant ---
  if (computed.warrantIssued) {
    lines.push('There is a warrant for your arrest. Any Navy vessel that identifies you will try to take you.');
  }
  if (computed.bountyDesc) {
    lines.push(`${computed.bountyDesc}. That kind of money makes friends into hunters.`);
  }

  // --- Hot cargo urgency (pirates/privateers with stolen goods) ---
  if (computed.hotCargoCount > 0 && isPirateType(agent.type)) {
    if (agent.status === 'in_port') {
      lines.push(`You have ${computed.hotCargoCount} stolen goods in your hold. SELL THEM NOW — use sell_plunder before the authorities find them. Every hour you wait, the risk grows.`);
    } else if (agent.status === 'at_sea') {
      lines.push(`You are carrying ${computed.hotCargoCount} pieces of hot cargo. Get to port and sell them through a fence before you are caught.`);
    }
  }

  // --- Crew morale (only for captains/crew) ---
  if (snapshot.ship && (group === 'sea_captain' || group === 'aboard_ship')) {
    if (computed.mutinyRisk === 'imminent') {
      lines.push('The crew is on the edge of mutiny. Act now — address their grievances, show strength, or lose everything.');
    } else if (computed.mutinyRisk === 'high') {
      lines.push('The crew is restless and angry. Mutiny is no longer unthinkable.');
    }
  }

  // --- Strategy voice (type-aware) ---
  const strategy = agent.persona?.strategyHint;
  if (strategy) {
    const voice = STRATEGY_VOICES[strategy]?.[group];
    if (voice) lines.push(voice);
  }

  // --- Deepest ambition (type-aware) ---
  const ambitions = agent.persona?.ambitions;
  if (ambitions && ambitions.length > 0) {
    const voice = AMBITION_VOICES[ambitions[0]!]?.[group];
    if (voice) lines.push(voice);
  }

  // --- Overlay decision hints (type-specific behavioral nudges) ---
  const registeredType = getAgentType(agent.type);
  if (registeredType?.overlay?.decisionHints?.length) {
    lines.push(registeredType.overlay.decisionHints[0]!);
  }

  if (lines.length === 0) {
    lines.push('You take stock of your situation and consider your next move.');
  }

  return lines.join(' ');
}

function isPirateType(type: string): boolean {
  return type === 'pirate_captain' || type === 'privateer_captain' || type === 'pirate_hunter';
}

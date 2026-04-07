export interface SkillDomain {
  id: string;
  name: string;
  subSkills: SubSkill[];
}

export interface SubSkill {
  id: string;
  name: string;
  description: string;
}

export const SKILL_DOMAINS: Record<string, SkillDomain> = {
  seamanship: {
    id: 'seamanship',
    name: 'Seamanship',
    subSkills: [
      { id: 'navigation', name: 'Navigation', description: 'Reading charts, stars, and currents' },
      { id: 'sail_handling', name: 'Sail Handling', description: 'Managing sails in all conditions' },
      { id: 'weather_reading', name: 'Weather Reading', description: 'Predicting weather changes' },
      { id: 'ship_handling', name: 'Ship Handling', description: 'Maneuvering in combat and port' },
    ],
  },
  combat: {
    id: 'combat',
    name: 'Combat',
    subSkills: [
      { id: 'gunnery', name: 'Gunnery', description: 'Accuracy and timing of cannon fire' },
      { id: 'swordplay', name: 'Swordplay', description: 'Cutlass and boarding combat' },
      { id: 'marksmanship', name: 'Marksmanship', description: 'Pistol and musket accuracy' },
      { id: 'boarding', name: 'Boarding', description: 'Leading boarding actions' },
      { id: 'tactics', name: 'Tactics', description: 'Naval battle strategy' },
    ],
  },
  trade: {
    id: 'trade',
    name: 'Trade',
    subSkills: [
      { id: 'negotiation', name: 'Negotiation', description: 'Getting better prices and deals' },
      { id: 'appraisal', name: 'Appraisal', description: 'Estimating cargo value accurately' },
      { id: 'smuggling', name: 'Smuggling', description: 'Moving goods past authorities' },
      { id: 'fencing', name: 'Fencing', description: 'Moving stolen goods through fences' },
    ],
  },
  leadership: {
    id: 'leadership',
    name: 'Leadership',
    subSkills: [
      { id: 'command', name: 'Command', description: 'Maintaining crew discipline and morale' },
      { id: 'intimidation', name: 'Intimidation', description: 'Using fear to control situations' },
      { id: 'inspiration', name: 'Inspiration', description: 'Motivating crew through hardship' },
      { id: 'diplomacy', name: 'Diplomacy', description: 'Negotiating with other captains and officials' },
    ],
  },
  survival: {
    id: 'survival',
    name: 'Survival',
    subSkills: [
      { id: 'medicine', name: 'Medicine', description: 'Treating wounds and disease' },
      { id: 'carpentry', name: 'Carpentry', description: 'Ship repair and maintenance' },
      { id: 'provisioning', name: 'Provisioning', description: 'Managing food and water' },
      { id: 'swimming', name: 'Swimming', description: 'Survival in water' },
    ],
  },
  subterfuge: {
    id: 'subterfuge',
    name: 'Subterfuge',
    subSkills: [
      { id: 'deception', name: 'Deception', description: 'Lying, false flags, disguises' },
      { id: 'intelligence', name: 'Intelligence', description: 'Gathering and using information' },
      { id: 'stealth', name: 'Stealth', description: 'Moving undetected' },
      { id: 'forgery', name: 'Forgery', description: 'Creating false documents and letters of marque' },
    ],
  },
  craftsmanship: {
    id: 'craftsmanship',
    name: 'Craftsmanship',
    subSkills: [
      { id: 'blacksmithing', name: 'Blacksmithing', description: 'Forging tools, nails, fittings' },
      { id: 'cooperage', name: 'Cooperage', description: 'Barrel-making for cargo and provisions' },
      { id: 'ropemaking', name: 'Ropemaking', description: 'Rigging, cordage, nets' },
      { id: 'sailmaking', name: 'Sailmaking', description: 'Canvas work, sail repair' },
    ],
  },
  agriculture: {
    id: 'agriculture',
    name: 'Agriculture',
    subSkills: [
      { id: 'planting', name: 'Planting', description: 'Crop cultivation knowledge' },
      { id: 'animal_husbandry', name: 'Animal Husbandry', description: 'Livestock, mules, horses' },
      { id: 'distilling', name: 'Distilling', description: 'Rum, spirits production' },
      { id: 'fishing', name: 'Fishing', description: 'Line, net, spearfishing' },
    ],
  },
  scholarship: {
    id: 'scholarship',
    name: 'Scholarship',
    subSkills: [
      { id: 'literacy', name: 'Literacy', description: 'Reading and writing — rare in this era' },
      { id: 'mathematics', name: 'Mathematics', description: 'Accounting, navigation calculations' },
      { id: 'cartography', name: 'Cartography', description: 'Map reading and creation' },
      { id: 'languages', name: 'Languages', description: 'Polyglot ability — Spanish, French, Dutch, Portuguese, indigenous' },
    ],
  },
  performing: {
    id: 'performing',
    name: 'Performing',
    subSkills: [
      { id: 'music', name: 'Music', description: 'Shanties, fiddle, drum — crew morale' },
      { id: 'storytelling', name: 'Storytelling', description: 'Oral tradition, inspiring tales' },
      { id: 'cooking', name: 'Cooking', description: 'Galley work, provisioning quality' },
      { id: 'oratory', name: 'Oratory', description: 'Speeches, sermons, rallying cries' },
    ],
  },
};

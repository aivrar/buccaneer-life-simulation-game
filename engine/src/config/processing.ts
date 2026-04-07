// Processing chains — how raw materials become finished plunderable goods
// Each chain defines: input → facility → output (+ optional byproduct)
// Processing happens at specific ports with specific labor and time requirements
//
// These chains are what fill ships' holds with the goods pirates steal.

// ============================================================
// Processing Chain Definition
// ============================================================

export type FacilityType =
  | 'sugar_mill'        // crush cane, extract juice
  | 'boiling_house'     // boil juice into raw sugar
  | 'distillery'        // ferment and distill molasses into rum
  | 'curing_barn'       // air-dry or fire-cure tobacco leaves
  | 'chocolate_house'   // roast and grind cacao beans
  | 'indigo_vat'        // ferment, oxidize, and dry indigo
  | 'tannery'           // tan raw hides into leather
  | 'refinery'          // refine raw sugar into white sugar
  | 'tar_kiln'          // burn pine for tar and pitch
  | 'rope_walk'         // twist fibers into rope
  | 'sail_loft'         // weave and cut sailcloth
  | 'mint'              // stamp silver/gold into coins

export interface ProcessingChain {
  id: string;
  name: string;
  facilityType: FacilityType;
  inputCargo: string;              // cargo type consumed
  inputPerUnit: number;            // units of input per unit of output
  outputCargo: string;             // cargo type produced
  outputPerCycle: number;          // units produced per processing cycle
  byproductCargo?: string;         // optional byproduct
  byproductPerCycle?: number;
  cycleTimeTicks: number;          // ticks per processing cycle (1 tick = 6 hours)
  processingPorts: string[];       // ports where this processing happens
  laborPerFacility: number;        // workers needed (enslaved or free)
  description: string;
}

export const PROCESSING_CHAINS: ProcessingChain[] = [
  // ══════════════════════════════════════════════════════════
  // SUGAR COMPLEX — the most important processing chain
  // Cane → raw sugar + molasses → rum
  // ══════════════════════════════════════════════════════════

  {
    id: 'sugar_milling',
    name: 'Sugar Milling & Boiling',
    facilityType: 'sugar_mill',
    inputCargo: 'sugar',           // raw sugarcane (represented as sugar in plantation output)
    inputPerUnit: 1.0,
    outputCargo: 'sugar',          // muscovado (raw brown sugar) packed in hogsheads
    outputPerCycle: 1.0,
    byproductCargo: 'molasses',    // ~30% of sugar weight becomes molasses
    byproductPerCycle: 0.3,
    cycleTimeTicks: 2,             // half a day per batch
    processingPorts: ['port_royal', 'bridgetown', 'basseterre', 'havana', 'santo_domingo', 'petit_goave'],
    laborPerFacility: 40,          // sugar mills need large crews — crushing, boiling, ladling
    description: 'Sugarcane is crushed in ox- or water-powered mills, juice boiled in a "train" of copper kettles at progressively lower temperatures, then packed into hogsheads with holes to drain molasses. Backbreaking, dangerous work — boiling sugar causes horrific burns. Each plantation has its own mill.',
  },
  {
    id: 'rum_distilling',
    name: 'Rum Distilling',
    facilityType: 'distillery',
    inputCargo: 'molasses',
    inputPerUnit: 1.5,             // 1.5 units molasses per unit rum
    outputCargo: 'rum',
    outputPerCycle: 1.0,
    cycleTimeTicks: 4,             // 1 day for fermentation + distillation cycle
    processingPorts: ['port_royal', 'bridgetown', 'basseterre', 'havana', 'nassau', 'petit_goave', 'boston'],
    laborPerFacility: 8,
    description: 'Molasses is mixed with water (and sometimes dunder — leftover wash), fermented for several days, then distilled in copper pot stills. Caribbean rum is robust and fiery. Boston distills imported Caribbean molasses into New England rum — cheaper, rougher, traded to Africa for slaves.',
  },
  {
    id: 'sugar_refining',
    name: 'Sugar Refining',
    facilityType: 'refinery',
    inputCargo: 'sugar',           // raw muscovado
    inputPerUnit: 1.5,             // 1.5 units raw → 1 unit refined (loses impurities)
    outputCargo: 'refined_sugar',
    outputPerCycle: 1.0,
    cycleTimeTicks: 8,             // 2 days per batch
    processingPorts: ['amsterdam', 'london'],  // refined in EUROPE, not Caribbean
    laborPerFacility: 20,
    description: 'Raw muscovado sugar shipped to European refineries is dissolved, filtered through charcoal, reboiled, and poured into cone-shaped moulds. Amsterdam has the most refineries — the Dutch buy raw Caribbean sugar and sell refined white sugar across Europe at massive profit.',
  },

  // ══════════════════════════════════════════════════════════
  // TOBACCO — curing is the critical step
  // ══════════════════════════════════════════════════════════

  {
    id: 'tobacco_curing',
    name: 'Tobacco Curing',
    facilityType: 'curing_barn',
    inputCargo: 'tobacco',         // raw leaf
    inputPerUnit: 1.2,             // some loss in curing
    outputCargo: 'cured_tobacco',
    outputPerCycle: 1.0,
    cycleTimeTicks: 24,            // 6 days (historically 4-8 weeks, compressed for gameplay)
    processingPorts: ['havana', 'charles_town'],
    laborPerFacility: 10,
    description: 'Harvested tobacco leaves are hung in large barns to air-cure (Cuban method) or fire-cure (Virginia/Carolina method). The process takes 4-8 weeks. Temperature and humidity must be controlled — too wet and the leaf rots, too dry and it crumbles. Havana\'s cured leaf commands the highest prices in the world.',
  },

  // ══════════════════════════════════════════════════════════
  // CHOCOLATE — grinding cacao into drink/paste
  // ══════════════════════════════════════════════════════════

  {
    id: 'chocolate_processing',
    name: 'Chocolate Processing',
    facilityType: 'chocolate_house',
    inputCargo: 'cacao',
    inputPerUnit: 1.0,
    outputCargo: 'chocolate',
    outputPerCycle: 0.8,           // some waste in roasting/grinding
    cycleTimeTicks: 4,
    processingPorts: ['veracruz', 'cartagena', 'havana', 'seville_cadiz', 'amsterdam'],
    laborPerFacility: 6,
    description: 'Cacao beans are roasted over fire, shells cracked and removed (winnowing), then nibs ground on a heated metate stone into a thick paste. Mixed with sugar, vanilla, and spices to make drinking chocolate. The drink is a growing fashion in European courts and coffeehouses.',
  },

  // ══════════════════════════════════════════════════════════
  // INDIGO — chemical processing of the dye
  // ══════════════════════════════════════════════════════════

  {
    id: 'indigo_processing',
    name: 'Indigo Processing',
    facilityType: 'indigo_vat',
    inputCargo: 'indigo',          // raw plant
    inputPerUnit: 10.0,            // enormous volume of plant per unit of dye
    outputCargo: 'indigo',         // processed dye cakes (same cargo, now tradeable)
    outputPerCycle: 1.0,
    cycleTimeTicks: 6,             // soak + beat + settle + dry
    processingPorts: ['charles_town', 'petit_goave', 'santo_domingo', 'cartagena'],
    laborPerFacility: 15,
    description: 'Cut indigo plants are soaked in stone-lined vats until the leaves ferment and release the blue pigment. The liquid is drained to a second vat and beaten vigorously to oxidize the indigo. It settles to the bottom, is strained, cut into cakes, and dried. The stench is unbearable — processing vats are kept far from habitation.',
  },

  // ══════════════════════════════════════════════════════════
  // LEATHER — tanning hides
  // ══════════════════════════════════════════════════════════

  {
    id: 'hide_tanning',
    name: 'Hide Tanning',
    facilityType: 'tannery',
    inputCargo: 'hides',
    inputPerUnit: 1.0,
    outputCargo: 'leather',
    outputPerCycle: 0.8,           // some hides spoil or are rejected
    cycleTimeTicks: 16,            // 4 days (historically months, compressed)
    processingPorts: ['havana', 'santo_domingo', 'cartagena', 'london', 'seville_cadiz'],
    laborPerFacility: 8,
    description: 'Raw hides are soaked in lime to remove hair, scraped clean, then soaked in tannin (from bark or mangrove) for weeks to months. The resulting leather is used for shoes, belts, bags, saddles, book bindings, and bucket brigades. Tanneries stink — located downwind of settlements.',
  },

  // ══════════════════════════════════════════════════════════
  // NAVAL STORES — pitch and tar from pine
  // ══════════════════════════════════════════════════════════

  {
    id: 'tar_production',
    name: 'Tar & Pitch Production',
    facilityType: 'tar_kiln',
    inputCargo: 'naval_stores',    // raw pine resin and wood
    inputPerUnit: 1.0,
    outputCargo: 'naval_stores',   // processed tar, pitch, turpentine
    outputPerCycle: 1.0,
    cycleTimeTicks: 8,
    processingPorts: ['charles_town', 'boston'],
    laborPerFacility: 12,
    description: 'Longleaf pine is tapped for resin (turpentine) or stacked in earth-covered kilns and slowly burned to produce tar. Tar is further boiled to make pitch. These products waterproof ship hulls, preserve rope, and coat rigging. Carolina supplies the Royal Navy under bounty contracts.',
  },

  // ══════════════════════════════════════════════════════════
  // SHIP SUPPLIES — rope and sail production
  // ══════════════════════════════════════════════════════════

  {
    id: 'rope_making',
    name: 'Rope Making',
    facilityType: 'rope_walk',
    inputCargo: 'textiles',        // raw hemp/fiber (abstracted)
    inputPerUnit: 0.5,
    outputCargo: 'cordage',
    outputPerCycle: 1.0,
    cycleTimeTicks: 4,
    processingPorts: ['london', 'amsterdam', 'boston'],
    laborPerFacility: 10,
    description: 'Hemp or manila fibers are twisted into yarn, then laid into strands, then twisted together into rope on a long "rope walk" — a narrow building hundreds of feet long. Every ship needs miles of rope. Boston\'s rope walks supply the colonial fleet.',
  },
  {
    id: 'sail_making',
    name: 'Sail Making',
    facilityType: 'sail_loft',
    inputCargo: 'textiles',        // canvas/flax (abstracted)
    inputPerUnit: 0.5,
    outputCargo: 'sailcloth',
    outputPerCycle: 1.0,
    cycleTimeTicks: 6,
    processingPorts: ['london', 'amsterdam'],
    laborPerFacility: 8,
    description: 'Flax or hemp woven into heavy canvas, then cut and sewn by sailmakers in large lofts. A ship of the line carries over an acre of sail. Sailcloth is a constant need — sun, wind, and salt rot canvas within a year in the tropics.',
  },

  // ══════════════════════════════════════════════════════════
  // MINTING — turning raw metal into money
  // ══════════════════════════════════════════════════════════

  {
    id: 'silver_minting',
    name: 'Silver Minting',
    facilityType: 'mint',
    inputCargo: 'silver',
    inputPerUnit: 1.0,
    outputCargo: 'coins',
    outputPerCycle: 8.0,           // 1 bar = 8 pieces of eight
    cycleTimeTicks: 1,
    processingPorts: ['veracruz', 'portobelo', 'seville_cadiz'],
    laborPerFacility: 15,
    description: 'Silver bars are assayed, cut into blanks (cobs), and hand-struck with dies bearing the Spanish royal arms. The resulting "pieces of eight" (8 reales) are the world\'s reserve currency — accepted from Canton to Cairo. Mexico City\'s mint is the busiest. Portobelo mints during the fair. Cobs are rough-cut; milled coins from Spain are more regular.',
  },
];

// ============================================================
// Port processing capacity — which ports have which facilities
// ============================================================

export interface PortProcessingProfile {
  portId: string;
  facilities: FacilityType[];
  notes: string;
}

export const PORT_PROCESSING: Record<string, PortProcessingProfile> = {
  port_royal: {
    portId: 'port_royal',
    facilities: ['sugar_mill', 'distillery'],
    notes: 'Jamaica has hundreds of sugar mills in the interior, each plantation with its own. Rum distilleries at Port Royal and across the island. No refining — raw sugar shipped to London.',
  },
  bridgetown: {
    portId: 'bridgetown',
    facilities: ['sugar_mill', 'distillery'],
    notes: 'Barbados is the most efficient sugar producer. Every plantation has a windmill-powered sugar works. Multiple distilleries. Mount Gay distillery (1703) is already operating.',
  },
  basseterre: {
    portId: 'basseterre',
    facilities: ['sugar_mill', 'distillery'],
    notes: 'St. Kitts sugar estates each have their own mill and boiling house. Small distilleries produce rum.',
  },
  havana: {
    portId: 'havana',
    facilities: ['sugar_mill', 'distillery', 'curing_barn', 'tannery', 'chocolate_house'],
    notes: 'Havana has the most diverse processing of any Caribbean port. Sugar ingenios, tobacco curing barns in Vuelta Abajo, tanneries for Cuban cattle hides, and chocolate processing from Tabasco cacao.',
  },
  santo_domingo: {
    portId: 'santo_domingo',
    facilities: ['sugar_mill', 'distillery', 'tannery'],
    notes: 'Declining sugar industry but mills still operate. Tanneries process hides from the vast cattle herds of the central plains.',
  },
  petit_goave: {
    portId: 'petit_goave',
    facilities: ['sugar_mill', 'distillery', 'indigo_vat'],
    notes: 'French Saint-Domingue is rapidly expanding. New sugar mills and indigo processing vats. Rum distilleries produce rhum agricole from fresh cane juice.',
  },
  cartagena: {
    portId: 'cartagena',
    facilities: ['tannery', 'chocolate_house', 'indigo_vat'],
    notes: 'Cartagena processes goods from the interior — tanning hides, grinding cacao into chocolate, processing indigo. Also a transit point for emeralds and gold needing no processing.',
  },
  veracruz: {
    portId: 'veracruz',
    facilities: ['chocolate_house', 'mint'],
    notes: 'Veracruz processes cacao from Tabasco into chocolate. The Mexico City mint (accessible via Veracruz) is the busiest in the empire, stamping silver cobs.',
  },
  portobelo: {
    portId: 'portobelo',
    facilities: ['mint'],
    notes: 'Portobelo mints coins during the treasure fair. Otherwise minimal processing — everything passes through in transit.',
  },
  charles_town: {
    portId: 'charles_town',
    facilities: ['indigo_vat', 'tar_kiln', 'curing_barn'],
    notes: 'Carolina processes indigo, cures tobacco, and operates tar kilns in the pine forests. The naval stores industry is vital to the Royal Navy.',
  },
  boston: {
    portId: 'boston',
    facilities: ['distillery', 'tar_kiln', 'rope_walk'],
    notes: 'Boston\'s distilleries convert imported Caribbean molasses into New England rum — the fuel of the slave trade triangle. Rope walks on the waterfront. Some tar production from New Hampshire pines.',
  },
  nassau: {
    portId: 'nassau',
    facilities: ['distillery'],
    notes: 'A crude distillery or two — pirates make their own kill-devil rum from stolen molasses. No other manufacturing to speak of.',
  },
  london: {
    portId: 'london',
    facilities: ['refinery', 'tannery', 'rope_walk', 'sail_loft'],
    notes: 'London has sugar refineries, tanneries, rope walks at Woolwich, and sail lofts at the royal dockyards. The imperial manufacturing hub.',
  },
  amsterdam: {
    portId: 'amsterdam',
    facilities: ['refinery', 'chocolate_house', 'rope_walk', 'sail_loft'],
    notes: 'Amsterdam has more sugar refineries than any city in Europe. Dutch chocolate houses process Caribbean cacao. WIC rope walks and sail lofts supply the fleet.',
  },
  seville_cadiz: {
    portId: 'seville_cadiz',
    facilities: ['chocolate_house', 'tannery', 'mint'],
    notes: 'Seville\'s Casa de Contratación oversees all processing of colonial goods. The royal mint stamps colonial silver. Chocolate houses and tanneries process imports.',
  },
};
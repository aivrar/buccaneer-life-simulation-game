// Named plantations near each port from PHYSICAL_WORLD.md
// With production data for the economy system

export type PlantationType = 'sugar' | 'tobacco' | 'rice' | 'coffee' | 'mixed' | 'cotton' | 'indigo' | 'cacao' | 'ginger' | 'pimento' | 'timber' | 'naval_stores' | 'salt' | 'aloe' | 'palm_oil';

export interface Plantation {
  id: string;
  name: string;
  portId: string;
  type: PlantationType;
  established: number;
  acres: number;
  enslavedWorkers: number;
  annualOutput: number;         // units of primary cargo per year
  primaryCargo: string;         // cargo type ID
  description: string;
}

export const PLANTATIONS: Plantation[] = [
  // Jamaica (Port Royal / Kingston)
  { id: 'drax_hall_jamaica', name: 'Drax Hall', portId: 'port_royal', type: 'sugar', established: 1669, acres: 500, enslavedWorkers: 200, annualOutput: 150, primaryCargo: 'sugar', description: 'One of the oldest sugar estates in Jamaica.' },
  { id: 'rose_hall', name: 'Rose Hall', portId: 'port_royal', type: 'sugar', established: 1700, acres: 400, enslavedWorkers: 150, annualOutput: 120, primaryCargo: 'sugar', description: 'Sugar estate — the great house will become famous.' },
  { id: 'good_hope', name: 'Good Hope', portId: 'port_royal', type: 'sugar', established: 1680, acres: 600, enslavedWorkers: 250, annualOutput: 180, primaryCargo: 'sugar', description: 'Large sugar estate in Trelawny parish.' },
  { id: 'worthy_park', name: 'Worthy Park', portId: 'port_royal', type: 'sugar', established: 1670, acres: 550, enslavedWorkers: 220, annualOutput: 160, primaryCargo: 'sugar', description: 'Sugar estate in St. Catherine parish, operating since the 1670s.' },
  { id: 'green_park', name: 'Green Park', portId: 'port_royal', type: 'mixed', established: 1690, acres: 300, enslavedWorkers: 100, annualOutput: 80, primaryCargo: 'sugar', description: 'Coffee and sugar estate.' },

  // Barbados (Bridgetown)
  { id: 'drax_hall_barbados', name: 'Drax Hall Estate', portId: 'bridgetown', type: 'sugar', established: 1640, acres: 600, enslavedWorkers: 280, annualOutput: 200, primaryCargo: 'sugar', description: 'One of the oldest sugar plantations in Barbados. The Drax family pioneered Caribbean sugar.' },
  { id: 'sunbury', name: 'Sunbury Plantation', portId: 'bridgetown', type: 'sugar', established: 1660, acres: 350, enslavedWorkers: 160, annualOutput: 120, primaryCargo: 'sugar', description: 'Established by Matthew Chapman.' },
  { id: 'codrington', name: 'Codrington Estates', portId: 'bridgetown', type: 'sugar', established: 1680, acres: 763, enslavedWorkers: 315, annualOutput: 250, primaryCargo: 'sugar', description: '763 acres, 315 enslaved people, 3 windmills. Donated to the Society for the Propagation of the Gospel.' },
  { id: 'st_nicholas_abbey', name: 'St. Nicholas Abbey', portId: 'bridgetown', type: 'sugar', established: 1658, acres: 400, enslavedWorkers: 180, annualOutput: 140, primaryCargo: 'sugar', description: 'One of three surviving Jacobean mansions in the Western Hemisphere.' },
  { id: 'morgan_lewis', name: 'Morgan Lewis', portId: 'bridgetown', type: 'sugar', established: 1670, acres: 300, enslavedWorkers: 130, annualOutput: 100, primaryCargo: 'sugar', description: 'Sugar estate with the largest intact windmill in the Caribbean.' },

  // Cuba (Havana)
  { id: 'vuelta_abajo', name: 'Vegas of Vuelta Abajo', portId: 'havana', type: 'tobacco', established: 1600, acres: 2000, enslavedWorkers: 400, annualOutput: 300, primaryCargo: 'tobacco', description: 'The famous tobacco-growing district west of Havana. World\'s finest tobacco.' },
  { id: 'havana_ingenios', name: 'Havana Ingenios', portId: 'havana', type: 'sugar', established: 1650, acres: 1500, enslavedWorkers: 500, annualOutput: 350, primaryCargo: 'sugar', description: 'Numerous sugar mills along the rivers near Havana.' },

  // Hispaniola (Santo Domingo)
  { id: 'engombe', name: 'Engombe', portId: 'santo_domingo', type: 'sugar', established: 1520, acres: 400, enslavedWorkers: 150, annualOutput: 100, primaryCargo: 'sugar', description: 'Sugar plantation on the Haina River, one of the oldest in the Americas.' },
  { id: 'palave', name: 'Palavé', portId: 'santo_domingo', type: 'mixed', established: 1550, acres: 250, enslavedWorkers: 80, annualOutput: 60, primaryCargo: 'sugar', description: 'Colonial estate near Santo Domingo.' },
  { id: 'boca_de_nigua', name: 'Boca de Nigua', portId: 'santo_domingo', type: 'sugar', established: 1580, acres: 350, enslavedWorkers: 120, annualOutput: 90, primaryCargo: 'sugar', description: 'Sugar estate west of Santo Domingo.' },

  // South Carolina (Charles Town)
  { id: 'middleton_place', name: 'Middleton Place', portId: 'charles_town', type: 'rice', established: 1680, acres: 800, enslavedWorkers: 200, annualOutput: 250, primaryCargo: 'rice', description: 'Rice plantation on the Ashley River.' },
  { id: 'drayton_hall', name: 'Drayton Hall', portId: 'charles_town', type: 'rice', established: 1680, acres: 600, enslavedWorkers: 150, annualOutput: 180, primaryCargo: 'rice', description: 'Plantation on the Ashley River.' },

  // St. Kitts (Basseterre)
  { id: 'basseterre_sugar', name: 'Basseterre Sugar Estates', portId: 'basseterre', type: 'sugar', established: 1640, acres: 3000, enslavedWorkers: 800, annualOutput: 500, primaryCargo: 'sugar', description: 'Almost the entire island devoted to sugar production. Plantations cover every arable acre.' },

  // ============================================================
  // PIMENTO / ALLSPICE — Jamaica near-monopoly
  // ============================================================

  { id: 'jamaica_pimento_groves', name: 'Jamaica Pimento Walks', portId: 'port_royal', type: 'pimento', established: 1660, acres: 2000, enslavedWorkers: 80, annualOutput: 200, primaryCargo: 'pimento', description: 'Wild and semi-cultivated pimento (allspice) groves across Jamaica\'s hills. Trees produce for decades. Berries picked green by enslaved workers and dried in the sun.' },

  // ============================================================
  // GINGER
  // ============================================================

  { id: 'jamaica_ginger', name: 'Jamaica Ginger Fields', portId: 'port_royal', type: 'ginger', established: 1640, acres: 400, enslavedWorkers: 60, annualOutput: 100, primaryCargo: 'ginger', description: 'Jamaica was the first Caribbean ginger exporter. Rhizomes grown in rich, well-watered soils in the interior parishes.' },
  { id: 'barbados_ginger', name: 'Barbados Ginger Plots', portId: 'bridgetown', type: 'ginger', established: 1650, acres: 150, enslavedWorkers: 30, annualOutput: 40, primaryCargo: 'ginger', description: 'Small-scale ginger cultivation on Barbados, secondary to sugar.' },

  // ============================================================
  // COTTON
  // ============================================================

  { id: 'barbados_cotton', name: 'Barbados Cotton Fields', portId: 'bridgetown', type: 'cotton', established: 1630, acres: 200, enslavedWorkers: 40, annualOutput: 50, primaryCargo: 'cotton', description: 'Cotton was Barbados\'s first cash crop before the sugar revolution. Small acreage remains on less fertile land.' },
  { id: 'carolina_cotton', name: 'Carolina Sea Island Cotton', portId: 'charles_town', type: 'cotton', established: 1690, acres: 300, enslavedWorkers: 50, annualOutput: 60, primaryCargo: 'cotton', description: 'Long-staple Sea Island cotton grown on the barrier islands. Premium fiber, early cultivation.' },
  { id: 'cartagena_cotton', name: 'Spanish Main Cotton', portId: 'cartagena', type: 'cotton', established: 1600, acres: 500, enslavedWorkers: 80, annualOutput: 80, primaryCargo: 'cotton', description: 'Cotton grown in the hinterland of the Spanish Main. Shipped through Cartagena.' },
  { id: 'saintdomingue_cotton', name: 'Saint-Domingue Cotton', portId: 'petit_goave', type: 'cotton', established: 1690, acres: 400, enslavedWorkers: 60, annualOutput: 70, primaryCargo: 'cotton', description: 'French cotton production on Hispaniola, growing alongside sugar and indigo.' },

  // ============================================================
  // INDIGO
  // ============================================================

  { id: 'carolina_indigo', name: 'Carolina Indigo Plantations', portId: 'charles_town', type: 'indigo', established: 1680, acres: 500, enslavedWorkers: 100, annualOutput: 80, primaryCargo: 'indigo', description: 'Indigo grown on upland fields where rice won\'t grow. The foul-smelling fermentation vats are kept downwind of the great houses.' },
  { id: 'saintdomingue_indigo', name: 'Saint-Domingue Indigoteries', portId: 'petit_goave', type: 'indigo', established: 1670, acres: 800, enslavedWorkers: 150, annualOutput: 120, primaryCargo: 'indigo', description: 'French Saint-Domingue is a major indigo producer. The blue dye cakes are highly valued in European textile mills.' },
  { id: 'santo_domingo_indigo', name: 'Hispaniola Indigo', portId: 'santo_domingo', type: 'indigo', established: 1600, acres: 300, enslavedWorkers: 50, annualOutput: 40, primaryCargo: 'indigo', description: 'Spanish indigo production on Hispaniola, declining as the French side expands.' },
  { id: 'cartagena_indigo', name: 'New Granada Indigo', portId: 'cartagena', type: 'indigo', established: 1580, acres: 400, enslavedWorkers: 60, annualOutput: 50, primaryCargo: 'indigo', description: 'Indigo from the interior of New Granada, shipped through Cartagena.' },

  // ============================================================
  // CACAO
  // ============================================================

  { id: 'santo_domingo_cacao', name: 'Cacao Haciendas of Hispaniola', portId: 'santo_domingo', type: 'cacao', established: 1550, acres: 600, enslavedWorkers: 100, annualOutput: 80, primaryCargo: 'cacao', description: 'Cacao grown in the shaded valleys of the interior. Hispaniola was an early cacao producer.' },
  { id: 'cartagena_cacao', name: 'Venezuelan Cacao (via Cartagena)', portId: 'cartagena', type: 'cacao', established: 1620, acres: 3000, enslavedWorkers: 400, annualOutput: 300, primaryCargo: 'cacao', description: 'Caracas cacao — the finest in the world. Grown in Venezuelan haciendas and trans-shipped through Cartagena. Rich, complex flavor from Criollo beans.' },
  { id: 'saintdomingue_cacao', name: 'Saint-Domingue Cacao Groves', portId: 'petit_goave', type: 'cacao', established: 1680, acres: 400, enslavedWorkers: 60, annualOutput: 50, primaryCargo: 'cacao', description: 'French cacao cultivation on Hispaniola, growing alongside other crops.' },

  // ============================================================
  // TIMBER & FOREST PRODUCTS
  // ============================================================

  { id: 'jamaica_logwood', name: 'Jamaica South Coast Logwood', portId: 'port_royal', type: 'timber', established: 1670, acres: 5000, enslavedWorkers: 50, annualOutput: 100, primaryCargo: 'logwood', description: 'Logwood harvested from the swamps and forests of Jamaica\'s south coast. Hard, dangerous work in mosquito-ridden swamps.' },
  { id: 'jamaica_mahogany', name: 'Jamaica Mahogany Forest', portId: 'port_royal', type: 'timber', established: 1700, acres: 10000, enslavedWorkers: 60, annualOutput: 50, primaryCargo: 'mahogany', description: 'Mahogany felled in Jamaica\'s mountainous interior and floated downriver. Just becoming fashionable in European furniture.' },
  { id: 'carolina_naval_stores', name: 'Carolina Tar Kilns', portId: 'charles_town', type: 'naval_stores', established: 1690, acres: 8000, enslavedWorkers: 100, annualOutput: 300, primaryCargo: 'naval_stores', description: 'Longleaf pine forests tapped for turpentine and burned in kilns for tar and pitch. Carolina supplies the Royal Navy with essential ship-waterproofing materials.' },

  // ============================================================
  // SALT
  // ============================================================

  { id: 'curacao_salt', name: 'Curaçao Salt Pans', portId: 'willemstad', type: 'salt', established: 1640, acres: 500, enslavedWorkers: 30, annualOutput: 200, primaryCargo: 'salt', description: 'Solar salt produced in shallow pans on the arid south coast. Curaçao\'s dry climate and steady wind make ideal evaporation conditions.' },

  // ============================================================
  // ALOE
  // ============================================================

  { id: 'curacao_aloe', name: 'Curaçao Aloe Fields', portId: 'willemstad', type: 'aloe', established: 1650, acres: 300, enslavedWorkers: 20, annualOutput: 40, primaryCargo: 'medicine', description: 'Aloe vera thrives in Curaçao\'s arid conditions. The gel treats burns and wounds; the resin is exported as a purgative medicine.' },

  // ============================================================
  // WEST AFRICAN PRODUCTION
  // ============================================================

  { id: 'gold_coast_palm', name: 'Gold Coast Palm Groves', portId: 'cape_coast_castle', type: 'palm_oil', established: 1500, acres: 5000, enslavedWorkers: 0, annualOutput: 100, primaryCargo: 'palm_oil', description: 'Oil palms cultivated by local Fante communities. Palm oil, palm wine, and palm kernel oil. European forts purchase provisions from local farmers.' },
  { id: 'elmina_palm', name: 'Elmina District Palms', portId: 'elmina', type: 'palm_oil', established: 1500, acres: 3000, enslavedWorkers: 0, annualOutput: 60, primaryCargo: 'palm_oil', description: 'Palm groves around Elmina. Local Fante production, not European-managed.' },
  { id: 'dahomey_palm', name: 'Dahomey Palm Plantations', portId: 'whydah', type: 'palm_oil', established: 1500, acres: 8000, enslavedWorkers: 0, annualOutput: 150, primaryCargo: 'palm_oil', description: 'The Kingdom of Dahomey manages extensive palm plantations under royal authority. More organized than Gold Coast production.' },

  // ============================================================
  // EUROPEAN PRODUCTION
  // ============================================================

  { id: 'andalusia_vineyards', name: 'Andalusian Vineyards', portId: 'seville_cadiz', type: 'mixed', established: 1200, acres: 20000, enslavedWorkers: 0, annualOutput: 500, primaryCargo: 'wine', description: 'The sherry bodegas of Jerez and the vineyards of Andalusia. Spanish wine, especially sherry and Canary, is shipped to every Caribbean port.' },
  { id: 'andalusia_olives', name: 'Andalusian Olive Groves', portId: 'seville_cadiz', type: 'mixed', established: 1000, acres: 15000, enslavedWorkers: 0, annualOutput: 400, primaryCargo: 'provisions', description: 'Olive oil is the cooking fat of the Spanish Empire. Vast olive groves across Andalusia supply the colonies.' },

  // ============================================================
  // VANILLA — Mexican world monopoly
  // ============================================================

  { id: 'papantla_vanilla', name: 'Papantla Vanilla Orchards', portId: 'veracruz', type: 'mixed', established: 1500, acres: 1000, enslavedWorkers: 0, annualOutput: 30, primaryCargo: 'vanilla', description: 'Totonac people of the Papantla region cultivate vanilla orchid vines on forest trees. Each flower is hand-pollinated. The green pods are cured for months. Mexico\'s world monopoly — Spain guards the source jealously.' },

  // ============================================================
  // SARSAPARILLA — wild-harvested medicinal
  // ============================================================

  { id: 'jamaica_sarsaparilla', name: 'Jamaica Sarsaparilla Harvest', portId: 'port_royal', type: 'mixed', established: 1660, acres: 3000, enslavedWorkers: 20, annualOutput: 50, primaryCargo: 'medicine', description: 'Sarsaparilla root dug from the wild forests and mountains of Jamaica. Exported to Europe as a cure-all. Hard work in rough terrain.' },
  { id: 'veracruz_sarsaparilla', name: 'New Spain Sarsaparilla', portId: 'veracruz', type: 'mixed', established: 1550, acres: 5000, enslavedWorkers: 0, annualOutput: 80, primaryCargo: 'medicine', description: 'Sarsaparilla root harvested from the tropical forests of Mexico and Honduras. Indigenous knowledge guides the collection. Shipped through Veracruz.' },

  // ============================================================
  // ANNATTO — dye and food coloring
  // ============================================================

  { id: 'jamaica_annatto', name: 'Jamaica Annatto Groves', portId: 'port_royal', type: 'mixed', established: 1650, acres: 200, enslavedWorkers: 10, annualOutput: 30, primaryCargo: 'annatto', description: 'Annatto (achiote) trees grown in Jamaica\'s lowlands. The red-orange seed dye is used locally and exported for textile dyeing.' },
  { id: 'veracruz_annatto', name: 'Yucatan Annatto', portId: 'veracruz', type: 'mixed', established: 1500, acres: 500, enslavedWorkers: 0, annualOutput: 60, primaryCargo: 'annatto', description: 'Annatto cultivation in the Yucatan and Gulf lowlands. Essential in Mesoamerican cuisine (achiote paste) and used as textile dye.' },
];

// Aggregate production per port (units per year)
export function getPortProduction(portId: string): Record<string, number> {
  const output: Record<string, number> = {};
  for (const p of PLANTATIONS) {
    if (p.portId === portId) {
      output[p.primaryCargo] = (output[p.primaryCargo] ?? 0) + p.annualOutput;
    }
  }
  return output;
}

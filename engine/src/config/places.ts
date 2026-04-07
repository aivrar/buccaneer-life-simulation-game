// Place definitions — every building/location within a port
// From PHYSICAL_WORLD.md historically accurate names

export type PlaceType =
  | 'tavern'
  | 'fort'
  | 'church'
  | 'dock'
  | 'market'
  | 'shipyard'
  | 'brothel'
  | 'warehouse'
  | 'government'
  | 'jail'
  | 'camp'
  | 'landmark'
  | 'residential'
  | 'trading_post'
  | 'slave_market'
  | 'hospital';

export interface PlaceTemplate {
  type: PlaceType;
  defaultCapacity: number;
  defaultQuality: number;     // 0-100
  defaultSafety: number;      // 0-100
  defaultCorruption: number;  // 0-100
  defaultVisibility: number;  // 0-100 how public/visible the location is
}

export const PLACE_TEMPLATES: Record<PlaceType, PlaceTemplate> = {
  tavern:       { type: 'tavern',       defaultCapacity: 40, defaultQuality: 50, defaultSafety: 40, defaultCorruption: 50, defaultVisibility: 80 },
  fort:         { type: 'fort',         defaultCapacity: 200, defaultQuality: 60, defaultSafety: 90, defaultCorruption: 20, defaultVisibility: 100 },
  church:       { type: 'church',       defaultCapacity: 100, defaultQuality: 60, defaultSafety: 80, defaultCorruption: 20, defaultVisibility: 90 },
  dock:         { type: 'dock',         defaultCapacity: 50, defaultQuality: 50, defaultSafety: 50, defaultCorruption: 40, defaultVisibility: 90 },
  market:       { type: 'market',       defaultCapacity: 200, defaultQuality: 50, defaultSafety: 60, defaultCorruption: 40, defaultVisibility: 100 },
  shipyard:     { type: 'shipyard',     defaultCapacity: 30, defaultQuality: 50, defaultSafety: 60, defaultCorruption: 30, defaultVisibility: 80 },
  brothel:      { type: 'brothel',      defaultCapacity: 20, defaultQuality: 40, defaultSafety: 30, defaultCorruption: 70, defaultVisibility: 60 },
  warehouse:    { type: 'warehouse',    defaultCapacity: 500, defaultQuality: 50, defaultSafety: 50, defaultCorruption: 50, defaultVisibility: 50 },
  government:   { type: 'government',   defaultCapacity: 50, defaultQuality: 70, defaultSafety: 80, defaultCorruption: 40, defaultVisibility: 100 },
  jail:         { type: 'jail',         defaultCapacity: 30, defaultQuality: 20, defaultSafety: 10, defaultCorruption: 30, defaultVisibility: 70 },
  camp:         { type: 'camp',         defaultCapacity: 300, defaultQuality: 20, defaultSafety: 20, defaultCorruption: 80, defaultVisibility: 70 },
  landmark:     { type: 'landmark',     defaultCapacity: 50, defaultQuality: 50, defaultSafety: 50, defaultCorruption: 30, defaultVisibility: 90 },
  residential:  { type: 'residential',  defaultCapacity: 20, defaultQuality: 50, defaultSafety: 60, defaultCorruption: 30, defaultVisibility: 40 },
  trading_post: { type: 'trading_post', defaultCapacity: 30, defaultQuality: 50, defaultSafety: 50, defaultCorruption: 50, defaultVisibility: 70 },
  slave_market: { type: 'slave_market', defaultCapacity: 200, defaultQuality: 10, defaultSafety: 40, defaultCorruption: 60, defaultVisibility: 80 },
  hospital:     { type: 'hospital',     defaultCapacity: 30, defaultQuality: 40, defaultSafety: 70, defaultCorruption: 20, defaultVisibility: 70 },
};

export interface PlaceDefinition {
  id: string;
  name: string;
  portId: string;
  type: PlaceType;
  capacity?: number;
  quality?: number;
  safety?: number;
  corruption?: number;
  visibility?: number;
  description: string;
}

// ============================================================
// All places by port — historically accurate names
// ============================================================

export const PORT_PLACES: PlaceDefinition[] = [
  // ---- NASSAU ----
  { id: 'nassau_fort', name: 'Fort Nassau', portId: 'nassau', type: 'fort', quality: 20, safety: 30, description: 'Small, poorly maintained stone fort. 28 guns (many unserviceable). Pirates nominally maintain it.' },
  { id: 'nassau_stranded_mermaid', name: 'The Stranded Mermaid', portId: 'nassau', type: 'tavern', quality: 70, safety: 30, description: 'Largest tavern, main recruiting ground, center of pirate social life.' },
  { id: 'nassau_rusty_anchor', name: 'The Rusty Anchor', portId: 'nassau', type: 'tavern', quality: 40, safety: 20, description: 'Rougher establishment near the waterfront, cheaper rum.' },
  { id: 'nassau_crows_nest', name: 'The Crow\'s Nest', portId: 'nassau', type: 'tavern', quality: 60, safety: 40, description: 'Elevated position overlooking harbor, popular with captains for its view of arriving ships.' },
  { id: 'nassau_waterfront', name: 'Nassau Waterfront', portId: 'nassau', type: 'dock', quality: 30, description: 'Informal wharves. Ships anchor in harbor and lighter cargo ashore in boats.' },
  { id: 'nassau_careening_east', name: 'Careening Beach (East)', portId: 'nassau', type: 'dock', quality: 40, description: 'Sandy beach on the east end for hull cleaning.' },
  { id: 'nassau_careening_west', name: 'Careening Beach (West)', portId: 'nassau', type: 'dock', quality: 35, description: 'Secondary careening spot near Hog Island.' },
  { id: 'nassau_market', name: 'Nassau Open Market', portId: 'nassau', type: 'market', quality: 30, corruption: 90, description: 'Chaotic, no regulation. Stolen goods sold openly alongside fish.' },
  { id: 'nassau_shipyard', name: 'Potter\'s Cay Yard', portId: 'nassau', type: 'shipyard', quality: 30, description: 'Informal shipwright operation. Basic repairs only.' },
  { id: 'nassau_brothel', name: 'Madam Colette\'s', portId: 'nassau', type: 'brothel', quality: 60, corruption: 80, description: 'French-run establishment. The most organized business in Nassau outside of piracy. Intel hub.' },
  { id: 'nassau_warehouse', name: 'Beach Street Warehouse', portId: 'nassau', type: 'warehouse', description: 'Repurposed customs house, used by fences to store plunder.' },
  { id: 'nassau_church', name: 'Christ Church', portId: 'nassau', type: 'church', quality: 10, description: 'Small Anglican church, largely abandoned during pirate republic. Barely standing.' },
  { id: 'nassau_beach', name: 'Nassau Beach', portId: 'nassau', type: 'camp', quality: 10, safety: 15, description: 'The majority of pirates live in tents and lean-tos on the beach. Hammocks, cooking fires, gambling.' },
  { id: 'nassau_captains_row', name: 'Captain\'s Row', portId: 'nassau', type: 'camp', quality: 30, safety: 30, description: 'Better shelters up the hill where established captains maintain semi-permanent camps.' },
  { id: 'nassau_governors_house', name: 'The Governor\'s House', portId: 'nassau', type: 'government', quality: 10, description: 'Empty/abandoned shell. Woodes Rogers will occupy it in 1718.' },
  { id: 'nassau_hanging_tree', name: 'The Hanging Tree', portId: 'nassau', type: 'landmark', description: 'Large silk cotton tree at the harbor\'s edge. Pirates conduct informal justice here.' },
  { id: 'nassau_assembly', name: 'The Assembly Ground', portId: 'nassau', type: 'landmark', description: 'Open area near the fort where captains gather to discuss republic business.' },
  { id: 'nassau_hog_island', name: 'Hog Island', portId: 'nassau', type: 'landmark', description: 'Across the harbor. Fresh water springs, farming, hiding spots.' },
  { id: 'nassau_bay_street', name: 'Bay Street', portId: 'nassau', type: 'landmark', description: 'The waterfront "road" (more a beaten path) running along the harbor.' },
  { id: 'nassau_the_hill', name: 'The Hill', portId: 'nassau', type: 'residential', quality: 25, safety: 25, description: 'The slope rising from the waterfront where more permanent structures are built.' },
  { id: 'nassau_back_path', name: 'The Back Path', portId: 'nassau', type: 'landmark', description: 'Trail behind the settlement leading inland to freshwater wells and the bush.' },
  { id: 'nassau_sawbones', name: 'The Sawbones Tent', portId: 'nassau', type: 'hospital', quality: 10, description: 'A ship\'s surgeon who set up on shore. Amputation, bullet extraction, crude stitching. Better than nothing — barely.' },

  // ---- PORT ROYAL ----
  { id: 'pr_fort_charles', name: 'Fort Charles', portId: 'port_royal', type: 'fort', quality: 70, description: 'Oldest fort in Jamaica (built 1656). Primary harbor defense.' },
  { id: 'pr_fort_rupert', name: 'Fort Rupert', portId: 'port_royal', type: 'fort', quality: 50, description: 'Secondary battery on the Palisadoes.' },
  { id: 'pr_fort_walker', name: 'Fort Walker', portId: 'port_royal', type: 'fort', quality: 50, description: 'Covers the western approach.' },
  { id: 'pr_sign_mermaid', name: 'The Sign of the Mermaid', portId: 'port_royal', type: 'tavern', quality: 70, safety: 50, description: 'Respectable merchant tavern near the docks.' },
  { id: 'pr_bucket_blood', name: 'The Bucket of Blood', portId: 'port_royal', type: 'tavern', quality: 40, safety: 20, description: 'Rougher waterfront establishment, sailors and lower ranks.' },
  { id: 'pr_kings_arms', name: 'The King\'s Arms', portId: 'port_royal', type: 'tavern', quality: 80, safety: 70, description: 'Officer and gentleman\'s tavern near Fort Charles.' },
  { id: 'pr_naval_dockyard', name: 'Port Royal Naval Dockyard', portId: 'port_royal', type: 'dock', quality: 80, description: 'Royal Navy facility. Repair, provisioning, and HQ for Jamaica squadron.' },
  { id: 'pr_merchant_wharves', name: 'Merchant Wharves', portId: 'port_royal', type: 'dock', quality: 60, description: 'Multiple stone-built wharves for commercial shipping.' },
  { id: 'pr_market', name: 'Port Royal Market', portId: 'port_royal', type: 'market', quality: 60, description: 'Daily market, regulated by town council. Fresh fish, provisions, imported goods.' },
  { id: 'pr_shipyard', name: 'Royal Naval Dockyard', portId: 'port_royal', type: 'shipyard', quality: 80, description: 'Full shipbuilding and repair capability. The best in the Caribbean for English ships.' },
  { id: 'pr_church', name: 'St. Peter\'s Church', portId: 'port_royal', type: 'church', quality: 60, description: 'Rebuilt after 1692 earthquake and 1703 fire.' },
  { id: 'pr_admiralty', name: 'Admiralty House', portId: 'port_royal', type: 'government', quality: 70, description: 'Headquarters of the Jamaica naval station.' },
  { id: 'pr_customs', name: 'Customs House', portId: 'port_royal', type: 'government', quality: 60, corruption: 50, description: 'Inspects all arriving cargo, collects duties.' },
  { id: 'pr_prize_court', name: 'Prize Court', portId: 'port_royal', type: 'government', quality: 60, corruption: 70, description: 'Admiralty court that adjudicates captured ships. Notoriously corrupt.' },
  { id: 'pr_fishing_docks', name: 'Fishing Docks', portId: 'port_royal', type: 'dock', quality: 40, description: 'Small boat landing for the fishing fleet.' },
  { id: 'pr_jail', name: 'Port Royal Gaol', portId: 'port_royal', type: 'jail', quality: 20, safety: 15, description: 'Stone jail near Fort Charles. Pirates and smugglers held before trial.' },
  { id: 'pr_giddy_house', name: 'Giddy House', portId: 'port_royal', type: 'landmark', description: 'Old artillery storage, partially sunken from 1692 earthquake. Tilted at an angle.' },
  { id: 'pr_sunken_city', name: 'The Sunken City', portId: 'port_royal', type: 'landmark', description: 'Underwater ruins of pre-1692 Port Royal, visible at low tide. Eerie landmark.' },
  { id: 'pr_lime_cay', name: 'Lime Cay', portId: 'port_royal', type: 'landmark', description: 'Small island offshore. Used for picnics and illicit meetings.' },
  { id: 'pr_merchant_row', name: 'Merchant Row', portId: 'port_royal', type: 'residential', quality: 55, safety: 55, description: 'Stone and brick merchant houses rebuilt after the 1692 earthquake. More modest than the original city.' },
  { id: 'pr_brothel', name: 'Mrs. Fouler\'s Establishment', portId: 'port_royal', type: 'brothel', quality: 50, corruption: 70, description: 'One of Port Royal\'s many brothels. In its heyday, one in four buildings was a brothel or tavern.' },
  { id: 'pr_warehouse', name: 'Thames Street Warehouses', portId: 'port_royal', type: 'warehouse', quality: 55, description: 'Commercial storage along the rebuilt waterfront. Sugar, rum, and less legitimate cargo.' },
  { id: 'pr_slave_market', name: 'Port Royal Slave Market', portId: 'port_royal', type: 'slave_market', description: 'Near the merchant wharves. Enslaved people sold alongside other cargo from arriving ships.' },
  { id: 'pr_hospital', name: 'Port Royal Naval Hospital', portId: 'port_royal', type: 'hospital', quality: 40, description: 'Attached to the naval dockyard. Treats sailors, marines, and occasionally civilians. Fever is the main killer.' },

  // ---- HAVANA ----
  { id: 'hav_el_morro', name: 'El Morro', portId: 'havana', type: 'fort', quality: 95, safety: 95, description: 'Castillo de los Tres Reyes Magos del Morro. Massive fortress, 64 guns, 700-man garrison. Commands the entire approach.' },
  { id: 'hav_la_punta', name: 'La Punta', portId: 'havana', type: 'fort', quality: 85, description: 'Castillo de San Salvador de la Punta. Opposite El Morro. The chain is strung between them at night.' },
  { id: 'hav_real_fuerza', name: 'La Real Fuerza', portId: 'havana', type: 'fort', quality: 80, description: 'Oldest stone fort in the Americas (1558). Government and military HQ.' },
  { id: 'hav_bodeguita', name: 'La Bodeguita', portId: 'havana', type: 'tavern', quality: 60, description: 'Waterfront tavern near the docks, popular with visiting sailors.' },
  { id: 'hav_gallo_oro', name: 'El Gallo de Oro', portId: 'havana', type: 'tavern', quality: 80, safety: 70, description: 'Upscale establishment near the main plaza, officers and merchants.' },
  { id: 'hav_taberna_pirata', name: 'La Taberna del Pirata', portId: 'havana', type: 'tavern', quality: 40, safety: 30, description: 'Ironically named, working-class dockside tavern.' },
  { id: 'hav_astillero', name: 'Real Astillero de La Habana', portId: 'havana', type: 'shipyard', quality: 90, description: 'One of the finest shipyards in the Spanish Empire. Full construction capability.' },
  { id: 'hav_muelle_real', name: 'Muelle Real', portId: 'havana', type: 'dock', quality: 80, description: 'Royal Wharf — main commercial dock.' },
  { id: 'hav_muelle_luz', name: 'Muelle de Luz', portId: 'havana', type: 'dock', quality: 60, description: 'Secondary wharf for smaller vessels.' },
  { id: 'hav_plaza_armas', name: 'Plaza de Armas Market', portId: 'havana', type: 'market', quality: 70, description: 'Main plaza, regulated commerce, daily market.' },
  { id: 'hav_iglesia_mayor', name: 'Iglesia Mayor', portId: 'havana', type: 'church', quality: 80, description: 'Principal church on the main plaza.' },
  { id: 'hav_san_francisco', name: 'Convento de San Francisco de Asís', portId: 'havana', type: 'church', quality: 85, description: 'Franciscan monastery. Bell tower is a harbor landmark.' },
  { id: 'hav_governors_palace', name: 'Palacio de los Capitanes Generales', portId: 'havana', type: 'government', quality: 90, description: 'Governor\'s Palace. Seat of all civil and military authority in Cuba.' },
  { id: 'hav_contratacion', name: 'Casa de Contratación Office', portId: 'havana', type: 'government', quality: 70, corruption: 40, description: 'Controls all official trade.' },
  { id: 'hav_inquisition', name: 'Inquisition Office', portId: 'havana', type: 'government', quality: 50, safety: 20, description: 'Feared religious authority.' },
  { id: 'hav_customs', name: 'Real Aduana', portId: 'havana', type: 'government', quality: 70, description: 'Customs House — controls harbor commerce.' },
  { id: 'hav_slave_market', name: 'Havana Slave Market', portId: 'havana', type: 'slave_market', description: 'Near the docks, regular auctions.' },
  { id: 'hav_chain', name: 'The Chain', portId: 'havana', type: 'landmark', description: 'Heavy chain between El Morro and La Punta, raised at night to close the harbor.' },
  { id: 'hav_tobacco_warehouses', name: 'Tobacco Warehouses', portId: 'havana', type: 'warehouse', quality: 70, description: 'Havana\'s famous tobacco stored in large warehouses near the harbor.' },
  { id: 'hav_santo_angel', name: 'Iglesia del Santo Ángel Custodio', portId: 'havana', type: 'church', quality: 70, description: 'Hilltop church overlooking the city.' },
  { id: 'hav_city_walls', name: 'City Walls', portId: 'havana', type: 'fort', quality: 75, description: 'Stone walls encircling the old city, with gates that close at night.' },
  { id: 'hav_plaza_vieja', name: 'Plaza Vieja', portId: 'havana', type: 'market', quality: 55, description: 'Secondary market square, smaller trades.' },
  { id: 'hav_la_merced', name: 'Iglesia de la Merced', portId: 'havana', type: 'church', quality: 65, description: 'Mercedarian order church.' },
  { id: 'hav_jail', name: 'Havana City Jail', portId: 'havana', type: 'jail', quality: 15, safety: 10, description: 'Stone cells near La Real Fuerza. Pirates, smugglers, and political prisoners.' },
  { id: 'hav_casa_gallega', name: 'Casa de la Gallega', portId: 'havana', type: 'brothel', quality: 50, corruption: 65, description: 'Establishment near the docks. Sailors from the treasure fleet are the primary clientele.' },
  { id: 'hav_calle_obispo', name: 'Calle Obispo', portId: 'havana', type: 'residential', quality: 70, safety: 70, description: 'Principal commercial street. Merchants, colonial officials, prosperous families.' },
  { id: 'hav_extramuros', name: 'Extramuros', portId: 'havana', type: 'residential', quality: 30, safety: 35, description: 'Settlement outside the city walls. Workers, free blacks, poorer residents. Growing rapidly.' },
  { id: 'hav_hospital', name: 'Hospital de San Felipe y Santiago', portId: 'havana', type: 'hospital', quality: 35, description: 'Church-run hospital within the city walls. Overwhelmed during fleet season when tropical diseases spike.' },

  // ---- TORTUGA ----
  { id: 'tort_fort', name: 'Fort de Rocher', portId: 'tortuga', type: 'fort', quality: 35, description: 'Built by Jean le Vasseur c.1640. 24 guns. Overlooks Cayona harbor from a rocky cliff. Partially ruined.' },
  { id: 'tort_boucanier', name: 'Le Boucanier', portId: 'tortuga', type: 'tavern', quality: 50, safety: 25, description: 'The traditional buccaneer tavern, legendary in pirate lore but now quieter.' },
  { id: 'tort_tortue_ivre', name: 'La Tortue Ivre', portId: 'tortuga', type: 'tavern', quality: 30, safety: 20, description: 'The Drunken Turtle — rough dockside drinking house.' },
  { id: 'tort_wharf', name: 'Cayona Wharf', portId: 'tortuga', type: 'dock', quality: 30, description: 'Small wooden dock, handles limited trade.' },
  { id: 'tort_market', name: 'Cayona Market', portId: 'tortuga', type: 'market', quality: 20, description: 'Small, irregular. Trade happens when ships come in.' },
  { id: 'tort_chapel', name: 'Chapelle de Cayona', portId: 'tortuga', type: 'church', quality: 30, description: 'Small Catholic chapel, French parish.' },
  { id: 'tort_boucan_camps', name: 'Boucan Camps', portId: 'tortuga', type: 'camp', quality: 15, safety: 20, description: 'The original buccaneer tradition — hunters smoke wild pig and cattle meat on the island.' },
  { id: 'tort_mountain_interior', name: 'Mountain Interior', portId: 'tortuga', type: 'landmark', description: 'Rugged, forested interior. Hiding places and fresh water streams. Known only to locals.' },
  { id: 'tort_north_coast', name: 'Northern Coast', portId: 'tortuga', type: 'landmark', description: 'Uninhabited, rocky, dangerous currents. Useful hideouts for those who know it.' },
  { id: 'tort_jail', name: 'Fort de Rocher Cells', portId: 'tortuga', type: 'jail', quality: 10, safety: 5, description: 'A few stone cells within the old fort. Rarely used — justice on Tortuga is swift and informal.' },
  { id: 'tort_warehouse', name: 'Cayona Storehouse', portId: 'tortuga', type: 'warehouse', quality: 20, corruption: 80, description: 'Rough wooden structure near the wharf. Plunder stored between sales. No questions asked.' },
  { id: 'tort_brothel', name: 'La Maison des Femmes', portId: 'tortuga', type: 'brothel', quality: 35, corruption: 90, description: 'The French governor historically imported women to the island to "civilize" the buccaneers. This is what resulted.' },

  // ---- BRIDGETOWN ----
  { id: 'bt_james_fort', name: 'James Fort', portId: 'bridgetown', type: 'fort', quality: 60, description: 'Northern defense of Carlisle Bay.' },
  { id: 'bt_willoughby', name: 'Willoughby Fort', portId: 'bridgetown', type: 'fort', quality: 60, description: 'Central harbor defense.' },
  { id: 'bt_garrison', name: 'St. Ann\'s Fort / The Garrison', portId: 'bridgetown', type: 'fort', quality: 70, description: 'Britain\'s first permanent military base in the Caribbean (1705). Barracks, parade ground, armory.' },
  { id: 'bt_careening', name: 'The Careening', portId: 'bridgetown', type: 'tavern', quality: 55, description: 'Waterfront tavern near the docks.' },
  { id: 'bt_sugar_mill', name: 'The Sugar Mill', portId: 'bridgetown', type: 'tavern', quality: 70, safety: 60, description: 'Upscale merchant establishment.' },
  { id: 'bt_garrison_arms', name: 'The Garrison Arms', portId: 'bridgetown', type: 'tavern', quality: 55, safety: 60, description: 'Military tavern near the fort.' },
  { id: 'bt_wharf', name: 'Bridgetown Wharf', portId: 'bridgetown', type: 'dock', quality: 70, description: 'Main commercial dockage, stone-built.' },
  { id: 'bt_careenage', name: 'The Careenage', portId: 'bridgetown', type: 'dock', quality: 60, description: 'Narrow tidal inlet cutting into the town center, used by smaller vessels.' },
  { id: 'bt_cheapside', name: 'Cheapside Market', portId: 'bridgetown', type: 'market', quality: 65, description: 'Main market, daily. Provisions, goods, enslaved people.' },
  { id: 'bt_shipyard', name: 'Carlisle Bay Yard', portId: 'bridgetown', type: 'shipyard', quality: 55, description: 'Moderate repair capability, some construction.' },
  { id: 'bt_st_michaels', name: 'St. Michael\'s Cathedral', portId: 'bridgetown', type: 'church', quality: 75, description: 'Principal Anglican church, tall spire visible from harbor.' },
  { id: 'bt_synagogue', name: 'Nidhe Israel Synagogue', portId: 'bridgetown', type: 'church', quality: 70, description: 'Sephardic Jewish synagogue (founded 1654). Reflects the significant Jewish merchant community.' },
  { id: 'bt_gov_house', name: 'Government House', portId: 'bridgetown', type: 'government', quality: 70, description: 'Governor\'s residence.' },
  { id: 'bt_customs', name: 'Customs House', portId: 'bridgetown', type: 'government', quality: 60, description: 'Carlisle Bay waterfront.' },
  { id: 'bt_town_hall', name: 'Town Hall', portId: 'bridgetown', type: 'government', quality: 55, description: 'Civic governance.' },
  { id: 'bt_charles_fort', name: 'Charles Fort', portId: 'bridgetown', type: 'fort', quality: 55, description: 'Southern defense at Needham\'s Point.' },
  { id: 'bt_jail', name: 'Bridgetown Gaol', portId: 'bridgetown', type: 'jail', quality: 20, safety: 15, description: 'Colonial prison near the Garrison.' },
  { id: 'bt_merchant_quarter', name: 'Merchant Quarter', portId: 'bridgetown', type: 'residential', quality: 65, safety: 65, description: 'Merchant houses near the Careenage. Prosperous sugar trade families.' },
  { id: 'bt_warehouse', name: 'Carlisle Bay Warehouses', portId: 'bridgetown', type: 'warehouse', quality: 65, description: 'Sugar hogsheads stacked high awaiting the next fleet. Rum, molasses, and colonial goods.' },
  { id: 'bt_slave_market', name: 'Bridgetown Slave Market', portId: 'bridgetown', type: 'slave_market', description: 'Near the Careenage. Barbados was the first major English slave society. Auctions held regularly.' },
  { id: 'bt_trafalgar', name: 'Trafalgar Square', portId: 'bridgetown', type: 'landmark', description: 'Central square of Bridgetown. Public gatherings, announcements, and occasional punishments.' },
  { id: 'bt_hospital', name: 'Bridgetown Hospital', portId: 'bridgetown', type: 'hospital', quality: 35, description: 'Near the Garrison. Treats soldiers and sailors. Yellow fever and dysentery are constant threats.' },
  { id: 'bt_brothel', name: 'The Sugar House', portId: 'bridgetown', type: 'brothel', quality: 45, corruption: 60, description: 'Establishment near the wharves. Fleet sailors and plantation overseers on leave.' },

  // ---- CHARLES TOWN ----
  { id: 'ct_walls', name: 'The Walled City', portId: 'charles_town', type: 'fort', quality: 55, description: 'The only walled English colonial city in North America. Fortification wall with bastions.' },
  { id: 'ct_fort_johnson', name: 'Fort Johnson', portId: 'charles_town', type: 'fort', quality: 50, description: 'Harbor defense on James Island (built 1708).' },
  { id: 'ct_half_moon', name: 'Half Moon Battery', portId: 'charles_town', type: 'fort', quality: 40, description: 'Waterfront gun emplacement.' },
  { id: 'ct_powder_magazine', name: 'The Powder Magazine', portId: 'charles_town', type: 'warehouse', quality: 60, description: 'Store for the city\'s gunpowder supply. Still standing today.' },
  { id: 'ct_pink_house', name: 'The Pink House', portId: 'charles_town', type: 'tavern', quality: 60, safety: 50, description: 'Colonial tavern, one of the oldest buildings.' },
  { id: 'ct_dillons', name: 'Dillon\'s', portId: 'charles_town', type: 'tavern', quality: 55, safety: 50, description: 'Waterfront tavern, merchant clientele.' },
  { id: 'ct_shepheards', name: 'The Shepheard\'s', portId: 'charles_town', type: 'tavern', quality: 45, safety: 40, description: 'Near the wharves, sailors and traders.' },
  { id: 'ct_cooper_wharves', name: 'Cooper River Wharves', portId: 'charles_town', type: 'dock', quality: 60, description: 'Main commercial dockage.' },
  { id: 'ct_ashley_landing', name: 'Ashley River Landing', portId: 'charles_town', type: 'dock', quality: 45, description: 'Secondary dock on the Ashley River side.' },
  { id: 'ct_shipyard', name: 'Charles Town Shipyard', portId: 'charles_town', type: 'shipyard', quality: 50, description: 'Modest ship repair facility on the Cooper River.' },
  { id: 'ct_exchange', name: 'The Exchange', portId: 'charles_town', type: 'government', quality: 65, description: 'Combined customs house and commercial exchange at the end of Broad Street.' },
  { id: 'ct_market', name: 'Charles Town Market', portId: 'charles_town', type: 'market', quality: 60, description: 'Regulated, along the waterfront. Rice, naval stores, provisions.' },
  { id: 'ct_slave_market', name: 'Charles Town Slave Market', portId: 'charles_town', type: 'slave_market', description: 'One of the largest slave markets in the English colonies.' },
  { id: 'ct_st_philips', name: 'St. Philip\'s Church', portId: 'charles_town', type: 'church', quality: 70, description: 'Principal Anglican church. Tall steeple is the landmark for approaching ships.' },
  { id: 'ct_huguenot', name: 'French Huguenot Church', portId: 'charles_town', type: 'church', quality: 55, description: 'French Protestant community.' },
  { id: 'ct_gov_house', name: 'Governor\'s House', portId: 'charles_town', type: 'government', quality: 65, description: 'Within the walled city.' },
  { id: 'ct_courthouse', name: 'Colonial Court House', portId: 'charles_town', type: 'government', quality: 60, description: 'Where colonial justice is administered.' },
  { id: 'ct_jail', name: 'Charles Town Gaol', portId: 'charles_town', type: 'jail', quality: 15, safety: 10, description: 'Where Stede Bonnet was held before his hanging. Provost Marshal guards the prisoners.' },
  { id: 'ct_broad_street', name: 'Broad Street', portId: 'charles_town', type: 'residential', quality: 60, safety: 60, description: 'Main street within the walled city. Merchant houses, professionals, colonial gentry.' },
  { id: 'ct_white_point', name: 'White Point', portId: 'charles_town', type: 'landmark', description: 'Southern tip of the peninsula at the harbor entrance. Where pirates are hanged and gibbeted as warning to ships entering the harbor.' },
  { id: 'ct_hospital', name: 'Charles Town Infirmary', portId: 'charles_town', type: 'hospital', quality: 30, description: 'Small colonial hospital. Malaria from the surrounding marshes is the constant enemy.' },

  // ---- SANTO DOMINGO ----
  { id: 'sd_ozama', name: 'Fortaleza Ozama', portId: 'santo_domingo', type: 'fort', quality: 75, description: 'Oldest European military construction in the Americas (1502). Tower and walls at river mouth.' },
  { id: 'sd_cathedral', name: 'Catedral de Santa María la Menor', portId: 'santo_domingo', type: 'church', quality: 90, description: 'The oldest cathedral in the Americas (1514-1542). Massive stone construction.' },
  { id: 'sd_la_plaza', name: 'La Plaza', portId: 'santo_domingo', type: 'tavern', quality: 60, safety: 55, description: 'Merchant tavern on the main square.' },
  { id: 'sd_el_alcazar_tavern', name: 'El Alcázar', portId: 'santo_domingo', type: 'tavern', quality: 65, safety: 60, description: 'Near the Columbus palace, popular with officials.' },
  { id: 'sd_bodega_puerto', name: 'La Bodega del Puerto', portId: 'santo_domingo', type: 'tavern', quality: 40, safety: 35, description: 'Dockside tavern, sailors and dockworkers.' },
  { id: 'sd_ozama_wharf', name: 'Ozama River Wharf', portId: 'santo_domingo', type: 'dock', quality: 60, description: 'Main docking area at the river mouth, below the fortress.' },
  { id: 'sd_plaza_market', name: 'Plaza Mayor Market', portId: 'santo_domingo', type: 'market', quality: 55, description: 'Central square, daily commerce.' },
  { id: 'sd_alcazar_colon', name: 'Alcázar de Colón', portId: 'santo_domingo', type: 'government', quality: 80, description: 'Columbus family palace (1510-1514). Impressive coral limestone building overlooking the river.' },
  { id: 'sd_audiencia', name: 'Real Audiencia', portId: 'santo_domingo', type: 'government', quality: 75, description: 'Oldest European court in the Americas. Appeals court for the entire Caribbean.' },
  { id: 'sd_hospital', name: 'Hospital San Nicolás de Bari', portId: 'santo_domingo', type: 'hospital', quality: 20, description: 'Oldest hospital in the Americas, now in ruins but still used.' },

  // ---- SANTO DOMINGO (additions) ----
  { id: 'sd_calle_damas', name: 'Calle de las Damas', portId: 'santo_domingo', type: 'landmark', description: 'Oldest paved street in the New World (1502). Lined with colonial mansions.' },
  { id: 'sd_universidad', name: 'Universidad de Santo Tomás de Aquino', portId: 'santo_domingo', type: 'landmark', description: 'First university in the Americas (founded 1538). Educates clergy, lawyers, administrators.' },
  { id: 'sd_casa_bastidas', name: 'Casa de Bastidas', portId: 'santo_domingo', type: 'residential', quality: 70, description: 'Colonial merchant\'s mansion, one of the finest on Calle de las Damas.' },
  { id: 'sd_puerta_conde', name: 'Puerta del Conde', portId: 'santo_domingo', type: 'landmark', description: 'Western gate in the city wall, main land entrance to the city.' },
  { id: 'sd_san_francisco', name: 'Monasterio de San Francisco', portId: 'santo_domingo', type: 'church', quality: 40, description: 'Franciscan monastery ruins on a hill overlooking the city.' },
  { id: 'sd_jail', name: 'Santo Domingo Prison', portId: 'santo_domingo', type: 'jail', quality: 15, safety: 10, description: 'Colonial jail within the city walls. Dark cells beneath the fortress.' },
  { id: 'sd_calle_conde', name: 'Calle El Conde', portId: 'santo_domingo', type: 'landmark', description: 'Commercial street — shops and merchants.' },
  { id: 'sd_dominicos', name: 'Convento de los Dominicos', portId: 'santo_domingo', type: 'church', quality: 65, description: 'Dominican monastery.' },
  { id: 'sd_santa_barbara', name: 'Iglesia de Santa Bárbara', portId: 'santo_domingo', type: 'church', quality: 55, description: 'Parish church.' },
  { id: 'sd_casa_moneda', name: 'Casa de la Moneda', portId: 'santo_domingo', type: 'government', quality: 60, description: 'Colonial mint — coins minted here.' },
  { id: 'sd_inquisition', name: 'Inquisition Office', portId: 'santo_domingo', type: 'government', quality: 50, safety: 20, description: 'Feared religious authority.' },
  { id: 'sd_fish_market', name: 'Waterfront Fish Market', portId: 'santo_domingo', type: 'market', quality: 40, description: 'Fresh catch from the Ozama River and sea.' },
  { id: 'sd_slave_market', name: 'Santo Domingo Slave Market', portId: 'santo_domingo', type: 'slave_market', description: 'The oldest slave market in the Americas. Near the Ozama River wharf.' },
  { id: 'sd_atarazana', name: 'Atarazana Real', portId: 'santo_domingo', type: 'shipyard', quality: 40, description: 'Royal shipyard on the Ozama River. Modest capacity — repairs more than construction. The first in the New World.' },
  { id: 'sd_almacenes', name: 'Royal Warehouses', portId: 'santo_domingo', type: 'warehouse', quality: 50, description: 'Stone warehouses along the Ozama waterfront. Colonial trade goods and provisions.' },

  // ---- CARTAGENA ----
  { id: 'cart_san_felipe', name: 'Castillo San Felipe de Barajas', portId: 'cartagena', type: 'fort', quality: 99, safety: 99, description: 'The most formidable fortress in the Americas. Underground tunnels, multiple batteries. Nearly impregnable.' },
  { id: 'cart_bocachica_forts', name: 'Bocachica Forts', portId: 'cartagena', type: 'fort', quality: 85, description: 'Chain of forts controlling the only usable harbor entrance: San Luis, San José, San Fernando, Santa Bárbara.' },
  { id: 'cart_cathedral', name: 'Catedral de Santa Catalina', portId: 'cartagena', type: 'church', quality: 80, description: 'Main cathedral of Cartagena.' },
  { id: 'cart_san_pedro_claver', name: 'Iglesia de San Pedro Claver', portId: 'cartagena', type: 'church', quality: 85, description: 'Jesuit monastery. San Pedro Claver was the "Apostle of the Slaves."' },
  { id: 'cart_santo_domingo', name: 'Iglesia de Santo Domingo', portId: 'cartagena', type: 'church', quality: 75, description: 'Dominican church, oldest in the city.' },
  { id: 'cart_la_popa', name: 'Convento de la Popa', portId: 'cartagena', type: 'church', quality: 70, description: 'Monastery on the highest hill overlooking the city.' },
  { id: 'cart_pegasos', name: 'Muelle de los Pegasos', portId: 'cartagena', type: 'dock', quality: 70, description: 'Main city wharf.' },
  { id: 'cart_naval_dock', name: 'Cartagena Naval Dockyard', portId: 'cartagena', type: 'dock', quality: 75, description: 'Repair and provisioning for the Spanish fleet.' },
  { id: 'cart_plaza_coches', name: 'Plaza de los Coches', portId: 'cartagena', type: 'market', quality: 70, description: 'Main commercial plaza, former slave market.' },
  { id: 'cart_portal_dulces', name: 'Portal de los Dulces', portId: 'cartagena', type: 'market', quality: 60, description: 'Covered arcade for trade.' },
  { id: 'cart_inquisition', name: 'Palacio de la Inquisición', portId: 'cartagena', type: 'government', quality: 60, safety: 10, description: 'Inquisition headquarters. Feared throughout the Spanish Main.' },
  { id: 'cart_gov_palace', name: 'Governor\'s Palace', portId: 'cartagena', type: 'government', quality: 80, description: 'Colonial administration center.' },
  { id: 'cart_customs', name: 'Casa de la Aduana', portId: 'cartagena', type: 'government', quality: 65, description: 'Customs House controlling harbor commerce.' },
  { id: 'cart_slave_market', name: 'Cartagena Slave Market', portId: 'cartagena', type: 'slave_market', description: 'One of the primary slave markets in the Spanish Americas.' },
  { id: 'cart_jail', name: 'Cartagena Prison', portId: 'cartagena', type: 'jail', quality: 10, safety: 5, description: 'Cells beneath the Inquisition palace and in the city walls. Pirates and heretics alike.' },
  { id: 'cart_san_pedro', name: 'San Pedro District', portId: 'cartagena', type: 'residential', quality: 85, safety: 80, description: 'Cathedral quarter. Andalusian-style palaces, colonial elite.' },
  { id: 'cart_san_diego', name: 'San Diego District', portId: 'cartagena', type: 'residential', quality: 60, safety: 60, description: 'Merchants, middle class, artisans.' },
  { id: 'cart_getsemani', name: 'Getsemaní', portId: 'cartagena', type: 'residential', quality: 30, safety: 30, corruption: 60, description: '"Popular quarter" — workers, formerly enslaved, vibrant street life. The real city.' },
  { id: 'cart_city_walls', name: 'City Walls', portId: 'cartagena', type: 'fort', quality: 90, description: '11km of massive stone walls encircling the old city. 23 bastions. Up to 18 meters thick.' },
  { id: 'cart_la_mulata', name: 'La Mulata', portId: 'cartagena', type: 'tavern', quality: 55, safety: 40, description: 'Tavern in Getsemaní, mixed clientele — sailors, soldiers off duty, free people of color.' },
  { id: 'cart_taberna_galeones', name: 'Taberna de los Galeones', portId: 'cartagena', type: 'tavern', quality: 65, safety: 55, description: 'Near the naval dockyard, fleet officers and merchants during treasure fleet season.' },
  { id: 'cart_bodegon', name: 'El Bodegón del Puerto', portId: 'cartagena', type: 'tavern', quality: 35, safety: 25, description: 'Dockside drinking hole in Getsemaní. Sailors, dockworkers, rumor mill.' },
  { id: 'cart_astillero', name: 'Cartagena Shipyard', portId: 'cartagena', type: 'shipyard', quality: 70, description: 'Ship repair facility attached to the naval dockyard. Capable of refitting galleons.' },
  { id: 'cart_almacenes', name: 'Royal Warehouses', portId: 'cartagena', type: 'warehouse', quality: 75, description: 'Stone warehouses near the docks. Treasure stored here between fleet sailings.' },
  { id: 'cart_torre_reloj', name: 'Torre del Reloj', portId: 'cartagena', type: 'landmark', description: 'Clock Tower Gate — main entrance through the city walls from Getsemaní. The gateway between worlds.' },
  { id: 'cart_bocagrande', name: 'Bocagrande Passage', portId: 'cartagena', type: 'landmark', description: 'The sealed harbor entrance. Spanish sank ships to block it, forcing all traffic through Bocachica.' },
  { id: 'cart_hospital', name: 'Hospital de San Lázaro', portId: 'cartagena', type: 'hospital', quality: 25, description: 'Leper colony and hospital on an island in the harbor. Also treats tropical fevers.' },

  // ---- PORTOBELO ----
  { id: 'pb_san_felipe', name: 'Fuerte San Felipe de Todo Fierro', portId: 'portobelo', type: 'fort', quality: 65, description: 'Fort All Iron — main harbor defense.' },
  { id: 'pb_santiago', name: 'Fuerte Santiago', portId: 'portobelo', type: 'fort', quality: 55, description: 'Large battery on the harbor\'s south side.' },
  { id: 'pb_san_jeronimo', name: 'Fuerte San Jerónimo', portId: 'portobelo', type: 'fort', quality: 50, description: 'Secondary harbor defense.' },
  { id: 'pb_san_fernando', name: 'Fuerte San Fernando', portId: 'portobelo', type: 'fort', quality: 45, description: 'Overlooks town from elevated position.' },
  { id: 'pb_aduana', name: 'Real Aduana', portId: 'portobelo', type: 'warehouse', quality: 80, description: 'Royal Customs House — massive stone building where treasure was stored during the fair.' },
  { id: 'pb_contaduria', name: 'Contaduría', portId: 'portobelo', type: 'government', quality: 70, description: 'Counting House — where silver was weighed, counted, and taxed.' },
  { id: 'pb_church', name: 'Iglesia de San Felipe', portId: 'portobelo', type: 'church', quality: 60, description: '17th century church with the famous Black Christ of Portobelo golden altar.' },
  { id: 'pb_san_juan', name: 'Iglesia de San Juan de Dios', portId: 'portobelo', type: 'church', quality: 40, description: 'Hospital church — adjacent to the hospital.' },
  { id: 'pb_wharf', name: 'Portobelo Main Wharf', portId: 'portobelo', type: 'dock', quality: 60, description: 'Stone construction, designed for heavy cargo (silver, gold).' },
  { id: 'pb_tavern', name: 'La Feria', portId: 'portobelo', type: 'tavern', quality: 35, safety: 25, description: 'Only proper tavern in Portobelo. Barely standing outside of fair season.' },
  { id: 'pb_market', name: 'Fair Grounds', portId: 'portobelo', type: 'market', quality: 40, description: 'The entire town transforms during the 2-3 week annual treasure fair. Streets become markets.' },
  { id: 'pb_hospital', name: 'Portobelo Hospital', portId: 'portobelo', type: 'hospital', quality: 15, description: 'Desperately needed. Portobelo\'s swamp climate kills visitors rapidly.' },
  { id: 'pb_san_lorenzo', name: 'Fort San Lorenzo', portId: 'portobelo', type: 'fort', quality: 70, safety: 80, description: 'Guards the Chagres River mouth. 80-foot cliff, dry moat with drawbridge. Controls river access to Panama City. Rebuilt after Henry Morgan destroyed it in 1671.' },
  { id: 'pb_jail', name: 'Portobelo Prison', portId: 'portobelo', type: 'jail', quality: 5, safety: 5, description: 'Cells within Fuerte Santiago. Damp, tropical, prisoners rarely last long in the disease-ridden climate.' },
  { id: 'pb_camino_real', name: 'Camino Real Trailhead', portId: 'portobelo', type: 'landmark', description: 'Start of the overland mule trail to Panama City. 80km through jungle. The silver route when the river is impassable.' },
  { id: 'pb_residential', name: 'Portobelo Town', portId: 'portobelo', type: 'residential', quality: 15, safety: 25, description: 'Miserable settlement of a few hundred. Between fairs, Portobelo is a disease-ridden ghost town.' },

  // ---- BOSTON ----
  { id: 'bos_castle_island', name: 'Castle Island (Fort William)', portId: 'boston', type: 'fort', quality: 65, description: 'Island fortress in the harbor, primary defense. Built 1634, rebuilt multiple times.' },
  { id: 'bos_fort_hill', name: 'Fort Hill', portId: 'boston', type: 'fort', quality: 50, description: 'Elevated battery overlooking the harbor from the southern end of town.' },
  { id: 'bos_north_battery', name: 'North Battery', portId: 'boston', type: 'fort', quality: 40, description: 'Waterfront gun emplacement.' },
  { id: 'bos_bunch_grapes', name: 'Bunch of Grapes', portId: 'boston', type: 'tavern', quality: 80, safety: 70, description: 'At the head of Long Wharf. Finest tavern in Boston. Merchant and officer clientele.' },
  { id: 'bos_green_dragon', name: 'The Green Dragon', portId: 'boston', type: 'tavern', quality: 60, safety: 50, description: 'Popular gathering place.' },
  { id: 'bos_blue_anchor', name: 'The Blue Anchor', portId: 'boston', type: 'tavern', quality: 45, safety: 40, description: 'Waterfront tavern.' },
  { id: 'bos_long_wharf', name: 'Long Wharf', portId: 'boston', type: 'dock', quality: 90, description: 'Built 1710-1721, 1,586 feet into the harbor. Up to 50 vessels simultaneously. Warehouses line the north side.' },
  { id: 'bos_town_dock', name: 'Town Dock', portId: 'boston', type: 'dock', quality: 50, description: 'Older, smaller commercial dock.' },
  { id: 'bos_dock_square', name: 'Dock Square Market', portId: 'boston', type: 'market', quality: 65, description: 'Main commercial area near the wharves.' },
  { id: 'bos_shipyards', name: 'Boston Shipyards', portId: 'boston', type: 'shipyard', quality: 85, description: 'Multiple private shipyards — builds the best ships in the English colonies.' },
  { id: 'bos_old_north', name: 'Old North Church', portId: 'boston', type: 'church', quality: 75, description: 'Christ Church — Anglican, tall steeple landmark.' },
  { id: 'bos_old_south', name: 'Old South Meeting House', portId: 'boston', type: 'church', quality: 70, description: 'Puritan congregation meeting house.' },
  { id: 'bos_kings_chapel', name: 'King\'s Chapel', portId: 'boston', type: 'church', quality: 65, description: 'Church of England, for royal officials.' },
  { id: 'bos_state_house', name: 'Massachusetts State House', portId: 'boston', type: 'government', quality: 75, description: 'Colonial government (built 1713). Royal Governor\'s court.' },
  { id: 'bos_customs', name: 'Boston Customs House', portId: 'boston', type: 'government', quality: 65, description: 'At the waterfront.' },
  { id: 'bos_town_house', name: 'Town House', portId: 'boston', type: 'government', quality: 60, description: 'Civic meeting place.' },
  { id: 'bos_jail', name: 'Boston Gaol', portId: 'boston', type: 'jail', quality: 20, safety: 15, description: 'Colonial prison. Pirates await trial and hanging here.' },
  { id: 'bos_gallows', name: 'Gallows on Boston Neck', portId: 'boston', type: 'landmark', description: 'Where pirates are hanged. Bodies sometimes gibbeted on harbor islands as warning.' },
  { id: 'bos_bird_island', name: 'Bird Island', portId: 'boston', type: 'landmark', description: 'In the harbor, used for gibbeting executed pirates as warning to approaching ships.' },
  { id: 'bos_copps_hill', name: 'Copp\'s Hill Burying Ground', portId: 'boston', type: 'landmark', description: 'Old cemetery overlooking the harbor.' },
  { id: 'bos_boston_neck', name: 'Boston Neck', portId: 'boston', type: 'landmark', description: 'Narrow land connection to the mainland — the only land approach to the peninsula.' },
  { id: 'bos_north_end', name: 'North End', portId: 'boston', type: 'residential', quality: 50, safety: 50, description: 'Oldest residential neighborhood. Densely packed houses, winding streets. Near the wharves.' },
  { id: 'bos_warehouse', name: 'Long Wharf Warehouses', portId: 'boston', type: 'warehouse', quality: 75, description: 'Stone warehouses lining the north side of Long Wharf. Colonial goods, rum, naval stores, timber.' },
  { id: 'bos_hospital', name: 'Boston Almshouse', portId: 'boston', type: 'hospital', quality: 35, description: 'Poorhouse that also serves as the town\'s hospital. Treats sailors and the destitute.' },

  // ---- WILLEMSTAD ----
  { id: 'wil_fort_amsterdam', name: 'Fort Amsterdam', portId: 'willemstad', type: 'fort', quality: 65, description: 'Built 1635. Overlooks harbor entrance. Governor\'s residence inside. Protestant church built into the fort.' },
  { id: 'wil_waterfort', name: 'Waterfort', portId: 'willemstad', type: 'fort', quality: 50, description: 'Harbor entrance battery, low walls facing the sea.' },
  { id: 'wil_rif_fort', name: 'Rif Fort', portId: 'willemstad', type: 'fort', quality: 45, description: 'Secondary harbor defense.' },
  { id: 'wil_gouverneur', name: 'De Gouverneur', portId: 'willemstad', type: 'tavern', quality: 70, safety: 60, description: 'Near Fort Amsterdam, Dutch officer and merchant clientele.' },
  { id: 'wil_anker', name: 'Het Anker', portId: 'willemstad', type: 'tavern', quality: 50, safety: 40, description: 'The Anchor — waterfront tavern in Punda, sailors and traders.' },
  { id: 'wil_zwarte_kat', name: 'De Zwarte Kat', portId: 'willemstad', type: 'tavern', quality: 40, safety: 30, description: 'The Black Cat — Otrobanda side, rougher, more diverse.' },
  { id: 'wil_handelskade', name: 'Handelskade', portId: 'willemstad', type: 'dock', quality: 75, description: 'Main commercial quay along Sint Anna Bay, Punda side. Warehouses directly on the waterfront.' },
  { id: 'wil_schottegat', name: 'Schottegat', portId: 'willemstad', type: 'dock', quality: 70, description: 'Massive inner harbor behind the narrows. Ship repair, careening, storage.' },
  { id: 'wil_wic_wharf', name: 'WIC Wharf', portId: 'willemstad', type: 'dock', quality: 65, description: 'Dutch West India Company\'s own commercial dock.' },
  { id: 'wil_floating_market', name: 'Floating Market', portId: 'willemstad', type: 'market', quality: 65, description: 'Boats from Venezuela sell fresh produce directly from their vessels.' },
  { id: 'wil_punda_market', name: 'Punda Market', portId: 'willemstad', type: 'market', quality: 60, description: 'Regulated Dutch-style market.' },
  { id: 'wil_fort_church', name: 'Fort Church', portId: 'willemstad', type: 'church', quality: 60, description: 'Protestant church built into Fort Amsterdam.' },
  { id: 'wil_synagogue', name: 'Mikvé Israel-Emanuel Synagogue', portId: 'willemstad', type: 'church', quality: 75, description: 'Sephardic Jewish synagogue (founded 1651). Sand floor. The Jewish community is a MAJOR commercial force.' },
  { id: 'wil_wic', name: 'WIC Trading House', portId: 'willemstad', type: 'government', quality: 70, description: 'Dutch West India Company headquarters.' },
  { id: 'wil_gov_residence', name: 'Governor\'s Residence', portId: 'willemstad', type: 'government', quality: 65, description: 'Inside Fort Amsterdam.' },
  { id: 'wil_customs', name: 'Customs House', portId: 'willemstad', type: 'government', quality: 60, description: 'Harbor entrance. Controls all commerce.' },
  { id: 'wil_punda', name: 'Punda', portId: 'willemstad', type: 'residential', quality: 65, safety: 65, description: 'East side of Sint Anna Bay. Dutch colonial houses painted in bright colors. Merchants, WIC officials, Jewish traders.' },
  { id: 'wil_otrobanda', name: 'Otrobanda', portId: 'willemstad', type: 'residential', quality: 40, safety: 35, description: '"Other Side" — west of the bay. Sailors, freedmen, poorer residents. More diverse and rougher than Punda.' },
  { id: 'wil_jail', name: 'Fort Amsterdam Prison', portId: 'willemstad', type: 'jail', quality: 20, safety: 15, description: 'Cells within the fort. Dutch justice is pragmatic — fines preferred over imprisonment.' },
  { id: 'wil_wic_warehouse', name: 'WIC Warehouses', portId: 'willemstad', type: 'warehouse', quality: 70, description: 'Dutch West India Company storage. Colonial goods, slave trade provisions, European imports.' },
  { id: 'wil_shipyard', name: 'Schottegat Shipyard', portId: 'willemstad', type: 'shipyard', quality: 60, description: 'Ship repair and careening in the massive inner harbor. Dutch engineering, competent work.' },
  { id: 'wil_slave_market', name: 'Willemstad Slave Market', portId: 'willemstad', type: 'slave_market', description: 'Curaçao is the Dutch slave trade hub. Enslaved people are "seasoned" here before resale throughout the Caribbean and Spanish colonies.' },
  { id: 'wil_pontoon', name: 'Queen Emma Bridge', portId: 'willemstad', type: 'landmark', description: 'Floating pontoon bridge connecting Punda and Otrobanda across Sint Anna Bay. Opens to allow ships into Schottegat.' },

  // ---- VERACRUZ ----
  { id: 'ver_san_juan', name: 'San Juan de Ulúa', portId: 'veracruz', type: 'fort', quality: 95, description: 'Island fortress with 250 cannons. 3-foot thick walls. Treasure stored here between fleet departures. Also functions as prison.' },
  { id: 'ver_parroquia', name: 'La Parroquia', portId: 'veracruz', type: 'tavern', quality: 60, description: 'Coffee house and tavern near the main plaza. The coffee tradition here is centuries old.' },
  { id: 'ver_portal', name: 'El Portal', portId: 'veracruz', type: 'tavern', quality: 50, description: 'Waterfront tavern, fleet crews when in port.' },
  { id: 'ver_sirena', name: 'La Sirena', portId: 'veracruz', type: 'tavern', quality: 35, safety: 30, description: 'Sailors\' tavern near the docks.' },
  { id: 'ver_wharf', name: 'Veracruz Main Wharf', portId: 'veracruz', type: 'dock', quality: 60, description: 'Between city and San Juan de Ulúa.' },
  { id: 'ver_fleet_anchorage', name: 'Fleet Anchorage', portId: 'veracruz', type: 'dock', quality: 55, description: 'Open water between fortress and shore. Ships lighter cargo to docks.' },
  { id: 'ver_plaza', name: 'Plaza de Armas Market', portId: 'veracruz', type: 'market', quality: 60, description: 'Main market square.' },
  { id: 'ver_waterfront_market', name: 'Waterfront Market', portId: 'veracruz', type: 'market', quality: 45, description: 'Provisions for fleet crews.' },
  { id: 'ver_church', name: 'Parroquia de la Asunción', portId: 'veracruz', type: 'church', quality: 65, description: 'Main parish church.' },
  { id: 'ver_san_francisco', name: 'Convento de San Francisco', portId: 'veracruz', type: 'church', quality: 55, description: 'Franciscan monastery.' },
  { id: 'ver_customs', name: 'Veracruz Customs House', portId: 'veracruz', type: 'government', quality: 65, description: 'All trade controlled through Casa de Contratación system.' },
  { id: 'ver_cabildo', name: 'Cabildo', portId: 'veracruz', type: 'government', quality: 55, description: 'City Hall on the main plaza.' },
  { id: 'ver_hospital', name: 'Hospital de Nuestra Señora de Loreto', portId: 'veracruz', type: 'hospital', quality: 30, description: 'Church hospital. Yellow fever kills newcomers regularly.' },
  { id: 'ver_jail', name: 'San Juan de Ulúa Prison', portId: 'veracruz', type: 'jail', quality: 5, safety: 5, description: 'Cells within the fortress. Damp, dark, surrounded by water. Notorious.' },
  { id: 'ver_almacenes', name: 'Royal Warehouses', portId: 'veracruz', type: 'warehouse', quality: 65, description: 'Stone warehouses for treasure fleet cargoes. Silver, cochineal, indigo, chocolate awaiting shipment to Spain.' },
  { id: 'ver_barrio', name: 'Veracruz Residential Quarter', portId: 'veracruz', type: 'residential', quality: 40, safety: 45, description: 'Between the walls and the sea. Stifling heat, mosquitoes, disease. Most officials flee to the highlands when they can.' },
  { id: 'ver_medanos', name: 'Los Médanos', portId: 'veracruz', type: 'landmark', description: 'Sand dunes south of the city. The desolate landscape greeting arriving ships. Northers bury the city in sand.' },
  { id: 'ver_slave_market', name: 'Veracruz Slave Market', portId: 'veracruz', type: 'slave_market', description: 'Primary entry point for enslaved Africans into New Spain. Near the main wharf.' },

  // ---- PETIT-GOAVE ----
  { id: 'pg_fort', name: 'Petit-Goâve Fort', portId: 'petit_goave', type: 'fort', quality: 30, description: 'Small French fortification overlooking the harbor.' },
  { id: 'pg_corsaire', name: 'Le Corsaire', portId: 'petit_goave', type: 'tavern', quality: 55, safety: 25, corruption: 80, description: 'The corsair tavern. French pirates and privateers. Rum and intrigue.' },
  { id: 'pg_flibustier', name: 'Le Flibustier', portId: 'petit_goave', type: 'tavern', quality: 35, safety: 20, description: 'Rougher waterfront establishment.' },
  { id: 'pg_carenage', name: 'Îlet du Carénage', portId: 'petit_goave', type: 'dock', quality: 50, description: 'Island in the bay specifically for careening ships.' },
  { id: 'pg_wharf', name: 'Petit-Goâve Wharf', portId: 'petit_goave', type: 'dock', quality: 35, description: 'Modest wooden construction.' },
  { id: 'pg_market', name: 'Petit-Goâve Market', portId: 'petit_goave', type: 'market', quality: 30, description: 'Small open market — provisions, local produce.' },
  { id: 'pg_church', name: 'Église de Petit-Goâve', portId: 'petit_goave', type: 'church', quality: 40, description: 'Catholic parish church.' },
  { id: 'pg_gov', name: 'Governor\'s House', portId: 'petit_goave', type: 'government', quality: 40, corruption: 80, description: 'French colonial administrator. Famously corrupt and corsair-friendly.' },
  { id: 'pg_jail', name: 'Petit-Goâve Lockup', portId: 'petit_goave', type: 'jail', quality: 10, safety: 10, description: 'A few cells in the fort. The governor usually just fines offenders — or looks the other way.' },
  { id: 'pg_warehouse', name: 'Corsair Storehouse', portId: 'petit_goave', type: 'warehouse', quality: 25, corruption: 85, description: 'Wooden warehouse where corsair plunder is stored before fencing. The governor takes his cut.' },
  { id: 'pg_baie', name: 'Petit-Goâve Bay', portId: 'petit_goave', type: 'landmark', description: 'Deep natural harbor sheltered by mountains. Why the corsairs chose this place — perfect anchorage.' },
  { id: 'pg_settlement', name: 'French Settlement', portId: 'petit_goave', type: 'residential', quality: 25, safety: 30, description: 'Small French colonial town. Wooden houses, a few stone buildings. Buccaneers, planters, merchants.' },

  // ---- BASSETERRE ----
  { id: 'bas_brimstone', name: 'Brimstone Hill Fortress', portId: 'basseterre', type: 'fort', quality: 85, description: '"The Gibraltar of the West Indies." Massive fortress on 800-foot volcanic hill. Multiple bastions, barracks, hospital, officers\' quarters.' },
  { id: 'bas_fort_charles', name: 'Fort Charles', portId: 'basseterre', type: 'fort', quality: 50, description: 'Coastal fort near Basseterre.' },
  { id: 'bas_fort_thomas', name: 'Fort Thomas', portId: 'basseterre', type: 'fort', quality: 45, description: 'Coastal defense.' },
  { id: 'bas_pelican', name: 'The Pelican', portId: 'basseterre', type: 'tavern', quality: 50, description: 'Waterfront tavern, English naval and merchant clientele.' },
  { id: 'bas_sugar_loaf', name: 'The Sugar Loaf', portId: 'basseterre', type: 'tavern', quality: 45, description: 'Named for the island\'s primary export.' },
  { id: 'bas_wharf', name: 'Basseterre Wharf', portId: 'basseterre', type: 'dock', quality: 45, description: 'Main commercial landing. Ships anchor in the bay, cargo moved by small boats.' },
  { id: 'bas_market', name: 'Basseterre Market', portId: 'basseterre', type: 'market', quality: 50, description: 'Sugar, provisions, enslaved people.' },
  { id: 'bas_church', name: 'St. George\'s Church', portId: 'basseterre', type: 'church', quality: 55, description: 'Originally a French Jesuit Catholic church, rebuilt as Anglican. Destroyed and rebuilt 4 times.' },
  { id: 'bas_gov_house', name: 'Government House', portId: 'basseterre', type: 'government', quality: 50, description: 'English colonial administration. Administrative presence from 1713.' },
  { id: 'bas_customs', name: 'Customs House', portId: 'basseterre', type: 'government', quality: 45, description: 'Controls trade and duties.' },
  { id: 'bas_jail', name: 'Basseterre Gaol', portId: 'basseterre', type: 'jail', quality: 15, safety: 10, description: 'Small colonial prison. Mostly used for runaway enslaved people and drunken soldiers.' },
  { id: 'bas_plantation_row', name: 'Plantation Row', portId: 'basseterre', type: 'residential', quality: 50, safety: 55, description: 'Great houses of the sugar plantation owners along the coast road. The planter elite.' },
  { id: 'bas_brimstone_road', name: 'Brimstone Hill Road', portId: 'basseterre', type: 'landmark', description: 'The winding road up to the fortress. 800 feet of volcanic hill with views across to Nevis, Montserrat, and beyond.' },
  { id: 'bas_sugar_warehouse', name: 'Sugar Warehouses', portId: 'basseterre', type: 'warehouse', quality: 55, description: 'Hogsheads of sugar and barrels of rum stacked along the waterfront awaiting the next fleet.' },
  { id: 'bas_shipyard', name: 'Basseterre Boat Yard', portId: 'basseterre', type: 'shipyard', quality: 30, description: 'Small repair facility. Can handle sloops and small vessels. Larger ships must go elsewhere.' },
];

// West African post places
export const AFRICAN_POST_PLACES: PlaceDefinition[] = [
  { id: 'ccc_castle', name: 'Cape Coast Castle', portId: 'cape_coast_castle', type: 'fort', quality: 70, description: 'Large stone fortress. Multiple levels, gun batteries. Primary English slave trading HQ in West Africa.' },
  { id: 'ccc_trading_hall', name: 'Trading Hall', portId: 'cape_coast_castle', type: 'trading_post', quality: 50, description: 'Where European goods are exchanged for enslaved people, gold, ivory.' },
  { id: 'ccc_dungeons', name: 'Slave Dungeons', portId: 'cape_coast_castle', type: 'jail', quality: 1, safety: 1, description: 'Underground vaulted cellars. Hold up to 1,500 enslaved people. No ventilation, no light.' },
  { id: 'ccc_door', name: 'The Door of No Return', portId: 'cape_coast_castle', type: 'landmark', description: 'The gate through which enslaved people pass from the dungeons to the boats. One-way.' },
  { id: 'ccc_chapel', name: 'Castle Chapel', portId: 'cape_coast_castle', type: 'church', quality: 50, description: 'Located directly ABOVE the slave dungeons. Those below could hear preaching through the floor.' },
  { id: 'ccc_governor', name: 'Governor\'s Quarters', portId: 'cape_coast_castle', type: 'residential', quality: 70, description: 'Spacious upper floor rooms with parquet floors, ocean views, dining hall. Comfortable European living — above the dungeons.' },
  { id: 'ccc_officers', name: 'Officers\' Quarters', portId: 'cape_coast_castle', type: 'residential', quality: 50, description: 'Upper levels, airy rooms with windows.' },
  { id: 'ccc_courtyard', name: 'Castle Courtyard', portId: 'cape_coast_castle', type: 'landmark', description: 'Open central area, parade ground. Transactions and punishments occur in view of the entire garrison.' },
  { id: 'ccc_confinement', name: 'Confinement Cells', portId: 'cape_coast_castle', type: 'jail', quality: 1, safety: 1, description: 'Pitch-black punishment cells for those who resist. Smaller than a coffin standing up.' },
  { id: 'ccc_storage', name: 'Storage Rooms', portId: 'cape_coast_castle', type: 'warehouse', quality: 50, description: 'European trade goods: cloth, iron bars, guns, gunpowder, rum, glass beads, brass goods, cowrie shells.' },

  { id: 'elm_castle', name: 'Elmina Castle', portId: 'elmina', type: 'fort', quality: 75, description: 'Oldest European building in sub-Saharan Africa (1482). Portuguese-built, Dutch-modified.' },
  { id: 'elm_coenraadsburg', name: 'Fort Coenraadsburg', portId: 'elmina', type: 'fort', quality: 60, description: 'Hilltop fort overlooking Elmina Castle. Built by Dutch to bombard the castle if retaken.' },
  { id: 'elm_trading', name: 'Elmina Trading Hall', portId: 'elmina', type: 'trading_post', quality: 50, description: 'Dutch trading operations — pragmatic, profit-focused.' },
  { id: 'elm_st_george', name: 'St. George\'s Room', portId: 'elmina', type: 'trading_post', quality: 55, description: 'The original Portuguese trading chamber.' },
  { id: 'elm_governor', name: 'Dutch Governor\'s Quarters', portId: 'elmina', type: 'residential', quality: 60, description: 'Upper floor, overlooking the bay.' },
  { id: 'elm_dungeons', name: 'Elmina Slave Dungeons', portId: 'elmina', type: 'jail', quality: 1, safety: 1, description: 'Underground. Same horror as Cape Coast.' },
  { id: 'elm_warehouse', name: 'Elmina Trade Warehouse', portId: 'elmina', type: 'warehouse', quality: 50, description: 'Storage for European trade goods — cloth, iron, guns, beads, spirits — exchanged for gold and enslaved people.' },
  { id: 'elm_door', name: 'Door of No Return', portId: 'elmina', type: 'landmark', description: 'The gate opening directly onto the sea. Enslaved people passed through to waiting boats. One-way.' },
  { id: 'elm_beach', name: 'Elmina Beach', portId: 'elmina', type: 'landmark', description: 'Fishing village on the beach below the castle. Local Fante community. Canoes launch from here.' },

  { id: 'why_french_fort', name: 'Fort Saint-Louis de Grégoy', portId: 'whydah', type: 'fort', quality: 40, description: 'Small French fortified trading post.' },
  { id: 'why_english', name: 'English Factory', portId: 'whydah', type: 'trading_post', quality: 40, description: 'English trading post (factory = trading agent\'s station).' },
  { id: 'why_portuguese', name: 'Portuguese Trading Post', portId: 'whydah', type: 'trading_post', quality: 35, description: 'The oldest European presence at Whydah.' },
  { id: 'why_route_slaves', name: 'The Route of Slaves', portId: 'whydah', type: 'landmark', description: 'The 4km path from the town to the beach, lined with ritual sites.' },
  { id: 'why_dahomey', name: 'Dahomey Royal Compound', portId: 'whydah', type: 'government', quality: 70, description: 'The King of Dahomey\'s representatives oversee ALL trade. European forts exist only with his permission.' },
  { id: 'why_market', name: 'Whydah Market', portId: 'whydah', type: 'market', quality: 55, description: 'Active trading market. European goods, local produce, textiles. All transactions require Dahomey royal approval.' },
  { id: 'why_barracoons', name: 'Slave Barracoons', portId: 'whydah', type: 'slave_market', description: 'Holding pens near the beach where enslaved people await the ships. The final stage before the Middle Passage.' },
  { id: 'why_warehouse', name: 'Trade Goods Store', portId: 'whydah', type: 'warehouse', quality: 40, description: 'Storage for European imports — muskets, powder, cloth, iron bars, cowrie shells, spirits — the currency of the slave trade.' },
];

// European city places (background decision centers)
export const EUROPEAN_CITY_PLACES: PlaceDefinition[] = [
  // ---- LONDON ----
  { id: 'lon_admiralty', name: 'The Admiralty', portId: 'london', type: 'government', quality: 95, description: 'Whitehall. Where anti-piracy policy is made, patrol routes assigned, warships dispatched.' },
  { id: 'lon_lloyds', name: 'Lloyd\'s Coffee House', portId: 'london', type: 'tavern', quality: 85, safety: 80, description: 'Lombard Street. Where shipping insurance is bought and sold. THE intelligence hub for shipping information.' },
  { id: 'lon_east_india', name: 'East India House', portId: 'london', type: 'government', quality: 90, description: 'Leadenhall Street. East India Company HQ. Their own navy, their own trade routes. Lobbies Parliament for pirate suppression.' },
  { id: 'lon_tower', name: 'The Tower of London', portId: 'london', type: 'fort', quality: 95, description: 'Royal mint, armory, prison. Where captured pirate treasure is sometimes sent.' },
  { id: 'lon_execution_dock', name: 'Execution Dock, Wapping', portId: 'london', type: 'landmark', description: 'Where pirates are hanged at low tide, bodies left for three tides, then gibbeted along the Thames. Captain Kidd was executed here in 1701.' },
  { id: 'lon_parliament', name: 'Parliament', portId: 'london', type: 'government', quality: 95, description: 'Where colonial policy is debated. Trade merchants and ship owners lobby MPs. Anti-piracy legislation originates here.' },
  { id: 'lon_pool', name: 'Pool of London', portId: 'london', type: 'dock', quality: 85, description: 'The stretch of Thames below London Bridge where ocean-going ships dock. Forest of masts, constant activity.' },
  { id: 'lon_deptford', name: 'Deptford Royal Dockyard', portId: 'london', type: 'shipyard', quality: 90, description: 'Royal Navy dockyard on the Thames. Where warships are built, repaired, and fitted for anti-piracy patrols.' },
  { id: 'lon_warehouses', name: 'Thames Warehouses', portId: 'london', type: 'warehouse', quality: 80, description: 'Massive riverside warehouses. Sugar, tobacco, rum, and colonial goods pour through here. The wealth of empire.' },
  { id: 'lon_exchange', name: 'Royal Exchange', portId: 'london', type: 'market', quality: 90, description: 'Cornhill. Where merchants trade colonial commodities. Sugar prices set here ripple across the Caribbean.' },

  // ---- SEVILLE / CADIZ ----
  { id: 'sev_contratacion', name: 'Casa de Contratación', portId: 'seville_cadiz', type: 'government', quality: 95, description: 'House of Trade. Controls ALL Spanish colonial commerce. Every ship, cargo, route must be authorized. Moving from Seville to Cádiz in 1717.' },
  { id: 'sev_torre_oro', name: 'Torre del Oro', portId: 'seville_cadiz', type: 'landmark', description: 'Golden Tower on the Guadalquivir River. Where treasure fleet cargoes were inspected and registered upon arrival.' },
  { id: 'sev_archivo', name: 'Archivo General de Indias', portId: 'seville_cadiz', type: 'government', quality: 80, description: 'Records of every colonial transaction, every ship, every cargo. The administrative memory of the Spanish Empire.' },
  { id: 'sev_cadiz_harbor', name: 'Cádiz Harbor', portId: 'seville_cadiz', type: 'dock', quality: 80, description: 'Taking over from Seville as the treasure fleet terminus. Deep water, better access.' },
  { id: 'sev_cathedral', name: 'Seville Cathedral', portId: 'seville_cadiz', type: 'church', quality: 95, description: 'Largest Gothic cathedral in the world. Columbus is buried here. The spiritual center of the colonial enterprise.' },
  { id: 'sev_alcazar', name: 'Real Alcázar', portId: 'seville_cadiz', type: 'fort', quality: 90, description: 'Royal palace and fortress. The Crown\'s seat of power in Andalusia.' },
  { id: 'sev_almacenes', name: 'Seville Warehouses', portId: 'seville_cadiz', type: 'warehouse', quality: 75, description: 'Along the Guadalquivir. Treasure fleet cargoes stored and distributed. The wealth of the New World flows through here.' },
  { id: 'sev_lonja', name: 'Lonja de Mercaderes', portId: 'seville_cadiz', type: 'market', quality: 80, description: 'Merchant exchange. Where colonial trade is brokered. Later becomes the Archivo de Indias.' },

  // ---- AMSTERDAM ----
  { id: 'ams_wic', name: 'West-Indisch Huis', portId: 'amsterdam', type: 'government', quality: 85, description: 'Herengracht. Dutch West India Company HQ. Decisions about Curaçao, slave trade, and Caribbean operations.' },
  { id: 'ams_bourse', name: 'Amsterdam Bourse', portId: 'amsterdam', type: 'market', quality: 95, description: 'The world\'s first stock exchange. WIC and VOC shares traded here. Financial center of Europe.' },
  { id: 'ams_warehouses', name: 'Herengracht Warehouses', portId: 'amsterdam', type: 'warehouse', quality: 80, description: 'Canal-side warehouses storing colonial goods. The physical infrastructure of Dutch trade.' },
  { id: 'ams_admiralty', name: 'Admiralty of Amsterdam', portId: 'amsterdam', type: 'government', quality: 80, description: 'Dutch naval headquarters. Ships, officers, orders.' },
  { id: 'ams_banks', name: 'Banking Houses', portId: 'amsterdam', type: 'government', quality: 90, description: 'Amsterdam bankers finance voyages, extend credit across oceans. Most sophisticated financial system in the world in 1715.' },
  { id: 'ams_oostenburg', name: 'Oostenburg Shipyard', portId: 'amsterdam', type: 'dock', quality: 85, description: 'VOC/WIC shipyard on the IJ. Where East and West Indiamen are built and fitted. Among the largest in Europe.' },
  { id: 'ams_oude_kerk', name: 'Oude Kerk', portId: 'amsterdam', type: 'church', quality: 75, description: 'Old Church — Amsterdam\'s oldest building. Sailors\' wives prayed here while their men sailed for the Caribbean.' },
  { id: 'ams_zeemanskerk', name: 'De Zeemanshoop', portId: 'amsterdam', type: 'tavern', quality: 65, safety: 60, description: 'Sailor\'s tavern near the docks. Where crews are recruited for WIC voyages. Rum and stories from the Caribbean.' },
];

// Spanish Town, Jamaica — the actual capital (10 miles from Port Royal)
export const SPANISH_TOWN_PLACES: PlaceDefinition[] = [
  { id: 'st_kings_house', name: 'King\'s House', portId: 'port_royal', type: 'government', quality: 75, description: 'Governor\'s residence in Spanish Town, 10 miles from Port Royal. Orders from the Governor must travel by road.' },
  { id: 'st_cathedral', name: 'St. Catherine\'s Cathedral', portId: 'port_royal', type: 'church', quality: 70, description: 'Oldest Anglican cathedral in the Caribbean (converted from Catholic 1655). In Spanish Town.' },
  { id: 'st_assembly', name: 'House of Assembly', portId: 'port_royal', type: 'government', quality: 70, description: 'Jamaica\'s colonial legislature. In Spanish Town, not Port Royal.' },
  { id: 'st_courthouse', name: 'Spanish Town Court House', portId: 'port_royal', type: 'government', quality: 65, description: 'Where colonial justice is administered. 10 miles from Port Royal — messages take hours.' },
];

// All places combined
export const ALL_PLACES: PlaceDefinition[] = [...PORT_PLACES, ...AFRICAN_POST_PLACES, ...EUROPEAN_CITY_PLACES, ...SPANISH_TOWN_PLACES];

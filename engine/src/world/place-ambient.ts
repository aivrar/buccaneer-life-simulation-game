// Place-aware ambient text generation for land-based locations
// Composes from weather experience + place activity + regional flavor + event overlay
// Covers all 16 place types × 7 weather conditions × 4 times of day × 9 regions

import type { WeatherState, GameTime, WeatherEventInstance } from '../runtime/types.js';
import { WeatherCondition, WeatherEventType } from '../runtime/types.js';
import { getTimeOfDay } from './time.js';
import { ALL_PLACES, type PlaceType } from '../config/places.js';
import { PORT_PROFILES } from '../config/ports.js';
import {
  type PlaceExposure,
  type PortRegion,
  type PlaceActivityLevel,
  PLACE_EXPOSURE,
  getPortRegion,
  getPlaceActivityLevel,
} from '../config/place-weather.js';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

// ============================================================
// Section 1: Weather Experience by Exposure Level
// What the weather feels/sounds/looks like from this shelter level
// ============================================================

const WEATHER_EXPERIENCE: Record<PlaceExposure, Record<WeatherCondition, Partial<Record<TimeOfDay, string[]>>>> = {
  // ── EXPOSED ─────────────────────────────────────────────
  exposed: {
    [WeatherCondition.CLEAR]: {
      morning: [
        'The morning sun climbs into a cloudless sky. The air is already warm, carrying the smell of salt and cooking fires.',
        'A fine morning. The sky is brilliant blue, the breeze light and steady.',
        'Dawn light floods the open ground. Shadows are sharp, the air clean from the night.',
      ],
      afternoon: [
        'The afternoon sun is merciless. Heat shimmers off stone and packed earth. There is no shade to be found.',
        'The full glare of the tropical sun beats down. Sweat soaks through every shirt within minutes.',
        'A blazing afternoon. The sun is a white disc overhead, the air thick and heavy.',
      ],
      evening: [
        'The sun sinks low, painting the sky in amber and rose. The heat begins to release its grip.',
        'Evening brings relief at last. The light turns golden, long shadows stretching across the ground.',
        'The western sky burns with color as the day ends. A cooler breeze stirs.',
      ],
      night: [
        'A warm tropical night under a canopy of stars. The air is soft, carrying voices and distant music.',
        'The night sky is magnificent — a vault of stars from horizon to horizon. Torchlight flickers.',
        'Darkness settles over the open ground. Fireflies drift. The heat of the day slowly radiates from the stone.',
      ],
    },
    [WeatherCondition.CLOUDY]: {
      morning: [
        'An overcast morning. Grey clouds stretch low overhead, pressing the heat down. The air is thick and humid.',
        'The sky is a featureless grey. No shadows, no breeze. An oppressive, muggy morning.',
      ],
      afternoon: [
        'Heavy clouds trap the heat. The afternoon is grey and close, the air hard to breathe.',
        'Overcast and stifling. The clouds promise rain but deliver nothing. The humidity is punishing.',
      ],
      evening: [
        'The overcast sky glows briefly orange at sunset before fading to a dull grey.',
        'Evening comes without drama. The cloud cover holds, sealing in the warmth.',
      ],
      night: [
        'A dark, overcast night. No stars, no moon. The air is heavy and still.',
        'The cloud cover makes the night absolute. Torchlight and lanterns are the only relief.',
      ],
    },
    [WeatherCondition.RAIN]: {
      morning: [
        'Rain falls in warm, heavy sheets. The ground is quickly awash, red mud forming in every hollow.',
        'A grey morning of steady rain. Water streams off every surface. The smell of wet earth is strong.',
        'The rain started before dawn and shows no sign of stopping. Everything is sodden.',
      ],
      afternoon: [
        'Afternoon rain drums steadily on stone and thatch. Puddles merge into streams running downhill.',
        'The rain continues, warm and relentless. Visibility drops to a few hundred yards.',
      ],
      evening: [
        'Rain at evening. Water drips from every eave and ledge. The light fades behind grey curtains.',
        'The rain eases slightly as evening comes, but the ground is a muddy morass.',
      ],
      night: [
        'Rain patters through the darkness. The ground is treacherous underfoot, slick with mud.',
        'A wet, warm night. The rain has driven most people under cover. Water gurgles in every gutter.',
      ],
    },
    [WeatherCondition.STORM]: {
      morning: [
        'The storm howls across the open ground. Rain drives sideways, stinging exposed skin. The world is grey and violent.',
        'Morning brings no comfort. The storm rages, wind tearing at anything not secured. Debris flies.',
      ],
      afternoon: [
        'The storm is at full fury. Trees bend nearly to the ground. The air is more water than air.',
        'Impossible to stand upright in the wind. The storm turns the open ground into a dangerous place.',
      ],
      evening: [
        'The storm shows no sign of relenting as darkness approaches. Lightning illuminates a scene of devastation.',
      ],
      night: [
        'A hellish night in the open. Lightning cracks, thunder shakes the ground. The wind screams endlessly.',
        'No one should be outside tonight. The storm owns the open ground.',
      ],
    },
    [WeatherCondition.HURRICANE]: {
      morning: [
        'The hurricane is upon us. The wind is a solid wall of force, tearing roofs from buildings. Nothing survives in the open.',
        'Dawn — if it has come — is invisible. The world is a roaring chaos of wind, water, and debris.',
      ],
      afternoon: [
        'The hurricane shows no mercy. Trees are uprooted, stones fly through the air. To be outside is to die.',
        'The full fury of the storm. The very air is weaponized — boards, branches, roof tiles become missiles.',
      ],
      evening: [
        'Hours of punishment with no end in sight. The hurricane continues to tear the world apart.',
      ],
      night: [
        'A night of absolute horror. The hurricane screams in the darkness. Every crash could be a building collapsing.',
        'No light penetrates the hurricane. The darkness is total, the noise overwhelming, the destruction constant.',
      ],
    },
    [WeatherCondition.FOG]: {
      morning: [
        'Dense morning fog blankets the ground. Shapes appear and vanish at twenty paces. Sound carries strangely.',
        'A thick fog has rolled in, reducing the world to a grey, damp sphere barely wider than arm\'s reach.',
        'The fog is so thick you can taste the moisture. Every surface drips. Voices echo oddly.',
      ],
      afternoon: [
        'The fog persists into the afternoon, unusual and unsettling. The sun is a dim pale disc.',
        'Afternoon and still fog-bound. The air is clammy, visibility poor. An eerie quiet prevails.',
      ],
      evening: [
        'The fog thickens as evening cools the air. Lanterns make dim yellow halos in the murk.',
      ],
      night: [
        'A fog-shrouded night. Lanterns barely penetrate three feet. Every sound is muffled and directionless.',
        'The fog and darkness combine into a blind, damp world. Nothing exists beyond arm\'s reach.',
      ],
    },
    [WeatherCondition.BECALMED]: {
      morning: [
        'Not a breath of air stirs. The morning heat is already oppressive, the sky a hazy white.',
        'Dead calm. The air is absolutely still, the heat building with every minute. Insects drone.',
      ],
      afternoon: [
        'The stillness is suffocating. Not a leaf moves, not a flag stirs. The heat is a physical weight.',
        'The dead calm continues. The sun bakes everything without mercy. Even the flies seem sluggish.',
      ],
      evening: [
        'Evening brings no breeze. The heat radiates back from stone and earth. The air is stifling.',
      ],
      night: [
        'A breathless night. The air is warm and utterly still. Sleep is impossible in the heat.',
      ],
    },
  },

  // ── SEMI-SHELTERED ──────────────────────────────────────
  semi_sheltered: {
    [WeatherCondition.CLEAR]: {
      morning: [
        'Morning sun angles under the roof, throwing patches of light across the work area. The air is warm but the shade helps.',
        'A fine morning. The open sides let in the breeze, and the roof keeps the worst of the sun off.',
      ],
      afternoon: [
        'The afternoon sun beats on the roof overhead. Heat builds under the shelter, but it is better than being fully exposed.',
        'Hot afternoon under the canopy. The shade is welcome but the air is thick and still.',
      ],
      evening: [
        'The evening light slants in low from the west. The day\'s heat slowly dissipates.',
      ],
      night: [
        'Night air circulates through the open sides. Lanterns hang from the roof beams, swaying gently.',
      ],
    },
    [WeatherCondition.CLOUDY]: {
      morning: [
        'An overcast morning. The shelter hardly matters under the grey sky — it is uniformly dull and humid.',
      ],
      afternoon: [
        'Overcast and close. The covered space traps the humidity. Sweat drips from every brow.',
      ],
      evening: [
        'Evening under grey skies. The shelter provides no comfort against the clinging humidity.',
      ],
      night: [
        'A dark, overcast night. The shelter feels smaller in the blackness, lanterns the only light.',
      ],
    },
    [WeatherCondition.RAIN]: {
      morning: [
        'Rain drums on the roof overhead. Water cascades off the edges. The open sides let spray through when the wind gusts.',
        'The roof keeps the worst off, but rain blows in from the sides. The floor is slick.',
      ],
      afternoon: [
        'Steady rain hammers the roof. Workers shelter under cover, watching the downpour sheet past.',
      ],
      evening: [
        'Rain continues as evening falls. The shelter becomes the only dry ground for yards around.',
      ],
      night: [
        'Rain on the roof all night. The steady drumming is hypnotic. The ground beyond the shelter is awash.',
      ],
    },
    [WeatherCondition.STORM]: {
      morning: [
        'The storm drives rain through the open sides. The roof shudders in the gusts. Tools and loose items blow about.',
        'The shelter provides little protection. Wind-driven rain soaks everything. Work is impossible.',
      ],
      afternoon: [
        'The storm batters the structure. The roof groans. Water pours through gaps. Everyone huddles in the most protected corner.',
      ],
      evening: [
        'The storm continues to punish the half-sheltered space. Everything exposed to the wind side is soaked and battered.',
      ],
      night: [
        'A terrifying night under a roof that feels ready to lift off. The storm finds every gap.',
      ],
    },
    [WeatherCondition.HURRICANE]: {
      morning: [
        'The hurricane tears at the roof. Sections rip away. What was semi-sheltered becomes dangerously exposed.',
        'No shelter is enough. The hurricane peels back roofing and sends it flying. Debris pierces the walls.',
      ],
      afternoon: [
        'The structure is failing. The hurricane has torn away most of the protection. Survival means finding better cover.',
      ],
      evening: [
        'What remains of the shelter shudders and groans. The hurricane has reduced it to a skeleton.',
      ],
      night: [
        'Night in the hurricane. The shelter is gone or going. Every crash in the darkness could be the final collapse.',
      ],
    },
    [WeatherCondition.FOG]: {
      morning: [
        'Fog fills the open-sided structure, making the interior dim and close. Moisture beads on every surface.',
      ],
      afternoon: [
        'The fog persists. The covered space feels isolated, cut off from the world beyond a few paces.',
      ],
      evening: [
        'Fog and evening combine. Lantern light barely reaches the edges of the shelter.',
      ],
      night: [
        'A fog-bound night. The shelter is an island in a grey void.',
      ],
    },
    [WeatherCondition.BECALMED]: {
      morning: [
        'Dead calm. The shelter traps the heat rather than providing relief. The air under the roof is stifling.',
      ],
      afternoon: [
        'The still air bakes under the roof. The shelter has become an oven. Everyone seeks the edges where some air might move.',
      ],
      evening: [
        'Evening brings no breeze through the open sides. The heat builds and builds.',
      ],
      night: [
        'A sweltering night. The roof holds the day\'s heat. The open sides offer no relief — there is no air to let in.',
      ],
    },
  },

  // ── SHELTERED ───────────────────────────────────────────
  sheltered: {
    [WeatherCondition.CLEAR]: {
      morning: [
        'Sunlight streams through the windows, dust motes floating in the beams. The thick walls keep the morning cool.',
        'Morning light fills the room. The building is pleasantly cool, sheltered from the sun.',
      ],
      afternoon: [
        'The interior is warm but bearable. Thick walls and shuttered windows hold back the worst of the afternoon heat.',
        'Afternoon inside. The building absorbs the heat slowly. A ceiling fan or a slave with a palm frond stirs the air.',
      ],
      evening: [
        'Evening light angles through the windows. The interior is comfortable, the thick walls releasing the day\'s stored warmth slowly.',
      ],
      night: [
        'Lantern light and candles illuminate the interior. The night sounds of the town filter in through the shutters.',
        'Inside for the night. The walls hold warmth from the day. Candlelight flickers over the room.',
      ],
    },
    [WeatherCondition.CLOUDY]: {
      morning: [
        'A dim, grey light fills the room through the windows. The overcast sky makes the interior gloomy.',
      ],
      afternoon: [
        'The interior is dark under the overcast. Candles are lit early. The air is close and humid.',
      ],
      evening: [
        'Evening comes early under the clouds. The interior was already dim; now it is properly dark.',
      ],
      night: [
        'Overcast night. The interior feels sealed off from the world, candlelight the only illumination.',
      ],
    },
    [WeatherCondition.RAIN]: {
      morning: [
        'Rain beats against the shutters. Inside is dry and warm, but the sound of water is everywhere.',
        'The building is a refuge from the rain. Water streams down the windows. The roof leaks in one corner.',
      ],
      afternoon: [
        'Rain continues to drum on the roof. Inside, the humidity climbs. Walls sweat. Everything feels damp.',
      ],
      evening: [
        'Rain at evening. The building has become the gathering place — everyone driven inside by the weather.',
      ],
      night: [
        'The rain on the roof is a constant companion. Inside is dry but the air is thick with moisture.',
      ],
    },
    [WeatherCondition.STORM]: {
      morning: [
        'The building shudders with each gust. Rain hammers the shutters. Inside, people speak louder to be heard over the wind.',
        'The storm rages outside but the thick walls hold. Water seeps under the door. The roof creaks ominously.',
      ],
      afternoon: [
        'The storm is a muffled roar beyond the walls. The building feels like a ship in heavy seas — groaning, flexing.',
      ],
      evening: [
        'The storm continues as darkness falls. Inside, candles gutter in drafts. The walls shudder with each gust.',
      ],
      night: [
        'A violent night outside. Inside, the building holds. Plaster dust falls with each gust. No one sleeps easy.',
        'The storm howls beyond the walls. Inside, lanterns swing. The thick walls muffle the worst, but the shaking is constant.',
      ],
    },
    [WeatherCondition.HURRICANE]: {
      morning: [
        'The building groans under the hurricane\'s assault. Shutters bang, then tear away. Water pours through breaches in the roof.',
        'Even inside, the hurricane is terrifying. The walls flex. Plaster cracks and falls. The sound is like cannon fire.',
      ],
      afternoon: [
        'The hurricane finds every weakness. A shutter fails and the wind howls through the room, scattering everything.',
        'Inside during the hurricane. The building is the only hope — but it sounds like it is coming apart.',
      ],
      evening: [
        'Hours of punishment. The building has held so far, but the hurricane continues to probe every joint and beam.',
      ],
      night: [
        'The worst night imaginable. The hurricane screams outside. Inside, you pray the walls hold until dawn.',
        'Darkness and the hurricane. Every creak of timber sounds like the building is about to fail. No one speaks.',
      ],
    },
    [WeatherCondition.FOG]: {
      morning: [
        'Fog presses against the windows. Inside is dry but the air feels damp. The world beyond the glass is invisible.',
        'The fog makes the interior feel cozy — sealed away from a grey, formless world.',
      ],
      afternoon: [
        'Still fog-bound. The interior is dim, the windows showing only grey. Sound from outside is muffled.',
      ],
      evening: [
        'Fog at evening. The windows show only grey darkness. Inside feels cut off from everything.',
      ],
      night: [
        'A fog-bound night. Inside is warm and dry. The fog outside might as well be a wall.',
      ],
    },
    [WeatherCondition.BECALMED]: {
      morning: [
        'The air inside is already warm and still. The thick walls that keep rain out also keep heat in.',
        'No breeze enters through the windows. The interior is stuffy, the air unmoving.',
      ],
      afternoon: [
        'The building is an oven. The thick walls have absorbed the heat and now radiate it. Every door and window stands open.',
        'Suffocating afternoon inside. The still air carries the smell of sweat and close-packed bodies.',
      ],
      evening: [
        'Evening inside. The doors stand open hoping for a breeze. None comes. The heat is relentless.',
      ],
      night: [
        'A sleepless, airless night inside. The building has stored the day\'s heat and releases it slowly. Every window is open.',
      ],
    },
  },
};

// ============================================================
// Section 2: Place Activity by Type
// What is happening at this place, independent of weather
// ============================================================

const PLACE_ACTIVITY: Record<PlaceType, Partial<Record<PlaceActivityLevel, Partial<Record<TimeOfDay, string[]>>>>> = {
  tavern: {
    peak: {
      evening: [
        'The tavern is packed to the walls. Rum flows, dice rattle on tables, and someone is playing a fiddle badly. Arguments and laughter compete for volume.',
        'Every table is full. The serving girls cannot keep up. Pipe smoke hangs in blue layers. A card game in the corner is getting heated.',
        'The tavern roars with life. Sailors, merchants, and worse crowd the bar. A toast goes up — to something, anything — and mugs crash together.',
      ],
      night: [
        'The tavern is at its loudest. Songs, curses, and the crash of breaking crockery. Someone is passed out under a table.',
        'Late night and the tavern is still roaring. The hard drinkers are in their element. A fight breaks out near the door and is quickly settled.',
        'The small hours and still the rum flows. The crowd has thinned to the serious drinkers and the desperate — those with no bed to go to, or no desire to go to it.',
      ],
    },
    active: {
      morning: [
        'The tavern is quiet in the morning. A few early drinkers sit in corners. The keeper sweeps sawdust and last night\'s mess.',
        'Morning at the tavern. The place smells of stale rum and tobacco. A few bleary faces nurse small beers and regret.',
      ],
      afternoon: [
        'Afternoon trade is slow. A few regulars occupy their usual spots. The keeper polishes mugs and waits for evening.',
        'The tavern ticks over quietly in the afternoon heat. A few men play cards without much energy.',
      ],
      evening: [
        'The evening crowd begins to arrive. The tavern warms up. Voices rise, orders are called, and the night begins.',
      ],
    },
    quiet: {
      morning: [
        'The tavern is nearly empty. Chairs are stacked on tables. The smell of last night lingers.',
      ],
      afternoon: [
        'A dead afternoon. One man drinks alone in the corner. The keeper dozes behind the bar.',
      ],
    },
    closed: {
      night: [
        'The tavern is shut and dark. A chain across the door. Whatever drove the keeper to close, it must be serious.',
      ],
    },
  },

  dock: {
    peak: {
      morning: [
        'The docks are alive with activity. Stevedores haul cargo, harbormasters shout orders, boats shuttle between ships at anchor and the wharves.',
        'Morning rush at the docks. A merchantman is unloading, her cargo swinging ashore in nets. Customs men pick through crates. Sailors curse the heat.',
        'The waterfront is chaos. Three ships loading simultaneously, bumboats weaving between, the harbormaster\'s clerk trying to keep records no one respects.',
      ],
      afternoon: [
        'Afternoon at the docks. The morning rush has eased but work continues — stacking hogsheads, coiling rope, mending sails on the quay.',
      ],
    },
    active: {
      morning: [
        'The docks stir to life. Early boats come in with the night\'s catch. Dockworkers arrive, stretching and grumbling.',
      ],
      afternoon: [
        'The docks are quieter now. The heavy work is done. Fishermen mend nets. A few boats still shuttle cargo.',
      ],
      evening: [
        'The docks wind down for the day. The last cargo is secured. Watchmen take their posts as the workers head for the taverns.',
      ],
    },
    quiet: {
      evening: [
        'The docks are nearly deserted. A watchman walks his rounds. The moored boats creak against their fenders.',
      ],
      night: [
        'Night at the docks. The watchman\'s lantern bobs along the waterfront. Rats scurry between the pilings.',
      ],
    },
    closed: {
      night: [
        'The docks are shut down entirely. No lights, no movement. Even the watchman has found better shelter.',
      ],
    },
  },

  market: {
    peak: {
      morning: [
        'The market is in full cry. Vendors shout over each other, hawking fish, fruit, salt pork, cloth. The smell of fresh bread competes with the harbor stink.',
        'Market day morning. Every stall is open, every aisle packed. Servants haggle for their masters, sailors spend their wages, pickpockets work the crowd.',
        'The market hums with commerce. Baskets of tropical fruit, barrels of salt fish, bolts of cloth. Money changes hands at every turn.',
      ],
    },
    active: {
      morning: [
        'The market is filling up. Vendors arrange their wares. The first customers pick through the freshest goods.',
        'Early market. The best produce goes first. Wise buyers arrive at dawn.',
      ],
      afternoon: [
        'Afternoon at the market. The crowd has thinned. Vendors lower prices on perishables. The heat wilts the remaining produce.',
      ],
    },
    quiet: {
      afternoon: [
        'The market is winding down. Half the stalls have packed up. The remaining vendors sit in the shade, fanning flies.',
        'Late afternoon. The market is nearly empty. Bruised fruit and picked-over goods are all that remain.',
      ],
    },
    closed: {
      night: [
        'The market is deserted and dark. Empty stalls stand like skeletons. A stray dog sniffs for scraps.',
      ],
      evening: [
        'The market has closed for the day. Vendors cart away unsold goods. The ground is littered with fish scales and crushed fruit.',
      ],
    },
  },

  fort: {
    peak: {
      morning: [
        'The morning watch changes with crisp efficiency. The garrison musters on the parade ground. The flag rises over the battlements.',
        'Dawn gun fires over the harbor. The garrison stirs. Sentries report from the night watch. The fort comes to life.',
      ],
    },
    active: {
      morning: [
        'The fort is busy with routine. Soldiers drill on the parade ground. Armory work, cleaning, maintenance.',
      ],
      afternoon: [
        'Afternoon at the fort. The garrison rests in the shade of the walls. A few sentries watch the approaches.',
        'Afternoon drill on the parade ground. The soldiers move without enthusiasm in the heat.',
      ],
      evening: [
        'Evening watch begins. The sentries take their posts on the walls. The garrison settles for the night.',
        'The evening gun marks the close of day. Gates are secured. The watch is set.',
      ],
      night: [
        'Night watch at the fort. Sentries pace the walls, watching the darkness. The garrison sleeps in the barracks below.',
        'The fort never sleeps. Lanterns mark the sentry posts along the walls. The watch calls the hours.',
      ],
    },
    quiet: {
      afternoon: [
        'A quiet afternoon at the fort. Most of the garrison is at rest. Only the sentries are awake and alert.',
      ],
      night: [
        'Deep night. The fort is still. Only the sentries move, pacing the walls in lantern light.',
      ],
    },
  },

  church: {
    peak: {
      morning: [
        'The church fills for morning service. The congregation gathers in their best clothes. The organ sounds — or the choir begins to sing.',
        'Morning mass. The nave is full. Incense smoke rises toward the vaulted ceiling. The priest\'s voice echoes in the stone.',
      ],
    },
    active: {
      morning: [
        'Morning prayers. A handful of the faithful kneel in the pews. The church is cool and quiet inside.',
        'The church is open. A few worshippers sit in contemplation. A priest prepares the altar.',
      ],
      afternoon: [
        'Afternoon in the church. The cool stone interior is a refuge from the heat. A few people come to pray or simply to sit.',
      ],
      evening: [
        'Vespers. The evening light filters through the windows, painting colored patches on the stone floor.',
        'Evening service. Candles glow on the altar. The small congregation bows their heads.',
      ],
    },
    quiet: {
      afternoon: [
        'The church is empty and cool. Dust motes hang in shafts of colored light from the windows. Footsteps echo.',
        'An empty church in the afternoon. The stone walls radiate coolness. A welcome silence after the noise of the street.',
      ],
      night: [
        'The church is locked and dark. A single votive candle flickers on the altar.',
      ],
    },
    closed: {
      night: [
        'The church doors are barred for the night. The building is a dark shape against the sky.',
      ],
    },
  },

  government: {
    peak: {
      morning: [
        'The government offices are busy. Clerks scratch with quills, officials stamp documents, petitioners queue along the corridor.',
        'Morning at the seat of power. The governor\'s calendar is full. Officials bustle. Important decisions are made — or delayed.',
      ],
    },
    active: {
      morning: [
        'The government building is open for business. A few early petitioners wait on benches.',
      ],
      afternoon: [
        'Afternoon at the offices. The pace has slowed. Officials review papers. A warm torpor settles over the building.',
      ],
    },
    quiet: {
      afternoon: [
        'The government offices are nearly empty in the late afternoon. Clerks count the hours until closing.',
      ],
    },
    closed: {
      evening: [
        'The government building is closed and locked. Business will resume in the morning — for those with patience and bribes.',
      ],
      night: [
        'Dark and locked. A single watchman guards the entrance. The papers and seals sleep inside.',
      ],
    },
  },

  shipyard: {
    peak: {
      morning: [
        'The shipyard rings with the sound of hammers and adzes. Sawdust fills the air. Frames rise on the stocks. Workers shout over the din.',
        'Morning at the yard. The master shipwright inspects the work. Caulkers drive oakum into seams. The smell of hot pitch and fresh timber.',
      ],
    },
    active: {
      morning: [
        'The shipyard comes to life. Workers arrive, tools are unlocked, and the day\'s work begins.',
      ],
      afternoon: [
        'Afternoon work continues at a slower pace. The heat makes the pitch run and the men sluggish.',
        'The shipyard works through the afternoon. A vessel in the cradle gets her hull scraped. Another has new planking fitted.',
      ],
    },
    quiet: {
      evening: [
        'The shipyard is quiet. Tools are locked away. The half-built hull stands silent on the stocks.',
      ],
    },
    closed: {
      night: [
        'The shipyard is dark and locked. A watchman guards against fire — the shipwright\'s worst enemy.',
      ],
    },
  },

  warehouse: {
    peak: {
      morning: [
        'The warehouse doors stand wide. Carts arrive with goods, porters carry crates and hogsheads in and out. The inventory clerk checks everything against his ledger.',
      ],
    },
    active: {
      morning: [
        'Morning at the warehouse. Workers shift cargo, making room for incoming shipments. The air smells of sugar, tobacco, and rope.',
      ],
      afternoon: [
        'The warehouse is quieter. Goods are stacked and inventoried. A few workers rearrange stock in the dim interior.',
      ],
    },
    quiet: {
      afternoon: [
        'A quiet afternoon. The warehouse doors are open but little moves. The goods sit patiently in the dark interior.',
      ],
      evening: [
        'The warehouse is being locked up for the night. The last cart departs.',
      ],
    },
    closed: {
      night: [
        'The warehouse is locked and dark. Rats patrol the aisles between barrels and crates.',
      ],
    },
  },

  brothel: {
    peak: {
      night: [
        'The brothel is at its busiest. Laughter, music, and the clink of coin behind curtained doors. The madam keeps order with an iron hand.',
        'Late night at the establishment. Every room is occupied. Sailors spend their prize money freely.',
      ],
      evening: [
        'The evening crowd arrives. The establishment comes alive — music, perfume, and candlelight.',
      ],
    },
    active: {
      evening: [
        'The brothel opens for the evening. The women appear in their best. The first customers arrive.',
      ],
      night: [
        'The establishment does steady business. The piano plays softly. Rum and conversation flow.',
      ],
    },
    quiet: {
      afternoon: [
        'The brothel is quiet in the afternoon. The women rest, mend clothes, gossip. The madam counts last night\'s take.',
      ],
      morning: [
        'Morning at the establishment. The last customers have gone. The women sleep. Only the cleaner moves through the rooms.',
      ],
    },
    closed: {
      morning: [
        'The brothel is shut tight. Shutters drawn. The place will not stir until evening.',
      ],
    },
  },

  jail: {
    active: {
      morning: [
        'Morning in the jail. The guard brings thin gruel. Prisoners stir on stone floors. A new day of captivity begins.',
        'The jailer makes his morning rounds. Checking chains, counting heads. The prisoners barely look up.',
      ],
      afternoon: [
        'Afternoon in the cells. The heat builds. The stench worsens. Prisoners lie in whatever shade they can find.',
        'The jail bakes in the afternoon. Water is rationed. Flies buzz around the chamber pot. Time stretches into eternity.',
      ],
      evening: [
        'Evening at the jail. The heat begins to ease. Prisoners cluster at the bars, watching the last light fade.',
      ],
      night: [
        'Night in the jail. The darkness is absolute. Rats scurry. Someone groans in another cell. Sleep comes hard on stone.',
        'The night watch passes the cells. A lantern briefly illuminates the misery within, then moves on.',
      ],
    },
    quiet: {
      night: [
        'Deep night. The jail is silent except for the rasp of breathing and the occasional clank of chains.',
      ],
    },
  },

  camp: {
    peak: {
      morning: [
        'The camp stirs to life. Cooking fires lit, hammocks taken down, men stretching and cursing the morning.',
        'Morning in the camp. Someone is already arguing. Smoke from cooking fires drifts through the tents and lean-tos.',
      ],
    },
    active: {
      morning: [
        'The camp is busy. Men repair equipment, cook, gamble, and argue. The usual morning chaos.',
      ],
      afternoon: [
        'The camp dozes in the afternoon heat. Most men find shade and sleep. A few die-hards continue gambling.',
      ],
      evening: [
        'Evening at the camp. Cooking fires blaze. The smell of roasting meat — turtle, pig, or whatever was caught today.',
        'The camp comes alive again as the heat breaks. Fires are stoked, rum is passed, stories begin.',
      ],
    },
    quiet: {
      afternoon: [
        'The camp is quiet in the midday heat. Everyone sleeps or sits in what shade there is.',
      ],
      night: [
        'The camp fires burn low. Most have turned in. A few men sit in the darkness, drinking quietly.',
      ],
    },
    closed: {
      night: [
        'The camp is abandoned — everyone has sought better shelter from the weather.',
      ],
    },
  },

  landmark: {
    active: {
      morning: [
        'The landmark draws a few visitors in the morning light. People pass by on their way to business.',
      ],
      afternoon: [
        'Afternoon at the landmark. A few idle onlookers, a conversation or two. The place holds its history quietly.',
      ],
      evening: [
        'Evening light plays over the landmark. The crowds have thinned. It stands in dignified quiet.',
      ],
    },
    quiet: {
      night: [
        'The landmark stands dark and silent. Whatever history it holds, it keeps to itself tonight.',
      ],
      morning: [
        'Early morning. The landmark is empty. The first light reveals its age and character.',
      ],
    },
  },

  residential: {
    peak: {
      morning: [
        'The residential quarter stirs. Servants fetch water, shutters open, breakfast smells drift from kitchens. Children are shooed off to lessons.',
      ],
      evening: [
        'Evening in the residential district. Families gather. Cooking smells fill the street. Voices and laughter carry from open windows.',
      ],
    },
    active: {
      morning: [
        'Morning in the neighborhood. People head to work. Servants sweep doorsteps.',
      ],
      afternoon: [
        'Afternoon in the quarter. Shutters are drawn against the heat. The street is quiet — everyone napping.',
      ],
      evening: [
        'The neighborhood comes alive as evening cools the air. Neighbors talk over fences. Children play in the lane.',
      ],
    },
    quiet: {
      afternoon: [
        'The residential street is silent in the afternoon heat. Shuttered windows, empty lanes. The siesta rules.',
      ],
      night: [
        'The neighborhood sleeps. A dog barks somewhere. A candle glows in an upper window.',
      ],
    },
  },

  trading_post: {
    peak: {
      morning: [
        'The trading post is busy. Factors weigh goods, check quality, haggle over exchange rates. Ledgers are filled in quick ink.',
      ],
    },
    active: {
      morning: [
        'The trading post opens. The factor inspects his stock of European goods. Local traders arrive to negotiate.',
      ],
      afternoon: [
        'Afternoon at the trading post. A deal is being struck — cloth and iron for gold dust and ivory.',
      ],
    },
    quiet: {
      afternoon: [
        'A quiet afternoon. The trading post keeper reviews his ledgers and waits for the next arrival.',
      ],
    },
    closed: {
      night: [
        'The trading post is locked and barred. The goods inside are too valuable for anything less.',
      ],
    },
  },

  slave_market: {
    peak: {
      morning: [
        'The slave market is at its worst. Human beings are inspected like cattle — teeth checked, muscles prodded. Bidding is brisk and businesslike.',
        'Auction morning. The enslaved stand on the block. Buyers examine, bid, and collect their purchases with practiced indifference to the horror.',
      ],
    },
    active: {
      morning: [
        'The slave market opens. The enslaved are brought out, washed and oiled. Buyers begin to arrive.',
      ],
      afternoon: [
        'Afternoon at the market. The auction is over. The unsold are returned to holding. Paperwork and payment.',
      ],
    },
    quiet: {
      afternoon: [
        'The market is quiet. The enslaved sit in the holding area, waiting for whatever comes next.',
      ],
    },
    closed: {
      night: [
        'The slave market is closed. The holding pens are locked. In the darkness, the human cargo waits.',
      ],
    },
  },

  hospital: {
    active: {
      morning: [
        'Morning rounds at the hospital. The surgeon checks his patients. Fever, wounds, tropical disease — the usual Caribbean afflictions.',
        'The hospital stirs. Fresh bandages are prepared. The sick and wounded lie in rows. The smell of sickness and poultice.',
      ],
      afternoon: [
        'Afternoon at the hospital. The heat makes everything worse. Flies buzz around the patients. The surgeon works on.',
        'The hospital is an oven in the afternoon. Patients lie in sweat-soaked sheets. The surgeon does what he can.',
      ],
      evening: [
        'Evening at the hospital. The worst of the heat passes. A few visitors come to check on the sick.',
      ],
      night: [
        'Night at the hospital. The surgeon sleeps but the orderly keeps watch. A patient moans. Fever burns.',
        'The hospital is quiet but for the labored breathing of the sick. A candle burns at the orderly\'s station.',
      ],
    },
    quiet: {
      night: [
        'Deep night. The hospital is still. Those who will die tonight will do so quietly, without fuss.',
      ],
    },
  },
};

// ============================================================
// Section 3: Regional Flavor by Season
// Location-specific seasonal color
// ============================================================

type SeasonKey = 'dry_season' | 'rainy_season' | 'hurricane_season' | 'winter' | 'summer' | 'harmattan' | 'norther_season';

const REGIONAL_FLAVOR: Partial<Record<PortRegion, Partial<Record<SeasonKey, string[]>>>> = {
  caribbean_english: {
    dry_season: [
      'The dry season. Steady trade winds, clear skies, good business. The best time of year in the islands.',
      'Pleasant season. The constant breeze keeps the heat manageable. Ships come and go freely.',
    ],
    rainy_season: [
      'The rainy season is upon the island. Afternoon squalls are as regular as the tide. Everything mildews.',
      'Wet season. The rain comes in warm torrents, drying within the hour. Then it comes again.',
    ],
    hurricane_season: [
      'Hurricane season. An edge to every conversation about the weather. Ships stay closer to port.',
      'The dangerous months. Every cloud on the horizon draws anxious glances. The wise stay ashore.',
      'September — the most feared month. Old hands watch the barometer and the behavior of the birds.',
    ],
  },
  caribbean_spanish: {
    dry_season: [
      'The dry season. The plazas bake under the sun. Fountains are the center of city life.',
      'La temporada seca. The Spanish colonial city is at its best — comfortable heat, steady breeze, clear skies.',
    ],
    rainy_season: [
      'The rains have come. Water courses through the cobbled streets. The churches fill with those praying for dry weather.',
      'Wet season in the Spanish colonies. The humid air carries the scent of tropical flowers and rotting fruit.',
    ],
    hurricane_season: [
      'Temporada de huracanes. The cathedral bells will toll if a storm approaches. The fleet stays in harbor.',
      'Hurricane season. Spanish soldiers reinforce the shutters on the forts. The governor issues proclamations no one reads.',
    ],
  },
  caribbean_french: {
    dry_season: [
      'The dry season on the French island. The corsairs are in good spirits — fair weather means good hunting.',
      'Saison sèche. The heat is moderated by the breeze. Rum and conversation flow freely.',
    ],
    rainy_season: [
      'The rains come to the French settlement. Mud is ankle-deep. The buccaneers drink and wait it out.',
    ],
    hurricane_season: [
      'Saison des ouragans. Even the corsairs respect the hurricane. Ships are hauled up or sent to deeper harbors.',
    ],
  },
  caribbean_dutch: {
    dry_season: [
      'The dry season on Curaçao. The island is arid even in the best of times. Water is precious.',
      'Droog seizoen. The Dutch colony is efficient as always. Trade continues regardless of the weather.',
    ],
    rainy_season: [
      'The brief rains come to the island. The Dutch collect every drop — cisterns and catchments fill the water supply.',
    ],
    hurricane_season: [
      'Hurricane season, though Curaçao sits south of the usual tracks. The Dutch thank their geography and keep trading.',
    ],
  },
  north_american: {
    winter: [
      'Winter on the colonial coast. The harbor sometimes freezes. Snow dusts the cobblestones. Breath fogs in the bitter air.',
      'A cold colonial winter. Firewood is dear. The harbor is quieter — ships wait for spring to sail south.',
      'Ice and cold. The colonial town hunkers down. Ships sit idle. Everyone dreams of Caribbean warmth.',
    ],
    summer: [
      'Summer in the colonies. The harbor is busy, the air warm and pleasant. The best trading season.',
      'A fine colonial summer. Market days are bustling, ships come and go freely, and the living is easy.',
    ],
    hurricane_season: [
      'Late summer storm season. The big storms rarely come this far north — but when they do, the damage is catastrophic.',
    ],
  },
  european_english: {
    winter: [
      'London winter. Grey skies, cold rain, and the stink of coal smoke. The Thames is dark and sluggish.',
      'A raw English winter. Fog off the river, ice in the gutters. The coffeehouses are warm and crowded.',
    ],
    summer: [
      'London summer. Long days, the Thames busy with traffic. The city stinks in the heat, but commerce thrives.',
      'English summer. The days are long and mild. Ships depart for the Caribbean loaded with manufactured goods.',
    ],
  },
  european_spanish: {
    winter: [
      'Winter in Seville. Cool rain on the stone streets. The Guadalquivir runs high. The treasure fleet is somewhere on the Atlantic.',
    ],
    summer: [
      'Andalusian summer. The heat is fierce. The streets empty at midday. Everyone retreats behind thick walls and shuttered windows.',
      'Summer in Seville. The blazing sun bakes the stone. Work stops at noon and resumes at dusk. The treasure fleet is expected.',
    ],
  },
  european_dutch: {
    winter: [
      'Amsterdam winter. The canals freeze. The merchants work on, wrapped in wool. Ships are hauled up for maintenance.',
      'A bitter Dutch winter. Ice and fog on the canals. The warehouses are cold but the Bourse still trades.',
    ],
    summer: [
      'Amsterdam in summer. The canals glitter. The port is busy with WIC ships. Business is good.',
    ],
  },
  west_african: {
    dry_season: [
      'The dry season on the Gold Coast. The parched earth cracks. The trading posts stir only when ships arrive.',
    ],
    rainy_season: [
      'The rains have come to West Africa. Torrential, tropical downpours that flood everything. Disease spikes.',
      'Rainy season on the coast. The rivers swell, roads become impassable. Trade slows to a crawl.',
    ],
    harmattan: [
      'The Harmattan blows from the Sahara. Fine red dust coats everything — skin, food, lungs. The sun is a dim disc through the haze.',
      'Harmattan season. The dry wind cracks lips and irritates eyes. The dust gets into everything. Water is precious.',
      'The northeast wind carries the desert to the coast. Visibility drops. Everything tastes of sand.',
    ],
  },
};

// ============================================================
// Section 4: Weather Event Overlay
// What specific weather events feel like on land
// ============================================================

const EVENT_OVERLAY: Partial<Record<WeatherEventType, Record<PlaceExposure, string[]>>> = {
  [WeatherEventType.NORTHER]: {
    exposed: [
      'The norther howls across the open ground. The temperature plummets. Men clutch their coats and hats and run for cover.',
      'A bitter north wind drives cold rain sideways. Everything exposed is soaked and freezing within minutes.',
    ],
    semi_sheltered: [
      'The norther cuts through the open sides of the shelter like a knife. The sudden cold is shocking after the tropical warmth.',
    ],
    sheltered: [
      'Inside, the norther is a muffled roar. The unusual cold draws everyone near the fire. Shutters bang and rattle.',
      'The building creaks in the norther. A sudden chill has replaced the tropical warmth. People pull blankets close.',
    ],
  },
  [WeatherEventType.NOREASTER]: {
    exposed: [
      'The nor\'easter drives freezing rain and sleet sideways. Impossible to face into the wind. The ground is a sheet of ice.',
      'A vicious nor\'easter — wind, rain, sleet, and cold in equal measure. The exposed ground is no place for anyone.',
    ],
    semi_sheltered: [
      'The nor\'easter finds every gap. Rain and sleet drive through the open sides. The temperature has dropped twenty degrees.',
    ],
    sheltered: [
      'The nor\'easter batters the walls. Inside, ice forms on the window panes. The fire struggles to keep the room warm.',
      'Wind howls outside. The building shudders. Inside, people crowd near the fire and listen to the storm.',
    ],
  },
  [WeatherEventType.HARMATTAN]: {
    exposed: [
      'The Harmattan dust turns the air red-brown. Visibility drops to a few hundred yards. Every breath is gritty.',
      'Fine Saharan dust coats everything — skin, clothes, food, water. The sun is a dim orange disc. The air is bone-dry.',
    ],
    semi_sheltered: [
      'The dust finds its way under the roof. A fine coating covers every surface. Eyes sting, throats burn.',
    ],
    sheltered: [
      'Even inside, the Harmattan dust seeps through cracks. A fine grit covers the furniture. Everyone coughs.',
      'The building offers some refuge from the dust, but the dry heat penetrates the walls. Water is rationed.',
    ],
  },
  [WeatherEventType.TROPICAL_WAVE]: {
    exposed: [
      'A tropical wave passes through — sudden wind, heavy rain, then clearing. The cycle repeats every few hours.',
      'Squalls sweep through in bands. Ten minutes of violent wind and rain, then sun, then another squall.',
    ],
    semi_sheltered: [
      'The tropical wave brings gusting rain that drives under the roof. Work stops and starts with each squall.',
    ],
    sheltered: [
      'Rain hammers the building in waves — heavy, then light, then heavy again. The tropical wave passes overhead.',
    ],
  },
  [WeatherEventType.AFTERNOON_THUNDERSTORM]: {
    exposed: [
      'Lightning cracks directly overhead. The downpour is instant and total. Everyone runs for cover.',
      'The afternoon thunderstorm hits without warning. One moment clear, the next a wall of water and fire in the sky.',
    ],
    semi_sheltered: [
      'Thunder shakes the rafters. Rain drums on the roof like cannon fire. Lightning illuminates everything in white flashes.',
    ],
    sheltered: [
      'The thunderstorm rattles the shutters. Lightning flashes throw sharp shadows. Thunder shakes the walls. Inside, people pause and listen.',
      'A tremendous crack of thunder. The afternoon storm is upon us. Rain hammers the roof. It will pass in an hour.',
    ],
  },
  [WeatherEventType.WATERSPOUT]: {
    exposed: [
      'A waterspout is visible offshore — a dark funnel reaching from cloud to sea. Debris and spray whirl around its base.',
      'Waterspout! The cry goes up. A writhing column of water moves across the harbor. Everyone runs.',
    ],
    semi_sheltered: [
      'The waterspout passes close enough to rattle the roof and send loose items flying. A moment of terror.',
    ],
    sheltered: [
      'Word comes of a waterspout in the harbor. From inside, you can hear the strange howling of the wind.',
    ],
  },
};

// ============================================================
// Main composition function
// ============================================================

function getSeasonKey(portId: string, gameTime: GameTime): SeasonKey | null {
  const region = getPortRegion(portId);

  // West African harmattan
  if (region === 'west_african' && (gameTime.month === 12 || gameTime.month === 1 || gameTime.month === 2)) {
    return 'harmattan';
  }

  // North American / European winter (Dec-Feb)
  if ((region === 'north_american' || region === 'european_english' || region === 'european_dutch') &&
      (gameTime.month === 12 || gameTime.month <= 2)) {
    return 'winter';
  }

  // European Spanish summer
  if (region === 'european_spanish' && gameTime.month >= 6 && gameTime.month <= 9) {
    return 'summer';
  }

  // North American / European summer (Jun-Aug)
  if ((region === 'north_american' || region === 'european_english' || region === 'european_dutch') &&
      gameTime.month >= 6 && gameTime.month <= 8) {
    return 'summer';
  }

  // Gulf norther season
  // (Handled by weather events, not seasonal key — northers are event-driven)

  // Caribbean hurricane season (Jun-Nov)
  if (region.startsWith('caribbean') && gameTime.month >= 6 && gameTime.month <= 11) {
    return 'hurricane_season';
  }

  // Caribbean dry season (Dec-Apr)
  if (region.startsWith('caribbean') && (gameTime.month >= 12 || gameTime.month <= 4)) {
    return 'dry_season';
  }

  // Caribbean rainy season (May-Nov, non-hurricane emphasis)
  if (region.startsWith('caribbean') && gameTime.month >= 5 && gameTime.month <= 5) {
    return 'rainy_season';
  }

  // West African rainy season (Apr-Oct)
  if (region === 'west_african' && gameTime.month >= 4 && gameTime.month <= 10) {
    return 'rainy_season';
  }

  // West African dry season (Nov-Mar, non-harmattan)
  if (region === 'west_african' && (gameTime.month === 3 || gameTime.month === 11)) {
    return 'dry_season';
  }

  return null;
}

export function getPlaceAmbientText(
  placeId: string,
  weather: WeatherState,
  gameTime: GameTime,
  activeEvent?: WeatherEventInstance,
): string {
  const place = ALL_PLACES.find(p => p.id === placeId);
  if (!place) return '';

  const timeOfDay = getTimeOfDay(gameTime.hour) as TimeOfDay;
  const exposure = PLACE_EXPOSURE[place.type];
  const activityLevel = getPlaceActivityLevel(place.type, gameTime.hour, weather.condition);

  const parts: string[] = [];

  // Layer 1: Weather experience (always present)
  const weatherTexts = WEATHER_EXPERIENCE[exposure]?.[weather.condition]?.[timeOfDay];
  if (weatherTexts && weatherTexts.length > 0) {
    parts.push(pick(weatherTexts));
  }

  // Layer 2: Weather event overlay (if active)
  if (activeEvent) {
    const eventTexts = EVENT_OVERLAY[activeEvent.type]?.[exposure];
    if (eventTexts && eventTexts.length > 0) {
      parts.push(pick(eventTexts));
    }
  }

  // Layer 3: Place activity (if place has text for this state)
  const activityTexts = PLACE_ACTIVITY[place.type]?.[activityLevel]?.[timeOfDay];
  if (activityTexts && activityTexts.length > 0) {
    parts.push(pick(activityTexts));
  }

  // Layer 4: Regional flavor (occasional — ~30% chance to avoid repetition)
  if (Math.random() < 0.3) {
    const region = getPortRegion(place.portId);
    const seasonKey = getSeasonKey(place.portId, gameTime);
    if (seasonKey) {
      const flavorTexts = REGIONAL_FLAVOR[region]?.[seasonKey];
      if (flavorTexts && flavorTexts.length > 0) {
        parts.push(pick(flavorTexts));
      }
    }
  }

  return parts.join(' ');
}

// Convenience: get ambient for a place by looking up its port's weather from the zone map
export function getPlaceAmbientFromWeatherMap(
  placeId: string,
  weatherMap: Map<string, WeatherState>,
  gameTime: GameTime,
  activeEvent?: WeatherEventInstance,
): string {
  const place = ALL_PLACES.find(p => p.id === placeId);
  if (!place) return '';

  // Resolve port → seaZone via PORT_PROFILES
  const portProfile = PORT_PROFILES[place.portId];
  if (portProfile) {
    const weather = weatherMap.get(portProfile.seaZoneId);
    if (weather) {
      return getPlaceAmbientText(placeId, weather, gameTime, activeEvent);
    }
  }

  // Fallback: use first available weather
  for (const [, weather] of weatherMap) {
    return getPlaceAmbientText(placeId, weather, gameTime, activeEvent);
  }

  return '';
}

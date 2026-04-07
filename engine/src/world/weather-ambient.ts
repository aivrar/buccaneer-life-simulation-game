// Ambient text generation for weather, storms, and seasons
// Pure functions, no side effects

import type { WeatherState, GameTime, ActiveStorm } from '../runtime/types.js';
import { WeatherCondition } from '../runtime/types.js';
import { getTimeOfDay } from './time.js';
import { SEA_ZONE_DEFINITIONS } from '../config/regions.js';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

type ZoneCategory = 'open_ocean' | 'island_waters' | 'coastal' | 'strait';

function getZoneCategory(zoneId: string): ZoneCategory {
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  if (!zone) return 'open_ocean';
  switch (zone.zoneType) {
    case 'open_ocean': return 'open_ocean';
    case 'island_waters': return 'island_waters';
    case 'narrow_strait': case 'deep_channel': return 'strait';
    default: return 'coastal';
  }
}

const WEATHER_TEXT: Record<string, Record<string, Record<string, string[]>>> = {
  // condition -> timeOfDay -> zoneCategory -> variants
  [WeatherCondition.CLEAR]: {
    morning: {
      open_ocean: [
        'The morning sun burns across azure waters. Steady trade winds fill the sails from the east.',
        'A fine morning on the open sea. The horizon is sharp in every direction, the wind brisk and constant.',
        'Dawn breaks golden over an endless expanse of blue. The rigging hums with a fair breeze.',
      ],
      island_waters: [
        'The morning sun paints the islands in warm gold. A gentle breeze carries the scent of tropical flowers.',
        'Clear skies over the islands. Green peaks rise from turquoise waters, the air already warm.',
        'A brilliant morning among the islands. Trade winds pipe steadily through the channels.',
      ],
      coastal: [
        'The coast shimmers in the morning haze. Sea birds wheel overhead as a land breeze dies.',
        'Morning light reveals the coastline ahead, green and low. The sea is calm near shore.',
        'A fine morning on the coastal approaches. The harbor flags hang limp, waiting for the sea breeze.',
      ],
      strait: [
        'Morning in the straits. The current runs strong and the wind funnels between the headlands.',
        'Clear morning in the passage. Other sails visible ahead and astern in the narrow channel.',
        'The strait is calm and clear. A good morning to make the passage with the current.',
      ],
    },
    afternoon: {
      open_ocean: [
        'The afternoon sun blazes overhead. The sea is a dazzling sheet of blue-white light.',
        'Hot afternoon on the open ocean. The sails are taut with steady wind, the deck warm underfoot.',
        'An afternoon of endless blue sky and sea. The ship makes good way on the trades.',
      ],
      island_waters: [
        'The afternoon heat shimmers over the islands. The water is impossibly clear over coral reefs below.',
        'A hot afternoon in the island waters. Cumulus clouds build over the green peaks.',
        'The islands drowse in afternoon heat. Flying fish skim the surface alongside the hull.',
      ],
      coastal: [
        'The afternoon sea breeze picks up along the coast. Good sailing weather for coastal work.',
        'Hot afternoon sun beats down on the coastal waters. The land is a hazy green line.',
        'The coast bakes in the afternoon heat. Sea birds ride the thermals rising from the cliffs.',
      ],
      strait: [
        'Afternoon in the passage. The tide is turning and the current shifts unpredictably.',
        'The strait is busy this afternoon. Merchant sails dot the narrows in both directions.',
      ],
    },
    evening: {
      open_ocean: [
        'The sun sinks into the western sea, painting the sky in shades of amber and crimson.',
        'Evening falls on the open ocean. The wind eases slightly as the sky turns gold.',
        'A spectacular sunset over the western horizon. The first stars appear in the east.',
      ],
      island_waters: [
        'The islands are silhouetted against a fiery sunset. Cooking fires glow on distant shores.',
        'Evening settles over the islands. The water turns from turquoise to deep indigo.',
      ],
      coastal: [
        'Evening comes to the coast. The land breeze begins, carrying the scent of wood smoke.',
        'The setting sun lights the coastal cliffs in red and gold. An offshore breeze rises.',
      ],
      strait: [
        'Evening in the strait. Running lights appear on ships ahead as the sky darkens.',
        'The passage narrows in the failing light. Best to anchor until morning.',
      ],
    },
    night: {
      open_ocean: [
        'A canopy of stars wheels overhead. The phosphorescent wake glows blue-green behind the stern.',
        'A dark night at sea. The stars are magnificent, the only sound the rush of water.',
        'Moonlight silvers the ocean swells. The ship ghosts along under a vault of stars.',
      ],
      island_waters: [
        'The islands are dark shapes against the stars. Fires flicker on distant beaches.',
        'A warm Caribbean night among the islands. The rigging creaks and the anchor chain groans.',
      ],
      coastal: [
        'The coast is a dark mass to leeward. A lighthouse beam sweeps the approaches.',
        'Night on the coastal waters. The land breeze is cool and steady.',
      ],
      strait: [
        'A tense night passage through the narrows. The lookout strains to spot unlit vessels.',
        'The strait is dark and the current strong. Navigation by stars and dead reckoning.',
      ],
    },
  },
  [WeatherCondition.STORM]: {
    morning: {
      open_ocean: [
        'Grey dawn breaks on a violent sea. The ship labors through mountainous swells, green water crashing over the bow.',
        'Morning brings no relief from the storm. The sky is an unbroken wall of grey, the wind a constant howl.',
      ],
      island_waters: [
        'The storm lashes the islands. Rain obscures everything beyond a cable length. The ship strains at her anchors.',
      ],
      coastal: [
        'A vicious storm pounds the coast. Breakers crash on the rocks with terrifying force.',
      ],
      strait: [
        'The storm turns the strait into a cauldron. Confused seas from every direction slam against the hull.',
      ],
    },
    afternoon: {
      open_ocean: [
        'The storm rages on through the afternoon. The seas are tremendous, the ship corkscrewing wildly.',
        'No sky visible, only driving rain and spray. The ship is a cork in a tempest.',
      ],
      island_waters: [
        'The storm tears at the island anchorage. Trees bend flat on the shore. Vessels drag their anchors.',
      ],
      coastal: [
        'Storm-driven waves pound the coastal shallows. No vessel dare approach the shore.',
      ],
      strait: [
        'The strait is impassable. Waves meet current head-on, throwing up walls of green water.',
      ],
    },
    evening: {
      open_ocean: [
        'The storm shows no sign of abating as darkness falls. Lightning illuminates mountainous seas.',
      ],
      island_waters: [
        'Evening in the storm. The islands have vanished behind curtains of rain.',
      ],
      coastal: [
        'The storm drives vessels off the coast as night falls. A dangerous lee shore in the darkness.',
      ],
      strait: [
        'Night falls on the storm-wracked strait. God help any vessel in this passage tonight.',
      ],
    },
    night: {
      open_ocean: [
        'Lightning splits the sky. The ship groans against mountainous swells, green water crashing over the bow.',
        'A hellish night at sea. The storm screams in the rigging, the world reduced to noise and fury.',
      ],
      island_waters: [
        'A terrifying night among the islands. Breakers roar unseen on every side.',
      ],
      coastal: [
        'The storm rages through the night. Somewhere in the darkness, the coast waits to catch the unwary.',
      ],
      strait: [
        'The worst kind of night — a storm in the narrows, with rocks on every side and no room to run.',
      ],
    },
  },
  [WeatherCondition.FOG]: {
    morning: {
      open_ocean: [
        'A thick fog smothers the sea. The ship moves like a ghost through a world of grey.',
        'Dense morning fog. Sounds carry strangely — a bell somewhere, voices from an unseen vessel.',
      ],
      island_waters: [
        'Morning fog lies thick among the islands. The masts of nearby vessels materialize like spectres.',
      ],
      coastal: [
        'A thick fog smothers the sea. Voices carry strangely; a ship\'s bell sounds somewhere in the murk.',
        'Dense coastal fog. The shore is invisible, known only by the sound of surf and the smell of land.',
      ],
      strait: [
        'Fog fills the strait like cotton. Dangerous passage — other vessels are invisible until nearly alongside.',
      ],
    },
    afternoon: {
      open_ocean: [
        'The fog persists into the afternoon, unusual and oppressive. No horizon, no sky, no bearing.',
      ],
      island_waters: [
        'The fog begins to thin in the afternoon heat but still obscures the islands.',
      ],
      coastal: [
        'Afternoon fog clings to the coast. The lookout peers uselessly into the grey.',
      ],
      strait: [
        'The strait remains fog-bound. Vessels sound their bells and creep through the narrows.',
      ],
    },
    evening: {
      open_ocean: [
        'The fog thickens again as evening cools the air. An eerie silence blankets the sea.',
      ],
      island_waters: [
        'Evening fog returns. The islands are lost in the murk.',
      ],
      coastal: [
        'Evening fog rolls in from the sea. The coast disappears in minutes.',
      ],
      strait: [
        'Fog closes in with the evening. Anchoring may be the only safe course.',
      ],
    },
    night: {
      open_ocean: [
        'A fog-shrouded night. The lanterns make dim yellow halos. Nothing else exists beyond the rail.',
      ],
      island_waters: [
        'A blind night in the fog. The anchor watch listens for breakers on unseen reefs.',
      ],
      coastal: [
        'Night fog on the coast. The helmsman steers by sound alone, listening for the surf.',
      ],
      strait: [
        'Fog and darkness in the narrows. Every creak of the rigging sounds like approaching danger.',
      ],
    },
  },
  [WeatherCondition.BECALMED]: {
    morning: {
      open_ocean: [
        'The sails hang limp as rags. The sea is a flat mirror under the rising sun. Not a breath of wind.',
        'Becalmed. The ship sits motionless on a glassy sea. The only movement is the slow heave of the swell.',
      ],
      island_waters: [
        'Dead calm among the islands. The water is perfectly still, reflecting the green peaks like glass.',
      ],
      coastal: [
        'Not a breath of wind on the coastal waters. The ship drifts on the current alone.',
      ],
      strait: [
        'Becalmed in the narrows. The current carries the ship, but there is nothing to steer with.',
      ],
    },
    afternoon: {
      open_ocean: [
        'The sails hang limp as rags. The sea is a flat mirror under the merciless sun. Not a breath of wind.',
        'The afternoon calm is absolute. The tar bubbles in the deck seams. Men shelter in any shade they can find.',
      ],
      island_waters: [
        'The afternoon heat is stifling with no wind. The sea around the islands is like warm soup.',
      ],
      coastal: [
        'Becalmed in the afternoon heat. Perhaps the evening land breeze will bring relief.',
      ],
      strait: [
        'No wind in the strait. The current has the ship and carries her where it will.',
      ],
    },
    evening: {
      open_ocean: [
        'The calm continues into the evening. The sunset is spectacular but the crew is restless.',
      ],
      island_waters: [
        'The evening brings no wind. The islands fade into dusk on a perfectly still sea.',
      ],
      coastal: [
        'The evening land breeze stirs at last. Barely enough to give steerage way.',
      ],
      strait: [
        'Evening in the becalmed strait. The ship drifts with the current and the tide.',
      ],
    },
    night: {
      open_ocean: [
        'A still night on a still sea. The stars reflect perfectly in the water. No wind, no waves, no sound.',
      ],
      island_waters: [
        'A perfectly calm night. Bioluminescence glows in the water around the hull.',
      ],
      coastal: [
        'The night is calm and warm. A faint land breeze carries sounds from the shore.',
      ],
      strait: [
        'A calm night in the passage. The ship rests at anchor, waiting for the wind.',
      ],
    },
  },
  [WeatherCondition.RAIN]: {
    morning: {
      open_ocean: [
        'A grey morning with steady rain. The horizon is lost in a curtain of water. Visibility is poor.',
        'Rain sweeps across the open sea in sheets. The wind is fresh and the deck is awash.',
      ],
      island_waters: [
        'Rain drums on the deck as low clouds hide the island peaks. Warm tropical rain.',
      ],
      coastal: [
        'A rainy morning on the coast. The shore is a grey smudge through the downpour.',
      ],
      strait: [
        'Rain reduces visibility in the strait. Other vessels appear as dim shapes in the murk.',
      ],
    },
    afternoon: {
      open_ocean: [
        'The rain continues through the afternoon. The wind is fresh but the visibility poor.',
      ],
      island_waters: [
        'An afternoon squall sweeps through the islands. Heavy rain but it should pass.',
      ],
      coastal: [
        'Steady rain on the coastal waters. The crew goes about their work in oilskins.',
      ],
      strait: [
        'Rain and reduced visibility in the narrows. Extra lookouts posted.',
      ],
    },
    evening: {
      open_ocean: [
        'Rain at evening. The sunset is just a dim brightening in the western grey.',
      ],
      island_waters: [
        'The rain eases as evening comes. Waterfalls cascade down the island cliffs from the downpour.',
      ],
      coastal: [
        'Evening rain on the coast. Lights ashore glow dimly through the wet.',
      ],
      strait: [
        'A wet evening in the passage. The rain shows no sign of stopping.',
      ],
    },
    night: {
      open_ocean: [
        'Rain patters on the deck through the night. A warm, wet darkness envelops the ship.',
      ],
      island_waters: [
        'A rainy night among the islands. The smell of wet earth carries from unseen shores.',
      ],
      coastal: [
        'Night rain on the coastal waters. The shore lights are haloed in the wet air.',
      ],
      strait: [
        'A dark, rainy night in the narrows. The crew stays alert through the wet.',
      ],
    },
  },
  [WeatherCondition.CLOUDY]: {
    morning: {
      open_ocean: [
        'An overcast morning. Grey clouds stretch from horizon to horizon. The wind is steady.',
        'Cloudy skies over the open sea. No sun for a noon sight today.',
      ],
      island_waters: [
        'Low clouds obscure the island peaks this morning. The air is warm and humid.',
      ],
      coastal: [
        'A grey morning along the coast. The overcast sky promises rain before long.',
      ],
      strait: [
        'Overcast skies in the strait. Good visibility despite the clouds.',
      ],
    },
    afternoon: {
      open_ocean: [
        'Overcast afternoon. The sea is a dull grey under the clouds.',
      ],
      island_waters: [
        'Clouds build over the islands in the afternoon heat. Thunder rumbles in the distance.',
      ],
      coastal: [
        'A grey afternoon on the coastal waters. The overcast holds.',
      ],
      strait: [
        'Cloudy afternoon in the passage. Steady wind through the narrows.',
      ],
    },
    evening: {
      open_ocean: [
        'Evening comes grey and featureless. No sunset tonight, just a gradual darkening.',
      ],
      island_waters: [
        'The overcast sky glows briefly at sunset before fading to grey.',
      ],
      coastal: [
        'A dull evening on the coast. The clouds threaten rain.',
      ],
      strait: [
        'Evening in the overcast strait. The clouds press low over the water.',
      ],
    },
    night: {
      open_ocean: [
        'A dark, cloudy night. No stars, no moon. Navigation by dead reckoning alone.',
      ],
      island_waters: [
        'Overcast night. The islands are invisible in the darkness, known only by their smell.',
      ],
      coastal: [
        'A dark cloudy night on the coast. Shore lights are the only guide.',
      ],
      strait: [
        'A black night in the strait. The clouds hide every star.',
      ],
    },
  },
  [WeatherCondition.HURRICANE]: {
    morning: {
      open_ocean: [
        'The full fury of the hurricane. Seas run forty feet. No ship can hold course in this.',
        'Dawn — if it can be called that — brings only a darker shade of grey-green chaos.',
      ],
      island_waters: [
        'The hurricane tears at the islands with unimaginable force. Trees, roofs, boats — all airborne.',
      ],
      coastal: [
        'The hurricane drives a wall of water onto the coast. Nothing on shore is safe.',
      ],
      strait: [
        'The hurricane in the narrows is apocalyptic. The sea is more foam than water.',
      ],
    },
    afternoon: {
      open_ocean: [
        'The hurricane shows no mercy. The ship is a plaything of the wind and waves.',
      ],
      island_waters: [
        'Afternoon in the hurricane. The islands have vanished behind walls of water and wind.',
      ],
      coastal: [
        'The hurricane batters the coast without pause. Storm surge floods the low-lying areas.',
      ],
      strait: [
        'The strait is a death trap in the hurricane. God preserve all souls in these waters.',
      ],
    },
    evening: {
      open_ocean: [
        'Evening falls — not that anyone can tell. The hurricane rages on in endless fury.',
      ],
      island_waters: [
        'As darkness adds to the horror, the hurricane continues to devastate the islands.',
      ],
      coastal: [
        'Night falls on the hurricane-ravaged coast. The worst may be yet to come.',
      ],
      strait: [
        'Night and hurricane combine in the strait. Nothing to do but pray and hold on.',
      ],
    },
    night: {
      open_ocean: [
        'A night of absolute terror. The hurricane screams, the ship creaks and groans. Every wave could be the last.',
        'Lightning reveals mountainous seas in frozen instants of white light. Then darkness and the roar.',
      ],
      island_waters: [
        'The hurricane howls through the islands in the darkness. Somewhere, ships are being torn apart.',
      ],
      coastal: [
        'The hurricane rages through the night. By dawn, the coast will be unrecognizable.',
      ],
      strait: [
        'A night none aboard will ever forget — if they survive. The hurricane owns the strait.',
      ],
    },
  },
};

export function getWeatherAmbientText(weather: WeatherState, gameTime: GameTime): string {
  const timeOfDay = getTimeOfDay(gameTime.hour);
  const zoneCategory = getZoneCategory(weather.seaZoneId);

  const conditionTexts = WEATHER_TEXT[weather.condition];
  if (!conditionTexts) return '';

  const timeTexts = conditionTexts[timeOfDay];
  if (!timeTexts) return '';

  const zoneTexts = timeTexts[zoneCategory] ?? timeTexts['open_ocean'];
  if (!zoneTexts || zoneTexts.length === 0) return '';

  return pick(zoneTexts);
}

export function getStormNarrativeText(storm: ActiveStorm, zoneId: string, phase: 'approaching' | 'arriving' | 'at_peak' | 'departing'): string {
  const catText = storm.category >= 1 ? `Category ${storm.category} hurricane` : 'tropical storm';

  switch (phase) {
    case 'approaching':
      return pick([
        `Dark clouds mass on the horizon to the ${Math.random() < 0.5 ? 'east' : 'southeast'}. The barometer falls steadily. The ${catText} ${storm.name} approaches.`,
        `The swell is building from the east, long and ominous. Word comes of the ${catText} ${storm.name} bearing down on these waters.`,
        `An uneasy calm settles over the sea. Birds fly inland. The ${catText} ${storm.name} draws near.`,
      ]);
    case 'arriving':
      return pick([
        `The ${catText} ${storm.name} bears down upon us. The sky turns green-black and the wind rises to a shriek.`,
        `The ${catText} ${storm.name} has arrived. The first savage gusts tear at the rigging as the sky goes dark.`,
        `${storm.name} is upon us. The wind shifts suddenly and howls with terrible force. The sea rises in confusion.`,
      ]);
    case 'at_peak':
      return pick([
        `The full fury of ${storm.name} is upon us. Seas run forty feet. No ship can hold course in this maelstrom.`,
        `${storm.name} rages at peak intensity. The wind is a solid wall of force. Survival is the only objective.`,
        `The eye wall of ${storm.name} passes over. Winds of unimaginable force, rain like grapeshot, the sea a churning chaos.`,
      ]);
    case 'departing':
      return pick([
        `The wind eases at last. Heavy swells persist but the worst of ${storm.name} has passed. Damage assessment begins.`,
        `${storm.name} moves on, leaving destruction in its wake. The sky brightens slowly in the west.`,
        `The barometer begins to rise. ${storm.name} has departed these waters. Time to count the cost.`,
      ]);
  }
}

export function getSeasonalAmbientText(zoneId: string, gameTime: GameTime): string {
  const zone = SEA_ZONE_DEFINITIONS[zoneId];
  if (!zone) return '';

  const month = gameTime.month;

  // Hurricane season tension (Jun-Nov in hurricane zones)
  if (zone.hurricaneSeason && month >= 6 && month <= 11) {
    if (month === 9) {
      return pick([
        'September — the most dangerous month. Every cloud on the horizon draws anxious glances.',
        'Peak hurricane season. The old hands watch the sky and the barometer with equal care.',
        'The height of the storm season. Wise captains stay in port if they can.',
      ]);
    }
    if (month >= 8 && month <= 10) {
      return pick([
        'Hurricane season is in full force. The trade winds feel uneasy, gusty and shifting.',
        'Storm season weighs on every mind. Ships hug the coast, ready to run for shelter.',
      ]);
    }
    return pick([
      'The hurricane season has begun. An edge of tension in every conversation about the weather.',
      'Early storm season. The wise keep one eye on the sky and one on the harbor mouth.',
    ]);
  }

  // Dry season calm (Dec-Apr in Caribbean)
  if (month >= 12 || month <= 4) {
    if (zone.hurricaneSeason) {
      return pick([
        'The dry season — the best sailing weather of the year. Steady trades, clear skies, calm seas.',
        'Christmas trade winds blow fresh and constant. Prime sailing season in the Caribbean.',
        'The pleasant season. No fear of hurricanes, just steady winds and fair weather.',
      ]);
    }
  }

  // Harmattan season (West Africa)
  if (zoneId === 'west_african_coast' && (month === 12 || month === 1 || month === 2)) {
    return pick([
      'The Harmattan blows from the Sahara. A fine dust fills the air, turning the sun a hazy red.',
      'Harmattan season. The dry wind cracks lips and parches throats. Visibility drops in the dust haze.',
      'The northeast wind carries Saharan dust across the coast. Everything is coated in fine grit.',
    ]);
  }

  // Norther season (Gulf)
  if ((zoneId === 'gulf_of_mexico' || zoneId === 'yucatan_channel') && month >= 11 && month <= 3) {
    return pick([
      'Norther season in the Gulf. Cold fronts sweep down without warning, turning calm seas vicious.',
      'Winter in the Gulf means northers — sudden, cold, violent. Wise ships keep sea room.',
    ]);
  }

  return '';
}

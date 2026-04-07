// Runtime interfaces for Buccaneer Life agent system

export interface TickHandler {
  name: string;
  phase: TickPhase;
  execute(tick: TickContext): Promise<void>;
}

export enum TickPhase {
  WORLD = 'world',        // Weather, sea state, time progression
  DECAY = 'decay',        // Heat, loyalty, food, condition decay
  ECONOMY = 'economy',    // Market fluctuation, trade routes
  AGENTS = 'agents',      // Agent decision scheduling
  EVENTS = 'events',      // Event queue processing
  CLEANUP = 'cleanup',    // Post-tick cleanup
}

export interface TickContext {
  tickNumber: number;
  timestamp: Date;
  gameTime: GameTime;
  deltaMs: number;
  logger?: any;  // SimLogger — typed as any to avoid circular dependency
}

export interface GameTime {
  year: number;        // 1710-1725
  month: number;       // 1-12
  day: number;         // 1-31
  hour: number;        // 0-23
  season: Season;
  isDay: boolean;
  ticksElapsed: number;
}

export enum Season {
  WINTER = 'winter',
  SPRING = 'spring',
  SUMMER = 'summer',     // Hurricane season starts
  AUTUMN = 'autumn',     // Hurricane season peaks
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  jsonMode?: boolean;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  model: string;
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
}

export interface AgentMemoryRecord {
  id: string;
  agentId: string;
  content: string;
  type: MemoryType;
  importance: number;       // 1-10
  isTraumatic: boolean;     // Never decays
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

export enum MemoryType {
  WORKING = 'working',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
}

export interface AgentDecision {
  agentId: string;
  action: string;
  params: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  tickNumber: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParam>;
  execute(agent: AgentState, params: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolParam {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  sideEffects?: SideEffect[];
}

export interface SideEffect {
  type: string;
  target: string;
  data: Record<string, unknown>;
}

export interface AgentState {
  id: string;
  type: string;
  name: string;
  status: AgentStatus;
  portId: string;
  seaZoneId: string;
  shipId?: string;
  persona: PersonaProfile;
  lastDecisionTick: number;
  cooldownUntilTick: number;
}

export enum AgentStatus {
  ACTIVE = 'active',
  AT_SEA = 'at_sea',
  IN_PORT = 'in_port',
  IMPRISONED = 'imprisoned',
  DEAD = 'dead',
  FLED = 'fled',
}

export interface PersonaProfile {
  traits: PersonaTraits;
  paragraph: string;
  ambitions: string[];
  strategyHint: string;
  background: string;
}

export interface PersonaTraits {
  bravery: number;          // 0-100
  cruelty: number;          // 0-100
  greed: number;            // 0-100
  loyalty: number;          // 0-100
  cunning: number;          // 0-100
  superstition: number;     // 0-100
  charisma: number;         // 0-100
  seamanship: number;       // 0-100
  ambition: number;         // 0-100
  temperance: number;       // 0-100 (self-control, sobriety)
  honor: number;            // 0-100 (keeps word, fair dealing)
}

export interface HumanAttributes {
  // Physical (0-100)
  strength: number;       // raw power, carry capacity, melee damage
  endurance: number;      // stamina, pain tolerance, sustained labor
  agility: number;        // reflexes, balance, climbing, dodging
  constitution: number;   // disease resistance, healing speed, poison tolerance
  appearance: number;     // physical bearing, attractiveness (affects social)

  // Mental (0-100)
  intellect: number;      // reasoning, learning speed, strategic depth
  perception: number;     // awareness, spotting danger, reading weather
  willpower: number;      // mental resilience, resistance to fear/coercion
  creativity: number;     // improvisation, problem-solving, adaptability
  memory: number;         // recall, detail retention, pattern recognition

  // Social (0-100)
  eloquence: number;      // persuasion, rhetoric, oratory
  empathy: number;        // reading people, predicting behavior
  presence: number;       // commanding attention, physical bearing in a room
}

export interface BehaviorOverlay {
  id: string;
  name: string;
  traitModifiers?: Partial<PersonaTraits>;
  actionWeights?: Record<string, number>;
  decisionHints?: string[];
}

export interface SpawnConfig {
  minPerRegion: number;
  maxPerRegion: number;
  preferredPorts?: string[];
  requiredTraits?: Partial<PersonaTraits>;
}

export interface WorldState {
  gameTime: GameTime;
  weather: Map<string, WeatherState>;
  seaState: Map<string, SeaCondition>;
  tick: number;
}

export interface WeatherState {
  seaZoneId: string;
  condition: WeatherCondition;
  windSpeed: number;        // knots
  windDirection: number;    // degrees
  visibility: number;       // 0-1
  stormIntensity: number;   // 0-1
  temperature: number;      // degrees Fahrenheit
  activeStormId?: string;   // set when zone is under a named storm
}

export enum WeatherEventType {
  HURRICANE = 'hurricane',
  TROPICAL_STORM = 'tropical_storm',
  TROPICAL_WAVE = 'tropical_wave',
  NORTHER = 'norther',
  NOREASTER = 'noreaster',
  HARMATTAN = 'harmattan',
  WATERSPOUT = 'waterspout',
  AFTERNOON_THUNDERSTORM = 'afternoon_thunderstorm',
}

export interface ActiveStorm {
  id: string;
  name: string;
  type: WeatherEventType;
  category: number;              // 0 = tropical storm, 1-5 = hurricane
  currentZoneId: string;
  trackZoneIds: string[];        // planned path
  trackIndex: number;
  spawnTick: number;
  ticksInCurrentZone: number;
  ticksPerZone: number;          // speed — how many ticks before advancing
  peakCategory: number;
  dissipating: boolean;
}

export interface WeatherEventInstance {
  id: string;
  type: WeatherEventType;
  affectedZoneIds: string[];
  startTick: number;
  remainingTicks: number;
  windSpeed: number;
  windDirection: number;
  visibility: number;
  tempModF: number;
}

export enum WeatherCondition {
  CLEAR = 'clear',
  CLOUDY = 'cloudy',
  RAIN = 'rain',
  STORM = 'storm',
  HURRICANE = 'hurricane',
  FOG = 'fog',
  BECALMED = 'becalmed',
}

export interface SeaCondition {
  seaZoneId: string;
  waveHeight: number;       // meters
  currentSpeed: number;     // knots
  currentDirection: number; // degrees
  visibility: number;       // 0-1
}

// ============================================================
// llama.cpp Server Integration Types
// ============================================================

export interface ServerConfig {
  modelPath: string;
  host: string;
  port: number;
  gpuLayers: number;
  parallel: number;
  ctxSize: number;
  cacheTypeK: string;
  cacheTypeV: string;
  flashAttn: boolean;
  contBatching: boolean;
  batchSize: number;
  ubatchSize: number;
  cudaDevice?: number;
}

export interface GpuProfile {
  name: string;
  vramGb: number;
  parallel: number;
  ctxSize: number;
  cacheTypeK: string;
  cacheTypeV: string;
  flashAttn: boolean;
  description: string;
}

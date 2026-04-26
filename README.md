# Buccaneer Life

**A full-scale Golden Age of Piracy simulation powered by local LLM inference.**

Every character in this world — pirate captains, merchant traders, naval officers, tavern keepers, surgeons, fences, governors, crew members — is an autonomous AI agent whose decisions are made by a language model running on your GPU. No cloud. No API keys. No monthly bills. Just you, your graphics card, and 100+ AI minds navigating the 1715 Caribbean.

The number of AI agents is fully scalable — the only limit is your hardware. Tested and validated with Qwen 3.5-9B on a single RTX 3090 running 100+ agents. Scale up with more VRAM, scale down to fit an 8GB card. Every agent runs through the same rich decision pipeline regardless of population size.

Built for modders, AI researchers, game developers, and anyone who wants to watch (or join) a living world where every decision has consequences.

---

## What Makes This Different

### Rich Proprioception — Agents That *Feel* Their World

Every agent decision is informed by **50+ contextual data points**, translated from raw numbers into narrative prose before the LLM ever sees them. The model doesn't read `hull: 42` — it reads *"your brigantine is battered and leaking, barnacles thick on the keel."*

Each decision prompt is built from **13 narrative sections**, dynamically trimmed to fit a ~1,400 token budget:

| Section | What It Contains |
|---------|-----------------|
| **Identity** | Name, role, location anchor (prevents cross-contamination in batch inference) |
| **Scene** | Weather, sea state, time of day, ambient atmosphere |
| **Body** | Active wounds — "a serious gunshot wound to the shoulder, half-healed" |
| **Nature** | Personality traits rendered as felt experience, not stats |
| **Ship** | Hull condition, guns, crew strength, stores, barnacle level |
| **Sightings** | Nearby vessels — "3 merchants, 1 navy frigate" |
| **Crew** | Morale state, loyalty warnings, grievances |
| **Self** | Inner voice — ambitions, fears, strategy hints |
| **Legal** | Active warrants, bounties on your head, trial risk |
| **Intel** | Gathered intelligence — shipping routes, patrol schedules |
| **Memories** | Last 5 actions with outcomes and the agent's own reasoning |
| **Economic** | Cash, cargo value, market prices, trade opportunities |
| **Planning** | 1-2 step lookahead — "fence your cargo and you'll have enough for a hideout" |

The result: agents that remember what they did, understand why it worked or failed, see the consequences of their options, and plan ahead. All running on a 9B parameter model at 16 tokens of output.

### Hybrid AI Decision Pipeline

```
  Rule Engine          Narrative Builder         LLM              Executor
 ┌──────────┐      ┌──────────────────┐    ┌──────────┐    ┌──────────────┐
 │ Filter    │      │ 13 sections      │    │ "Pick a  │    │ Execute      │
 │ 65+ tools │─────>│ consequence      │───>│  number" │───>│ action       │
 │ to 4-10   │      │ previews         │    │          │    │ against DB   │
 │ valid     │      │ future planning  │    │ Output:  │    │              │
 │ actions   │      │ memories         │    │ "3"      │    │ Update world │
 └──────────┘      └──────────────────┘    └──────────┘    └──────────────┘
       │                                                          │
       │          Deterministic Overrides                         │
       ├─── Force-fence: pirates sell stolen cargo immediately    │
       ├─── Force-sail: break port-camping after 3 idle actions   │
       ├─── Force-dock: critically damaged ships limp to port     │
       └─── Force-join: unassigned crew find a ship               │
```

The LLM is a decision-maker, not a game engine. The rule engine pre-filters impossible actions. The narrative builder pre-computes all math and translates it to prose. The LLM picks a number. The executor applies it. This keeps inference fast (16 max tokens) while decisions remain contextually rich.

### 15 Agent Types, Each With Purpose

| Type | Role | What They Do |
|------|------|-------------|
| **Pirate Captain** | Raider | Attack ships, seize cargo, fence plunder, build havens |
| **Merchant Captain** | Trader | Buy low at origin ports, sail to destinations, sell high |
| **Naval Officer** | Law | Patrol sea zones, build cases, arrest pirates, escort convoys |
| **Privateer Captain** | Licensed pirate | Legal raiding with letters of marque — cross the line and become outlaw |
| **Pirate Hunter** | Bounty hunter | Track targets, claim bounties, gather intel on pirate movements |
| **Port Governor** | Authority | Set tariffs, issue pardons, host trials, accept bribes, fortify ports |
| **Fence** | Black market | Buy stolen goods, set prices, build trust networks with pirates |
| **Crew Member** | Labor | Work, grumble, support or challenge captains, gamble, desert |
| **Quartermaster** | Elected voice | Distribute shares, settle disputes, call votes, manage provisions |
| **Informant** | Spy | Gather intel, sell secrets, plant rumors, eavesdrop, betray sources |
| **Tavern Keeper** | Social hub | Serve drinks, broker deals, recruit crews, shelter fugitives |
| **Shipwright** | Builder | Repair ships, upgrade vessels, assess damage, build new ships |
| **Surgeon** | Healer | Treat wounds, cure disease, perform amputations |
| **Harbor Master** | Gatekeeper | Inspect ships, collect fees, look the other way for a price |
| **Plantation Owner** | Producer | Grow crops, hire shipping, post bounties on pirates |

### Historical Figures With Custom Personalities

Blackbeard, Anne Bonny, Charles Vane, Calico Jack, Stede Bonnet, Benjamin Hornigold, Mary Read, Woodes Rogers, and more — each with deeply researched biographical system prompts, historically accurate trait profiles, starting relationships, and signature ships.

> *"You are Edward Teach — Blackbeard. You weave slow-burning fuses into your great black beard before battle, wreathing your face in smoke and hellfire. You have cultivated an image of demonic terror so complete that most prizes surrender at the sight of your flag. This is deliberate. You are not mad — you are theatrical. Violence is a tool, and fear is cheaper than cannon shot."*

### The World

- **25 sea zones** — from the Great Bahama Bank to the Darien Coast
- **20 ports** — 14 Caribbean (Nassau, Port Royal, Havana, Tortuga...), 3 European, 3 African
- **200+ named places** — taverns, forts, churches, shipyards, slave markets, government houses
- **15+ hideouts** — Ocracoke Inlet, Cape Fear, maroon strongholds, uninhabited cays
- **17 ship classes** — periagua (4-crew canoe) to East Indiaman (350 cargo, 36 guns)
- **50+ trade goods** — sugar, rum, tobacco, gold, silver, emeralds, enslaved people, spices, silk, gunpowder, ambergris, vanilla, whale oil, and more
- **Full triangular trade** — Caribbean → Europe → Africa → Caribbean, with production, processing, and consumption
- **Dynamic weather** — hurricanes track across zones, storms reduce visibility, becalmed waters trap ships
- **Disease system** — malaria, yellow fever, scurvy, dysentery — port-specific infection rates
- **River systems, overland routes, plantations, mine sites**

### Combat That Follows History

~90% of real pirate encounters ended without a broadside fired. The combat system reflects this:

- **Intimidation phase**: Infamy acts as a force multiplier. A feared pirate captain makes merchants surrender before a shot is fired.
- **Broadside phase**: 1-3 rounds of cannon fire. Firepower = guns x hull condition x powder stores.
- **Boarding phase**: Crew ratio determines the outcome. 1.5:1 advantage = capture.
- **Cargo seizure**: Only pirate-type captains loot (LOOT_TYPES gate). Seized goods gain "heat."
- **Ship capture**: Taken as prize. Captains can claim prizes as new flagships.
- **Sinking is rare**: Wooden ships are very hard to sink with cannons — hull must go below -20.

### Persona System — 11 Traits, Infinite Characters

Every agent is generated with 11 personality traits (0-100 each):

`bravery | cruelty | greed | loyalty | cunning | superstition | charisma | seamanship | ambition | temperance | honor`

Plus 13 human attributes (strength, endurance, agility, constitution, intellect, perception, willpower, etc.). Traits drive:
- **Narrative personality paragraphs** — procedurally generated prose
- **Ambition ranking** — wealth, power, fame, survival, respect, freedom, revenge, legacy
- **Strategy archetypes** — aggressive, opportunistic, cautious, diplomatic, mercantile
- **Dynasty system** — child agents inherit parental traits with jitter (for generational gameplay)

### Economy That Breathes

- **Production**: Crops grow based on weather and season. Mines extract based on labor.
- **Processing**: Sugar → molasses → rum. Cacao → chocolate. Hides → leather.
- **Consumption**: Ports consume goods proportional to population.
- **Dynamic pricing**: Supply/demand driven. Gluts crash prices. Shortages spike them.
- **Fence network**: 5-tier trust system. Tier 1 fences take a 30% cut. Tier 5 takes 10%.
- **Haven investments**: Build hideouts, warehouses, taverns, shipyards, forts — each with income.
- **Crew wages**: Loyalty decays without pay. Mutiny at loyalty <15. Desertion at <20.

---

## Human Player Hook

The engine is built for a future where **you** are one of the agents. The simulation harness (`src/sim/`) runs all agents autonomously, but the architecture is designed so a human player can replace any agent's LLM decision with their own input:

- The `player-ai.ts` module provides the hook point
- The action filter shows you valid moves
- The consequence preview tells you what happens if you choose each one
- The narrative prompt is your world view — rich, atmospheric, personal
- Every other character continues making their own LLM-driven decisions around you

**The vision**: You start as a crew member — kidnapped, thrown aboard a pirate ship. Every person around you is an AI with their own personality, loyalties, and ambitions. Rise from common sailor to pirate lord through your choices. The world doesn't pause for you.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **A CUDA-capable GPU** (8GB+ VRAM recommended, 12GB+ ideal)
- **A GGUF model** — tested with [Qwen 3.5-9B Q4_K_M](https://huggingface.co/bartowski/Qwen_Qwen3.5-9B-GGUF) (~5.5 GB)

### 1. Clone

```bash
git clone --recurse-submodules https://github.com/aivrar/buccaneer-life-simulation-game.git
cd buccaneer-life-simulation-game
```

### 2. Build llama.cpp

```bash
cd llama.cpp
cmake -B build -G "Visual Studio 17 2022" -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES="86;89" -DBUILD_SHARED_LIBS=OFF
cmake --build build --config Release -j
cd ..
```

> **Linux/Mac**: Adjust the cmake generator. See [llama.cpp build docs](https://github.com/ggml-org/llama.cpp#build).

### 3. Download a Model

Place your GGUF model in `models/`:

```bash
mkdir -p models/qwen35-9b
# Download from HuggingFace — example:
# https://huggingface.co/bartowski/Qwen_Qwen3.5-9B-GGUF
# Place the .gguf file in models/qwen35-9b/
```

### 4. Start the LLM Server

```bash
./llama.cpp/build/bin/Release/llama-server \
  --model models/qwen35-9b/Qwen_Qwen3.5-9B-Q4_K_M.gguf \
  --host 127.0.0.1 --port 8081 \
  --ctx-size 4096 --parallel 20 \
  --n-gpu-layers 999 \
  --flash-attn on \
  --cache-type-k q8_0 --cache-type-v q8_0 \
  --reasoning off
```

Or on Windows, use the included batch file:
```bash
load_model.bat
```

Verify the server is running:
```bash
curl http://127.0.0.1:8081/health
```

### 5. Install Dependencies & Seed the World

```bash
cd engine
npm install
```

Create the `.env` file:
```bash
cat > .env << 'EOF'
LLM_PROVIDER=local
VLLM_URL=http://127.0.0.1:8081/v1
VLLM_MODEL=qwen35-9b
SQLITE_PATH=./game.db
SIM_TICK_INTERVAL_MS=0
SIM_MAX_CONCURRENT_LLM=20
SIM_LOG_LEVEL=events
EOF
```

Seed the database:
```bash
npx tsx src/db/seed.ts
```

### 6. Run the Simulation

```bash
# 100 agents, 90 game days
npx tsx src/sim/index.ts --agents=100 --days=90 --log=events
```

### 7. Resume a Previous Run

```bash
npx tsx src/sim/index.ts --days=90 --resume --log=events
```

---

## Configuration

### Scalability — Your VRAM Is the Only Limit

The agent count is fully scalable. There is no hardcoded cap. The engine batches LLM calls (up to 60 at a time via `Promise.allSettled`) and the `--parallel` flag on llama-server controls how many concurrent inference slots your GPU handles. More VRAM = more slots = more agents.

| GPU | VRAM | Recommended `--parallel` | Estimated Agents |
|-----|------|-------------------------|-----------------|
| RTX 3060 | 12 GB | 10-15 | 40-60 |
| RTX 3070 Ti | 12 GB | 10-15 | 40-60 |
| RTX 3090 | 24 GB | 20-30 | 80-120+ |
| RTX 4070 Ti | 16 GB | 15-20 | 60-80 |
| RTX 4090 | 24 GB | 25-40 | 100-200+ |

> **Future: TurboQuant KV cache quantization** (included as `llama.cpp-tq` submodule) roughly doubles concurrent slots by compressing the KV cache from FP16 to 3-4 bit. On an RTX 3090 with a 9B model: from ~80 slots to ~176 slots. Targeting mainline llama.cpp merge in Q3 2026.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `local` | `local` for llama-server, `openrouter` for cloud API |
| `VLLM_URL` | `http://localhost:8081/v1` | LLM server endpoint |
| `VLLM_MODEL` | `qwen35-9b` | Model name for API calls |
| `SQLITE_PATH` | `./game.db` | Game state database |
| `SIM_MAX_CONCURRENT_LLM` | `20` | Max parallel LLM requests |
| `SIM_LOG_LEVEL` | `events` | `silent`, `errors`, `events`, `verbose`, `debug` |

### Tested Models

| Model | Size | Quality | Speed | Notes |
|-------|------|---------|-------|-------|
| **Qwen 3.5-9B Q4_K_M** | 5.5 GB | Best | Good | Recommended. 17% passive action rate. |
| Gemma 4 E4B Uncensored | 5.1 GB | Good | Good | Apache 2.0. Needs `--reasoning off`. |
| Qwen 3.5-4B | 2.5 GB | Fair | Fast | 44% passive actions. Needs fuzzy parsing. |

---

## Project Structure

```
buccaneer-life-simulation-game/
├── engine/                    # Game engine (TypeScript)
│   ├── src/
│   │   ├── agents/            # 15 agent types + persona engine + historical figures
│   │   ├── config/            # Game balance: ships, cargo, ports, economy, weather...
│   │   ├── db/                # SQLite schema, models, queries, seed data
│   │   ├── engine/            # Action executors (65+), combat, trade, navigation...
│   │   ├── handlers/          # 17 tick handlers (weather, economy, combat, crew...)
│   │   ├── nudge/             # Self-nudge, crew advisory, planning nudge
│   │   ├── runtime/           # LLM client, tick scheduler, memory store, types
│   │   ├── sim/               # Simulation harness, checkpoints, logger, metrics
│   │   ├── strategy/          # Hybrid AI: action filter, narrative prompt, parser
│   │   ├── utils/             # Formatting helpers
│   │   └── world/             # Weather, crops, mining, sea state, ports, vessels
│   ├── package.json
│   └── tsconfig.json
├── llama.cpp/                 # Git submodule — upstream llama.cpp
├── llama.cpp-tq/              # Git submodule — TurboQuant fork (KV cache quantization)
├── models/                    # GGUF model files (gitignored)
├── scripts/                   # Build scripts
├── load_model.bat             # Windows model launcher
├── llama_game_notes.md        # Development notes & research
├── 4-5-26_sim_findings.md     # Simulation analysis & balance findings
├── SIM_TESTING_LOG.md         # Full testing log across 40+ runs
└── README.md
```

---

## Simulation Output

Each run produces detailed JSONL logs in `engine/sim-output/`:

| File | Contents |
|------|----------|
| `agent-decisions.jsonl` | Every agent decision with action, result, source (LLM/short-circuit/force) |
| `combat.jsonl` | Every combat engagement with damage, casualties, cargo seized |
| `cargo-trade.jsonl` | Every buy/sell transaction with prices, quantities, ports |
| `fences.jsonl` | Every fence transaction — stolen goods laundered |
| `navigation.jsonl` | Every departure and arrival |
| `economy.jsonl` | Daily market snapshots — prices, supply, agent wealth |
| `crew-events.jsonl` | Recruitment, desertion, shares distributed, mutiny risk |
| `intel.jsonl` | Intelligence gathered, sold, planted |
| `law.jsonl` | Arrests, cases, patrols, warrants |
| `bounties.jsonl` | Bounties posted and claimed |
| `pardons.jsonl` | Pardons offered and accepted |
| `wounds-disease.jsonl` | Wounds inflicted, treated, disease outbreaks |
| `reputation.jsonl` | Reputation changes across sea zones |
| `prompt-debug.jsonl` | Full LLM prompts and responses (for tuning) |
| `tick-summary.jsonl` | Per-tick performance metrics |
| `agent-states.jsonl` | Daily snapshot of all agent states |
| `memories.jsonl` | Agent cognitive memory creation |

---

## Key Design Decisions

### Why the LLM Only Outputs a Number

Small local models (4B-9B) cannot reliably follow structured output formats. After 40+ simulation runs and 200K+ LLM decisions, the lesson is clear: **ask for the least possible output**. The numbered-choice format achieves near-perfect parse rates across models. All context, all math, all narrative richness is in the *input* — the output is just a selection.

### Why Deterministic Overrides Exist

The LLM is a tool, not a strategist. It will *never* reliably choose `sell_plunder` even with "SELL STOLEN CARGO NOW" in all caps. It defaults to passive actions (lay_low, do_nothing, gather_intel). The fix isn't better prompting — it's deterministic overrides for critical economic actions. Force-fence, force-sail, and force-dock are all historically accurate behaviors that the LLM consistently fails to choose.

### Why Local Inference

The target is a Steam game where every player runs their own agents on their own GPU. No server costs scale with player count. More players = more compute = more agents in the shared world. A single RTX 3060 can run 40-60 concurrent agents. An RTX 3090 handles 100+.

---

## Development History

This project is a direct evolution of **Buccaneer Life (BUC)**, a 30,000+ line TypeScript simulation that ran 100+ agents on a custom vLLM Windows server. The full engine was ported to use llama.cpp for Steam distribution — switching from Python/CUDA-only inference to a single distributable binary that supports CUDA, Vulkan, and Metal.

Key milestones documented in the included dev notes:
- 40+ simulation runs validating agent behavior
- 200,000+ LLM decisions analyzed
- Combat, economy, trade, crew loyalty systems all battle-tested
- Balance findings with detailed analysis (see `4-5-26_sim_findings.md`)

---

## Contributing

This is an open project. Fork it, mod it, build on it. Some areas that need work:

- **Multiplayer game server** — the `server/` directory is scaffolded but empty
- **Player input integration** — `player-ai.ts` has the hook, needs a UI
- **Frontend** — no visual client yet (pure simulation engine)
- **More models tested** — especially AMD/Vulkan and Apple Silicon
- **Action executor depth** — some actions are still shallow stubs
- **Trade route AI** — merchants need smarter multi-hop route planning

---

## License

MIT License. Free for any use. See [LICENSE](LICENSE).

---

*Built with llama.cpp, TypeScript, SQLite, and an unhealthy obsession with the Golden Age of Piracy.*

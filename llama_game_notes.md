# LLAMA GAME — Development Notes

Started: 2026-04-03

## Project Overview

A solo pirate life simulation game powered by local LLM inference via llama.cpp. The player controls a single character — kidnapped and thrown aboard a pirate ship — and must survive, build relationships, and rise from swab hand to pirate lord. Every character in the world is an autonomous AI agent making LLM-inferred decisions. The game runs at 1:1 real-time scale: a 3-day voyage takes 3 real days, and everything that happens during those 3 days is playable content.

Target platform: Steam (Windows). Distributed with bundled llama-server + GGUF model. No cloud dependency — all inference runs on the player's GPU.

## Prior Art: Buccaneer Life (E:\BUC)

This project builds on **Buccaneer Life**, an AI agent pirate simulation at `E:\BUC`. BUC is a TypeScript/Node.js project that runs 100+ autonomous AI agents in a persistent Golden Age of Piracy world (1710–1725). The full BUC engine has been ported into this project (see "BUC Engine Port" section below).

**BUC by the numbers**:
- 136 TypeScript source files, ~30,000+ lines of code
- 15 agent types, 65+ action types, 17 tick handlers
- 25 sea zones, 14 Caribbean ports, 17 ship classes, 50+ cargo types
- 20+ database tables (originally MySQL, migrated to SQLite for this project)
- Hybrid strategy: rule engine filters valid actions → LLM picks from filtered set
- Rich proprioception: 50+ data points per agent decision
- Three nudges per LLM call (self-nudge, crew advisory, planning)
- Sim tested: 100 agents, 180 game-days, 33,000+ LLM decisions, years of game time validated
- Originally powered by vLLM (custom Windows build) running Qwen 3.5-9B abliterated GPTQ-4bit

## Prior Art: vLLM Windows Build (E:\vllm-windows-build-v2)

Custom vLLM 0.17.1 server built for Windows with workarounds:
- Request batching via background worker thread (50ms interval) because AsyncLLMEngine ZMQ fails on Windows
- Think token banning via logit_bias (Qwen 3.5 tokens 248068/248069)
- Prefix caching enabled, Marlin GPTQ kernels
- Tested: 250 sustained requests, 93 concurrent, 100% success rate
- Models available: Qwen 3.5-9B GPTQ-4bit, Qwen 3.5-27B GPTQ-3bit/4bit, Qwen 3-14B AWQ-4bit

## Why llama.cpp Instead of vLLM

- **Steam distribution**: llama-server is a single binary. vLLM requires Python + CUDA + venv — nightmare to package.
- **Broader GPU support**: llama.cpp supports CUDA, Vulkan (AMD/Intel), Metal (Mac). vLLM is CUDA-only.
- **Lower VRAM with GGUF**: Quantized GGUF models run on 8GB cards. vLLM GPTQ needs more headroom.
- **TurboQuant future**: KV cache quantization will multiply concurrent agent slots. llama.cpp's `--cache-type-k/v` flags already support this path.
- **Tradeoff accepted**: vLLM has better batch throughput (Marlin kernels, paged attention), but at 1:1 real-time game pace, llama.cpp's concurrency is more than sufficient.

---

## Research: TurboQuant (2026-04-03)

Investigated TurboQuant (Zandieh et al., ICLR 2026) — a KV cache quantization method from Google using polar coordinates.

**Status**: Not yet merged into mainline llama.cpp. Feature request opened 2026-03-25 (ggml-org/llama.cpp#20977). CPU implementation complete (18/18 tests passing). CUDA kernels written, awaiting GPU validation. Official merge targeted Q3 2026.

**Performance**: TQ3 (3-bit) gives 4.9x compression vs FP16. TQ4 (4-bit) gives 3.8x compression. Near-lossless: 0.997 on Needle-in-a-Haystack at 4x compression.

**Community forks examined**:
- `TheTom/llama-cpp-turboquant` — NOT an actual TurboQuant implementation. Just a fresh fork of llama.cpp (1 commit ahead of upstream). The "turboquant" name is aspirational.
- `TheTom/turboquant_plus` — Apple Silicon / Metal support with turbo3/turbo4 cache types.
- `spiritbuun/llama-cpp-turboquant-cuda` — CUDA support variant.

**Decision**: Use upstream llama.cpp as a git submodule. Prepare a `patches/` directory for custom TurboQuant patches when ready. When TurboQuant merges into mainline (Q3 2026), delete patches and use native support.

**Impact on concurrency**: TurboQuant q4_0 KV cache roughly doubles concurrent agent slots vs current q8_0 KV. On RTX 3090 with 7B model: from ~88 slots to ~176 slots.

---

## Research: Models (2026-04-03)

### Gemma 4 (Google, April 2026)

Gemma 4 released April 2026 under **Apache 2.0** license (changed from Google's restrictive license — critical for Steam).

Model family: E2B (2B effective), E4B (4B effective), 26B-A4B (MoE, 26B total / 4B active), 31B (dense).

**Downloaded for testing**:
- `Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf` (5.1 GB) — from HauhauCS on HuggingFace. Abliterated with 0/465 refusals. K_P quantization uses importance matrix for quality preservation. 131K context supported.
- Source: https://huggingface.co/HauhauCS/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive

**Not yet downloaded but noted**:
- Gemma 4 26B-A4B: MoE architecture, 26B total params but only activates 4B per inference. Smarter than E4B but Q4_K_M is ~16.8 GB. No abliterated version exists yet.
- Gemma 4 31B: Most capable, Q4 is ~20 GB. Tight on 24GB VRAM.

### Qwen 3.5

**Downloaded for testing**:
- `Qwen_Qwen3.5-9B-Q4_K_M.gguf` (5.5 GB) — from bartowski on HuggingFace. Standard (not abliterated) but proven quality from BUC testing. Think tokens require logit_bias ban (tokens 248068/248069).
- Source: https://huggingface.co/bartowski/Qwen_Qwen3.5-9B-GGUF

**Note**: Qwen 3.5-9B abliterated versions exist (lukey03/Qwen3.5-9B-abliterated, huihui_ai/qwen3.5-abliterated on Ollama) but not yet downloaded as GGUF.

### Think Token Handling

Different models handle thinking/reasoning differently:

| Model | Think Tokens | Server-Level Disable | Client-Level Disable |
|-------|-------------|---------------------|---------------------|
| Gemma 4 | `<\|think\|>` / `<\|/think\|>` | `--reasoning off` | N/A (server handles it) |
| Qwen 3.5 | `<think>` / `</think>` | `--reasoning off` | logit_bias ban tokens 248068/248069 |

**Decision**: Think tokens OFF for agent workloads. The hybrid strategy (rule engine pre-filters actions) means the LLM is doing selection + personality, not complex reasoning. Think tokens waste context budget and latency. The `--reasoning off` flag was added to llama-server as a replacement for the deprecated `--chat-template-kwargs`. The LLM client also strips leaked think blocks as a safety net.

---

## Infrastructure Setup (2026-04-03)

### llama.cpp Submodule

- Cloned `ggml-org/llama.cpp` as git submodule at `E:\llama_game\llama.cpp\`
- Built with CUDA support for compute capability 86 (RTX 3060/3090) and 89
- CMake command: `cmake -B build -G "Visual Studio 17 2022" -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES="86;89" -DBUILD_SHARED_LIBS=OFF`
- Built target: `llama-server.exe` (343 MB) at `llama.cpp/build/bin/Release/llama-server.exe`
- CUDA 13.1.80 detected (v13.1 toolkit installed on system)

### Build Scripts

| File | Purpose |
|------|---------|
| `scripts/build-llama.sh` | CMake build with CUDA. Auto-applies any patches from `patches/` directory before building. |
| `scripts/update-llama.sh` | Pulls latest upstream llama.cpp submodule and rebuilds. |

### Model Downloads

| File | Location | Size |
|------|----------|------|
| Gemma 4 E4B Uncensored Q4_K_P | `models/gemma4-e4b-uncensored/Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf` | 5.1 GB |
| Qwen 3.5-9B Q4_K_M | `models/qwen35-9b/Qwen_Qwen3.5-9B-Q4_K_M.gguf` | 5.5 GB |

Downloaded via `huggingface_hub.hf_hub_download()` Python API. The `huggingface-cli download` command failed on Windows due to Unicode encoding errors in progress bar output.

---

## Benchmark Results (2026-04-03)

### Test Environment
- GPU: NVIDIA RTX 3090 24GB (pinned via CUDA_VISIBLE_DEVICES=0)
- Model: Gemma 4 E4B Uncensored Q4_K_P (5.1 GB)
- llama-server config: 88 parallel slots, 1024 ctx, q8_0 KV, flash-attn on, reasoning off
- Model VRAM usage: 4,088 MiB (of 23,304 MiB free)

### 20 Concurrent Agents

| Metric | Value |
|--------|-------|
| Success rate | 20/20 (100%) |
| Batch wall time | 2,742ms |
| Avg latency | 2,452ms |
| P50 latency | 2,477ms |
| P95 latency | 2,735ms |
| Throughput | 7.3 agents/sec |

### 88 Concurrent Agents (max slots)

| Metric | Value |
|--------|-------|
| Success rate | 88/88 (100%) |
| Batch wall time | 9,068ms |
| Avg latency | 7,342ms |
| P50 latency | 7,560ms |
| P95 latency | 8,951ms |
| Throughput | 9.7 agents/sec |

**Key observations**:
- 88 simultaneous agents on a single RTX 3090, zero failures
- Throughput IMPROVED from 7.3 to 9.7 agents/sec at higher load (GPU batching more efficient when saturated)
- All agents produced contextually appropriate, in-character responses
- The uncensored model handled pirate-themed content without refusals
- At real-time 1:1 game pace, even 200+ agents needing decisions every few game-hours is trivially handled

### Not Yet Tested
- Qwen 3.5-9B comparison (model downloaded, not benchmarked)
- Stress test ramp to find actual failure ceiling (may be higher than 88)
- Dual-GPU (3090 + 3060) concurrent testing
- Higher context sizes (2048, 4096) impact on slot count
- **Full BUC sim running on llama-server** (next milestone)

---

## Game Design Decisions (2026-04-03)

### Time Scale: 1:1 Real-Time

The game runs at 1:1 real-time scale. A 3-day sea voyage takes 3 real days. This is NOT dead time — everything is playable content because every character on the ship is an AI agent with personality, memories, and agendas.

**Daily rhythm at sea**: Watch changes, work duties, meals, training/gambling, evening socializing, night watch or sleep. AI agents generate conversations, conflicts, events, and relationships that fill every moment.

**Interrupts**: Ship sightings, storms, crew fights, sickness, encounters — snap the player to attention during routine periods.

**Player offline**: Character goes to sleep or passive watch. AI agents continue making decisions. When the player returns, a logbook summarizes what happened. Deciding what to follow up on from the log IS gameplay.

**Why 1:1 works**:
- AI agents make every moment content-rich (unique conversations, evolving relationships)
- Relationships build over real time — spending 3 actual days with crew means you KNOW them
- Skills develop naturally through repeated practice, not skill trees
- Boredom/quiet makes action moments feel electric (real pacing)
- Concurrency math works: 30 agents making 1 decision per game-hour = 30 LLM calls per real hour = trivial load

### Progression: Nothing to Everything

The player starts as a kidnapped nobody ("shanghaied") and works up to pirate lord. The UI itself reflects status:

| Stage | Rank | What You See | Actions Available |
|-------|------|-------------|-------------------|
| 1 | Prisoner / Kidnapped | Dark hold, cramped space | Talk, listen, comply, resist |
| 2 | Swab Hand | Deck view, learning names | Work, steal, eavesdrop, befriend |
| 3 | Trusted Crew | Sea horizon, weather | Volunteer for raids, request duties, build alliances |
| 4 | Officer / First Mate | Navigation charts (partial map) | Give orders, plan routes, manage disputes |
| 5 | Captain | Full captain's desk (map, manifest, logbook, intel board) | Everything — raids, trade, diplomacy, fleet |
| 6 | Pirate Lord | Expanded desk, fleet view, political correspondence | Empire management, faction control |

**The UI IS the progression.** Information is power, literally reflected in what the player can see. No grayed-out features — you genuinely don't know what you don't know until you earn access through rank and relationships.

### Interface Concept: Captain's Desk

The screen represents the player's physical perspective. At captain rank:
- **Sea chart** (canvas map) — click to navigate, see ships/ports
- **Conversation panel** — AI dialogue with character portraits and action choices
- **Ship status** — crew, cargo, hull, supplies
- **Logbook / feed** — agent actions, world events, intel reports

At lower ranks, most of this is hidden. A swab hand sees the deck and has conversations. A prisoner sees darkness and whispers.

### Solo First, Multiplayer Later

**Primary target**: Solo experience. One player, their GPU, their pirate story.

**Future multiplayer considerations discussed**:
- Each player runs own llama-server locally (distributed inference, zero server GPU cost)
- Session-based or "Dark Souls invasion" style encounters when players are in same sea zone
- Offline agents: simplest approach is agents disappear with player. Alternative: zombified rule-based behavior.
- Time sync is the hard problem. 1:1 real-time simplifies this — everyone's on the same clock.

---

## BUC Engine Port (2026-04-04)

### What Was Done

The entire BUC source tree (136 TypeScript files, ~30,000+ lines) was copied from `E:\BUC\src\` into `E:\llama_game\engine\src\`. This brings in the full game engine:

**Copied directories**:
- `agents/` — 15 agent types, persona engine, name generator, historical figures, spawn system
- `config/` — ports, ships, regions, cargo, economy, weather, agents, skills, heritage, etc.
- `db/` — database models, queries, schema, seed script
- `engine/` — 47 files: action executor, 17 action modules, combat, navigation, crew loyalty, reputation, economy, encounters, fence network, intel, trade, territory, daily routine, prisoners, interactions, wounds, skills, etc.
- `handlers/` — 17 tick handlers (weather, disease, travel, decay, crew, economy, navy, intel, agent, interaction, combat, encounter, events, etc.)
- `nudge/` — self-nudge, crew advisory, planning nudge, branch builder, plan manager
- `runtime/` — agent runner, tick scheduler, LLM client, memory store, embedding client, types
- `sim/` — simulation harness, checkpoint, metrics, reporter, sim clock, sim logger, player AI
- `strategy/` — hybrid decision pipeline, action filter, narrative prompt builder, proprioception, response parser, cognitive prompt, consequence preview, future planner, agent memory
- `utils/` — formatting utilities
- `world/` — weather, sea state, storm tracker, disease, navigation, ports, places, regions, temperature, vessel spawner, crop/mineral production, port inventory/consumption

**NOT copied** (stashed in `engine/src/_llama_infra/`):
- Simple placeholder game files that were superseded by BUC's full engine (player-state.ts, world-state.ts, game-session.ts, presenter.ts, conversation.ts, agent-brain.ts, events.ts)
- Original poc.ts, stress.ts, play.ts, index.ts (these reference the placeholder types)

**Kept alongside BUC code** (llama.cpp integration layer):
- `runtime/server-manager.ts` — llama-server lifecycle manager
- `config/gpu-profiles.ts` — GPU VRAM → parallel slot mappings
- `config/models.ts` — per-model think token + temperature config

### MySQL → SQLite Migration

BUC used MySQL (mysql2/promise) for all game state persistence. For Steam distribution, this was migrated to SQLite (better-sqlite3).

**Files changed**:

| File | Change |
|------|--------|
| `db/sqlite.ts` | **New file** replacing `db/mysql.ts`. Uses `better-sqlite3` with async wrapper functions that match the old MySQL interface (`query<T>()`, `execute()`, `transaction()`, `closeDb()`). WAL mode enabled. Foreign keys enabled. Database file at `process.env.SQLITE_PATH \|\| './game.db'`. |
| `db/schema.sql` | **Converted** from MySQL to SQLite syntax. Changes: removed `CREATE DATABASE`/`USE`, `ENUM()` → `TEXT CHECK(IN(...))`, `JSON` → `TEXT`, `DECIMAL` → `REAL`, `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` → `TEXT DEFAULT (datetime('now'))`, `ON UPDATE CURRENT_TIMESTAMP` removed, `BOOLEAN` → `INTEGER`, `VARCHAR` → `TEXT`, inline `INDEX`/`UNIQUE KEY` → separate `CREATE INDEX` statements. |
| `db/queries.ts` | **Updated** imports from `./mysql.js` to `./sqlite.js`. Removed all `RowDataPacket` type intersections (60+ occurrences). `ON DUPLICATE KEY UPDATE` → `ON CONFLICT() DO UPDATE SET`. Backtick-quoted column names → double-quoted. `UUID()` SQL function → removed (UUIDs generated in TypeScript). |
| `db/seed.ts` | **Updated** imports to use sqlite.ts. `SET FOREIGN_KEY_CHECKS` → `PRAGMA foreign_keys`. `TRUNCATE TABLE` → `DELETE FROM`. `INSERT IGNORE` → `INSERT OR IGNORE`. `pool.query()` → `dbExecute()`. |

**Dependencies updated**: Added `better-sqlite3`, `sql.js`, `@types/better-sqlite3`, `@types/sql.js` to package.json. `mysql2` kept as dependency (not yet removed — some files may still reference types).

**TypeScript compilation**: Clean — zero errors across all 182 source files after migration.

### BUC Architecture Summary (from comprehensive code review)

**Decision Pipeline Flow**:
```
AgentRunner.runSingle(agent)
  ├─ filterActionsForAgent() → 4-10 valid actions
  ├─ buildNarrativePrompt() → rich proprioception (1400-token budget, 4-stage compression)
  │   ├─ gatherAgentData() — 50+ data points
  │   ├─ self-nudge (strategy × agent-type voice matrix)
  │   ├─ crew-advisory (captain/QM only: crew strength, loyalty, grievances, mutiny risk)
  │   └─ planning-nudge (active plan progress OR 2-3 branch suggestions)
  ├─ fillSystemPrompt() → agent type template with {placeholders}
  ├─ llmClient.chatCompletion() → LLM response
  ├─ parseAgentResponse() → extract first digit → map to action
  ├─ executeAction() → apply to world state (65+ action handlers)
  └─ memoryStore.addMemory() → working memory
```

**Tick Execution (17 handlers in 5 phases)**:
```
Phase 1 WORLD:   weather → disease → travel
Phase 2 DECAY:   decay → crew → skill-transfer → reputation
Phase 3 ECONOMY: economy → haven
Phase 4 AGENTS:  navy → intel → agent-tick → interaction
Phase 5 EVENTS:  combat → encounter → event
```

**Key Engine Systems**:
- **Combat**: Escape check → pre-broadside surrender (infamy-weighted) → 1-3 broadside rounds → boarding. Historical accuracy: 90% of pirate encounters ended in surrender.
- **Encounters**: O(n²) ship pairs per sea zone, visibility-weighted, 48-tick cooldown between same pair.
- **Crew loyalty**: Per-crew-member loyalty (0-100), grievances, mutiny checks (ringleaders vs loyalists ratio determines outcome).
- **Reputation**: Per-zone (-100 to 100), propagates to adjacent zones at 50% bleed. Infamy separate from reputation.
- **Economy**: Dynamic pricing (supply/demand, glut/shortage thresholds, seasonal modifiers, disruption from piracy).
- **Navigation**: Waypoint-based travel with speed modifiers (hull condition, sea state, wind, crew).
- **Fence network**: 5-tier criminal fence system with trust progression, heat-aware pricing.
- **Daily routine**: Time-of-day agent preferences (morning=work, evening=tavern, night=sleep).
- **Prisoners**: Ransom, recruit (pressed into service at loyalty=25), release, execute, maroon.

**Database**: 20+ tables persisting agents, ships, crew, cargo, ports, sea zones, weather, reputation, relationships, intel, navy cases, bounties, wounds, skills, fences, haven investments, ship codes, documents, world events.

**Sim Harness**: 1 tick = 1 game-hour, 24 ticks/day. Slow handlers fire every 6 ticks. Agent cooldowns range from 1-96 ticks depending on action type. Fast-forward skips idle ticks. Checkpointing every 24 ticks. Metrics tracking (decisions, latency, combat, economy).

---

## Model Strategy & Context Length Analysis (2026-04-04)

### Model Intelligence Assessment

BUC was validated on **Qwen 3.5-9B GPTQ-4bit** (9 billion parameters). The models available for llama.cpp testing:

| Model | Params | Size | BUC-Validated? | Uncensored? | Notes |
|-------|--------|------|----------------|-------------|-------|
| Qwen 3.5-9B Q4_K_M | 9B | 5.5 GB | Yes (GPTQ variant) | No (standard) | Proven quality, may refuse pirate violence |
| Gemma 4 E4B Q4_K_P | 4B | 5.1 GB | No | Yes (0/465 refusals) | Half the params of validated model |

**Concern**: The 4B Gemma is less than half the parameters of the 9B Qwen that BUC was validated on. While BUC's task is relatively simple (pick a number from 4-10 actions), the quality of reasoning behind the choice matters for emergent behavior. A 4B model may:
- Pick valid actions but with less nuanced reasoning
- Be worse at understanding complex proprioception prompts (50+ data points)
- Be less consistent at staying in character across the 8 strategy × 6 agent-type voice matrix

**Plan**: Test both models. Start with Qwen 3.5-9B (proven quality), compare with Gemma 4 E4B. For Steam, we need an abliterated 9B+ model — either Qwen 3.5-9B abliterated GGUF or a future larger Gemma 4 abliterated variant.

### Context Length Requirements

BUC's prompt pipeline was engineered for **2048 context** on vLLM:

```
2048 total context budget
 - 120 tokens: system prompt template (role, personality, type-specific)
 - 1400 tokens: narrative prompt (proprioception + nudges + memories + actions)
    → 4-stage compression: strip stop words → use shortContent → remove section → never trim core
 - 16 tokens: output instruction ("reply with ONLY the number")
 - 250 tokens: max response (action number + reasoning)
 - ~262 tokens: buffer
```

The narrative prompt builder (`strategy/narrative-prompt.ts`) has a hard 1400-token budget with `estimateTokens()` = words × 1.35. It uses 4-stage compression to fit. Core sections (SCENE, BODY, ACTIONS) are never trimmed.

**GPU profile impact at 2048 context** (Gemma 4 E4B, 5.1 GB weights on RTX 3090):

| ctx_size | KV per slot (q8_0 + FA) | Available VRAM | Max parallel slots |
|----------|------------------------|---------------|--------------------|
| 1024 | ~22 MB | ~19 GB | ~88 |
| 2048 | ~45 MB | ~19 GB | ~42 |
| 4096 | ~90 MB | ~19 GB | ~21 |

**Decision**: Use 2048 for sim testing (matches BUC's validated config). 42 parallel slots is sufficient for 100 agents with staggered cooldowns. For the solo game, 4096 context with ~21 slots gives richer proprioception and longer conversation history — more than enough for real-time pace.

### Prompt Adjustments (vLLM → llama-server)

| BUC/vLLM Hack | Why It Existed | llama-server Equivalent |
|----------------|---------------|------------------------|
| Nonce injection (random string in messages) | Prevented vLLM prefix cache KV bleeding between agents | **Not needed** — llama-server slot system isolates requests |
| Think token ban via logit_bias (248068/248069) | Qwen 3.5 generates `<think>` waste tokens | `--reasoning off` flag + logit_bias fallback in client |
| `chat_template_kwargs: {enable_thinking: false}` | Template-level think disable | `--reasoning off` replaces this |
| Response format: single digit (1-N) | BUC hybrid strategy picks action by number | **Model-agnostic** — works with any instruction-following model |

**Open question**: Does the response parser (`strategy/response-parser.ts`) work reliably with Gemma 4? It strips think blocks, extracts the first digit, and maps to an action. This should work with any model that follows "reply with ONLY the number of your choice" but Gemma 4 hasn't been tested with BUC's prompts yet.

### Concurrency Analysis

**BUC sim at max speed** (100 agents, no player):
- 6-17 LLM calls per tick (agents staggered by cooldowns)
- vLLM handled 93 concurrent with batch inference
- llama-server at 42 parallel (2048 ctx): sufficient — agents don't all decide simultaneously
- Estimated sim throughput: ~8 agents/sec → ~240 decisions per game-day → ~30 seconds per game-day → ~90 minutes for 180-day sim

**Solo game at 1:1 real-time** (30-50 agents on a ship):
- Each agent decides every 2-5 game-hours
- At 1:1 time: ~10-25 LLM calls per real hour — trivial load
- Burst events (storm, combat, port arrival): 20-30 simultaneous calls
- 42 slots easily covers this

**Recommended sim test config**:
```
Model:     Qwen 3.5-9B Q4_K_M (proven quality)
ctx_size:  2048 (matches BUC's prompt budget)
parallel:  42 (safe for 2048 ctx on RTX 3090)
flash-attn: on
KV cache:  q8_0
reasoning: off (+ logit_bias for Qwen)
```

---

## Project File Structure (current as of 2026-04-04)

```
E:\llama_game\
├── .gitignore
├── .gitmodules                  ← submodule config
├── llama_game_notes.md          ← this file
├── llama.cpp/                   ← git submodule (ggml-org/llama.cpp)
│   └── build/bin/Release/
│       └── llama-server.exe     ← built with CUDA (86/89), 343 MB
├── patches/                     ← for TurboQuant patches (empty, ready)
├── models/
│   ├── gemma4-e4b-uncensored/
│   │   └── Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf  (5.1 GB)
│   └── qwen35-9b/
│       └── Qwen_Qwen3.5-9B-Q4_K_M.gguf  (5.5 GB)
├── scripts/
│   ├── build-llama.sh           ← cmake build + patch application
│   └── update-llama.sh          ← pull upstream + rebuild
├── engine/
│   ├── package.json             ← deps: better-sqlite3, sql.js, mysql2, dotenv, uuid, zod
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             ← BUC entry point
│       │
│       │  === BUC ENGINE (ported from E:\BUC\src) ===
│       │
│       ├── agents/              ← [from BUC] 15 agent types, persona engine, name gen, historical figures
│       │   ├── base-agent.ts
│       │   ├── persona-engine.ts
│       │   ├── name-generator.ts
│       │   ├── registry.ts
│       │   ├── historical-figures.ts
│       │   ├── historical-spawner.ts
│       │   ├── human-spawner.ts
│       │   ├── overlays.ts
│       │   └── types/           ← 15 agent type definitions
│       │
│       ├── config/              ← [from BUC + new] world data + llama.cpp config
│       │   ├── agents.ts        ← 15 agent type configs (prompts, tools, spawn)
│       │   ├── cargo.ts         ← 50+ cargo types
│       │   ├── economy.ts       ← economic constants
│       │   ├── ports.ts         ← 14 Caribbean ports + European/African
│       │   ├── regions.ts       ← 25 sea zone definitions
│       │   ├── ships.ts         ← 17 ship classes
│       │   ├── places.ts, skills.ts, heritage.ts, navy.ts, etc.
│       │   ├── gpu-profiles.ts  ← [NEW] GPU VRAM → parallel slot mappings
│       │   └── models.ts        ← [NEW] per-model think token config
│       │
│       ├── db/                  ← [from BUC, migrated MySQL→SQLite]
│       │   ├── sqlite.ts        ← [NEW] SQLite wrapper (replaces mysql.ts)
│       │   ├── schema.sql       ← [CONVERTED] 452 lines, MySQL→SQLite syntax
│       │   ├── queries.ts       ← [UPDATED] 844 lines, removed RowDataPacket, fixed upserts
│       │   ├── models.ts        ← DB entity types (Agent, Ship, Crew, Cargo, etc.)
│       │   └── seed.ts          ← [UPDATED] world seeding for SQLite
│       │
│       ├── engine/              ← [from BUC] 47 files — game mechanics
│       │   ├── action-executor.ts  ← routes 65+ actions to handlers
│       │   ├── actions/            ← 17 action modules (combat, trade, naval, crew, etc.)
│       │   ├── combat.ts, combat-engagement.ts, combat-prompt.ts
│       │   ├── navigation.ts, navigation-skills.ts
│       │   ├── crew-loyalty.ts, economy.ts, encounters.ts
│       │   ├── fence-network.ts, intel.ts, trade.ts
│       │   ├── reputation.ts, territory.ts, daily-routine.ts
│       │   ├── prisoners.ts, interaction.ts, relationships.ts
│       │   ├── wound.ts, skills.ts, skill-transfer.ts
│       │   ├── ship-condition.ts, careening.ts, cargo-heat.ts
│       │   └── corruption.ts, pardon.ts, trial.ts, documents.ts, etc.
│       │
│       ├── handlers/            ← [from BUC] 17 tick handlers
│       │   ├── index.ts         ← handler registration (ordered by phase)
│       │   ├── weather-tick.ts, disease-tick.ts, travel-tick.ts
│       │   ├── decay-tick.ts, crew-tick.ts, skill-transfer-tick.ts
│       │   ├── economy-tick.ts, haven-tick.ts, reputation-tick.ts
│       │   ├── navy-tick.ts, intel-tick.ts, agent-tick.ts
│       │   ├── interaction-tick.ts, combat-tick.ts
│       │   ├── encounter-tick.ts, event-tick.ts
│       │   └── (17 handlers total, 5 tick phases)
│       │
│       ├── nudge/               ← [from BUC] zero-cost decision context injection
│       │   ├── self-nudge.ts    ← 8 strategy × 6 agent-group voice matrix
│       │   ├── crew-advisory.ts ← captain/QM: crew strength, loyalty, grievances
│       │   ├── planning-nudge.ts ← active plan or 2-3 branch suggestions
│       │   ├── branch-builder.ts
│       │   └── plan-manager.ts
│       │
│       ├── runtime/             ← [from BUC + new] core runtime
│       │   ├── types.ts         ← BUC types + ServerConfig/GpuProfile (appended)
│       │   ├── llm-client.ts    ← [from BUC] concurrency queue, Qwen hacks
│       │   ├── agent-runner.ts  ← [from BUC] batch agent execution
│       │   ├── tick-scheduler.ts ← [from BUC] phase-ordered game loop
│       │   ├── memory-store.ts  ← [from BUC] SQLite-backed agent memory
│       │   ├── embedding-client.ts ← [from BUC] (not currently used)
│       │   └── server-manager.ts ← [NEW] llama-server lifecycle manager
│       │
│       ├── sim/                 ← [from BUC] simulation harness
│       │   ├── harness.ts       ← main sim orchestrator (100 agents, fast-forward, checkpoints)
│       │   ├── index.ts, checkpoint.ts, metrics.ts
│       │   ├── reporter.ts, sim-clock.ts, sim-logger.ts
│       │   └── player-ai.ts    ← AI-controlled player for testing
│       │
│       ├── strategy/            ← [from BUC] LLM decision pipeline
│       │   ├── hybrid.ts        ← core: filter → build prompt → LLM call → parse → execute
│       │   ├── action-filter.ts ← rule engine: status/location/type → valid actions
│       │   ├── narrative-prompt.ts ← proprioception builder (1400-token budget)
│       │   ├── proprioception.ts
│       │   ├── response-parser.ts ← extract digit → map to action
│       │   ├── cognitive-prompt.ts, narrative-compute.ts, narrative-data.ts
│       │   ├── narrative-sections.ts, consequence-preview.ts
│       │   ├── future-planner.ts, auto-fill-params.ts
│       │   └── agent-memory.ts
│       │
│       ├── utils/               ← [from BUC] formatting
│       │   └── format.ts
│       │
│       ├── world/               ← [from BUC] physical world simulation
│       │   ├── weather.ts, weather-ambient.ts, storm-tracker.ts
│       │   ├── sea-state.ts, navigation.ts, temperature.ts
│       │   ├── disease.ts, ports.ts, places.ts, regions.ts
│       │   ├── vessel-spawner.ts, time.ts, place-ambient.ts
│       │   ├── crop-production.ts, mineral-production.ts
│       │   ├── port-inventory.ts, port-consumption.ts
│       │   ├── processing-engine.ts, isthmus-transport.ts
│       │   └── (15 world simulation modules)
│       │
│       └── _llama_infra/        ← stashed llama-specific files (poc, stress, play, prototype game)
│           ├── poc.ts, stress.ts, play.ts, index.ts
│           └── (these reference old placeholder types, need updating)
│
└── server/                      ← multiplayer game server (future, empty)
    └── src/
```

---

## Next Steps

### Immediate (run the sim on llama-server)
1. **Update LLM provider config** to point at llama-server (port 8080, `/v1/chat/completions`)
2. **Update GPU profiles** to use 2048 context (matching BUC's prompt budget)
3. **Run the SQLite seed** to create the game database
4. **Run the BUC sim** against llama-server with Qwen 3.5-9B — validate that the full engine works
5. **Run with Gemma 4 E4B** — compare action quality

---

## Sim Testing Log (2026-04-04)

### Session: SQLite + llama-server validation

**Server config**: Qwen 3.5-9B Q4_K_M on llama-server (TheTom/llama-cpp-turboquant fork)
- 20 parallel slots, 2048 ctx/slot, turbo3 KV cache
- `--flash-attn on --cache-type-k turbo3 --cache-type-v turbo3 --reasoning off`
- Think token ban: logit_bias tokens [248068, 248069] = -100

**TurboQuant comparison** (10 agents, 7 days):
| Config | Slots | Time | Avg tick |
|---|---|---|---|
| q8_0 (mainline) | 10 | 79s | 464ms |
| turbo3 (TQ fork) | 10 | 71s | 417ms |
| turbo3 (TQ fork) | 20 | 126s | 735ms |

TurboQuant doubles available KV cache → 2x agent capacity from same GPU.

### Fixes applied during sim testing

**MySQL→SQLite residuals (batch 1)**:
- `UUID()` → `hex(randomblob(...))` in harness.ts fence seeding
- 25 double-quoted SQL string literals → single-quoted (5 files)
- `LEAST()`/`GREATEST()` → `MIN()`/`MAX()` (8 files)
- `RAND()` → `RANDOM()` in fence-actions.ts
- `query()` → `execute()` for UPDATE in decay-tick.ts (`.all()` on non-SELECT)

**Action quality fixes (batch 2)**:
- Consequence preview returns `null` for impossible actions (broke, no cargo, no prizes, etc.)
- Cognitive prompt builder filters out null-preview actions from the numbered choice list
- Returns `shownActions` alongside prompt text so parser uses the same filtered list
- Response parser simplified — no longer does its own reordering, trusts prompt builder
- `getPreview()` default case changed from `return ''` to `return null` — hides 22 unrecognized actions that had no preview case

**Force-sail fix (batch 3)**:
- Old trigger: 2 consecutive passive actions (from a small set: do_nothing, lay_low, gather_intel, visit_tavern, negotiate, eavesdrop)
- New trigger: 3 consecutive non-sail actions (any action that isn't sail_to)
- Result: force_sail went from 4/259 to 15/337 decisions — agents actually leave port now

**Navigation fix (batch 4)**:
- `redirectVoyage()` now falls back to zone-path BFS when pre-computed SEA_ROUTES table has no route
- SEA_ROUTES only covers 36/91 port pairs (39%). BFS covers all zone adjacencies.
- "Cannot plot course" failures should drop from 26% to near 0

**Memory leak prevention (batch 5)**:
- LLM client `latencies[]` array reset every game day
- Dead SimAgent objects pruned from simAgents array every game day
- `getPreview()` default→null reduces prompt token waste from bare-label actions

**Missing preview cases (batch 6)**:
- `default: return null` in getPreview was too aggressive — hid 22 actions, left agents with 1-2 choices
- Added proper preview cases for all 22 missing actions (treat_wound, assess_damage, track_target, etc.)
- Reverted default to `return ''` (show with no description)
- Result: parse failures dropped from 4 to 0, OOB still ~6% (model behavior not code bug)

### Metrics across runs (20 agents)

| Metric | Baseline (7d) | After fixes (14d) |
|---|---|---|
| Wasted calls | 12.7% | **1.1%** |
| Parse failures | 0.1% | **0.0%** |
| Sail failures | 19% (3/16) | **0%** (0/67) |
| Combat events | 0 | **14** |
| Sail success | 13 | **67** (26 forced) |
| Errors | 0 | **0** |
| Decisions/day | ~28 | **50** |

### Memory investigation
- No major leaks found. Largest contributors: V8 GC pressure, better-sqlite3 statement cache, episodic MemoryStore.
- Added day-boundary cleanup: LLM stats reset, dead SimAgent pruning.
- KV cache VRAM (turbo3 × 20 slots) is the biggest allocation — by design, not a leak.

### 90-Day Run Results (20 agents, 2160 ticks)

**Runtime**: 28 minutes (1678s), avg 775ms/tick, 53.4 decisions/day, 2.67 decisions/agent/day

| Metric | Value |
|---|---|
| Total decisions | 4,804 (85.6% LLM, 8.9% short-circuit, 5.4% force-sail) |
| Parse failures | 1 / 4,113 LLM calls (99.98% success) |
| Wasted calls | 83 (1.7%) |
| Deaths | **0** |
| Combat events | 50 (sustained — no collapse) |
| Cargo trades | 114 (growing over time: 6→18 per 10-day period) |
| Fence transactions | 6 (low — needs investigation) |
| Wounds/disease | 25 events, all survived |
| Errors | 0 |

**vs BUC Run 40** (vLLM, 100 agents, 180 days):
- BUC: 6.5 hours, 40,287 decisions, 56 dead (41%), 858 combat, 80 fences
- llama_game: 28 min, 4,804 decisions, 0 dead, 50 combat, 6 fences
- Per-agent throughput: BUC 2.24 dec/agent/day vs llama_game **2.67** (+19%)
- Parse quality: BUC 22 failures vs llama_game **1** failure

**Systems not logging to JSONL** (may be working in DB):
- Bounties: 0 logged (likely DB-only, no JSONL writer)
- Law/navy cases: 0 logged
- Intel: 0 logged

### 100-Agent × 90-Day Run (Batch 6 fixes)

**Fixes applied**: OOB mismatch (extract actions from prompt text), cross-role leakage (removed set_prices from surgeon/shipwright), survival urgency (hide combat/passive when hull<20 or food<1 day)

**Runtime**: 124 min | 24,841 decisions | 2.8 dec/agent/day

| Metric | This run | BUC Run 40 (vLLM) |
|---|---|---|
| Deaths | 5 (5%) | 56 (41%) |
| Combat | 145 | 858 |
| Trades | 406 | not tracked |
| Fences | 7 | 80 |
| Wasted | 1.4% | not tracked |
| Parse fail | 2 | 22 |

All 5 deaths from disease (sev 25-26), no combat deaths, no death spiral. Combat sustained over 90 days. 406 trades = active economy. OOB picks now correctly rejected (12.7%) instead of silently executing wrong actions.

### Critical Fixes — Deep Dive Findings (Batch 7)

Forensic analysis of 100-agent 90-day run revealed 6 game-breaking false positives.

**Fix: Market supply restocking** (economy-tick.ts, harness.ts)
- Root cause: harness cleared market_prices table but never re-seeded it. Economy-tick loaded empty supply.
- Fix: harness re-seeds market_prices after clear. Added baseline supply regeneration in economy-tick (1%/tick for goods below 50).
- Result: market supply zeros went from 91.9% → 0%

**Fix: Combat cargo seizure** (combat.ts)
- Root cause: pre-broadside and mid-broadside surrender paths returned `cargoSeized: true` without actually calling `CargoQueries.transferSeized`. Only post-boarding path did the transfer. Pre-broadside surrender was ~90% of pirate-merchant encounters.
- Fix: extracted cargo transfer into `transferSeizedCargo()` helper, called from all 3 surrender/capture paths.
- Result: seized cargo went from 0 → 3 records in 14-day test. Pirates went from -2,077g avg → +6,464g avg.

**Fix: last_decision_tick DB sync** (harness.ts)
- Root cause: `applyDecision()` updated in-memory `sa.nextActionTick` but never called `AgentQueries.updateDecisionTick()`.
- Fix: added DB sync call after setting nextActionTick.

**Fix: Port state frozen** (governor-actions.ts)
- Root cause: governor actions modified port stats but logged nothing to world_events.
- Fix: added `logGovernorEvent()` helper with world_events INSERT for raise_tariffs, lower_tariffs, increase_patrols, fortify_port.

**Fix: Cross-role action leakage** (agents.ts)
- Removed `set_prices` from surgeon and shipwright tool lists — they aren't fences.

**Fix: Survival urgency** (consequence-preview.ts)
- Combat actions (attack_ship, board_ship, engage_ship, pursue_target, patrol_region) return null when hull < 20 or food < 1 day.
- `lay_low` also hidden during survival crisis — agents forced toward sail_to/flee.

**Fix: OOB action mismatch** (harness.ts)
- Root cause: shownActions array could diverge from prompt text ordering.
- Fix: `extractActionsFromPrompt()` parses action names directly from the prompt text. Parser now uses what the LLM actually saw.

**Fix: Checkpoint resume** (harness.ts, index.ts, checkpoint.ts)
- BUC known issue: "Checkpoint resume not implemented (can save but not load)"
- Added `--resume` CLI flag. Loads latest checkpoint, skips table clear/reseed, rebuilds SimAgent array, continues tick loop from saved position. Logger opens in append mode.
- Usage: `npx tsx src/sim/index.ts --days=90 --resume --log=events`

### Post-fix 14-day validation (20 agents)

| Metric | Before fixes | After fixes |
|---|---|---|
| Market supply zeros | 91.9% | **0%** |
| Seized cargo (qty>0) | 0 | **3** |
| Fence transactions (14d) | ~1 | **17** |
| Pirate avg cash | -2,077g | **+6,464g** |
| Merchant avg cash | -113g | **+180g** |

### Balance Tuning (Batch 8) — Coupled triangle: pirate income ↔ combat rate ↔ merchant survival

**Fix order matters**: inflation first → combat rate second → merchant income last.

**Fix 1: Pirate inflation** (fence-network.ts)
- `plunderMultiplier` 2.0 → 0.8
- Old: stolen goods sold at 2x market (fences "resell at premium") = ~1,650g per seizure
- New: stolen goods sold at 0.8x market (historical: fences paid below market, seller has no leverage)
- Expected: pirate income drops ~60%, from ~99k to ~40k over 90 days
- Cascading: less fence income may push pirates toward legitimate trade

**Fix 2: Combat rate** (consequence-preview.ts, harness.ts)
- Survival hull threshold: `hull < 20` → `hull < 10` — damaged ships can still fight, only truly crippled ones retreat
- Recycler LIMIT: 20 → 50 — captured NPC ships return to sailing pool faster, maintaining encounter density
- Root cause of combat drop: each capture removed a ship from the encounter pool. With n ships, encounters scale as n*(n-1)/2 — going from 20 to 10 sailing ships drops encounters 76%
- Expected: combat should rise from 23 back toward 80-150

**Fix 3: Merchant income** (economy-tick.ts)
- Added docked commission: 3g/tick while in_port, capped at 1000g
- Represents warehouse commissions, port-agent fees, local trade
- Historical: Caribbean merchants maintained port warehouses
- Expected: merchants earn ~72g/day docked, enough to offset crew wages and recover from pirate raids

### Mechanical chain analysis

The three issues form a coupled triangle traced through exact code paths:

**Pirate → Combat → Merchant chain:**
- Pirate raids merchant → cargo seized (combat.ts transferSeizedCargo) → merchant loses everything + imprisoned 72 ticks
- Seized cargo fenced (force-fence in harness.ts) → pirate gets plunderMultiplier × baseValue − fenceCut
- Captured NPC ship removed from encounter pool (encounters.ts line 78: status='sailing' filter)
- Fewer NPC ships → fewer encounters → less combat → pirates sit idle
- Recycler (LIMIT 20) too slow to replenish → pool shrinks faster than replacement

**Key values changed:**
| Parameter | Old | New | File:Line |
|---|---|---|---|
| plunderMultiplier | 2.0 | 0.8 | fence-network.ts:64 |
| survivalCrisis hull | < 20 | < 10 | consequence-preview.ts:45 |
| recycler LIMIT | 20 | 50 | harness.ts:592 |
| merchant docked income | 0 | 3g/tick | economy-tick.ts:131 |

**Outstanding items for next session**:
- Validate balance with 100-agent 90-day run
- Wire bounty/law/intel JSONL event logging
- Try Gemma 4 E4B model for comparison
- Human player hook design

### Key findings

1. **Think token prevention works**: 0 think token leaks across all runs. Three-layer approach (--reasoning off, logit_bias, regex) is airtight.
2. **Number-only parser works**: 99.9%+ parse success rate. Model reliably outputs a single digit.
3. **9B model plays it safe**: ~60% of LLM decisions are generic/passive (negotiate, gather_intel, eavesdrop). Deterministic overrides (force-sail, force-fence) are essential.
4. **Short-circuit do_nothing is correct**: 16% do_nothing is mostly at-sea agents being handled by travel-tick — not wasted.
5. **TurboQuant is production-ready**: Zero errors across multiple runs with turbo3 cache. 2x slot capacity.

### Then (human player hook)
6. **Design player agent type** — a special agent whose decisions come from keyboard input instead of LLM
7. **Build presenter/UI layer** — what the player sees, filtered by rank
8. **Conversation system** — player ↔ AI agent dialogue (free-form text, not action numbers)
9. **Rank progression triggers** — events that advance the player based on actions/reputation

### Later (Steam release path)
10. **Tauri wrapper** — package TypeScript game + llama-server + GGUF model as a native app
11. **Captain's Desk UI** — progressive web UI reflecting player rank
12. **Multiplayer investigation** — session-based or invasion-style encounters

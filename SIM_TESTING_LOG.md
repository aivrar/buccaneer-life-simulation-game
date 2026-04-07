# Simulation Testing Log

## Session: 2026-03-24

### Run 1 — Baseline (pre-fixes)
- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: ~89 game days before stopped for investigation
- **Result**: BROKEN — multiple critical issues

#### Findings at Day 89

| Metric | Value | Assessment |
|--------|-------|------------|
| Deaths | 126/454 (28%) | CRITICAL — mass death |
| Governors dead | 25/34 (73%) | CRITICAL |
| Surgeons deserted | 413/458 (90%) | CRITICAL |
| Combat events | 1,390 (100% sea_battle) | All duplicate loops |
| Unique event types | 1 (sea_battle only) | No trade/law/social events |
| Reputation records | 0 | System not wired |
| Imprisoned | 44 | Excessive |
| Cargo in world | 2,810 (cotton + sugar only) | Economy frozen |

#### Root Causes Identified

1. **Combat infinite loop**: `resolveEngagement` called twice (from `resolveRound` AND `combat-tick`), duplicating every event. `syncCombatEngagements` used fire-and-forget `.then()` so dead/imprisoned status wasn't synced before next action. `updateStatusFull` didn't clear `sea_zone_id` so sunk ships stayed in zone queries.

2. **Economy appeared dead**: Initial investigation showed 0 supply, but this was because the query hit the wrong port (Amsterdam, a European city). Caribbean ports had healthy supply (Bridgetown 1,043 cotton, 182 sugar). The real bottleneck was 47% of merchants imprisoned from combat loop.

3. **Port agent mass death**: Disease severity stacking bug — `alreadyHas` check compared raw disease name (`'malaria'`) against wound type (`'fever'`), so agents could accumulate 3-4 fever wounds simultaneously. Combined with aggressive worsening rate (0.1/tick) and low death threshold (20), port agents died in ~4-12 days.

4. **Surgeon crew mass desertion**: Loyalty decayed at 0.2/tick (0.8/day), desertion threshold at 30 with 10% check per tick when docked. Starting loyalty 60, dropped below 30 in ~37 days if paid, much faster if not. Captains ran out of money to pay wages (crew cost 1/tick/crew).

5. **Reputation system inactive**: `recordReputationEvent` existed but was never called from any combat resolution path.

---

### Fixes Applied (Batch 1 — Pre-Run 2)

#### Fix 1: Combat Infinite Loop (3 sub-fixes)
- **combat-tick.ts**: Removed duplicate `resolveEngagement` call — was being called from both `resolveRound` internally AND from `combat-tick` after resolution
- **queries.ts `updateStatusFull`**: Now clears `sea_zone_id` and `current_zone_id` when status is `sunk` or `captured`
- **queries.ts `ShipQueries.getByZone`**: Added `status NOT IN ("sunk", "captured")` filter
- **harness.ts `syncCombatEngagements`**: Changed from fire-and-forget `.then()` to `await`

#### Fix 2: Disease Double-Counting
- **disease-tick.ts**: Changed `alreadyHas` check to compare mapped wound type instead of raw disease name
- Added `healing_progress < 100` filter so healed wounds don't block new infections

#### Fix 3: Port Agent Disease Survival
- **disease-tick.ts**: Port agents' untreated wounds worsen 4x slower (0.025/tick vs 0.1)
- Added natural recovery for port agents with mild ailments (severity <= 4, +0.5 progress/tick)
- Death threshold raised to 30 for port agents (vs 20 at sea)

#### Fix 4: Crew Retention
- **economy.ts**: Halved base wage (1 -> 0.5), reduced loyalty decay 4x (0.2 -> 0.05), lowered hunger penalty (5 -> 3), lowered mutiny threshold (20 -> 15), lowered desertion threshold (30 -> 20)
- **crew-tick.ts**: Reduced desertion probability (10% -> 3%), added 72-tick minimum service period

#### Fix 5: Reputation System
- **combat-engagement.ts**: Wired `recordReputationEvent` into `resolveEngagement` — navy victories, merchant attacks, pirate-vs-navy outcomes now generate reputation/infamy/honor

#### Fix 6: Pre-existing Type Error
- **trade.ts**: Added `data?: Record<string, unknown>` to `TradeResult` interface (fixed compile errors in trade-actions.ts)

---

### Run 2 — Post Batch 1 Fixes
- **Config**: 100 agents, 180 days
- **Duration**: ~47 game days before stopped for investigation
- **Result**: Major improvement, but new concerns found

#### Findings at Day 47

| Metric | Run 1 (Day 89) | Run 2 (Day 47) | Change |
|--------|----------------|----------------|--------|
| Deaths | 126 (28%) | 15 (15%) | Better, all combat |
| Disease deaths | ~100+ | 0 | Fixed (but over-corrected) |
| Governors dead | 25/34 (73%) | 3/7 (43%) | Better but still high |
| Crew deserted | 434 | 7 | Fixed |
| Reputation records | 0 | 135 (5 agents) | Fixed |
| Event diversity | 1 type | 2 types (combat + sea_battle) | Better |
| Naval officer avg cash | 150 | 22 | Worse — no income |

#### Concerns Found at Day 47

1. **Governor mortality still 43%** — disease duplicate check had a SECOND bug: the `alreadyHas` comparison used wound type but malaria/yellow_fever/fever all map to same type `'fever'`, meaning an agent could still only get one fever. However, they were accumulating fever + disease + cut = 3 wounds, and untreated wounds slowly reached death threshold. Root cause: natural healing only covered severity <= 4, but fever starts at severity 6.

2. **Military agents broke** — Naval officers avg 22 cash, pirate hunters avg 2, privateers avg 11. Crew wages at 0.5/tick × crew_count × 4 ticks/day drained all funds. No income-generating actions in their toolset.

3. **Empty game systems** — Navy cases, bounties, haven investments all at zero. Investigation found all actions are properly wired (tools, filter, auto-fill, executor). The issue is preconditions: bounties require infamy > 20 (nobody has it), navy cases require existing cases (circular), haven investments require cash > 500 (pirates broke).

4. **Skills nearly empty** — Only 5 records (all seamanship level 1). Skill transfer requires teacher level >= 30 (nobody has it). Skills only gain +1 from specific actions. Chicken-and-egg problem — too early in sim for skills to matter.

5. **NPC ship attrition** — 556 ships sunk in 39 days. Escape chance was low (base 20%), encounter rate high. Combat too lethal — ships sink instead of being captured.

6. **Duplicate sea_battle events persisting** — resolveEngagement still writing events twice for some engagements despite the combat-tick fix.

---

### Fixes Applied (Batch 2 — Pre-Run 3)

#### Fix 7: NPC Escape Chance
- **combat.ts `calculateEscapeChance`**: Base escape raised from 20% to 40%, speed factor from 0.05 to 0.08 per point, cap raised from 70% to 85%, floor raised from 0% to 10%

#### Fix 8: Natural Healing Extended
- **disease-tick.ts**: Extended natural healing threshold from severity <= 4 to severity <= 6 (covers standard fever at sev 6)

#### Fix 9: Port Disease Rate Reduction
- **disease-tick.ts**: Added 50% reduction to port disease infection rolls (represents better sanitation/shelter)

#### Fix 10: Military Income — Patrol Stipend
- **naval-actions.ts `executePatrolRegion`**: Added 50 gold Crown stipend per patrol action
- **naval-actions.ts `executeReportToAdmiralty`**: Added 30 gold operational funds per report

#### Fix 11: Event Dedup Guard
- **combat-engagement.ts**: Added `resolvedEngagementIds` Set to prevent `resolveEngagement` from writing duplicate events for the same engagement

---

### Run 3 — Post Batch 2 Fixes
- **Config**: 100 agents, 180 days
- **Duration**: Day 41+ (still running)
- **Result**: Significant improvement across all metrics

#### Findings at Day 41

| Metric | Run 1 (Day 89) | Run 2 (Day 47) | Run 3 (Day 41) | Trend |
|--------|----------------|----------------|----------------|-------|
| Deaths | 126 (28%) | 15 (15%) | 6 (6%) | Improving |
| Disease deaths | ~100+ | 0 | 0 | Over-corrected |
| Governors dead | 25/34 (73%) | 3/7 (43%) | 0/7 (0%) | Fixed |
| Crew deserted | 434 | 7 | 7 | Stable |
| Reputation records | 0 | 135 | 135 | Active |
| Naval officer avg cash | 150 | 22 | 282 | Stipend working |
| Pirate hunter avg cash | 169 | 2 | 23 | Still low |
| NPC ships sunk | ~200+ (Day 6) | ~100 (Day 6) | 50 (Day 6) | Halved by escape fix |
| Sunk:Captured ratio | — | — | 1758:12 (99.3% sunk) | Still too lethal |

#### vLLM Outage (Day 6-7)
- vLLM server was restarted by another Claude Code session working on RAVE LIFE
- BUC sim gracefully degraded to rule-based fallbacks (~200 "fetch failed" errors)
- Auto-recovered when vLLM came back — zero errors from Day 7 onward
- vLLM was updated: batch error isolation (one bad prompt no longer kills whole batch), better error messages

---

### Historical Accuracy Assessment (Day 41)

| System | Score | Issue |
|--------|:-----:|-------|
| Combat deaths | 7/10 | Rate right, but 99.3% sunk vs captured is ahistorical |
| Disease | 4/10 | Over-corrected — zero deaths unrealistic for Caribbean |
| Economy structure | 7/10 | Trade goods and prices feel right |
| Merchant activity | 4/10 | Too passive — all in port, many with destroyed ships |
| Naval funding | 8/10 | Chronic underfunding is historically accurate |
| Crew dynamics | 6/10 | Desertion rate accurate, but too stable after initial period |
| NPC combat | 3/10 | Should be capture-dominant, not sink-dominant |
| Port dynamics | 8/10 | Nassau as hub, geographic distribution correct |
| Legal system | 7/10 | Pardons and letters of marque reflect the era |
| Intel/social | 8/10 | Gossip network feels authentic |
| Harbor master wealth | 3/10 | Earning 1,400 gold/day — ahistorically rich |
| Overall | 6/10 | — |

---

### Identified Imbalances for Batch 3

#### Imbalance 1: NPC Combat Sunk:Captured Ratio (99.3% sunk)

**Root cause**: In `resolveCombat` (combat.ts), surrender only triggers when `defender.hull - totalDmg <= 20` during broadside. But damage often jumps from hull ~30 straight to hull <= 0, bypassing the surrender check entirely. The captured path only fires from the boarding phase, which requires surviving broadside. Additionally, NPC ships accumulate damage across multiple encounters without ever repairing, plus rot decay constantly lowers hull.

**Historical reality**: Most engagements ended in capture (60-70%), escape (20-25%), or disengagement. Actual sinkings were rare (~5-10%) — ships were valuable prizes.

**Proposed fix**: Raise surrender threshold from hull <= 20 to hull <= 40. Add pre-broadside surrender for outgunned defenders (2:1 gun ratio). This makes capture the primary outcome, feeding prize cargo into the pirate economy.

**Cascade effects (positive)**: More prizes → more pirate income → haven investments activate → fewer ship losses → merchants survive longer → more trade activity.

#### Imbalance 2: Disease Too Mild (Zero Deaths)

**Root cause**: Multiple overlapping protections stack:
- 50% port infection rate reduction
- Natural healing for severity <= 6 (+0.5 progress/tick = +2/day)
- Worsening rate only 0.025/tick (+0.1/day)
- Net healing: +1.9/day, wounds resolve in ~50 days
- Death threshold 30 for port agents
- Can only have one wound per type (fever, disease, etc.)

With net positive healing and max ~2-3 wounds possible, agents never reach severity 30.

**Historical reality**: Yellow fever killed 30-50% of European newcomers in first year ("seasoning period"). Malaria was chronic and debilitating. ~5-10% port mortality per 6 months would be realistic.

**Proposed fix**: Remove blanket 50% port reduction. Instead, implement "seasoning" — agents present < 60 days get full disease rates, agents present > 60 days get 50% reduction (survivors have partial immunity). Reduce natural healing threshold back to severity <= 4 (fever at sev 6 and yellow fever at sev 8 should NOT naturally heal — they need a surgeon). Keep the slow worsening rate (0.025) and high death threshold (30) as safety nets.

**Cascade effects (positive)**: Some port agent deaths → surgeon "treat" actions become valuable → replenishment system activates (new agents every 7 days) → population turnover feels realistic.

#### Imbalance 3: Merchant Passivity

**Root cause**: Not an LLM choice issue — merchants' ships are destroyed or captured. Of 7 merchants, 4 have captured ships (can't sail), 2 have hull 1-9 (too damaged), 1 has -260 cash (can't repair or provision). This is a cascade from Imbalance 1 (combat too lethal). No mechanism exists to acquire a replacement ship.

**Historical reality**: Merchants were constantly sailing triangular trade routes. When ships were lost, merchants bought or chartered new ones — maritime insurance existed since the 1600s.

**Proposed fix**: Add `buy_vessel` to merchant_captain tools. Cost scales by ship class (200 for sloop, 500 for merchantman). Only available in port with sufficient cash. Auto-fill picks appropriate class. Also: fixing Imbalance 1 (more captures, fewer sinkings) reduces ship losses, meaning fewer merchants need replacements.

**Cascade effects (neutral)**: Merchants spend cash to buy ships (reduces their wealth), then earn it back through trade (increases trade volume). Net positive for economy circulation.

#### Imbalance 4: Harbor Master Wealth (avg 5,525 at Day 41)

**Root cause**: `executeCollectFees` gives 3 gold per docked ship. Ports have 76-124 docked ships (from vessel spawner). That's 228-372 gold per action, ~4 actions/day = 912-1,488 gold/day. Over 41 days = 37,000-61,000 potential income (capped by other action choices).

**Historical reality**: Port officials earned fixed Crown salaries of ~£100-300/year. They supplemented with bribes and kickbacks, not linear per-ship fees.

**Proposed fix**: Cap `collect_fees` at 50 gold per action regardless of ship count. This represents a fixed administrative salary. Alternatively, reduce per-ship fee from 3 to 0.5 gold (max ~60 gold at busiest port).

**Cascade effects (minimal)**: Harbor masters earn less but are still above-average wealth. No impact on other systems — they don't spend much.

#### Imbalance 5: Crew Too Stable (QM loyalty 100, no mutinies)

**Root cause**: Loyalty decay 0.05/tick, wage boost 0.5/tick when paid. Net +0.45/tick × 164 ticks (41 days) = +73 loyalty. Starting at 60, capped at 100. Crew reaches max loyalty in ~3 weeks and stays there.

**Historical reality**: Crews were volatile even when paid. Personality conflicts, gambling debts, disease resentment, boredom, and political factions created constant tension. Mutinies happened on well-provisioned ships.

**Assessment**: At 41 days this may be acceptable — most historical mutinies occurred after months at sea, not weeks. This becomes unrealistic at Day 90+ when the permanent max-loyalty state prevents any crew drama.

**Proposed fix (for future session, not now)**: Add random crew events every ~7 days that inject -5 to -15 loyalty spikes (fights, gambling, disease blame, shore leave incidents). This creates periodic instability without changing the base mechanics.

---

### Dependency Map for Batch 3 Fixes

```
Fix combat lethality ──→ More captures ──→ Pirate income rises ──→ Haven investments activate
    (Imbalance 1)    ──→ Fewer sunk ships ──→ Merchants survive ──→ More sailing/trade
                     ──→ Less spawner load ──→ Fewer harbor ships ──→ Harbor fees naturally decrease

Fix disease calibration ──→ Some port deaths ──→ Replenishment activates
    (Imbalance 2)       ──→ Surgeon actions valuable ──→ Surgeon agents have purpose
                        ──→ Population turnover ──→ Fresh agents with full cash

Add ship replacement ──→ Stranded captains re-enter ──→ More sailing ──→ More encounters
    (Imbalance 3)    ──→ Cash drain ──→ Balances merchant wealth accumulation

Cap harbor fees ──→ Standalone, no cascades
    (Imbalance 4)

Crew events ──→ DEFERRED to future session (not needed until Day 90+)
    (Imbalance 5)
```

**Recommended implementation order**: 1 → 2 → 4 → 3 (combat fix has most positive cascades, disease next, harbor cap is quick, ship replacement is new feature)

---

### Files Modified Across All Batches

| File | Batch | Changes |
|------|-------|---------|
| src/handlers/combat-tick.ts | 1 | Removed duplicate resolveEngagement call |
| src/db/queries.ts | 1 | updateStatusFull clears zone on sunk/captured; getByZone excludes sunk/captured |
| src/sim/harness.ts | 1 | syncCombatEngagements changed to async/await |
| src/handlers/disease-tick.ts | 1, 2 | Disease duplicate check fix, port worsening rate, natural healing, port infection reduction |
| src/config/economy.ts | 1 | Crew wage/loyalty/desertion rebalance |
| src/handlers/crew-tick.ts | 1 | Desertion probability and min service period |
| src/engine/combat-engagement.ts | 1, 2 | Reputation wiring, event dedup guard |
| src/engine/trade.ts | 1 | TradeResult type fix |
| src/engine/combat.ts | 2, 3 | Escape chance rebalance; pre-broadside surrender; surrender threshold 20→40; attacker break-off; sink threshold requires -20 overshoot (hull 0 = captured not sunk) |
| src/engine/actions/naval-actions.ts | 2 | Patrol stipend and admiralty report pay |
| src/engine/actions/harbor-actions.ts | 3 | collect_fees capped at 50 gold, per-ship fee 3→0.5 |
| src/engine/actions/shipwright-actions.ts | 3 | New executeBuyVessel action — captains buy replacement ships at port |
| src/config/agents.ts | 3 | Added buy_vessel to merchant_captain, pirate_captain, privateer_captain tools |
| src/strategy/action-filter.ts | 3 | buy_vessel filter — only when in port without usable ship |
| src/strategy/auto-fill-params.ts | 3 | buy_vessel auto-fill |
| src/engine/action-executor.ts | 3 | buy_vessel routing |
| src/sim/harness.ts | 1, 3 | syncCombatEngagements async; buy_vessel cooldown [24,48] |
| src/handlers/disease-tick.ts | 1, 2, 3 | All disease fixes + seasoning system (full rates first 60 days, 50% after) + natural healing back to severity<=4 |

---

### Fixes Applied (Batch 3 — Historical Balance)

#### Fix 12: NPC Combat — Capture-Dominant
- **combat.ts**: Added pre-broadside surrender for outgunned defenders (2:1 gun ratio or 1.5:1 both guns+crew)
- **combat.ts**: Raised broadside surrender threshold from hull <= 20 to hull <= 40
- **combat.ts**: Added attacker break-off when hull <= 40 (returns 'escape' instead of fighting to death)
- **combat.ts `applyResults`**: Ships at hull 0 but above -20 are now marked 'captured' not 'sunk'. Only extreme hull destruction (-20 overshoot) causes actual sinking. Historical: sinking wooden ships with cannons was very difficult — most were taken as prizes.
- **Expected outcome**: Sunk:captured ratio should shift from 99:1 to roughly 30:70. More prize cargo flows into pirate economy.

#### Fix 13: Disease — Seasoning System
- **disease-tick.ts**: Removed blanket 50% port reduction. Replaced with "seasoning" — agents in first 60 days get full disease rates (newcomers vulnerable), agents past 60 days get 50% reduction (partial immunity from survival).
- **disease-tick.ts**: Natural healing threshold reduced from severity <= 6 back to severity <= 4. Fever (sev 6) and yellow fever (sev 8) no longer naturally heal — they require a surgeon's treatment. Only mild dysentery (sev 4) and minor ailments self-resolve.
- **Expected outcome**: ~5-10% port agent mortality over 6 months. Surgeon agents become valuable. Newcomers from replenishment are more vulnerable than veterans.

#### Fix 14: Harbor Master Fee Cap
- **harbor-actions.ts**: Per-ship fee reduced from 3 to 0.5 gold. Total capped at 50 gold per action.
- **Expected outcome**: Harbor masters earn ~200/day max instead of ~1,400/day. Still comfortable but not absurdly wealthy. Historical: port officials earned fixed Crown salaries.

#### Fix 15: Ship Replacement (buy_vessel)
- **shipwright-actions.ts**: New `executeBuyVessel` function. Captains without a ship can purchase one at port. Price scales by class: periagua 50, shallop 80, sloop 200, schooner 300, merchantman 400, brigantine 500. Merchants prefer merchantman/schooner, pirates prefer sloop/brigantine. Ship comes with skeleton crew (5), basic stores, and the captain is assigned immediately.
- **agents.ts**: Added buy_vessel to merchant_captain, pirate_captain, privateer_captain tool lists.
- **action-filter.ts**: buy_vessel only available when in port AND agent has no ship.
- **Expected outcome**: Stranded captains (lost ship to combat) can buy a replacement and get back to sea. Merchants with 400+ gold buy merchantmen, broke pirates can only afford periaguas.

---

### Run 4 (Run 3 continued to Day 116) — Post Batch 3 Assessment

- **Config**: 100 agents, 180 days
- **Duration**: 116 game days (April 26, 1715) — sim process hung overnight (CPU spike from DB heavy work killed Claude Code sessions; vLLM was fine)
- **Result**: Batch 3 combat fixes validated; THREE critical systemic failures identified

#### Findings at Day 116

| Metric | Run 2 (Day 47) | Run 3 (Day 41) | Run 4 (Day 116) | Trend |
|--------|----------------|----------------|-----------------|-------|
| Deaths | 15 (15%) | 6 (6%) | 4 (4%) | Stable |
| Disease deaths | 0 | 0 | 0 | Still zero |
| Governors dead | 3/7 (43%) | 0/7 (0%) | 0/7 (0%) | Fixed |
| Crew deserted | 7 | 7 | 7 | Stable |
| Reputation records | 135 | 135 | 135 | No growth |
| Naval officer avg cash | 22 | 282 | 176 | Declining (wages drain) |
| Pirate hunter avg cash | 2 | 23 | 95 | Better |
| Harbor master avg cash | 5,525 | — | 527 | Fixed (fee cap works) |
| Pirate captain avg cash | — | — | 17 | Broke despite captures |
| Navy cases | 0 | 0 | 0 | Still dormant |
| Bounties | 0 | 0 | 0 | Still dormant |
| Haven investments | 0 | 0 | 0 | Still dormant |
| Combat outcomes | 99% sunk | — | 39% capture, 4% sunk | **Fixed** |
| Trade value (recent ticks) | 0 | 0 | 0 | Zero circulation |

#### Batch 3 Validations

**Combat lethality (Fix 12) — CONFIRMED WORKING**: 192 captures, 82 cargo seizures, 196 repelled, 18 sunk. Ratio shifted from 99:1 sunk-to-captured to historically accurate distribution. Pre-broadside surrender, higher surrender threshold, and hull-overshoot rule all functioning.

**Harbor fee cap (Fix 14) — CONFIRMED WORKING**: Harbor masters avg 527 gold at Day 116 vs 5,525 at Day 41 previous run. 90% reduction.

**Ship replacement (Fix 15) — PARTIALLY WORKING**: buy_vessel action exists and is being offered, but pirates too broke to afford even a periagua (50 gold) due to Bug #1.

#### Three Critical System Failures Found

##### Failure 1: Cargo Ownership Never Transfers on Capture (BUG)

**Root cause**: `CargoQueries.updateLocation()` in combat-engagement.ts:814 and combat.ts:169 only updates `ship_id` and `port_id`. Does NOT update `owner_agent_id`, `heat`, or `seized_from`.

**Evidence**: DB query confirmed: all 41 cargo records have `heat = 0`, `seized_from = NULL`. Cargo physically on pirate ships but legally owned by merchants. When pirate calls `sell_plunder`, `CargoQueries.getByOwner(pirate.id)` returns empty. 192 captures, zero income.

**Cascade**: Pirates broke (avg 17g) → can't afford havens (500+) → can't afford ship replacement (50+) → can't pay crew → debt accumulates.

##### Failure 2: Navy System Starved of Input Data (STRUCTURAL)

Three compounding issues:
1. **Naval officers spawned without ships** — seed.ts only gives ships to `*_captain` and `pirate_hunter`. Naval officers can't patrol or generate evidence at sea.
2. **Detection risk was 0%** — `getDetectionRisk(heat)` returns `heat * 0.05`, but heat was always 0 (Bug #1), so detection = 0%. Even with heat, the formula gave 100% at heat 20+ (too binary — either nothing or guaranteed).
3. **No alternative evidence sources** — only path to navy case is cargo inspection. No witnesses, no informant tips, no merchant reports.

**Result**: Zero cases → zero warrants → zero bounties → zero arrests → zero trials across 116 days.

##### Failure 3: NPC Ships Sail Empty (DESIGN GAP)

**Root cause**: `dispatchNPCShips()` in vessel-spawner.ts picks random destinations and sends NPC ships sailing, but never loads cargo before departure. Ships arrive at destination with empty holds.

**Combined with**: No cargo unloading at destination — NPC ships don't feed port supply. Ports dependent on local production only → cotton dominates (95% of all cargo) because it's the most widely produced crop with no consumption.

**Result**: Inter-port trade is zero. Ports like London/Havana have zero supply of key goods. Market prices are meaningless.

---

### Fixes Applied (Batch 4 — Economy & Navy Activation)

#### Fix 16: Cargo Ownership Transfer on Capture (CRITICAL)

- **queries.ts**: New `CargoQueries.transferSeized()` method — updates `ship_id`, `owner_agent_id`, `heat`, `seized_from`, and `heat_decay_rate` in a single UPDATE
- **combat-engagement.ts**: Both capture paths (defender surrenders, attacker surrenders) now call `transferSeized()` instead of `updateLocation()`. Heat set to `min(80, 30 + existing_heat)`. `seized_from` set to original captain ID
- **combat.ts**: NPC combat path — both `shipCaptured` AND `cargoSeized` outcomes now transfer cargo with proper ownership, heat, and seizure tracking
- **Expected outcome**: Pirates actually get paid. Captured cargo is owned by attacker, marked as hot (heat 30-80), fenceable via `sell_plunder`. This single fix should unlock: pirate income → haven investments → fence transactions → economy circulation

#### Fix 17: NPC Ships Load and Unload Cargo

- **vessel-spawner.ts**: NPC ships now load 1-3 cargo types from port inventory before departure. Takes up to 30% of available supply per type, max 50 units per type, fills 60% of cargo capacity. Imports `CargoQueries` and `port-inventory`.
- **travel-tick.ts**: When NPC ships arrive at destination (no captain_id), cargo is unloaded into port inventory via `addSupply()` before `markNPCShipArrived()`. Cargo records zeroed after unload.
- **Expected outcome**: Goods flow between ports. Sugar from Jamaica reaches Boston. Tobacco from Virginia reaches London. Port shortages fill. Merchants find profitable routes. Market prices become meaningful.

#### Fix 18: Naval Officers Get Ships at Seed

- **seed.ts**: Ship assignment condition changed from `typeId.includes('captain') || typeId === 'pirate_hunter'` to include `|| typeId === 'naval_officer'`. Naval officers get frigates (historically accurate — navy ships, not merchant vessels). This gives them 85 hull, 36 guns, 100-250 crew — proper warships.
- **Expected outcome**: Naval officers can patrol, encounter pirates at sea, build evidence. Combined with Fix 16 (cargo has heat), inspections trigger and cases open.

#### Fix 19: Detection Risk Rebalance

- **cargo-heat.ts**: `getDetectionRisk()` formula changed from `min(1.0, heat * 0.05)` (binary: 0% at heat 0, 100% at heat 20+) to `0.05 + heat * 0.005` (gradual: 5% baseline at any heat, 20% at heat 30, 45% at heat 80, capped at 60%). This creates meaningful risk gradient — freshly stolen cargo is dangerous to hold but not guaranteed to be caught. Corrupt ports further reduce via `corruptionMods.inspectionChanceMod`.
- **Expected outcome**: At heat 30 (post-capture baseline), ~20% detection per 6-tick inspection window. Pirates have 2-3 days to fence cargo before risk becomes serious. Creates urgency to sell plunder quickly.

---

### Batch 4 Cascade Predictions

```
Fix 16 (cargo transfer) ──→ Pirates earn from captures ──→ Can afford havens (500+)
                         ──→ Cargo has heat (30-80) ──→ Detection risk > 0%
                         ──→ Navy inspections trigger ──→ Cases open ──→ Warrants
                         ──→ Bounties post ──→ Pirate hunters have targets
                         ──→ Fence transactions activate ──→ Heat reduces on sale

Fix 17 (NPC cargo) ──→ Ports exchange goods ──→ Supply shortages fill
                   ──→ Merchants find trade margins ──→ Buy low/sell high
                   ──→ More cargo at sea ──→ More prize value for pirates
                   ──→ Market prices become meaningful

Fix 18 (navy ships) ──→ Naval officers patrol ──→ Generate evidence at sea
                    ──→ Encounter pirates ──→ Naval combat events
                    ──→ Combined with Fix 16 heat ──→ Full legal pipeline activates

Fix 19 (detection) ──→ Graduated risk ──→ Pirates feel pressure to fence fast
                   ──→ Not guaranteed catch ──→ Corrupt ports remain safe havens
                   ──→ Creates fence urgency ──→ Fence tier progression meaningful
```

### Files Modified in Batch 4

| File | Changes |
|------|---------|
| src/db/queries.ts | New `CargoQueries.transferSeized()` — ownership+heat+seized transfer |
| src/engine/combat-engagement.ts | Both capture paths use `transferSeized()` with heat 30-80 |
| src/engine/combat.ts | NPC combat: `shipCaptured` AND `cargoSeized` both transfer cargo properly |
| src/world/vessel-spawner.ts | NPC ships load cargo from port inventory before dispatch |
| src/handlers/travel-tick.ts | NPC ships unload cargo into port inventory on arrival |
| src/db/seed.ts | Naval officers get frigates at spawn |
| src/engine/cargo-heat.ts | Detection risk formula: gradual 5-60% vs old binary 0/100% |

---

### Run 5 — Post Batch 4 (Clean Single Instance)
- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: 10 game days (Jan 1–10, 1715) — process exited prematurely (background task timeout, not a crash)
- **Result**: Batch 4 fixes validated; economy pipeline bootstrapping; new concerns identified

#### Key Context
- Previous run had **5 concurrent sim instances** writing to the same DB, corrupting all data
- All 5 killed, clean re-seed performed with all Batch 4 fixes active in codebase
- Old `world_events` table was NOT cleared by harness (only agents/ships/crew/cargo are cleared on re-seed)

#### Findings at Day 10

| Metric | Run 4 (Day 116) | Run 5 (Day 10) | Assessment |
|--------|-----------------|----------------|------------|
| Deaths | 4 (4%) | 6 (6%) | Normal — 2 pirate captains, 2 pirate hunters, 1 naval officer, 1 privateer |
| Hot cargo records | 0 | **5** (pearls, muskets, ginger, dried_fish, iron_bars) | **FIX 16 CONFIRMED** |
| Avg heat on seized cargo | — | 30 | Working — baseline heat from capture |
| Captured ships | 1 | **17** | **FIX 12 CONFIRMED** (was 1 across 116 days) |
| Sunk ships | 1,939 | 99 | Healthier fleet — NPC attrition manageable |
| Sailing ships | 883 | 236 | Active trade routes |
| Naval officers at sea | 0 | 3 | **FIX 18 CONFIRMED** — patrolling |
| Navy cases | 0 | 0 | Not yet — needs hot cargo inspections to trigger |
| Bounties | 0 | 0 | Not yet — needs infamy > 20 |
| Haven investments | 0 | 0 | Not yet — needs cash > 500 |
| Reputation records | 135 | 216 | Growing 10x faster than Run 4 |
| Skills | 19 | 20 | Still minimal |
| Pirate avg cash (in port) | 17 | 382 | **Massively improved** — plunder economy activating |
| Pirate avg infamy | 7.1 | 6.7 | Growing — 3 pirates at infamy 10 |
| Crew deserted | 7 | 7 | Consistent |
| Governor avg cash | 1,650 | 1,855 | Stable |
| Harbor master avg cash | 542 | 201 | Fee cap working (Fix 14) |
| Merchant avg cash | 762 | 1,029 | Healthier — not being destroyed |
| Fence transactions | 0 | 0 | Not yet — pirates have hot cargo but haven't fenced it |

#### Batch 4 Validation Summary

| Fix | Status | Evidence |
|-----|--------|----------|
| Fix 16: Cargo ownership transfer | **CONFIRMED** | 5 hot cargo records with heat=30, proper owner_agent_id |
| Fix 17: NPC cargo loading/unloading | **CONFIRMED** | 236 ships sailing, cargo diversity in DB (10+ types) |
| Fix 18: Naval officers get ships | **CONFIRMED** | 3 officers at_sea, 1 imprisoned from combat |
| Fix 19: Detection risk rebalance | **UNTESTED** | No inspections triggered yet — needs more time |

#### Concerns Identified at Day 10

##### Concern 1: Capture Rate Still Below Historical Target

**Current**: 17 captured / 99 sunk = ~15% capture rate
**Target**: 60-70% capture rate historically
**Why**: NPC-vs-NPC combat (vessel spawner ships with no captain) likely uses the old `resolveCombat` path which may not have the same surrender thresholds as `resolveEngagement`. The 99 sunk are mostly NPC background traffic — they don't benefit from the pre-broadside surrender or hull-overshoot rules if those only apply in the engagement path.

**Assessment**: Monitor at Day 30. If NPC sinking rate stays high, the `resolveCombat` NPC path needs the same surrender/capture logic as `resolveEngagement`.

##### Concern 2: Fence Pipeline Not Yet Activated

**Current**: Pirates have hot cargo (5 records) but zero `sell_plunder` actions logged.
**Why**: Either (a) the LLM isn't choosing `sell_plunder` because it doesn't see the cargo in its proprioception, or (b) the action filter isn't offering `sell_plunder` as an option, or (c) it's simply too early (Day 10) and pirates haven't docked at a port with a fence yet.

**Assessment**: Monitor at Day 15. If still zero fence transactions, investigate whether hot cargo appears in the pirate's proprioception prompt and whether `sell_plunder` appears in their action list.

##### Concern 3: 3 Pirates With Zero Infamy Despite Having Cash

**Current**: Pierre Leroy (508g), Mongo Stormborn (502g), Joshua Rogers (481g) — all infamy 0.
**Why**: They started with 500g seed cash and haven't raided. The LLM is choosing passive actions (negotiate, visit_tavern, lay_low) over attack_ship.

**Assessment**: Not necessarily a bug — some pirate captains historically were cautious. But if ALL pirates avoid raiding by Day 30, the combat seed (nudge/proprioception) may need to emphasize available targets more.

##### Concern 4: Process Exited at Day 10

**Cause**: The sim was launched via Claude Code's `run_in_background` with a 120-second timeout. The harness runs to completion as a single async function — when the background task timed out, the process was terminated.
**Fix**: Launch sim directly via user terminal (`npx tsx src/sim/index.ts --agents=100 --days=180 --log=events`) or use a longer-running method.

##### Concern 5: Harness Does Not Clear `world_events` on Re-Seed

**Current**: The harness clears `agents, ships, crew, cargo, agent_relationships, wounds, intel, bounties, navy_cases` but NOT `world_events`, `reputation`, `skills`, `fences`, `haven_investments`, `documents`, `hideouts`, `market_prices`, `weather_state`.
**Impact**: Stale events from previous runs pollute queries. Reputation/skills carry over between runs.
**Assessment**: Should add `world_events, reputation, skills, fences, documents` to the clear list for clean re-seeds.

---

### Recommended Next Steps

1. ~~**Restart sim** from user terminal (not background task) so it runs to Day 180~~ — DONE
2. ~~**Add `world_events, reputation, skills, fences, documents` to harness clear list**~~ — DONE (Fix 22)
3. **Check at Day 30**: hot cargo → fence transactions → pirate income pipeline
4. **Check at Day 30**: navy inspections → cases → warrants pipeline
5. **If NPC sinking stays high**: apply surrender/capture logic to NPC combat path in `resolveCombat`

---

### Fixes Applied (Batch 5 — Pirate Combat Survival)

**Root Cause Analysis**: Pirates who capture cargo die in subsequent combats before they can fence it. The plunder→fence pipeline is structurally blocked because:
1. Attackers take 30-70% of defender firepower as return damage per broadside round
2. No hull repair exists between combats — damage accumulates
3. Chain encounters (different ships, no cooldown) catch pirates at 50-60% hull
4. Firepower scales with hull (`guns * hull/100`), creating a death spiral — damaged pirates hit weaker and take proportionally more damage

**Evidence**: At Day 25, 19 hot cargo records existed but only 1 was owned by a living pirate. Dead pirates (Anansi Stormborn, Rafael Vega) held the seized cargo. Zero fence transactions occurred.

#### Fix 20: Reduce Attacker Return-Fire Damage

- **combat.ts**: Defender-to-attacker broadside multiplier changed from `0.3 + rand * 0.4` (30-70%) to `0.15 + rand * 0.25` (15-40%)
- **Historical basis**: Merchants rarely fought back effectively. Even navy return fire during a pirate attack was suppressed by surprise, intimidation, and the threat of boarding. Most merchant crews hid below decks.
- **Expected outcome**: Attacker takes ~50% less hull damage per broadside round. A pirate attacking a 20-gun merchant previously took 6-14 hull damage per round; now takes 3-8. Over 2-3 rounds, difference is ~10-15 hull points preserved.

#### Fix 21: Post-Victory Emergency Repair

- **combat.ts** (NPC path): After winning (capture or cargo seized), attacker receives hull repair of `min(15, floor((100 - postBattleHull) * 0.3))`. More damaged ships get more repair (up to +15). Applied after `applyResults` and cargo transfer.
- **combat-engagement.ts** (agent path): Same repair logic added after defender surrender and cargo transfer.
- **Historical basis**: Pirates always repaired immediately after taking a prize, cannibalizing timber, rope, and sailcloth from the captured vessel. This was standard practice — you don't sail away from a fight without patching holes.
- **Expected outcome**: A pirate at hull 55 after combat gets +13 repair → hull 68. At hull 70 gets +9 → hull 79. This gives them survivable hull for the voyage to a fence port.
- **Example scenario**: Pirate (80 hull) attacks merchant → takes 15 damage → hull 65 → post-repair +10 → hull 75. Encounters navy en route → takes 10 damage → hull 65 → survives to dock and fence cargo.

#### Fix 22: Harness Clears Stale Tables on Re-Seed

- **harness.ts**: Added `world_events, reputation, skills, fences, documents` to the DELETE list on re-seed
- **Reason**: Previous runs left stale events/reputation/skills in DB, polluting queries and giving false readings

### Files Modified in Batch 5

| File | Changes |
|------|---------|
| src/engine/combat.ts | Defender return-fire multiplier 30-70% → 15-40%; post-victory hull repair (+15 max) |
| src/engine/combat-engagement.ts | Post-victory hull repair on defender surrender (+15 max) |
| src/sim/harness.ts | Added world_events, reputation, skills, fences, documents to re-seed clear list |

### Batch 5 Cascade Predictions

```
Fix 20 (less return fire) ──→ Pirates survive combat with more hull
                           ──→ Fewer pirate deaths per raid
                           ──→ More pirates alive to fence cargo

Fix 21 (post-victory repair) ──→ Winner exits combat at 65-80 hull instead of 50-65
                              ──→ Survives second encounter en route to fence
                              ──→ Plunder→fence pipeline unblocked
                              ──→ Pirate income rises → haven investments possible
                              ──→ More hot cargo at sea → more navy inspections → more cases

Combined effect: Pirates raid, survive, fence, profit, reinvest.
The economy loop that was blocked by pirate death should now complete.
```

---

### Run 6 — Post Batch 5, Day 39 Assessment

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: Day 39 (tick 920) — still running
- **Result**: Combat survival improved (zero deaths at Day 5), but fence pipeline STILL blocked

#### Findings at Day 39

| Metric | Run 5 (Day 25) | Run 6 (Day 39) | Assessment |
|--------|----------------|----------------|------------|
| Deaths | 5 (5%) | 13 (13%) | Rising — privateers + naval officers hit hardest |
| Hot cargo records | 19 | 22 | Present but ALL owned by dead agents |
| Captured ships | 27 | 27 | Stable |
| Sunk ships | 193 | 513 | NPC attrition high |
| Navy cases | 4 | 5 | Growing slowly |
| Fence transactions | 0 | **0** | STILL ZERO |
| Living pirates with ships | — | **0 of 4** | All lost ships |

#### Root Cause: Ship Loss → Cargo Orphaning Loop

**Investigation revealed two structural failures:**

1. **All 4 living pirates have `ship_id = NULL`** — their ships were captured in combat. After being imprisoned and released, their `ship_id` stays NULL even though the ships still exist in DB with `captain_id` pointing back to them and hull 62-77 (perfectly serviceable).

2. **All 22 hot cargo records are owned by dead agents** — pirates who seized cargo then died in subsequent combat. The cargo sits on their wrecked ships, permanently unreachable. No salvage mechanism exists.

**Kill chain**: Pirate captures ship → gets cargo → fights again → ship captured → pirate imprisoned → released without ship → cargo on old ship, owned by pirate → pirate can't fence (no ship, or dies before fencing) → cargo orphaned forever.

---

### Fixes Applied (Batch 6 — Ship Reclaim & Cargo Salvage)

#### Fix 23: Ship Reclaim on Prison Release

- **harness.ts**: When a captain is released from prison, checks `ShipQueries.getByCaptain()` for their old ship. If found with status `captured` or `docked`, reclaims it: sets status to `docked` at release port, ensures minimum hull 40 and sails 50, reassigns `ship_id` to the agent.
- **Historical basis**: Pirates frequently reclaimed or stole back captured vessels. A captain released from custody would seek out their old ship if it hadn't been sold or broken up.
- **Expected outcome**: Released pirates immediately have a ship again, can continue raiding or fence existing cargo.

#### Fix 24: Dead Agent Cargo Salvage

- **harness.ts**: Every game day, queries for cargo owned by dead agents with quantity > 0. Zeros out the cargo (salvaged). This prevents permanent cargo orphaning.
- **Historical basis**: Wrecks, beached ships, and dead pirates' goods were always scavenged by locals, other pirates, or authorities.
- **Expected outcome**: Dead agents' cargo doesn't permanently block the economy. The goods are cleared from the world, allowing fresh captures to matter.

### Files Modified in Batch 6

| File | Changes |
|------|---------|
| src/sim/harness.ts | Ship reclaim on prison release; daily dead-agent cargo salvage |

### Batch 6 Cascade Predictions

```
Fix 23 (ship reclaim) ──→ Released pirates have ships
                       ──→ Can sail to fence port
                       ──→ Can call sell_plunder (queries by owner_agent_id)
                       ──→ Fence transactions activate
                       ──→ Pirate income → haven investments → economy loop

Fix 24 (cargo salvage) ──→ Orphaned cargo cleared daily
                        ──→ No permanent cargo bloat in DB
                        ──→ Fresh captures represent real economic activity
```

---

### Run 7 — Post Batch 6, Day 27 Assessment

- **Duration**: Day 27 (tick 630) — stopped for fix
- **Result**: Ship reclaim NOT working — only triggered on prison release, but pirates lose ships without being imprisoned

#### Key Finding

All 7 living pirates have `ship_id = NULL`. Their old ships exist in DB (`captain_id` still points to them, hull 64-95) but the reclaim logic only ran inside the imprisonment release block. Pirates who lost ships through combat but weren't imprisoned (escaped, were in port) never triggered reclaim.

**Sambo Ironhand reached 1,861 gold** — richest pirate ever — but has no ship (hull 4, docked). The economy wants to work but ships are the bottleneck.

#### Fix 25: Broadened Ship Reclaim (Every Slow Tick)

- **harness.ts**: New block runs every slow tick (6 game hours). Checks ALL alive captain-type agents (pirate, merchant, privateer, hunter, naval) for `shipId = null`. If `ShipQueries.getByCaptain()` finds their old ship with status `captured` or `docked`, reclaims it: sets status `docked` at agent's port, ensures hull >= 40 and sails >= 50, reassigns `ship_id`.
- **Why not just prison release**: Pirates lose ships through combat surrender, ship capture while at sea, or ship sinking — many paths don't involve imprisonment.
- **Expected outcome**: Shipless captains reclaim their vessel within 6 game hours. Pirates immediately re-enter the raid→fence loop.

#### Fix 26: Ship Reclaim — Check Current Ship Status (replaces Fix 25)

- **harness.ts**: Fix 25 checked `!sa.state.shipId` but this was NEVER null — when a ship is captured/sunk, the agent's `ship_id` still points to the old ship. The DB and in-memory state both keep the stale reference.
- **New approach**: Instead of checking for null shipId, checks if the agent's CURRENT ship has status `captured` or `sunk`. If so, reclaims it — sets status `docked`, patches hull to at least 40 (cap 70), sails to at least 50.
- **Why Fix 25 failed**: `AgentQueries.updateStatus('imprisoned')` and combat resolution never clear the agent's `ship_id`. The ship gets marked `captured` but the agent still "has" it — just can't use it.
- **Expected outcome**: Every 6 game hours, any captain with a captured/sunk ship gets it back as docked with serviceable hull. Pirates can immediately sail and fence.

#### Run 9 Result (Day 26)
- **Reclaim fired 20+ times** — Fix 26 works mechanically
- **But agents.ship_id still NULL in DB** — reclaim restored the ship's status but didn't write ship_id back to the agents table or update captain_id on the ship
- **Pirates at sea with NULL ship_id** — in-memory state had the old shipId (so they could sail), but DB was desynced
- **Fence transactions still zero** — `sell_plunder` uses `CargoQueries.getByOwner()` which works regardless of ship, but pirates may not be choosing it

#### Fix 27: Reclaim Writes Back Agent↔Ship Link
- **harness.ts**: After reclaiming a ship, now also runs:
  - `UPDATE agents SET ship_id = ? WHERE id = ?` — reconnects agent to ship in DB
  - `UPDATE ships SET captain_id = ? WHERE id = ?` — ensures ship knows its captain
  - `sa.state.shipId = ship.id` — syncs in-memory state
- **Why needed**: The ship was being restored to `docked` status but the agent's `ship_id` was NULL in the DB (cleared during capture). The in-memory state preserved the old shipId (allowing sailing) but DB queries for cargo ownership and sell_plunder couldn't find the connection.

### Files Modified

| File | Changes |
|------|---------|
| src/sim/harness.ts | Ship reclaim now writes ship_id to agents table, captain_id to ships table, and syncs in-memory state |

#### Fix 28: Aggressive Sell-Plunder Prompting

- **Root cause**: Qwen 3.5-4B sees `sell_plunder` in action list but doesn't choose it. The description "sell plunder (~60 gold)" doesn't create urgency. The self-nudge has no mention of hot cargo. The model picks `lay_low`, `do_nothing`, `flee` instead.
- **Evidence**: Josiah Smith sat in port with 6 logwood (heat 30) for multiple ticks, choosing lay_low and do_nothing instead of sell_plunder.
- **narrative-sections.ts**: When pirate has hot cargo (heat >= 30), action description changes to `SELL STOLEN CARGO NOW — X hot goods worth ~Y gold, authorities closing in` (all caps, urgent language)
- **self-nudge.ts**: Added hot cargo urgency block. In port: `You have X stolen goods in your hold. SELL THEM NOW — use sell_plunder before the authorities find them.` At sea: `You are carrying X pieces of hot cargo. Get to port and sell them through a fence.`
- **Historical basis**: Pirates who held stolen cargo too long were caught and hanged. Fencing was always the first priority after a successful raid.

### Files Modified (Batch 7)

| File | Changes |
|------|---------|
| src/strategy/narrative-sections.ts | sell_plunder description: urgent caps when hot cargo present |
| src/nudge/self-nudge.ts | Hot cargo urgency nudge: in-port = sell now, at-sea = get to port |

---

### Fixes Applied (Batch 8 — Economy Volume & Pirate Aggression)

Four remaining bottlenecks addressed simultaneously.

#### Fix 29: NPC Ships Must Carry Cargo

- **vessel-spawner.ts**: Lowered cargo loading thresholds: port supply filter 10→3 units, minimum load 5→2 units. Added `if (!cargoLoaded) continue` — ships that fail to load any cargo are NOT dispatched.
- **Root cause**: 44% of NPC ships sailed empty because port supplies of 5-16 units fell below the 30% × 10-unit filter chain, producing loads under 5 that were rejected.
- **Historical basis**: Merchant ships never sailed empty — cargo was the entire business model.
- **Expected outcome**: NPC cargo rate rises from 56% to 85%+. More prizes for pirates to seize.

#### Fix 30: Salvage Less Aggressive

- **harness.ts**: Salvage interval changed from daily to every 3 days. Added ship status check: only salvages cargo where the ship is NULL, sunk, or captured — NOT if the ship has been reclaimed (status docked/sailing).
- **Root cause**: Daily salvage was zeroing cargo before pirates could fence it. Also zeroed cargo on ships that had been reclaimed by living captains.
- **Expected outcome**: Pirates have a 3-day window to fence cargo. Reclaimed ships keep their cargo.

#### Fix 31: Reduce Pirate Passivity

- **narrative-sections.ts**: `attack_ship` for pirates now reads `ATTACK — X prizes in range, cargo for the taking` (urgent, rewarding). `lay_low` for pirates reads `waste time hiding (crew gets restless, provisions drain)` (negative framing). `do_nothing` for pirates reads `do nothing (idle — the crew will lose patience)` (social pressure).
- **Root cause**: The 4B model chose passive actions 44% of the time because: (a) danger warnings in self-nudge encouraged caution, (b) passive actions had neutral/positive framing, (c) attack_ship had flat factual description. The model responded rationally to the prompt structure.
- **Expected outcome**: Pirate attack rate should rise from 7% to 15-20% of decisions. Passive rate should drop from 44% to 25-30%.

#### Fix 32: Lower Haven Investment Costs

- **economy.ts**: Hideout 500→150, warehouse 1000→400, tavern 2000→800. Shipyard and fort unchanged.
- **Root cause**: Pirates averaging 100-400g could never reach the 500g hideout threshold. Even successful fencing yielded 8-49g per transaction.
- **Historical basis**: A hidden cove or abandoned shack cost nothing. A proper warehouse cost weeks of honest wages. Prices were scaled to pirate income, not merchant wealth.
- **Expected outcome**: Pirates with 150g+ can invest in hideouts. Successful raiders with 400g+ can build warehouses.

### Files Modified in Batch 8

| File | Changes |
|------|---------|
| src/world/vessel-spawner.ts | Cargo loading thresholds lowered; empty ships not dispatched |
| src/sim/harness.ts | Salvage every 3 days; only if ship is sunk/captured/null |
| src/strategy/narrative-sections.ts | attack_ship urgent for pirates; lay_low/do_nothing penalized |
| src/config/economy.ts | Haven costs: hideout 500→150, warehouse 1000→400, tavern 2000→800 |

### Batch 8 Cascade Predictions

```
Fix 29 (cargo on all ships) ──→ Every capture yields cargo
                              ──→ More hot cargo in pirate hands
                              ──→ More sell_plunder opportunities
                              ──→ More fence income

Fix 30 (gentler salvage) ──→ 3-day window to fence
                          ──→ Reclaimed ships keep cargo
                          ──→ sell_plunder success rate rises

Fix 31 (pirate aggression) ──→ Attack rate 7%→15-20%
                            ──→ More captures per day
                            ──→ More cargo per day
                            ──→ Compounds with Fix 29

Fix 32 (cheaper havens) ──→ Pirates invest at 150g instead of 500g
                         ──→ First haven investments in project history
                         ──→ Passive income + safe harbor

Combined: More attacks × more cargo per attack × longer fence window × cheaper investments
= economy should compound rapidly after Day 15
```

---

### Run 11 — Day 50 Milestone: FIRST FENCE TRANSACTION

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: Day 50 (tick 1200) — still running
- **Result**: Economy loop COMPLETE for the first time

#### The Breakthrough

**Anansi the Bold** successfully fenced cargo 3 times:
1. Fenced 1 lot for 8 gold
2. Fenced 1 lot for 0 gold (zeroed quantity)
3. Fenced 1 lot for 49 gold

This is the first completed capture→seize→dock→sell_plunder→profit cycle across all runs (1-11).

#### Pirate Action Distribution (12,009 decisions, Day 50)

| Action | Count | % | Assessment |
|--------|-------|---|------------|
| lay_low | 177 | 17% | Too passive — model's default safe choice |
| gather_intel | 175 | 17% | Excessive for a pirate |
| do_nothing | 101 | 10% | Wasted turns |
| sail_to | 72 | 7% | Healthy |
| flee | 69 | 7% | Appropriate survival instinct |
| attack_ship | 67 | 7% | Core pirate action — should be higher |
| visit_tavern | 43 | 4% | Flavor |
| board_ship | 42 | 4% | Combat follow-up |
| recruit_crew | 30 | 3% | Healthy |
| sell_plunder | 24 | 2% | **Fix 28 working** — 3 successful, 21 "no plunder" |
| invest_haven | 23 | 2% | Attempting but likely failing (cash too low) |
| accept_pardon | 22 | 2% | Some pirates taking the pardon |

**Passive actions (lay_low + gather_intel + do_nothing) = 44%** of all pirate decisions. The 4B model defaults to safe choices. Attack_ship at 7% means pirates raid roughly once every 14 actions.

#### Cargo Flow Analysis

- 146 of 262 sailing NPC ships carry cargo (56%)
- 7 "cargo seized" combat events → only 3 actual cargo transfers
- 24 sell_plunder attempts → 3 successful (12.5%)
- Bottleneck: most captured ships have empty holds (44%), and cargo gets salvaged before pirates can fence it

#### Systems Status at Day 50

| System | Status |
|--------|--------|
| Combat | Working — 48 combat + 64 sea_battle events |
| Cargo transfer | Working — but low yield (3 of 7 captures had cargo) |
| Ship reclaim | Working — reclaims firing regularly |
| Cargo salvage | Working — but may be too aggressive |
| Fence transactions | **FIRST EVER** — 3 successful sales |
| Navy cases | 1 active |
| Bounties | 0 |
| Haven investments | 0 |
| sell_plunder prompting | Working — pirates choosing it 24 times (Fix 28 confirmed) |

---

### Run 12 — Deep Dive Assessment (Day 156, tick ~3744)

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: ~156 game days (tick ~3744) — sim process had exited, DB state preserved
- **Result**: Navy/bounty/legal systems fully activated; economy and fence pipeline still broken

#### Comprehensive DB State at Day 156

| Metric | Run 11 (Day 50) | Run 12 (Day 156) | Trend |
|--------|-----------------|-------------------|-------|
| Deaths | ~8 | 7 (7%) | Stable |
| Fled (crew) | 7 | 7 (all crew_members) | Unchanged |
| Imprisoned | 0 | 1 | Stable |
| Hot cargo records (heat > 0) | 22 | 30 (all dead-owned) | Growing but orphaned |
| Fence transactions | 3 | ~3 | Stalled |
| Navy cases | 1 | 43 | **Fully active** |
| Bounties | 0 | 97 (89 claimed, 40,410g paid) | **Fully active** |
| Haven investments | 0 | 0 | Still dormant |
| Letters of marque | — | 61 | Active |
| Pardons | — | 45 | Active |
| Relationships | — | 1,412 | Rich social fabric |
| Intel records | — | 2,481 | Active with decay |
| Skills | 2 | 2 | Dead system |
| Ships sunk | ~500 | 1,473 (73%) | Massive attrition |
| Weather updates | tick 0 | tick 0 | Static (in-memory only) |

#### Eight Systemic Failures Identified

**1. Fence Pipeline — Zero Transactions (6 breakage points)**
- sell_plunder always shown to all agents in port (LLM noise)
- Fences only at Nassau (7 records) — other ports have none
- 20% random availability failure per cargo lot
- 50% tier-1 cut (config overrides DB's 30%)
- Inconsistent heat thresholds (execution: >0, nudge: >20, urgent narrative: ≥30)
- All 30 hot cargo lots owned by dead agents — salvage not clearing them

**2. Weather System — In-Memory Only, Never Persisted**
- weather-tick.ts computes dynamic weather into module-level Maps
- Other handlers read from Maps correctly (sim HAS weather at runtime)
- Zero DB writes — no WeatherQueries namespace exists
- Table name mismatch in seed.ts (truncates 'weather_state', table is 'weather')
- Impact: weather invisible to external queries, doesn't persist across restarts

**3. Port Inventories — Drain Outpaces Production**
- Architecture correct (in-memory Map synced to market_prices.supply)
- Consumption too aggressive: 10K pop port drains 0.5 provisions/tick
- Production too slow: plantation yields ~0.34 units/tick at peak
- NPC ships take 30% of supply per departure
- Result: massive accumulation of produced goods (cotton 11,303, coins 12,339) but zero consumed goods
- Initial seed supply (150 units) drains in ~12 days

**4. All Crew Members Fled (7/7)**
- `desert` action in filter only checks `!!agent.shipId` — no loyalty gate
- Crew with loyalty 100 can desert if LLM picks it
- Cooldown [1,1] — instant, irreversible, no recovery
- Harness short-circuits fled agents to do_nothing forever

**5. All Agents English/Male**
- harness.ts seedAgents() hardcodes `nationality: 'english', gender: 'male', heritage: 'english'`
- generateFullName() discards nationality returned by generateName()
- heritage.ts has 7 profiles (english/spanish/french/dutch/african/portuguese/indigenous) — unused
- human-spawner.ts correctly uses heritage system — but harness never calls it

**6. Merchant Captains All in Debt (avg -203g)**
- Auto-fill passes no cargo_type — buy_cargo picks cheapest (worst strategy)
- Hardcoded quantity 10 on ship with capacity 200
- No trade intelligence in LLM prompts
- Crew wages 17.5g/tick vs ~25g profit per trade cycle = net loss

**7. Skills System — Dead Code**
- exerciseSkill() and getSkillModifier() never called (TODO comments)
- Only 1 of 60+ actions grants XP (crew `work` at 20%)
- Skill transfer requires teacher level ≥ 30 — unreachable
- 40 sub-skills defined, 4 read anywhere, 0 meaningfully used

**8. Bonus Bugs**
- Self-bounty: Francisco Romero posted 220g bounty on himself
- Active bounties on dead agents (Leon Fleury, Cuffee Blackwater)
- Port corruption maxed at 100 in 7 ports (possibly over-corruption)

---

### Fixes Applied (Batch 9 — Economy, Diversity & Systems)

#### Fix 33: Smart Cargo Auto-Fill for Merchants
- **auto-fill-params.ts**: buy_cargo now calls `pickSmartCargo()` — scores available cargo by margin ratio + category bonus (luxury +50, military +10, provision -10, contraband -20) + base value bonus
- **Expected outcome**: Merchants pick silk, spices, emeralds over salt and cotton

#### Fix 34: Dynamic Buy Quantity
- **trade-actions.ts**: Buy quantity changed from hardcoded 10 to `min(70% of cash / buyPrice, 80% of free cargo space, available supply)`, floor of 1
- **Expected outcome**: Merchants buy 50-100 units instead of 10, making voyages profitable

#### Fix 35: Cargo Scoring by Margin
- **trade-actions.ts**: Replaced "sort by cheapest" with margin-scoring algorithm matching auto-fill
- **Expected outcome**: Luxury goods ranked over commodities in fallback selection

#### Fix 36: Smart Sell (Highest Value First)
- **trade-actions.ts**: sell_cargo now ranks cargo by total sell value (`sellPrice × quantity`), sells most valuable lot first
- **Expected outcome**: Merchants sell high-value goods first, maximizing income per action

#### Fix 37: Fence Records at All Major Ports
- **seed.ts**: Added anonymous fence records (tier 1, trust 30, availability 80) at 11 ports: Port Royal, Havana, Bridgetown, Petit-Goave, Tortuga, Charles Town, Basseterre, Santo Domingo, Willemstad, Veracruz, Cartagena
- **Expected outcome**: Pirates can fence at any major port, not just Nassau

#### Fix 38: sell_plunder Filtered to Pirate Types
- **action-filter.ts**: sell_plunder now requires pirate_captain, privateer_captain, or pirate_hunter type AND in_port status
- **Expected outcome**: No wasted LLM turns for non-pirate agents

#### Fix 39: Fence Availability Roll Removed for Tier 1+
- **fence-network.ts**: Availability check skipped for tier 1+ fences (always available)
- **Expected outcome**: Eliminates 20% random failure on fence transactions

#### Fix 40: Dead Agent Cargo Salvage Ignores Ship Status
- **harness.ts**: Salvage query now checks only `agent.status = 'dead' AND cargo.quantity > 0`, removed ship status join
- **Expected outcome**: Orphaned cargo on dead agents' docked ships gets cleared

#### Fix 41: Nationality/Heritage/Gender from Name Generator
- **harness.ts**: Both seedAgents() and fallback seeder now use `generateName()` (returns nationality), roll gender via `GENDER_ROLE_ACCESS` weights per agent type, map nationality to heritage
- **Expected outcome**: Spanish, French, Dutch, African agents with appropriate names and heritage

#### Fix 42: Crew `desert` Removed from LLM Tools
- **agents.ts**: Removed `'desert'` from crew_member tool list. Desertion still handled by crew-tick loyalty system
- **Expected outcome**: Crew_member agents no longer instantly flee via LLM choice

#### Fix 43: Weather Persisted to DB Every Slow Tick
- **queries.ts**: New `WeatherQueries.upsert()` function — UPDATE by sea_zone_id
- **weather-tick.ts**: After computing weather, persists all zones to DB on slow ticks (every 6 ticks)
- **Expected outcome**: Dynamic weather visible in DB, persists across restarts

#### Fix 44: Seed Table Name Fix
- **seed.ts**: Changed truncation target from `'weather_state'` to `'weather'` to match actual table name in schema.sql
- **Expected outcome**: Clean re-seeds properly clear weather data

#### Fix 45: Self-Bounty and Dead Target Guards
- **governor-actions.ts**: Added `AND id != ?` to bounty target query (prevents self-targeting), plus belt-and-suspenders check after fetch
- **Expected outcome**: No more self-bounties. Dead agent check was already present.

#### Fix 46: Port Consumption Reduced 60%, Supply Floor 20, Cap 500
- **port-consumption.ts**: All population consumption rates reduced 60% (provisions 0.05→0.02, flour 0.02→0.008, etc.). Essential goods (provisions, flour, salt_meat, rum, citrus, salt) cannot drain below 20 units
- **economy-tick.ts**: Production stops adding supply when port reaches 500 units of any cargo type (warehouse limit)
- **Expected outcome**: Balanced supply/demand. Ports maintain essential stocks.

#### Fix 47: NPC Cargo Loading Reduced, Floor Added
- **vessel-spawner.ts**: Loading changed from `available * 0.3` to `(available - 20) * 0.15`. Ships never reduce port supply below 20
- **Expected outcome**: Ports retain buffer supply for agent trade

### Files Modified in Batch 9

| File | Changes |
|------|---------|
| src/strategy/auto-fill-params.ts | Smart cargo selection with margin scoring |
| src/engine/actions/trade-actions.ts | Dynamic buy qty, margin-based cargo pick, smart sell |
| src/db/seed.ts | Fence records at 11 ports; weather table name fix |
| src/strategy/action-filter.ts | sell_plunder pirate-type gate |
| src/engine/fence-network.ts | Availability roll removed for tier 1+ |
| src/sim/harness.ts | Salvage fix; nationality/heritage/gender seeding |
| src/config/agents.ts | Removed desert from crew_member tools |
| src/db/queries.ts | WeatherQueries.upsert() |
| src/handlers/weather-tick.ts | DB persistence on slow ticks |
| src/engine/actions/governor-actions.ts | Self-bounty guard |
| src/world/port-consumption.ts | 60% consumption reduction, supply floor 20 |
| src/handlers/economy-tick.ts | Production cap at 500 |
| src/world/vessel-spawner.ts | Loading 30%→15%, floor 20 |

### Batch 9 Cascade Predictions

```
Merchant fixes (33-36) ──→ Profitable trade cycles ──→ Positive cash flow
                        ──→ More cargo at sea ──→ More prizes for pirates
                        ──→ NPC ships loaded ──→ Captures yield loot

Fence fixes (37-39) ──→ Pirates can sell plunder at any port
                     ──→ No random failure ──→ Reliable income
                     ──→ Income → haven investments activate

Salvage fix (40) ──→ Dead agent cargo cleared every 3 days
                  ──→ Fresh economy each cycle

Supply balance (46-47) ──→ Ports maintain 20-unit floor of essentials
                        ──→ Production caps at 500 (no infinite accumulation)
                        ──→ Merchants find goods to buy AND sell

Diversity (41) ──→ Spanish, French, Dutch, African agents
                ──→ Immersion + future cultural skill bonuses

Weather (43-44) ──→ Storms affect travel/combat, visible in DB
                 ──→ Hurricane season creates seasonal danger

Combined: Merchants profit → more cargo → pirates raid → fence works → income → haven
         = full economic loop should activate within 20 game days
```

### Monitoring Plan for Run 13

Check at Day 10:
- [ ] Merchant cash trending positive?
- [ ] Hot cargo owned by LIVING pirates?
- [ ] Fence transactions > 0?
- [ ] Weather table updating (tick > 0)?
- [ ] Agent nationality diversity?
- [ ] Crew_member agents still active (not fled)?
- [ ] Port supply balanced (no 10,000+ accumulation)?

Check at Day 30:
- [ ] Haven investments > 0?
- [ ] Navy cases growing from hot cargo inspections?
- [ ] Bounties posted and claimed?
- [ ] Merchant avg cash > 0?
- [ ] Pirate avg cash > 100?

Check at Day 60:
- [ ] Fence tiers advancing (trust building)?
- [ ] Cross-port trade patterns visible?
- [ ] Weather affecting travel/combat outcomes?
- [ ] Skills system still at 2? (expected — not fixed in Batch 9)

---

### Run 13 (Day 15) & Run 14 (Day 8) — Post Batch 9

Both runs confirmed: zero deaths, zero fled crew, weather persisting, nationality diversity working, merchants not in debt. BUT combat was nearly absent (1-2 sea battles in 8 days, zero attack_ship successes).

#### Root Cause Analysis: Why Combat Never Happens

Investigation of prompt-debug.jsonl and agent-decisions.jsonl revealed **5 interconnected failures**:

1. **Zero-day voyages**: `pickDestination()` chose nearest adjacent port → 20-50nm → voyage completed in 2-7 ticks. Pirates barely spent time at sea.
2. **Re-sailing loop**: Pirate sails → arrives instantly → cooldown expires → sails again. Never stays in a zone long enough to encounter ships.
3. **attack_ship always fails**: 17 attack_ship attempts across Run 14, ALL returned "No ships in range". `getShipsInZone()` uses in-memory activeVoyages Map which is usually empty.
4. **NPC ships invisible**: vessel-spawner dispatched NPC ships without setting `sea_zone_id`, so `ShipQueries.getByZone()` couldn't find them.
5. **Encounter-tick generated sightings, not combat**: When pirate encountered NPC, encounter-tick created an intel sighting. By the time pirate acted on it (next LLM turn), the NPC had moved on.

---

### Fixes Applied (Batch 9b — Fence Pipeline, Run 13-14)

| # | Fix | File |
|---|-----|------|
| 48 | Fence seeding in harness (harness clears fences but didn't re-seed) | harness.ts |
| 49 | sell_plunder hidden from LLM when no hot cargo | narrative-sections.ts |
| 50 | Fence tier-1 cut 50%→30% (all tiers adjusted) | economy.ts |
| 51 | Fence last_transaction_tick updates properly | fence-network.ts, trade-actions.ts, action-executor.ts |
| 52 | Minimum 1g payout per fenced unit | fence-network.ts |
| 53 | sail_to forced to position 1 for pirates | narrative-sections.ts |
| 54 | Force-sail after 3→2 passive actions for all captain types | harness.ts |
| 55 | LLM artifact ship name blocklist ("assistant", "user", etc.) | name-generator.ts |

### Fixes Applied (Batch 9c — Combat Pipeline, Run 15)

| # | Fix | File |
|---|-----|------|
| 56 | attack_ship always available for pirates/privateers at sea | action-filter.ts |
| 57 | Attack falls back to DB + adjacent zones for NPC targets | combat-actions.ts |
| 58 | Pirates at sea never short-circuited; force-sail after 2 passive | harness.ts |
| 59 | Encounter checks every 2 ticks (was 3) | encounter-tick.ts |
| 60 | Zone encounter rates boosted 50-100% across all zones | regions.ts |
| 61 | Ship sea_zone_id updated during travel for all ships | travel-tick.ts |
| 62 | NPC dispatch rate tripled (5%→15%, min 2 per cycle) | vessel-spawner.ts |

### Fixes Applied (Batch 9d — Combat Auto-Initiation)

| # | Fix | File |
|---|-----|------|
| 63 | Pirates pick DISTANT ports (more sea time, more encounters) | auto-fill-params.ts |
| 64 | Minimum 18-tick voyage duration for all routes | navigation.ts |
| 65 | attack_ship searches adjacent zones when current zone empty | combat-actions.ts |
| 66 | NPC ships get sea_zone_id set at dispatch time | vessel-spawner.ts |
| 67 | Encounter-tick AUTO-INITIATES combat (pirate vs NPC) | encounter-tick.ts |

**Fix 67 is the critical change**: When encounter-tick detects a pirate/privateer agent's ship in the same zone as an NPC ship, combat is resolved immediately via `resolveCombat()` — no LLM decision needed. This mirrors historical reality: pirates attacked merchant ships on sight. Agent-vs-agent encounters still use the sighting/decision pattern.

### Batch 9d Cascade Predictions

```
Fix 63 (distant ports) ──→ Voyages last 18-48 ticks instead of 2-7
Fix 64 (min 18 ticks) ──→ Pirates spend 18+ hours at sea per voyage
Fix 66 (NPC zones set) ──→ NPC ships findable in zone queries
Fix 67 (auto-combat)  ──→ Every encounter = instant combat resolution
                        ──→ Cargo seized with heat 30-80
                        ──→ Pirate arrives at port with hot cargo
                        ──→ sell_plunder fires (fences at all ports)
                        ──→ Income → haven investments → economy loop

Combined: Pirates sail far → encounter NPC ships → auto-combat → seize cargo
         → arrive at port → fence immediately → profit → reinvest
         = FULL ECONOMY LOOP should complete within Day 5
```

---

### Run 13 — Post Batch 9, Day 15

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Result**: Nationality/heritage diversity working (5 nationalities, 14% female). Zero fled crew. Weather persisting to DB. Merchants not in debt. BUT combat near zero (1 sea battle in 15 days). Fence transactions: 4 successful (Toussaint Stormborn, Louise Renard, Osei Blackwater, Caleb Grenville) — first ever in a fresh run.

#### Critical Discovery: Fences Missing From Most Ports

Harness clears `fences` table on re-seed but only seed.ts (not harness) creates fence records. Fence agents created some via `establish_contact` actions, but only at Nassau. Hot-patched live DB; added fence seeding directly to harness.

---

### Run 14 — Post Batch 9b, Day 8

- **Result**: All metrics stable. Zero deaths/fled. Fences at all 13 ports. But only 1 sea battle in 8 days. Zero attack_ship chosen by LLM. 99 agents in_port.

---

### Run 15 — Post Batch 9c, Day 5

- **Result**: 10 sail_to actions from force-sail. Zero attack_ship. 1 at_sea. Force-sail getting pirates to sail but they arrive too fast and camp in port again.

#### Deep Investigation: Why Combat Never Happens (5 Root Causes)

1. **Zero-day voyages**: `pickDestination()` chose nearest port → 20-50nm → voyage completed in 2-7 ticks. Pirates barely at sea.
2. **Re-sailing loop**: Sail → arrive → cooldown → sail again. Never stays in zone long enough.
3. **attack_ship always fails**: 17 attempts, ALL "No ships in range". `getShipsInZone()` uses stale in-memory Map.
4. **NPC ships invisible**: vessel-spawner dispatched without setting `sea_zone_id`.
5. **Encounter-tick generates sightings, not combat**: Pirate gets intel about NPC ship. By next LLM turn, NPC has moved on.

---

### Fixes Applied (Batch 9d — Combat Auto-Initiation)

| # | Fix | File |
|---|-----|------|
| 63 | Pirates pick DISTANT ports (sort by distance DESC, pick farther half) | auto-fill-params.ts |
| 64 | Minimum 18-tick voyage duration for all routes | navigation.ts |
| 65 | attack_ship searches adjacent zones when current zone empty | combat-actions.ts |
| 66 | NPC ships get sea_zone_id set at dispatch time | vessel-spawner.ts |
| 67 | Encounter-tick AUTO-INITIATES combat (pirate/privateer vs NPC) | encounter-tick.ts |

---

### Run 16 — Post Batch 9d, Day 12

- **Result**: Combat growing (14 events by Day 12). Navy cases: 7, warrants: 4, arrests: 2, bounties: 1. FIRST FENCE TRANSACTION by Day 8. Legal pipeline fully active.
- **BUT**: Zero seized cargo in DB. All combat was NPC-vs-NPC. Pirates had `ship_id = NULL` in DB.

#### ROOT CAUSE FOUND: ship_id Never Written to DB at Seed

**Smoking gun** in harness.ts `seedAgents()`:
- Line 1059: `ship_id: null` in AgentQueries.insert()
- Line 1118: `state.shipId = shipId` — sets in-memory only
- DB never updated with ship_id

Every captain-type agent had their ship in memory but `ship_id = NULL` in the DB. Any system querying the DB (encounter detection, travel-tick, action filtering via DB queries) thought captains had no ship.

This explains ALL prior runs: the in-memory state worked (agents could sail via in-memory state) but DB-dependent systems were blind to their ships. The encounter-tick finding ships by zone via DB queries would never find agent-captained ships.

---

### Fix Applied (Batch 9e — Ship ID Write-Back)

| # | Fix | File |
|---|-----|------|
| 68 | Write ship_id to agents table after ship creation at seed | harness.ts |

```typescript
// After state.shipId = shipId;
await pool.query('UPDATE agents SET ship_id = ? WHERE id = ?', [shipId, state.id]);
```

---

### Run 17 — Post Fix 68, Day 3 Assessment

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: Day 3 (tick 72) — still running (PID 62887)
- **Result**: **CARGO SEIZURE CONFIRMED** — 2 hot cargo records with seized_from set. First time in ANY fresh run.

#### Findings at Day 3

| Metric | Run 16 (Day 4) | Run 17 (Day 3) | Assessment |
|--------|---------------|----------------|------------|
| Hot cargo | 0 | **2** | **Cargo seizure working!** |
| Seized cargo | 0 | **2** | **Transfer confirmed!** |
| Combat events | 5 | 5 | Same pace |
| Navy cases | 4 | 3 | On track |
| Bounties | 0 | **2** | Faster activation |
| Warrants | 1 | **3** | Legal pipeline active |
| Arrests | 1 | 1 | Same |
| sell_plunder chosen | 5 | 3 | Pirates attempting to fence |
| Fled crew | 0 | 0 | Stable |
| Captains with ships in DB | 0 | **34** | **Fix 68 confirmed** |

34 captains now have ship_id properly set in both DB and memory. Encounter-tick can now find pirate ships in zone queries, enabling auto-combat.

#### Day 7 Assessment

| Metric | Run 16 (Day 8) | Run 17 (Day 7) | Assessment |
|--------|---------------|----------------|------------|
| Combat events | 11 | **11** | Consistent |
| Navy cases | 7 | **10** | Faster growth |
| Warrants | 4 | **5** | Growing |
| Arrests | 2 | **3** | Growing |
| Bounties | 1 | **2** | Growing |
| Fence transactions | 1 | **2** | **Economy loop completing** |
| Hot cargo | 0 | **1** | Pipeline active |
| Seized cargo | 0 | **1** | Cargo transfer working |
| Deaths | 0 | 2 | Normal attrition |
| Fled crew | 0 | **0** | Stable |
| Pirate sail_to | 10 | **20** | More sailing |
| sell_plunder chosen | 5 | **7** | More fencing attempts |

**ECONOMY LOOP STATUS**: The full raid→seize→fence→profit cycle is completing for the first time in a clean launch. 2 fence transactions by Day 7. All major systems active: combat, cargo seizure, fencing, navy cases, warrants, arrests, bounties, weather persistence, nationality diversity, crew retention.

**Remaining concerns**:
- Pirates avg -112g (spending faster than earning — fence payouts need to increase or expenses decrease)
- Privateers avg -2g (borderline)
- Haven investments still 0 (pirates need positive cash first)
- Only 1 at_sea at snapshot (but 20 sail_to actions shows pirates ARE sailing, they're just docked at time of query)
- lay_low still 18 vs sail_to 20 — close, could nudge more sailing

### Files Modified Across All Batches (9-9e)

| File | Batch | Changes |
|------|-------|---------|
| src/strategy/auto-fill-params.ts | 9, 9d | Smart cargo selection; pirates pick distant ports |
| src/engine/actions/trade-actions.ts | 9 | Dynamic buy qty, margin scoring, smart sell |
| src/db/seed.ts | 9 | Fence records at 11 ports; weather table name fix |
| src/strategy/action-filter.ts | 9, 9c | sell_plunder pirate-type gate; attack_ship always for pirates at sea |
| src/engine/fence-network.ts | 9, 9b | Availability roll removed; min 1g payout; tick param |
| src/sim/harness.ts | 9, 9b, 9c, 9e | Salvage fix; nationality; fence seeding; force-sail; ship_id write-back |
| src/config/agents.ts | 9 | Removed desert from crew_member tools |
| src/db/queries.ts | 9 | WeatherQueries.upsert() |
| src/handlers/weather-tick.ts | 9 | DB persistence on slow ticks |
| src/engine/actions/governor-actions.ts | 9 | Self-bounty guard |
| src/world/port-consumption.ts | 9 | 60% consumption reduction, supply floor 20 |
| src/handlers/economy-tick.ts | 9 | Production cap at 500 |
| src/world/vessel-spawner.ts | 9, 9c, 9d | Loading 30%→15%, floor 20; dispatch rate 15%; sea_zone_id set |
| src/config/economy.ts | 9, 9b | Haven costs lowered; fence cuts 30/25/20/15/10% |
| src/strategy/narrative-sections.ts | 9b | sell_plunder hidden when no hot cargo; sail_to urgent for pirates |
| src/agents/name-generator.ts | 9b | LLM artifact ship name blocklist |
| src/engine/actions/trade-actions.ts | 9b | sell_plunder tick threading |
| src/engine/action-executor.ts | 9b | sell_plunder tick param |
| src/engine/actions/combat-actions.ts | 9c, 9d | DB fallback + adjacent zone search for targets |
| src/handlers/encounter-tick.ts | 9c, 9d | Every 2 ticks; auto-combat pirate vs NPC |
| src/config/regions.ts | 9c | Zone encounter rates boosted 50-100% |
| src/handlers/travel-tick.ts | 9c | Ship sea_zone_id updated during travel |
| src/engine/navigation.ts | 9d | Minimum 18-tick voyage duration |

---

### Fixes Applied (Batch 10 — Economy Fixes from Run 17 Deep Dive)

Crash interrupted mid-fix after Run 17 Day 9. Three of four fixes were incomplete. Wage fix survived the crash.

#### Fix 69: force_sail Passes Real Destination
- **harness.ts**: Changed `applyDecision(sa, 'sail_to', ...)` to `applyDecision(sa, autoFillParams('sail_to', sa.state, this.getWorldState(tick)), ...)`
- **Root cause**: force_sail passed `'sail_to'` as a raw string → `applyDecision` set params to `{}` → `executeSailTo` got no destination → "Invalid destination" on all 67 attempts in Run 17
- **Expected outcome**: Force-sail now picks a real destination via `pickDestination()`. Port-camping pirates will actually leave port.

#### Fix 70: invest_haven Defaults to Hideout (150g)
- **auto-fill-params.ts**: invest_haven now sets `haven_type: 'hideout'` (150g) instead of defaulting to tavern (800g)
- **Root cause**: Auto-fill only set `port`, never `haven_type` → haven-actions.ts defaulted to `'tavern'` (800g) → every attempt failed "Insufficient funds (need 800)"
- **Expected outcome**: Pirates with 150g+ can invest in hideouts

#### Fix 71: Fence Tier Advancement
- **fence-network.ts**: After updating fence trust, checks if `newTrust >= nextTierConfig.minTrust` and calls `FenceQueries.updateTier()` to promote
- **Root cause**: `updateTier()` existed but was never called from anywhere. Fences permanently stuck at tier 1 (30% cut)
- **Expected outcome**: Tier 2 at trust 20 (25% cut), tier 3 at trust 40 (20% cut), etc. Better payouts over time.

#### Fix 72: Wage Drain Halved
- **economy.ts**: `baseWagePerTick` changed from 1.0 to 0.5
- **Root cause**: 15-crew pirate burned 180g/day in wages vs ~45g total fence income across entire Run 17. Income/expense ratio was 0.4%.
- **Expected outcome**: Wage burden halved. Combined with higher fence payouts from tier advancement, pirates should break even.

### Files Modified in Batch 10

| File | Changes |
|------|---------|
| src/sim/harness.ts | force_sail calls autoFillParams for real destination |
| src/strategy/auto-fill-params.ts | invest_haven → hideout (150g) |
| src/engine/fence-network.ts | Tier advancement after trust update |
| src/config/economy.ts | baseWagePerTick 1.0 → 0.5 |

### Batch 10 Cascade Predictions

```
Fix 69 (force_sail works) ──→ Port-camping pirates actually sail
                            ──→ More time at sea ──→ more encounters ──→ more combat
                            ──→ More cargo seized ──→ more fence opportunities

Fix 70 (hideout at 150g) ──→ Pirates with 150g+ invest
                           ──→ First haven investments in project history
                           ──→ Safe house mechanic activates

Fix 71 (tier advancement) ──→ Fence cut drops 30%→25%→20% as trust grows
                            ──→ Pirate fence income rises 15-40%
                            ──→ Compounds with Fix 72 wage reduction

Fix 72 (half wages) ──→ Break-even point drops from ~360g/day to ~180g/day
                      ──→ Successful fence sales can now cover expenses
                      ──→ Pirates achieve positive cash flow

Combined: Pirates sail more → capture more → fence at better rates → spend less on wages
= sustainable pirate economy should emerge
```

---

### Run 18 — Post Batch 10, Day 9 Assessment

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: Day 9 (tick ~216) — still running
- **Result**: Best run yet. All economy loops activating. Fence tier advancement confirmed.

#### Findings at Day 9

| Metric | Run 17 (Day 9) | Run 18 (Day 9) | Assessment |
|--------|---------------|----------------|------------|
| Deaths | 2 | 4 (4%) | Normal |
| Imprisoned | — | 5 | Active legal system |
| Combat events | 11 | **71** | **6.5x improvement** |
| Hot cargo (living owners) | 1 | **8** | Pipeline healthy |
| Fence transactions | 2 | **4** (340g total) | Growing |
| Navy cases | 10 | **24** | 2.4x growth |
| Bounties | 2 | **11** | 5.5x growth |
| Fence tier advancement | — | **Havana → tier 2** | **Fix 71 confirmed** |
| Merchant avg cash | 700g | 760g | Stable positive |
| Pirate avg cash | -112g | -98g | Still negative but improving |
| sell_plunder attempts | 7 | 22 (4 successful) | Pirates trying more often |

#### Fence Pipeline Detail

- 22 sell_plunder attempts, 4 successful
- 18 failed with "No plunder to sell" — pirates try before acquiring cargo
- Best single transaction: Cudjoe Blackwater fenced 3 lots for **265g** at Petit-Goave
- Havana fence advanced to tier 2 (trust 32, 25% cut) — **first tier advancement ever**

#### Remaining Concerns

1. **Pirate avg cash still -98g** — wages drain ~90g/day (halved from 180), fence income averaging ~38g/day. Gap closing but not yet positive.
2. **sell_plunder "No plunder" rate 82%** — pirates attempt to fence when they have no hot cargo. The nudge may be too aggressive, wasting cooldowns.
3. **Haven investments still 0** — pirates need sustained positive cash to reach 150g threshold.
4. **0 at_sea at snapshot** — pirates sail but arrive quickly. Force-sail fix not yet validated (need more time).

---

### Run 19 — Post Batch 10, 180 Days Complete

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: Full 180 days, 4320 ticks, 43,998 decisions, 0 skipped, ~7.9 hours runtime
- **Result**: Legal pipeline fully mature. Economy broken by 3 critical bugs. 35% mortality.

#### Final State at Day 180

| Metric | Value | Assessment |
|--------|-------|------------|
| Deaths | 35 (35%) | HIGH — disease dominant |
| Imprisoned | 2 | Normal |
| At sea | 6 | Low |
| Combat events | 250 (collapsed 77→4 over 6 months) | Front-loaded, then exhausted |
| Fence transactions | 3 (44g total) | BROKEN |
| Navy cases | 115 (30 convicted, 61 dismissed) | Fully active |
| Bounties | 87 (74 claimed, 34,350g) | Fully active |
| Warrants | 69 | Active |
| Arrests | 38 | Active |
| Haven investments | 9 (all hideouts) | Stalled |
| Relationships | 1,427 | Rich social fabric |
| Intel records | 2,722 | Active with decay |
| Reputation records | 702 | Active |
| Letters of marque | 80 | Active |
| Pardons | 151 | Active |
| Total decisions | 43,998 (95.3% LLM) | Clean |

#### Agent Cash at End

| Type | Avg Cash | Count |
|------|----------|-------|
| Tavern keeper | 1,570 | 6 |
| Port governor | 1,453 | 5 |
| Informant | 1,165 | 6 |
| Pirate hunter | 930 | 5 |
| Surgeon | 817 | 6 |
| Merchant captain | -23 | 6 |
| Pirate captain | -266 | 5 |
| Privateer captain | -307 | 4 |

#### Three Critical Bugs Found

**Bug 1: Merchants Can't Trade (SHOWSTOPPER)**
`action-filter.ts:61-67` — switch fall-through grouped `trade_cargo`, `buy_cargo`, `sell_cargo` with `sell_plunder`, gating ALL to pirate/privateer/hunter types. Merchants made ZERO trade actions in 43,998 decisions. They just sailed aimlessly, fled, and surrendered. This killed the entire economy — merchants ended at -23g avg.

**Bug 2: Zombie Deaths**
`prisoners.ts` — `ransomPrisoner()`, `recruitPrisoner()`, and `releasePrisoner()` set agent status to `in_port`/`at_sea` without checking if agent is dead. Fernando Torres died **21 times** (resurrected by prisoner release → disease tick kills again → repeat). 100 death events for 35 unique agents.

**Bug 3: Seized Cargo Always Quantity 0**
All 45 seized cargo records had quantity=0. Two causes:
1. Combat transferred empty cargo rows (qty already 0 from NPC arrival unloading or prior salvage)
2. Salvage system zeroed cargo from dead agents every 3 days — since 35% of agents died, all seized cargo got salvaged before fencing

#### Secondary Issues

- **Combat collapse**: 77 events in Days 1-30 → 4 events in Days 151-180. Ships took hull damage faster than repair. All surviving captains had hull 1-5 and were permanently grounded.
- **Wound stacking**: Crew member Carlos Salazar accumulated 122 wounds (severity 259). No cap on wound creation. Fix 73 (max 5) already coded.
- **Naval officer passivity**: 41.6% passive actions (lay_low + do_nothing). Most passive agent type.
- **All bounties from England**: 87/87 bounties posted by England. No other nation's authorities post bounties.
- **Disease dominance**: 75% of deaths from disease, 25% from combat. Port natural healing (0.5/tick) can't keep up with wound accumulation.

#### What Worked Well

- **Role differentiation**: Each agent type has distinct action patterns. Crew drink/gamble/fight. Fences set prices/bribe. Harbor masters inspect/collect. Tavern keepers serve/broker.
- **Legal pipeline**: 115 cases, 33% pirate conviction rate, 42% privateer conviction rate. Merchants/naval always acquitted.
- **Social systems**: 1,427 relationships with meaningful fondness/trust/fear/rivalry distributions.
- **Nationality diversity**: Spanish 30, African 25, English 19, Dutch 17, French 9. 17% female.
- **Force-sail**: 708 system overrides broke port-camping pattern.

---

### Fixes Applied (Batch 11 — Economy, Zombie Deaths, Combat Survival)

#### Fix 73: Wound Cap (max 5 active wounds per agent)
- **crew-actions.ts**: New `insertWoundCapped()` — checks active wound count before inserting. All 4 wound insert points use it.
- **disease-tick.ts**: Both port and at-sea disease paths check `activeWounds.length < 5`.
- Max 5 wounds = max severity 15 at sev 3 — well below death threshold of 30.

#### Fix 74: Merchant Trade Gate
- **action-filter.ts**: Separated `trade_cargo`/`buy_cargo`/`sell_cargo` from `sell_plunder`. Trade actions now available to `merchant_captain`, `pirate_captain`, `privateer_captain`, `pirate_hunter`. `sell_plunder` remains pirate-type only.
- **Root cause**: Switch fall-through locked merchants out of ALL trading for 180 days.

#### Fix 75: Zombie Death Guard
- **prisoners.ts**: Added `if (prisoner.status === 'dead') return` guard at top of `ransomPrisoner()`, `recruitPrisoner()`, and `releasePrisoner()`. Dead agents can no longer be resurrected by prisoner processing.

#### Fix 76: Skip Empty Cargo on Seizure
- **combat.ts**: Added `if (cargo.quantity <= 0) continue` before `transferSeized()`.
- **combat-engagement.ts**: Same guard on both attacker→defender and defender→attacker cargo transfer paths.
- Prevents polluting DB with qty-0 seized records that confuse fence pipeline.

#### Fix 77: Passive Hull Repair for Docked Ships
- **harness.ts**: Every slow tick, docked ships with hull < 70 gain +3 hull (cap 70). Ships at hull 5 reach 70 in ~5.5 game days.
- **Root cause**: Combat collapse — ships took damage faster than agents repaired. All captains ended with hull 1-5, permanently grounded. No passive recovery existed.
- Need a shipwright (paid repair) for hull 70→100. This creates economic demand for shipwright services.

### Files Modified in Batch 11

| File | Changes |
|------|---------|
| src/engine/actions/crew-actions.ts | insertWoundCapped() helper, 4 call sites updated |
| src/handlers/disease-tick.ts | Wound cap check (< 5) on both port and at-sea disease paths |
| src/strategy/action-filter.ts | Separated trade actions from sell_plunder, merchants can trade |
| src/engine/prisoners.ts | Dead-check guard on ransom/recruit/release |
| src/engine/combat.ts | Skip qty-0 cargo on seizure |
| src/engine/combat-engagement.ts | Skip qty-0 cargo on both transfer paths |
| src/sim/harness.ts | Passive hull repair +3/slow tick for docked ships (cap 70) |

### Batch 11 Cascade Predictions

```
Fix 73 (wound cap) ──→ Agents survive longer (max severity 15 vs death at 30)
                     ──→ Pirates live to fence cargo
                     ──→ Crew members stop dying from 100+ wounds

Fix 74 (merchants trade) ──→ Merchants buy/sell cargo at ports
                           ──→ Gold circulates through economy
                           ──→ More cargo on merchant ships → richer prizes
                           ──→ Port supplies replenished → production meaningful

Fix 75 (no zombies) ──→ Death events drop from 100 to ~35
                      ──→ Disease tick processes fewer agents
                      ──→ Cleaner mortality data

Fix 76 (skip empty cargo) ──→ Only real cargo transferred on seizure
                            ──→ Seized cargo has qty > 0
                            ──→ sell_plunder finds actual goods to fence

Fix 77 (passive repair) ──→ Damaged ships recover to hull 70 in ~5 days
                          ──→ Combat captains return to sea
                          ──→ Combat rate stays steady instead of collapsing
                          ──→ More encounters → more cargo seized

Combined: Merchants trade → cargo flows → pirates seize real cargo → survive to fence
         → income exceeds expenses → haven investments activate
         = FULL ECONOMY LOOP should finally sustain across 180 days
```

---

### Run 20 — Post Batch 11, Day 168 Assessment (sim still running at tick 4037)

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: Day 168 (tick 4037) — near completion
- **Result**: Best structural run ever. Combat sustained. Legal pipeline massive. But economy still broken beneath the surface.

#### Key Metrics at Day 168

| Metric | Run 19 (180d) | Run 20 (168d) | Assessment |
|--------|--------------|---------------|------------|
| Deaths | 35 (35%) | 12 (12%) | Wound cap working |
| Combat events | 250 (collapsed 77→4) | 303 (sustained 72→52→48→54→56→21) | **Combat never collapsed** |
| Fence transactions | 3 (44g) | 27 (2,878g) | **65x more fence income** |
| Navy cases | 115 | 311 (123 convicted) | Strongest legal system ever |
| Haven investments | 9 | 22 (19 agents, 8 ports) | Active |
| Bounties | 87 | 48 (24 claimed) | Active |
| Fence max tier | 1 | 3 (avg trust 43.6) | Tier advancement working |
| Relationships | 1,427 | 1,713 | Richer |
| Ships sunk | 1,473 (73%) | 1,057 (64%) | Still high attrition |

#### Deep Dive: False Positives Discovered

1. **"27 fences for 2,878g" is a drop in the bucket** — every fencing agent is deeply in debt (Marcos Herrera: 715g earned, -1,516g cash)
2. **Haven investments generate zero income** — all hideouts at income_per_tick = 0.00 in DB (config was 0, not a DB read bug)
3. **Trade logs contain zero price/quantity data** — 200 events with no financial details
4. **6 merchant captains wrongfully convicted** — navy cases opened on merchants with hot cargo
5. **Bounty system is one naval officer (Maarten Dekker) posting 67% of all bounties** — on dead agents, merchants, and fellow officers
6. **Non-combatants stacking 5 wounds** — tavern keepers, surgeons, governors all wound-capped with 0% healing

#### Root Causes Identified

1. **Crew wages extinction event**: 45-crew sloop costs 22.5g/tick in wages. Average fence haul: 280-700g. Expense:income ratio 19:1.
2. **Merchants hold all hot cargo**: Navy/hunters attack merchants (no target-type validation). Defending merchants get "stolen" heat stamped on captured cargo.
3. **Natural healing broken**: Double-update bug in disease-tick — worsening write clobbers healing write. Severity passes 4.0 permanently disabling natural recovery.
4. **Zombie deaths**: 65 death events for 12 unique agents. 9 resurrection paths found (travel-tick, imprisonment release, combat engagement).
5. **Infamy pegged at 100**: Decay rate 0.1/tick vs +5-15 per combat event. All pirates permanently at cap.
6. **Captured ships in limbo**: 86 NPC ships stuck in "captured" status, never recycled.

---

### Fixes Applied (Batch 12 — Economy, Combat Targeting, Death Guards, Healing)

#### Fix 78: Crew Wages Slashed 80%
- **economy.ts**: `baseWagePerTick` 0.5 → 0.1. 45-crew sloop costs 4.5g/tick instead of 22.5g/tick. A single fence haul (280-700g) now covers 60-150 ticks of wages.

#### Fix 79: Conditional Heat on Cargo Transfer
- **combat-engagement.ts**: Both cargo transfer paths (defender surrenders, attacker surrenders) now check if the seizure constitutes piracy. Heat only applied when attacker/winner is `pirate_captain` or `privateer_captain`. Merchants defending themselves keep cargo with original heat (usually 0).
- **combat.ts**: Same conditional heat logic for NPC auto-combat path.

#### Fix 80: Navy/Hunter Target Validation in Action Filter
- **action-filter.ts**: `attack_ship`/`board_ship`/`engage_ship` now returns `false` for merchants (they have no combat tools anyway). Navy/hunters can attack but only if ships are visible in zone.

#### Fix 81: Zombie Death Guards
- **disease-tick.ts**: Added `if (agent.status === 'dead') continue` at top of agent loop.
- **decay-tick.ts**: Captain death from ship rot checks `captain.status !== 'dead'` first.
- **combat-engagement.ts**: Ship sinking death paths check agent not already dead.
- **harness.ts**: `syncCombatEngagements` only counts death on first detection (`sa.state.status !== AgentStatus.DEAD`).

#### Fix 82: Haven Hideout Income
- **economy.ts**: Hideout `incomePerTick` 0 → 2. Haven-tick reads from config (not DB), so all 22 existing hideouts immediately earn 2g/tick/level.

#### Fix 83: Arrival Cooldown Reset
- **harness.ts**: `syncArrivedAgents` now sets `nextActionTick = min(current, currentTick + 2)`. Agents act within 2 ticks of docking instead of sitting idle 10-20 ticks.

#### Fix 84: sell_plunder Restricted to Pirate Types
- **action-filter.ts**: Removed `merchant_captain` and `naval_officer` from sell_plunder gate. Only `pirate_captain`, `privateer_captain`, `pirate_hunter` can fence.

#### Fix 85: Natural Healing Double-Update Bug
- **disease-tick.ts**: Merged worsening and natural healing into single code path with one DB write per wound. Natural healing now triggers for untreated wounds with severity <= 5 (was 4). Mild worsening (+0.01/tick) still happens but healing (+0.5/tick) outpaces it. Severe untreated wounds still worsen normally.

#### Fix 86: Navy Case and Bounty Agent-Type Filters
- **governor-actions.ts**: `executePostBounty` query now filters `type IN ('pirate_captain', 'privateer_captain')`. No more bounties on merchants or naval officers.
- **navy-tick.ts**: `inspectDockedShips` now checks captain type — only investigates `pirate_captain`, `privateer_captain`, `pirate_hunter`. Merchants and naval officers skip inspection.

#### Fix 87: Dead Agent Resurrection Guards
- **combat-engagement.ts**: Both imprisonment paths (attacker/defender surrendered) check `status !== 'dead'` before setting imprisoned.
- **travel-tick.ts**: Ship arrival captain and crew transitions check `status !== 'dead'` before setting in_port.
- **harness.ts**: Imprisonment release loop checks DB for dead status before releasing.

#### Fix 88: Attack Target Validation for Navy/Hunters
- **combat-actions.ts**: `executeAttackShip` now filters targets for navy/hunter agents — only pirate-type captains are valid targets. NPC ships (no captain) remain valid targets.

#### Fix 89: Zero Crew Count on Sunk Ships
- **combat-engagement.ts**: `ShipQueries.updateCrewCount(shipId, 0)` called after sinking.
- **combat.ts**: Same crew zeroing in NPC combat `applyResults` sink path.

#### Fix 90: Infamy Decay Rate Increased 5x
- **decay-tick.ts**: Infamy decay 0.1 → 0.5 per tick. A +5 merchant_attack event now decays in 10 ticks instead of 50. Pirates can meaningfully drop from infamy 100.

#### Fix 91: Recycle Captured NPC Ships
- **harness.ts**: Salvage cycle now also finds captured ships with no living captain, resets them to `docked` with hull 50, crew 0, captain NULL. Vessel spawner can reuse them.

### Files Modified in Batch 12

| File | Fix # | Changes |
|------|-------|---------|
| src/config/economy.ts | 78, 82 | Wages 0.5→0.1; hideout income 0→2 |
| src/engine/combat-engagement.ts | 79, 81, 87, 89 | Conditional heat; death guards on sinking + imprisonment; crew zero on sink |
| src/engine/combat.ts | 79, 89 | Conditional heat for NPC combat; crew zero on sink |
| src/strategy/action-filter.ts | 80, 84 | Combat restricted for merchants; sell_plunder pirate-only |
| src/handlers/disease-tick.ts | 81, 85 | Dead agent skip; single-write healing with natural recovery fix |
| src/handlers/decay-tick.ts | 81, 90 | Dead captain guard; infamy decay 0.1→0.5 |
| src/sim/harness.ts | 81, 83, 87, 91 | Death counter fix; arrival cooldown; imprisonment dead check; NPC ship recycling |
| src/engine/actions/governor-actions.ts | 86 | Bounty targets pirate/privateer only |
| src/handlers/navy-tick.ts | 86 | Ship inspection skips non-pirate captains |
| src/engine/actions/combat-actions.ts | 88 | Navy/hunter attack targets pirate-types only |
| src/handlers/travel-tick.ts | 87 | Dead agent guard on arrival status transition |

### Batch 12 Cascade Predictions

```
Fix 78 (wages 80% cut) ──→ 45-crew pirate costs 4.5g/tick instead of 22.5g
                          ──→ Single fence haul covers 60-150 ticks of wages
                          ──→ Pirates can accumulate cash
                          ──→ Haven investments become reachable

Fix 79 (conditional heat) ──→ Merchants no longer accumulate hot cargo
                            ──→ Hot cargo only on actual pirates
                            ──→ sell_plunder more meaningful (real stolen goods)

Fix 80+84+88 (targeting) ──→ Navy stops attacking merchants
                           ──→ Merchants survive to trade
                           ──→ More cargo at sea for pirates to raid
                           ──→ Merchant cash trends positive

Fix 81+87 (zombie death) ──→ Clean death counts (12 events for 12 agents)
                           ──→ No resurrection loops
                           ──→ Mortality data trustworthy

Fix 82 (haven income) ──→ 22 hideouts earn 2g/tick each = 44g/tick passive income
                        ──→ Investors see return on capital
                        ──→ Motivates warehouse/tavern investment (5-15g/tick)

Fix 85 (healing) ──→ Mild diseases (sev ≤ 5) heal naturally in port
                   ──→ Non-combatants stop stacking to wound cap
                   ──→ Fewer disease deaths overall

Fix 86 (legal targeting) ──→ No more wrongful convictions of merchants
                           ──→ Bounties on actual pirates only
                           ──→ Legal system credible

Fix 90 (infamy decay) ──→ Infamy not permanently 100
                        ──→ Pardons meaningful (infamy drops)
                        ──→ Reputation system dynamic

Fix 91 (ship recycling) ──→ 86 captured ships return to pool
                          ──→ More NPC ships at sea
                          ──→ More targets for pirates

Combined: Cheaper crew × more merchant ships × navy stops friendly fire
         × working healing × legal accuracy × haven income
         = sustainable pirate economy + healthy agent population
```

---

### Run 23 — Post Batch 12, 180 Days Complete (10 agents)

- **Config**: 10 agents, 180 days, vLLM Qwen 3.5-4B
- **Duration**: Full 180 days, 4320 ticks, 5,661 decisions, 50 skipped, ~1.6 hours runtime
- **Result**: Structural validation at small scale. Combat sustained. Legal pipeline active. BUT deep dive revealed 10+ false positives.

#### False Positives Discovered (Deep Dive)

**ECONOMY-BREAKING:**

1. **buy_vessel never syncs in-memory state** — `applyDecision` in harness.ts had handlers for `sail_to`, `desert`, `surrender`, etc. but NONE for `buy_vessel`. After purchase, DB has `ship_id` set but `sa.state.shipId` stays null. Consequences: (a) action filter keeps offering `buy_vessel` → agents buy unlimited ships (Quaco owned 10 shallops), (b) all ship-dependent actions fail → merchants can never trade after buying replacement ships.

2. **patrol_region has no ship check** — `executePatrolRegion` pays 50g stipend without checking `agent.shipId`. Pedro Salazar accumulated 8,160g and Cudjoe Ironhand 6,544g from phantom patrols with no ship, no crew, no expenses. Uncapped money printer.

3. **sell_intel has no buyer/counterparty** — `executeSellIntel` adds 10g to informant with no buyer deduction. Bram de Vries minted 2,339g from 336 self-paying intel sales. Pure inflation.

4. **Zero-damage combat from tick 888+** — `calculateFirepower` returns `guns * (hull/100) * powderFactor`. Ships with hull < 5 produce firepower < 1, `Math.floor()` truncates to 0. Every broadside deals 0 damage to both sides while still producing combat outcome events.

**SYSTEM INTEGRITY:**

5. **19 "cargo seized" events, 0 actual cargo transferred** — All 15 seized cargo records had quantity=0. Root cause: NPC ships unload cargo on arrival (travel-tick:184 `updateQuantity(c.id, 0)`) before combat can seize it. Cargo transfer code correctly checks `quantity > 0` and skips, but the records still get created via transferSeized with the original quantity already zeroed. Note: some qty-0 records are from salvage zeroing dead pirate cargo.

6. **54/57 "repelled" event descriptions are lies** — Event says "repelled" but 95% of those victim ships are actually sunk. The event label was determined before `applyResults` checked hull status.

7. **Bounty expiration never fires** — expires_tick is stored but no handler checks it. Both bounties 1500+ ticks past expiry, both targets dead, poster dead, still "active".

8. **Navy convictions have no gameplay consequence** — Sambo convicted 4 times, never imprisoned. Convictions are record-keeping only.

9. **Pardons are inert documents** — 22 pardons at created_tick=0, no effect on infamy. Governor's `executeGrantPardon` DOES reduce infamy, but these 22 were seeded documents, not action results.

10. **agents.infamy vs reputation.infamy out of sync** — Two parallel tracking systems. agents.infamy=0 while reputation.infamy=88 for same agent.

11. **Dead agents produce intel** — intel-tick generates sightings for dead captains' ships (no status check).

12. **Fever permanently incurable** — 11/11 fevers at severity 10, stuck at 0% healing. Natural healing threshold was severity <= 5, no surgeon ever treats.

---

### Fixes Applied (Batch 13 — False Positive Corrections)

#### Fix 92: buy_vessel In-Memory State Sync
- **harness.ts**: Added `buy_vessel` handler in `applyDecision` — sets `sa.state.shipId` from `result.data.shipId` on success
- **Root cause**: All other state-changing actions had sync handlers (sail_to, desert, arrest, join_crew) but buy_vessel was missing
- **Expected outcome**: Replacement captains can use their purchased ships. No more infinite ship buying.

#### Fix 93: Patrol Requires Ship
- **naval-actions.ts**: Added ship check at top of `executePatrolRegion`. Shipless officers get 5g desk stipend instead of 50g patrol stipend.
- **Root cause**: No `agent.shipId` guard. Officers collected full pay with zero expenses.
- **Expected outcome**: Naval officers earn 5g/patrol without ship (90% reduction). Still incentivized to acquire ships.

#### Fix 94: sell_intel Requires Buyer
- **intel-actions.ts**: `executeSellIntel` now requires a non-informant agent at the same port. Buyer pays, seller receives. Price capped at 5g (was 10g default). Fails with "No one at this port to buy intel" if no buyers present.
- **Root cause**: One-sided transaction minted gold from nothing.
- **Expected outcome**: Intel sales are real transactions. Informant income depends on port traffic.

#### Fix 95: Combat Minimum Damage Floor
- **combat.ts**: `calculateFirepower` now floors hull factor at 10% and returns minimum 1 for armed ships. Broadside damage floors at 1 per round for armed ships.
- **Root cause**: `guns * (hull/100)` produced < 1 for low-hull ships, `Math.floor()` truncated to 0. From tick 888+ all combat was zero-damage theater.
- **Expected outcome**: Every round of combat does at least 1 hull damage per side. Engagements always resolve.

#### Fix 96: Bounty Expiration Processing
- **decay-tick.ts**: Added bounty expiration check after intel decay. Expires bounties past `expires_tick` AND bounties on dead targets.
- **Root cause**: `expires_tick` stored but never checked. No handler existed.
- **Expected outcome**: Stale bounties expire. Dead-target bounties cleared.

#### Fix 97: Dead Agent Intel Guard
- **intel-tick.ts**: Added `isCaptainDead()` check with per-tick cache. Sightings and manifests skip dead captains.
- **Root cause**: No status check on `captain_id` before generating intel.
- **Expected outcome**: Dead agents stop generating phantom intel.

#### Fix 98: Severe Wound Natural Recovery in Port
- **disease-tick.ts**: Added healing path for untreated wounds severity 6-10 in port. +1 progress/tick (vs +2 for mild). 2% chance per tick to reduce severity. Takes 100 ticks (~4 game days) to fully heal.
- **Root cause**: Natural healing threshold was <= 5. Fevers at severity 6-10 could never heal without surgeon treatment that never came.
- **Expected outcome**: Port fevers slowly resolve. Still slower than surgeon treatment. Disease remains meaningful but not permanently crippling.

#### Fix 99: agents.infamy Synced from Reputation Table
- **decay-tick.ts**: After reputation drift, queries max infamy per agent across all zones and writes back to `agents.infamy`.
- **Root cause**: Two separate infamy tracking systems (agents table, reputation table) never synchronized.
- **Expected outcome**: `agents.infamy` always reflects the max zone infamy. Bounty targeting, narrative prompts, and action filters see consistent data.

#### Fix 100: Healed Wound Cleanup
- **disease-tick.ts**: Every 24 ticks, deletes wounds with `healing_progress >= 100`. Prevents wound record bloat.
- **Root cause**: Healed wounds accumulated forever. One agent had 51 wound records.
- **Expected outcome**: Wound table stays lean. Only active wounds persist.

#### Fix 101: Accurate Combat Event Descriptions
- **combat.ts**: After combat resolution, checks defender ship status. Uses "sunk" label if defender hull <= 0 or status is sunk, instead of misleading "repelled".
- **Root cause**: Event description determined before checking actual outcome.
- **Expected outcome**: Event descriptions match reality. "Sunk" when sunk, "repelled" only when defender survived.

### Files Modified in Batch 13

| File | Fix # | Changes |
|------|-------|---------|
| src/sim/harness.ts | 92 | buy_vessel in-memory shipId sync in applyDecision |
| src/engine/actions/naval-actions.ts | 93 | Ship check in patrol_region; desk stipend 5g fallback |
| src/engine/actions/intel-actions.ts | 94 | sell_intel buyer requirement, price cap 5g, buyer pays |
| src/engine/combat.ts | 95, 101 | Firepower floor 10% + min 1; broadside min 1 damage; accurate event labels |
| src/handlers/decay-tick.ts | 96, 99 | Bounty expiration processing; agents.infamy sync from reputation |
| src/handlers/intel-tick.ts | 97 | Dead captain guard with per-tick cache |
| src/handlers/disease-tick.ts | 98, 100 | Severe wound natural recovery in port; healed wound cleanup |

### Batch 13 Cascade Predictions

```
Fix 92 (buy_vessel sync) ──→ Replacement captains use their ships
                           ──→ Merchants trade after losing original ship
                           ──→ Pirates sail and raid after ship loss
                           ──→ No more infinite ship buying (10 shallops → 1)

Fix 93 (patrol ship check) ──→ Shipless officers earn 5g not 50g
                             ──→ 90% income reduction for grounded officers
                             ──→ Officers incentivized to get ships

Fix 94 (sell_intel buyer) ──→ Informant income capped by port traffic
                            ──→ Gold no longer minted from nothing
                            ──→ Buyer agents spend gold → money circulates

Fix 95 (min damage) ──→ Every combat round produces real damage
                      ──→ Engagements resolve in finite rounds
                      ──→ No more zero-damage theater

Fix 96 (bounty expiry) ──→ Stale bounties clear automatically
                         ──→ Dead-target bounties removed
                         ──→ Bounty system stays clean

Fix 97 (dead intel) ──→ No phantom sightings of dead captains
                      ──→ Intel system reflects living world only

Fix 98 (fever healing) ──→ Port fevers heal in ~4 game days
                         ──→ No more permanently crippled agents
                         ──→ Disease meaningful but not permanent

Fix 99 (infamy sync) ──→ agents.infamy matches reputation.infamy
                       ──→ Bounty targeting consistent
                       ──→ Narrative prompts accurate

Fix 100 (wound cleanup) ──→ Wound table stays small
                          ──→ Disease queries faster

Fix 101 (event labels) ──→ "Sunk" when sunk, "repelled" when survived
                         ──→ Event data trustworthy for analysis
```

---

### Fixes Applied (Batch 14 — Config, Cargo, Combat, Prompting)

#### Fix 102: Cargo Seizure Preserved on NPC Arrival
- **travel-tick.ts**: Added `&& !c.seized_from` guard on NPC ship unload. Seized cargo no longer zeroed when NPC attacker ship docks.
- **Root cause**: NPC ships that won combat had seized cargo on board. On arrival, ALL cargo was zeroed and added to port supply — including plunder.
- **Result in Run 38**: 2 of 52 seized records had qty>0 (was 0 of 50 in Run 37). Partial fix — salvage is the remaining zeroing path (see Fix 117).

#### Fix 103: maxContext 1024→2048
- **providers.ts**: Updated local vLLM config to `maxContext: 2048`. Comment updated to reflect Qwen 3.5-9B model.
- **Root cause**: Config said 1024 but vLLM was serving with max_model_len=2048.

#### Fix 104: TOKEN_BUDGET 3500→1400
- **narrative-prompt.ts**: Changed `TOKEN_BUDGET = 3500` to `TOKEN_BUDGET = 1400` with comment explaining math (2048 context - ~120 system - ~16 output - ~500 buffer).
- **Note**: This is the backup path — harness actually uses `buildCognitivePrompt` (~1200 tokens, 5 sections). Narrative prompt is only used by `hybrid.ts`/`agent-runner.ts`.

#### Fix 105: Combat Max-Round Cap (20)
- **combat-engagement.ts**: Added `MAX_COMBAT_ROUNDS = 20` check at top of `resolveRound()`. After 20 rounds, engagement resolves as "both ships disengage."
- **Root cause**: Run 37 had a 114-round HMS Mermaid engagement (broadside↔chase infinite loop). No global round cap existed.
- **Result in Run 38**: No runaway combat loops detected. 90 combat log entries all clean.

#### Fix 106: Bounty Dead-Target Guard
- **navy-tick.ts**: `postBountiesForWarranted()` now queries target agent status before posting. Skips dead targets.
- **Root cause**: Navy-tick posted bounties from warranted cases without checking if the target was alive. 121 of 145 bounties in Run 37 targeted dead agents.
- **Result in Run 38**: 198 expired bounties on dead targets still exist (from early-run postings before targets died), but new postings should be cleaner. Further analysis needed.

#### Fix 107: Loop Breaker (3+ consecutive identical actions)
- **harness.ts**: Added loop breaker in LLM batch path — if all `recentActions` (5 entries) are identical, removes that action from options and logs `[loop-break]`.
- **harness.ts**: Fallback path (parse failure) now uses filtered `effectiveActions` instead of raw `validActions`.
- **Result in Run 38**: **DID NOT FIRE** — see Run 38 analysis below. Root cause: `shortCircuit` exits agents before they reach the loop breaker code.

#### Fix 108: Death Logging on DB Sync
- **harness.ts**: `processAgentBatch` DB sync now logs deaths with `cause: 'unknown'` when detecting status='dead' in DB.
- **Result in Run 38**: 53 death entries (vs 7 in Run 37). However, creates duplicates — 9 zombie cases where disease-tick logs death, then harness sync logs same death again.

#### Fix 109: Market Prices in Merchant Prompts
- **cognitive-prompt.ts**: Added market price section in `buildStateSection()` for merchant_captain, plantation_owner, and fence types. Shows top 3 profitable goods with buy/sell prices and availability.
- **Root cause**: Merchants had no visibility into market prices — buying blind.
- **Result in Run 38**: 1,151 trade actions by merchants (trade_cargo + buy_cargo + sell_cargo). Merchants are the most active trading type.

#### Fix 110: Coins Not Added to Port Supply via Processing
- **processing-engine.ts**: Added `if (chain.outputCargo !== 'coins')` guard before `addSupply()` in the processing loop.
- **Result in Run 38**: **PARTIAL FIX** — coins still accumulated to 72,252. See Run 38 analysis: NPC ships load coins as cargo and dump them at destination ports, bypassing the processing guard.

#### Fix 111: Ship-Required Actions Filtered
- **action-filter.ts**: `repair_ship`, `careen_ship`, `buy_provisions`, `recruit_crew` now require `!!agent.shipId`.
- **Root cause**: 436 "No ship" failures in Run 37 — shipless agents picking ship-dependent actions.

### Files Modified in Batch 14

| File | Fix # | Changes |
|------|-------|---------|
| src/handlers/travel-tick.ts | 102 | `!c.seized_from` guard on NPC cargo unload |
| src/config/providers.ts | 103 | maxContext 1024→2048, comment updated |
| src/strategy/narrative-prompt.ts | 104 | TOKEN_BUDGET 3500→1400 |
| src/engine/combat-engagement.ts | 105 | MAX_COMBAT_ROUNDS = 20, forced disengage |
| src/handlers/navy-tick.ts | 106 | Dead-target check before bounty posting |
| src/sim/harness.ts | 107, 108 | Loop breaker (ineffective); death logging on DB sync |
| src/strategy/cognitive-prompt.ts | 109 | Market prices for merchants in state section |
| src/world/processing-engine.ts | 110 | Coins skip `addSupply` in processing output |
| src/strategy/action-filter.ts | 111 | Ship-required gate on repair/provisions/recruit |

---

### Run 38 — Post Batch 14, 180 Days Complete

- **Config**: 100 agents (124 with replacements), 180 days, vLLM Qwen 3.5-9B
- **Duration**: Full 180 days, 4320 ticks, 41,391 decisions, 0 skipped, ~7.7 hours runtime
- **Result**: Errors down 97.7%. Combat healthy. Economy still broken beneath the surface.

#### Key Metrics

| Metric | Run 37 (Batch 13) | Run 38 (Batch 14) | Assessment |
|--------|-------------------|-------------------|------------|
| Deaths | 37 (44%) | 42 (34%) | Better but still high |
| Errors | 560 | **13** | **97.7% reduction** |
| Combat events | 582 | **625** | Sustained, never collapsed |
| Fence transactions | 62 | **71** | Improving |
| Fence total income | ~? | **~8,448g** | First measurable total |
| Navy cases | 136 | 146 | Stable |
| Bounties | 145 | **377** | Inflated (dead targets) |
| Executions | 1 | **3** | Legal going to completion |
| Haven investments | 4 | **8** | Double (all investors died) |
| Seized cargo qty>0 | **0/50** | **2/52** | Fix 102 partial success |
| Death log entries | 7 | **53** | Fix 108 working |
| Combat max tier | — | Clean (no loops) | Fix 105 working |
| Parse errors | 560 | **13** | 9B model much better |

#### Combat Over Time

| Period | Events |
|--------|--------|
| Day 1-30 | 173 |
| Day 31-60 | 142 |
| Day 61-90 | 119 |
| Day 91-120 | 63 |
| Day 121-150 | 64 |
| Day 151-180 | 64 |

Combat tapers from 173→64 but never collapses (Run 19 went 77→4). Passive hull repair keeping ships serviceable.

#### Agent Cash at End (Living)

| Type | Avg Cash | Count |
|------|----------|-------|
| Pirate hunter | 8,932 | 3 |
| Tavern keeper | 3,583 | 7 |
| Harbor master | 2,856 | 6 |
| Port governor | 2,665 | 7 |
| Surgeon | 1,033 | 6 |
| Informant | 893 | 7 |
| Naval officer | 747 | 3 |
| Plantation owner | 536 | 6 |
| Quartermaster | 350 | 7 |
| Shipwright | 297 | 6 |
| Crew member | 94 | 7 |
| Privateer captain | 25 | 4 |
| Fence | 6 | 7 |
| Merchant captain | 4 | 3 |
| **Pirate captain** | **-641** | **3** |

#### Five Systemic Failures Found

##### Failure 1: Coins-as-Commodity (72,252 in supply)

Fix 110 blocked coins from processing output, but coins enter via 3 other paths:
1. **NPC ships load coins as cargo** (vessel-spawner.ts) — no filter on cargo type
2. **NPC ships unload coins at destination** (travel-tick.ts:183) — no coins check
3. **Seed creates coins as port supply** (seed.ts) — 100-150 per origin port

Feedback loop: coins seeded → NPC ships pick up → sail → dump at destination → NPC ships pick up again → infinite redistribution. Portobelo alone: 51,339 supply.

##### Failure 2: Loop Breaker Never Fires

Fix 107 placed the loop breaker in the LLM batch path (line 670-678). But agents like George Dampier (116 consecutive do_nothing) are caught by `shortCircuit()` at line 588-593, which returns `do_nothing` and `continue`s the agent — they never reach the LLM batch or the loop breaker. The entire anti-repeat infrastructure (force-sail, anti-repeat, loop breaker) is bypassed by short-circuit.

George Dampier's likely scenario: imprisoned or at-sea-with-no-targets → `shortCircuit` returns `do_nothing` every tick → `applyDecision` pushes to `recentActions` → but no mechanism checks `recentActions` on the short-circuit path.

##### Failure 3: Salvage Zeros Seized Cargo (50 of 52 records)

Fix 102 in travel-tick correctly prevents NPC unload from zeroing seized cargo. But the harness salvage sweep (every 3 game-days) queries all cargo owned by dead agents and zeros it — including seized cargo with `seized_from` set. Since 77% of captains die, most seized cargo gets salvaged within days of capture.

DB confirms: all 50 qty=0 seized records are owned by dead agents. The 2 with qty>0 are owned by living agents.

##### Failure 4: Death Logging Duplicates (9 zombie entries)

Fix 108 added death logging in the harness DB sync. But disease-tick ALSO logs the death. Sequence: disease-tick kills agent + logs death → next batch, harness DB sync detects status='dead' → logs again with `cause: 'unknown'`. 9 agents appear twice in deaths.jsonl.

##### Failure 5: Captain Survival Crisis (77% dead)

30 of 39 captains dead. All 8 haven investors died. Living captains nearly broke (pirates avg -641g). Root causes:
- Crew wages drain continuously (0.1/tick × crew × 4 ticks/day)
- Fence income insufficient to cover wages (avg ~228g per sale but sales are rare)
- Disease kills slowly but inexorably (wound cap 5 × avg severity 4 = 20 = at-sea death threshold)
- No passive income for captains (haven hideout income 2g/tick but all investors died)

---

### Fixes Applied (Batch 15 — Root Cause Corrections)

#### Fix 112: Coins Excluded from NPC Cargo Loading

- **vessel-spawner.ts**: Filter out `coins` from cargo type selection when NPC ships load cargo before departure.
- **Root cause**: NPC ships loaded coins as tradeable cargo, redistributed them across ports, creating infinite accumulation loop. Processing fix (110) only blocked one of 3+ entry paths.
- **Cascade**: NPC ships carry real trade goods only → port supply reflects actual production → market prices meaningful for merchants.
- **Does NOT touch**: Agent cargo, prize cargo, or seed. Coins can still exist as agent cargo from captures. Only NPC background traffic excluded.

#### Fix 113: Coins Excluded from NPC Unloading

- **travel-tick.ts**: Added `&& c.type !== 'coins'` to the NPC arrival unload guard (alongside existing `!c.seized_from`).
- **Belt and suspenders**: Even if coins somehow get onto an NPC ship (e.g., from a different code path), they won't be dumped into port supply.
- **Combined with Fix 112**: Coins can't be loaded AND can't be unloaded by NPC ships. Double guard.

#### Fix 114: Loop Breaker Moved to Short-Circuit Path

- **harness.ts**: Added `recentActions` check BEFORE `shortCircuit()`. If last 3+ actions are all `do_nothing`, the agent is NOT short-circuited — forced into the LLM path instead. This ensures imprisoned/stuck agents eventually get a real decision.
- **Specifically**: If `recentActions.length >= 3` and all are `do_nothing`, skip `shortCircuit` and push to `needsLLM`.
- **Why 3 not 5**: 5 was too strict in Fix 107. 3 consecutive do_nothings should trigger intervention.
- **Cascade**: Agents stuck in prison/at-sea get LLM decisions → LLM picks escape/negotiate/sail_to → breaks the loop.
- **Risk**: Short-circuited agents had a reason (imprisoned, no targets). Sending them to LLM may produce failed actions. Acceptable — a failed action attempt is better than 116 do_nothings.

#### Fix 115: Salvage Skips Seized Cargo

- **harness.ts**: Salvage query adds `AND c.seized_from IS NULL` to exclude seized cargo from dead-agent cleanup.
- **Root cause**: Salvage zeroed all cargo from dead agents, including plunder with `seized_from` set. 50 of 52 seized records zeroed by this path.
- **Cascade**: Seized cargo persists even when the pirate who seized it dies. The cargo remains on the ship. If another captain reclaims the ship, they inherit the plunder and can fence it.
- **Risk**: Cargo bloat from dead pirates. Mitigated by existing 3-day salvage cycle for non-seized cargo. Seized cargo will accumulate but quantity is low (2-10 records per pirate).

#### Fix 116: Death Logging Deduplication

- **harness.ts**: DB sync death path checks `sa.confirmedDead` before logging. If already confirmed dead (disease-tick or syncCombatEngagements already logged), skip the duplicate log.
- **Root cause**: Disease-tick sets status='dead' + logs death → harness DB sync sees status='dead' → logs again as 'unknown'. 9 duplicates in Run 38.
- **Exact change**: Move the `sa.confirmedDead = true` check to BEFORE the death log, and only log if transitioning from alive to dead.

#### Fix 117: `do_nothing` Removed from Pirate/Privateer at Sea

- **harness.ts**: Extended the `SKIP_DO_NOTHING` set to also apply when the agent is AT_SEA (not just in port). Pirates and privateers at sea should attack, flee, board, or sail — not idle.
- **Rationale**: In Run 38, `do_nothing` was pirates' #1 action (419 times). At sea, there is no valid reason to do nothing. The LLM picks it as a "safe default" when unsure — removing it forces a real decision.
- **Cascade**: Pirates at sea choose from attack_ship, board_ship, flee, sail_to. May increase flee rate slightly, but that's better than idling.
- **Does NOT affect**: Port behavior. Pirates in port can still lay_low, visit_tavern, etc.
- **Note**: Investigation showed `SKIP_DO_NOTHING` already removes `do_nothing` in the LLM batch. The 419 pirate do_nothings may come from `shortCircuit` path (now addressed by Fix 114) rather than LLM choice. Fix 117 is NOT implemented as a code change — the existing `SKIP_DO_NOTHING` at line 682 already covers this. The real fix is Fix 114 (loop breaker on short-circuit path).

### Files Modified in Batch 15

| File | Fix # | Changes |
|------|-------|---------|
| src/world/vessel-spawner.ts | 112 | NPC ships exclude 'coins' from cargo loading |
| src/handlers/travel-tick.ts | 113 | NPC arrival skips coins when unloading to port supply |
| src/sim/harness.ts | 114, 115, 116 | Loop breaker on short-circuit path; salvage skips seized cargo; death log dedup |
| src/world/processing-engine.ts | 110 (Batch 14) | Already blocked coins from processing output |

### Batch 15 Cascade Predictions

```
Fix 112+113 (coins blocked) ──→ NPC ships carry real goods only
                               ──→ Port supply reflects actual production
                               ──→ Portobelo/Veracruz supply drops from 51K/23K to normal
                               ──→ Market prices become meaningful
                               ──→ Merchants can profit from price differentials

Fix 114 (loop breaker on SC) ──→ Imprisoned agents get LLM decisions after 3 do_nothings
                               ──→ LLM picks escape/negotiate → breaks prison loop
                               ──→ At-sea stuck agents get sail_to/attack decisions
                               ──→ George Dampier no longer does nothing 116 times
                               ──→ Risk: failed actions from agents with no valid options
                               ──→ Acceptable: failed action > permanent inaction

Fix 115 (salvage skip seized) ──→ Seized cargo survives pirate death
                                ──→ Ship reclaim inherits the cargo
                                ──→ Next captain can fence the plunder
                                ──→ Risk: cargo record bloat from dead pirates
                                ──→ Mitigated: only seized_from rows preserved (~2-10 per pirate)

Fix 116 (death dedup) ──→ Each agent logged once on death
                        ──→ Clean mortality data
                        ──→ No zombie entries in deaths.jsonl

Combined: Coins stop flooding economy × stuck agents break free × seized cargo fenceable
         × death data clean = healthier economy loop + better agent activity + trustworthy data
```

---

### Run 39 — Post Batch 15, Day 25 Early Stop

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-9B
- **Duration**: Stopped at Day 25 for investigation (23 deaths = 22% mortality)
- **Parse failures**: 1 (down from 150 in aborted Run 39a). Fix 114 revised to exclude imprisoned agents.
- **Seized cargo**: 32 records, ALL with qty>0 — Fix 115 confirmed working perfectly (was 0/50 in Run 37)
- **Coins**: 72,211 (declining from 72,250 seed) — Fix 112+113 preventing new accumulation

#### Critical Finding: Crew Brawls Are the #1 Killer

Wound analysis of 23 dead agents: **almost all wounds are `cut` type from crew fights, not from ship combat or disease.**

- Diego Herrera: 5 cuts, total severity 21 → dead
- Antoine Le Vasseur: 3 cuts, total severity 20 → dead
- Fernando Salazar: 5 cuts, total severity 20 → dead

**Root cause**: `executeFight` (crew-actions.ts) picks a RANDOM opponent from the same port — including non-combatants (governors, surgeons, informants). Both fighters get severity-2 cuts. With wound cap of 5 and at-sea death threshold of 20, just 4 cuts at severity 5 (after worsening) kills an agent at sea.

**The wound factory**: `fight` (807 actions in Run 38) + `challenge_captain` (783 actions) = ~1,600 wound-generating actions per 180 days. Each fight wounds BOTH participants. Non-combatant port agents accumulate cuts from being randomly selected as fight targets.

**Zombie deaths persist**: Fernando Salazar dies disease tick 354, then combat tick 362. Edward Thatch dies disease tick 420, then combat tick 422. Root cause: `combat.ts` (NPC auto-combat) and `encounter-tick.ts` have NO dead-agent checks — dead captains' ships still enter zone-based combat.

---

### Fixes Applied (Batch 15b — Mortality & Zombie Deaths)

#### Fix 118: At-Sea Death Threshold Raised 20→25

- **disease-tick.ts**: Changed `const deathThreshold = isInPort ? 30 : 20` to `isInPort ? 30 : 25`.
- **From**: 20 (4 cuts at sev 5 = instant death). **To**: 25 (need 5 wounds at sev 5, which hits the wound cap).
- **Historical basis**: Caribbean sailors were tough. Surviving multiple sword cuts was common — the historical death threshold was infection/gangrene (days/weeks later), not immediate wound severity. At-sea death should require severe, untreated wounds.
- **Cascade**: Captains survive 1-2 more fights before dying → more time to heal in port → more fencing/trading before death → economy benefits.
- **Risk**: Slightly more agents alive → more LLM calls per tick → marginal slowdown.
- **Does NOT change**: Port threshold (30) stays the same. Disease severity thresholds unchanged.

#### Fix 119: Fight Opponents Limited to Peer Types

- **crew-actions.ts `executeFight`**: When picking a random opponent at port, filters to same type category. Crew fight crew. Captain types fight captain types. Port officials (governor, harbor master) are excluded from random selection.
- **From**: Any agent at same port (governors, surgeons targeted by brawling crew).
- **To**: Only agents with compatible types — crew_member fights crew_member/quartermaster. Captain types fight other captains. Tavern keepers, surgeons, informants can be targeted by anyone (they're in public spaces) but governors and harbor masters are off-limits.
- **Historical basis**: Crew fights were within the crew. A sailor wouldn't punch the port governor — that's arrest and hanging. Tavern brawls involved whoever was drinking.
- **Cascade**: Non-combatant port agents stop accumulating cuts → fewer governor/surgeon deaths → more stable port systems.

#### Fix 120: Dead-Agent Guard in NPC Combat and Encounter-Tick

- **combat.ts**: Added dead-captain check before NPC auto-combat. If either ship's captain is dead, skip combat.
- **encounter-tick.ts**: Added dead-captain check before auto-initiating combat. Dead captains' ships don't trigger encounters.
- **Root cause**: Dead agents' ships remained in sea zones. Zone-based queries found them and initiated combat. The dead captain then "died" again from combat, creating zombie death entries.
- **Cascade**: Clean death data. No zombie entries. Dead captains' ships remain in zone until reclaim/recycling handles them.

### Files Modified in Batch 15b

| File | Fix # | Changes |
|------|-------|---------|
| src/handlers/disease-tick.ts | 118 | At-sea death threshold 20→25 |
| src/engine/actions/crew-actions.ts | 119 | Fight opponent filtering by type category |
| src/engine/combat.ts | 120 | Dead-captain guard before NPC combat |
| src/handlers/encounter-tick.ts | 120 | Dead-captain guard before auto-combat |

### Batch 15b Cascade Predictions

```
Fix 118 (death threshold 20→25) ──→ Captains survive 1 more wound at sea
                                  ──→ ~20% fewer at-sea deaths
                                  ──→ More time to dock and heal
                                  ──→ More fencing/trading before death
                                  ──→ Risk: slightly more agents alive = more LLM calls

Fix 119 (fight targeting) ──→ Governors, harbor masters, plantation owners immune to brawls
                            ──→ Port officials stop accumulating cuts
                            ──→ Stable governance (governors alive to post bounties, collect taxes)
                            ──→ Surgeons, tavern keepers, informants still targetable (public spaces)

Fix 120 (dead-captain combat guard) ──→ Dead captains' ships don't fight
                                      ──→ Zero zombie deaths from NPC auto-combat
                                      ──→ Zero zombie deaths from encounter-tick
                                      ──→ Clean death logs (each agent dies exactly once)
                                      ──→ Dead ships remain in zone until recycled

Combined: Captains survive longer × officials don't die from brawls × no zombie deaths
         = lower early mortality + stable port infrastructure + trustworthy death data
```

### Also fixed in Batch 15b (harness)

- **Loop breaker revised**: Imprisoned agents no longer bypass short-circuit (they legitimately do_nothing). Only AT_SEA and IN_PORT agents with 3+ consecutive do_nothings are sent to LLM.
- **Empty action safety net**: If all filtering leaves `effectiveActions` empty, falls back to full `validActions`. Prevents empty-prompt parse failures.

---

### Run 39 — Post Batches 14+15+15b, In Progress

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-9B
- **Status**: Day 128 of 180, 28,720 decisions, 0 skipped ticks

#### Aborted Attempts

**Run 39a (Batch 15 only, no 15b)**: Stopped at Day 13. 150 parse failures — Fix 114 (loop breaker on SC path) was sending imprisoned agents to LLM with empty action lists. Fixed by excluding imprisoned agents from SC bypass + adding empty-action safety net.

**Run 39b (Batch 15 + 15b partial)**: Stopped at Day 25. 23 dead (22%) — crew brawl wounds (cuts) killing captains via at-sea threshold of 20. Fixed by raising threshold to 25 (Fix 118), filtering fight targets (Fix 119), and adding dead-captain combat guards (Fix 120).

#### Run 39c Progress (current, all fixes applied)

| Metric | Day 2 | Day 50 | Day 128 |
|--------|-------|--------|---------|
| Deaths | 0 | 22 (21%) | 43 (35%) |
| Parse failures | 0 | 3 | 21 |
| Combat events | — | 304 | 486 |
| Seized cargo qty>0 | — | 47 | 49 |
| Bounties | — | 127 | 209 |
| Executions | — | 1 | 2 |
| At sea | 22 | 12 | 3 |
| Imprisoned | 2 | 1 | 0 |

#### Batch 15b Validation

| Fix | Status | Evidence |
|-----|--------|----------|
| Fix 112+113 (coins blocked) | **Monitoring** | Coins started at ~72K seed, need end-of-run check |
| Fix 114 (loop breaker revised) | **CONFIRMED** | 0 parse failures from empty prompts (was 150 in 39a) |
| Fix 115 (salvage skip seized) | **CONFIRMED** | 49 seized cargo with qty>0 (was 2/52 in Run 38) |
| Fix 116 (death dedup) | **Monitoring** | Need end-of-run deaths.jsonl analysis |
| Fix 118 (threshold 20→25) | **PARTIAL** | Early mortality halved (22 at Day 50 vs 23 at Day 25), but 43 dead by Day 128 |
| Fix 119 (fight targeting) | **Monitoring** | No governor/harbor master deaths observed — need full verification |
| Fix 120 (dead-captain guard) | **Monitoring** | Need end-of-run zombie death check |

#### Deaths by Type (Day 128)

| Type | Dead | Seeded | Survival % |
|------|------|--------|------------|
| Privateer captain | 11 | ~12 | 8% |
| Pirate captain | 9 | ~10 | 10% |
| Naval officer | 7 | ~10 | 30% |
| Merchant captain | 7 | ~8 | 13% |
| Pirate hunter | 6 | ~8 | 25% |
| Quartermaster | 2 | ~8 | 75% |
| All others | 1 | ~44 | 98% |

Captain types still dying at high rates. Port-based agent types (governor, harbor master, tavern keeper, surgeon, informant, fence, shipwright, plantation owner, crew member) have ~98% survival — Fix 119 (fight targeting) is protecting officials.

#### Remaining Concerns

1. **35% mortality at Day 128** — captain survival crisis continues. Wound accumulation over time is the fundamental issue. Crew wages + wound stacking = inevitable death spiral.
2. **Only 3 at sea at Day 128** — most surviving captains are docked/grounded. Combat tapers as fewer captains are operational.
3. **Parse failures trending up** (3 at Day 50 → 21 at Day 128) — some agents' prompts are becoming harder to parse as the sim progresses (more complex state).

---

### Run 39 Final Results — 180 Days Complete

- **Config**: 100 agents (124 with replacements), 180 days, vLLM Qwen 3.5-9B
- **Duration**: 4320 ticks, 39,610 decisions, 0 skipped, ~6.9 hours
- **Result**: Best structural run. Seized cargo 100% working. Pirates profitable for first time. But 37% mortality persists.

#### Key Metrics

| Metric | Run 37 | Run 38 | **Run 39** |
|--------|--------|--------|------------|
| Deaths | 37 (44%) | 42 (34%) | **46 (37%)** |
| Parse failures | 560 | 13 | **30** |
| Combat events | 582 | 625 | **637** |
| Fence transactions | 62 | 71 | **96** |
| Haven investments | 4 | 8 | **20** |
| Seized cargo qty>0 | 0/50 | 2/52 | **45/45 (100%)** |
| Pirate avg cash | -266 | -641 | **+541** |
| Merchant avg cash | -23 | 4 | **-356** |
| Fence max tier | 5 | 3 | **4** |
| Coins supply | 73K↑ | 72K↑ | **72K stable** |

#### Run 39 Root Cause Analysis

**Why 37% mortality (46 dead):**
1. **Cuts from crew fights are 79% of death-causing wounds** — `executeFight` gives sev-2 cuts to BOTH fighters, 100% of the time. With wound cap 5 × sev 5 (after worsening) = 25 = at-sea death threshold.
2. **At-sea worsening rate is lethal** — 20% chance per tick of +1 severity. A sev-5 wound reaches sev-10 in ~25 ticks (1 day). Five sev-5 cuts = 25 total = instant death.
3. **Only 14% of wounds are treated** — surgeons exist but don't treat captains effectively. 144 of 168 wounds untreated.
4. **Wound accumulation outpaces healing** — new cuts arrive from crew events faster than natural healing (+2 progress/tick) clears them.

**Why zombie deaths (8 duplicates):**
- Disease-tick sets DB `status='dead'` but doesn't update in-memory `sa.state.status` or `sa.confirmedDead`.
- Harness DB sync at next tick finds DB=dead, in-memory=alive → logs "unknown" death (duplicate).
- The dedup guard checked `sa.state.status !== DEAD` but it was still alive in memory.

**Why merchants in debt (-356g avg):**
- 7 of 10 merchant ships sunk. 3 survivors stuck at Port Royal.
- Trading at home port loses 20% per cycle (buy at full price, sell at 80%).
- No cash floor — `addCash` goes negative with no bankruptcy guard.
- Merchants keep executing `buy_cargo` at negative cash, deepening debt.

---

### Fixes Applied (Batch 16 — Mortality, Zombies, Merchant Debt)

#### Fix 121: At-Sea Wound Worsening Rate Halved (20%→8%)

- **disease-tick.ts**: `worsenChance` at sea changed from `0.2` to `0.08`.
- **From**: 20% per tick = ~4.8 severity/day = sev 5→10 in 1 day. Five sev-5 cuts = death in hours.
- **To**: 8% per tick = ~1.9 severity/day = sev 5→10 in ~2.5 days. Agents have 2-3 days to reach port.
- **Historical basis**: Wounds at sea worsened from infection over days/weeks, not hours. A pirate with a sword cut could sail for days before infection set in.
- **Cascade**: Captains survive longer at sea → more time to dock → more healing in port → lower mortality.
- **Risk**: Too few deaths may make the game too easy. Port threshold (30) and wound cap (5) still provide a ceiling.

#### Fix 122: Fight Wounds Reduced (sev 2 → sev 1, 100% → 50% chance)

- **crew-actions.ts `executeFight`**: Both fighters now have 50% chance of a sev-1 cut (was 100% chance of sev-2).
- **From**: Every fight = 2 wounds at severity 2 (one per fighter). 4 fights = 8 wounds = death spiral.
- **To**: Average fight = 1 wound at severity 1. 10 fights needed to accumulate same wound load.
- **Historical basis**: Most crew brawls were fistfights and shoving matches, not knife fights. Minor bruises, not sword cuts.
- **Cascade**: ~75% fewer wound-points per fight → captains survive crew interactions → more operational captains → more combat/trading.
- **Does NOT change**: `challenge_captain` (15% sev 2) or `steal` punishment (30% sev 3) — these are more serious events.

#### Fix 123: Zombie Death Logging Removed from Harness Sync

- **harness.ts**: Removed `this.logger.log('deaths', ...)` from the DB sync path. The sync now only updates in-memory state (`sa.state.status`, `sa.confirmedDead`).
- **From**: Disease-tick logs death, then harness sync logs same death again as "unknown" 1-7 ticks later.
- **To**: Deaths logged only at source (disease-tick, syncCombatEngagements, trial.ts). Zero duplicates.
- **Cascade**: Death count in deaths.jsonl matches actual unique deaths. No zombie entries. `cause: 'unknown'` disappears from death logs.
- **Risk**: Deaths from decay-tick (ship rot) won't be logged to deaths.jsonl (they're rare — 0 in Run 39). Acceptable tradeoff for clean data.

#### Fix 124: Merchants Can't Buy at Negative Cash

- **trade-actions.ts `executeBuyCargo`**: Added `if (cash <= 0) return { success: false, message: 'No funds to buy cargo' }` after fetching cash from DB.
- **From**: Merchants at -356g kept buying cargo, deepening debt infinitely.
- **To**: Broke merchants stop buying. They can still sell existing cargo, take other actions, or wait for trade income.
- **Cascade**: Merchant debt stops growing → merchants eventually recover through sell_cargo → positive cash flow becomes possible.
- **Does NOT change**: Selling cargo (always allowed regardless of cash). Crew wages (still drain even when broke — this is historical).

### Files Modified in Batch 16

| File | Fix # | Changes |
|------|-------|---------|
| src/handlers/disease-tick.ts | 121 | At-sea worsen chance 0.2→0.08 |
| src/engine/actions/crew-actions.ts | 122 | Fight wounds: sev 2→1, chance 100%→50% |
| src/sim/harness.ts | 123 | Removed death logging from DB sync path |
| src/engine/actions/trade-actions.ts | 124 | Cash <= 0 blocks buy_cargo |

### Batch 16 Cascade Predictions

```
Fix 121 (slower worsening) ──→ Captains survive 2-3 days at sea with wounds
                              ──→ Reach port alive → heal naturally
                              ──→ More captains operational → more combat/trade
                              ──→ Combined with Fix 122: wound load ~4x lower per unit time

Fix 122 (lighter fights) ──→ ~75% fewer wound-points from crew brawls
                           ──→ 5 wounds at sev 1 = total sev 5 (well below threshold 25)
                           ──→ Captains no longer die from crew insubordination
                           ──→ Combined with Fix 121: at-sea worsening of sev-1 wounds
                              takes ~12 days to reach sev-5 (was 1 day from sev-5→10)

Fix 123 (no zombie logging) ──→ Each agent dies exactly once in deaths.jsonl
                               ──→ Death count = unique dead agents
                               ──→ Clean cause attribution (disease/combat/execution only)

Fix 124 (merchant cash floor) ──→ Debt stops accumulating
                                 ──→ Merchants only trade when profitable
                                 ──→ Eventually recover through sell_cargo

Combined: Wounds arrive slower × worsen slower × merchants stop bleeding gold
         = target mortality 15-25% (down from 37%)
```

---

### Run 40 — Post Batch 16, 180 Days Complete

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-9B
- **Duration**: 4320 ticks, 40,287 decisions, 0 skipped, ~6.5 hours
- **Result**: Wound fixes worked (wound deaths rare), but **combat sinking is now the #1 killer**. 56 dead (41%).

#### Key Metrics

| Metric | Run 38 | Run 39 | **Run 40** |
|--------|--------|--------|------------|
| Deaths | 42 (34%) | 46 (37%) | **56 (41%)** |
| Parse failures | 13 | 30 | **22** |
| Combat events | 625 | 637 | **858** |
| Fence transactions | 71 | 96 | **80** |
| Haven investments | 8 | 20 | **?** |
| Seized cargo qty>0 | 2/52 | 45/45 | **52** |
| deaths.jsonl entries | 53 | 55 | **0** |

#### Critical Discovery: Ship Sinking Is the Dominant Killer

**33 of 56 dead agents have ZERO wounds.** They did not die from disease or crew fights. They died because their ship sank in combat-engagement.ts (lines 805-821), which sets `status='dead'` directly.

Only 4 code paths set agents to dead:
1. `disease-tick.ts:146` — wound accumulation (working but rare now thanks to Fixes 121-122)
2. `combat-engagement.ts:811,819` — **ship sunk → captain killed** (33 deaths)
3. `decay-tick.ts:45` — ship rot (rare)
4. `trial.ts:56` — execution (2 in Run 40)

**Historical inaccuracy**: Captains almost never went down with their ships. When a ship sank in the Age of Sail, crews were pulled from the water by the victor for ransom, trial, or forced recruitment. Only ~5-10% drowned. The code was treating every sinking as 100% captain death.

**17 dead merchant captains** — merchants can't fight back, their ships get attacked and sunk by pirates/navy. They die and get replaced, only to die again. The replacement spawner created many merchants who all died.

#### Why deaths.jsonl Is Empty

Fix 123 removed death logging from the harness DB sync path (to fix zombie duplicates). But:
- Disease-tick deaths are now rare (wound fixes working) — few disease deaths to log
- Combat sinking deaths in `combat-engagement.ts` never had logging — they set `status='dead'` in DB but don't call `logger.log('deaths', ...)`
- The `syncCombatEngagements` path (harness line 1377) only logs deaths for agents with `activeEngagementId` — NPC auto-combat via encounter-tick bypasses this

Result: death logging has no functioning path for the dominant death cause (ship sinking).

---

### Fixes Applied (Batch 17 — Ship Sinking Survival)

#### Fix 125: Captains Survive Ship Sinking → Imprisoned

- **combat-engagement.ts**: Both sinking paths (attacker sunk, defender sunk) now set captain to `'imprisoned'` at nearest port instead of `'dead'`.
- **From**: Ship sinks → captain killed (100% death rate). 33 deaths in Run 40.
- **To**: Ship sinks → captain pulled from water → imprisoned at nearest port. Can be released, escape, or be tried.
- **Historical basis**: Surviving captains were captured and either ransomed, tried, or pressed into service. Blackbeard's crew were captured alive after his ship was taken. Only captains who specifically chose to fight to the death (very rare) went down with their ship.
- **Cascade**: ~33 fewer deaths per 180 days → captains survive to buy new ships → re-enter the economy → more trading/raiding/fencing.
- **Risk**: Imprisonment mechanic needs to work — agents must eventually be released (prison release exists in the harness slow-tick). If release is broken, agents stay imprisoned forever instead of dying. This is better than dying but still a concern.
- **Does NOT change**: The ship is still sunk. Crew still zeroed. Cargo still at risk. Only the captain survives.

#### Fix 126: Ship Rot No Longer Kills Captain

- **decay-tick.ts**: When a ship rots to hull 0, captain is now set to `'in_port'` at their current location instead of `'dead'`.
- **From**: Ship rots → captain killed. **To**: Ship rots → captain stranded at port (shipless).
- **Historical basis**: A ship rotting in harbor doesn't kill anyone. The captain just loses their investment.
- **Cascade**: Captains stranded by rot can buy_vessel or find crew on a new ship.

### Files Modified in Batch 17

| File | Fix # | Changes |
|------|-------|---------|
| src/engine/combat-engagement.ts | 125 | Ship sinking → captain imprisoned (was dead) |
| src/handlers/decay-tick.ts | 126 | Ship rot → captain in_port (was dead) |

### Batch 17 Cascade Predictions

```
Fix 125 (sinking → imprisoned) ──→ ~33 fewer deaths per 180 days (60% reduction)
                                 ──→ Captains released from prison → buy_vessel → re-enter economy
                                 ──→ More merchants alive → more trading → more cargo at sea
                                 ──→ More pirates alive → more raiding → more fencing
                                 ──→ Prison population increases (may need release tuning)
                                 ──→ Risk: permanent imprisonment if release logic is broken

Fix 126 (rot → stranded) ──→ Ship rot is a financial loss, not death
                            ──→ Captains buy replacement ships
                            ──→ Small impact (rot deaths are rare)

Combined: Ship sinking no longer kills captains
         = target mortality <15% (down from 41%)
         = deaths only from wounds (disease-tick) and execution (trial.ts)
```

---

### Run 40 (continued) — Post Batch 17, Day 33 Deep Dive Assessment

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-9B
- **Duration**: Stopped at Day 33 (tick 804) for investigation
- **Result**: ZERO DEATHS — first time ever. Batch 17 sinking→imprisoned fix confirmed working. Economy pipeline structurally sound but not yet completing fence transactions.

#### Key Metrics at Day 33

| Metric | Run 39 (180d) | Run 40 (Day 33) | Assessment |
|--------|--------------|-----------------|------------|
| Deaths | 46 (37%) | **0 (0%)** | **Transformational** |
| Combat events | 637 | 340 | Healthy pace (~10/day) |
| Seized cargo qty>0 | 45/45 | **57/57 (100%)** | Fix 115 perfect |
| Fence transactions | 96 | 0 | Pipeline not yet activated |
| Navy cases | — | 65 (21 convicted) | Fully active |
| Bounties | — | 48 (21 claimed, 6,820g) | Fully active |
| Haven investments | 20 | 6 (4 investors) | Growing |
| Pirate avg cash | +541 | +13 | Early run, low but positive |
| Merchant avg cash | -356 | +40 | Healthier |
| Privateer avg cash | — | -157 | Debt spiral (balance issue) |
| Imprisoned | — | 5 | Sinking→imprisoned working |
| Relationships | — | 1,485 | Rich social fabric |
| Intel records | — | 3,481 | Active |
| Wounds | — | 81 (49 cuts, 16 fever) | Manageable |

#### Agent Status: All 100 Alive

| Status | Count |
|--------|-------|
| In port | 77 |
| At sea | 18 |
| Imprisoned | 5 |

Port-based agents (governors, tavern keepers, plantation owners, harbor masters) all thriving. Captain types active — 17 ships sailing, 17 docked. 3 pirate captains imprisoned (sinking→imprisoned path).

#### Star Player: Marcel Fleury (pirate_captain)

- 481g cash, 72 infamy (highest in Caribbean), -25 reputation
- Level 2 hideout at Bridgetown earning 4g/tick
- At sea in Le Vengeance (sloop, hull 56), 2 seized cargo lots at heat 30
- Reputation spread across 15 sea zones

#### Four Issues Found (3 code bugs, 1 false positive)

**Issue 1: market_prices not cleared on re-seed (CODE BUG)**

Harness cleared 14 tables but NOT `market_prices` or `haven_investments`. Coins from seed (Portobelo 50,136, Veracruz 21,625) persisted across runs. Fix 112/113 prevented new coin accumulation but couldn't clear the seed stock.

**Issue 2: Navy auto-combat attacks NPC merchants (CODE BUG)**

`encounter-tick.ts` lines 101-108: navy/hunter auto-engaged ALL NPC ships. Comment said "Navy/hunter agent vs NPC pirate" but NPC ships from vessel spawner are all merchant traffic — no pirate flag exists. Result:
- Alejandro Silva (naval_officer) seized 213 units of cargo he could never fence (naval officers can't use sell_plunder)
- NPC merchant ships damaged/sunk unnecessarily
- Cargo permanently stranded on officers who have no way to sell it

**Issue 3: sell_plunder urgent description threshold too strict (CODE BUG)**

`narrative-sections.ts:934` required BOTH `hotCargoCount > 0` AND `cargoHeatMax >= 30` for the urgent "SELL STOLEN CARGO NOW" message. But pirate_hunter seized cargo has `heat = 0` (only `seized_from` set — pirate_hunters not in `PIRACY_TYPES`). Hunters with 4 lots of seized cargo saw bland "sell plunder at market" instead of the urgent caps message.

Traced the full consistency chain:
- `narrative-compute.ts:117`: `hotCargoCount` correctly uses `(c.heat > 0 || c.seized_from)` ✓
- `harness.ts:702`: `hasStolen` uses same formula ✓
- `narrative-sections.ts:853`: filtering uses `hotCargoCount > 0` ✓
- `narrative-sections.ts:934`: description required `cargoHeatMax >= 30` ✗ — inconsistent with all other checks

**Issue 4: Zero fence transactions (FALSE POSITIVE)**

Only 2 pirate captains have seized cargo (Marcel Fleury: 2 lots, James Tew: 2 lots) and both are at sea. They need to dock before sell_plunder activates. The pipeline is correctly wired — `executeSellPlunder` uses `CargoQueries.getByOwner`, fences exist at all 13 ports with 95% availability, the harness keeps sell_plunder in the action list when `hasStolen` is true.

**Also investigated: Privateer debt spiral (BALANCE ISSUE, NOT BUG)**

`crew-tick.ts:27` checks `captain.cash >= totalWages` before deducting — captains can't go infinitely negative from wages alone. Debt comes from other actions without cash checks (upgrade_ship at 50g was the biggest gap — fixed). A 28-crew brigantine costs 67.2g/day in wages vs typical fence haul of 280-700g. The ratio is viable but tight.

---

### Fixes Applied (Batch 18 — Economy Integrity)

#### Fix 127: Clear market_prices and haven_investments on Re-Seed

- **harness.ts:258**: Added `market_prices` and `haven_investments` to the DELETE list on re-seed.
- **Root cause**: Harness cleared 14 tables (agents, ships, crew, cargo, etc.) but not market_prices or haven_investments. Coins from seed (72K) persisted indefinitely across runs. Haven investments from dead agents in previous runs polluted new runs.
- **Expected outcome**: Clean economic slate on re-seed. Coins start at zero. Haven investments start fresh.

#### Fix 128: Navy Auto-Combat vs NPC Replaced with Sighting

- **encounter-tick.ts:101-108**: Changed the navy/hunter vs NPC auto-combat block from `resolveCombat()` to `generateEncounterSighting()`.
- **Root cause**: Navy officers and pirate hunters auto-attacked ALL NPC ships (merchant traffic from vessel spawner). No way to distinguish NPC pirate from NPC merchant. Naval officer Alejandro Silva accumulated 213 units of seized cargo he could never fence. NPC merchant ships damaged unnecessarily, reducing trade volume.
- **Expected outcome**: Navy/hunters see NPC ships as intel sightings, not auto-combat targets. They still encounter LLM-captained pirates through the sighting→LLM decision pipeline. More NPC ships survive → more cargo flowing through ports → healthier trade economy.
- **Does NOT affect**: Pirate/privateer auto-combat vs NPC merchants (lines 75-98) — this is the correct behavior (pirates attack merchants on sight).

#### Fix 129: sell_plunder Urgent Description for ANY Seized Cargo

- **narrative-sections.ts:934**: Changed condition from `computed.hotCargoCount > 0 && computed.cargoHeatMax >= 30` to `computed.hotCargoCount > 0`.
- **Root cause**: Pirate_hunter seized cargo has `heat = 0` but `seized_from` is set. The `hotCargoCount` computation (narrative-compute.ts:117) correctly counts this cargo, but the urgent description required `cargoHeatMax >= 30` — causing an inconsistency where the harness detected stolen cargo but the prompt showed a bland description.
- **Expected outcome**: Any agent with seized cargo sees "SELL STOLEN CARGO NOW" in their action list. Increases LLM likelihood of choosing sell_plunder.

#### Fix 130: upgrade_ship Checks Captain Cash Before Charging

- **shipwright-actions.ts:152-198**: Added cash check at top of upgrade path. If captain exists and `cash < 50`, returns failure instead of deducting.
- **Root cause**: `executeUpgradeShip` deducted 50g from the captain without checking affordability. Other spending actions (buy_vessel, haven investments, bounty posting) all had cash checks. Upgrade_ship was the gap. Contributed to Gaston Bonhomme reaching -900g.
- **Expected outcome**: Captains never go negative from ship upgrades. Shipwrights skip upgrade if captain can't afford it.

### Files Modified in Batch 18

| File | Fix # | Changes |
|------|-------|---------|
| src/sim/harness.ts | 127 | Added market_prices, haven_investments to re-seed clear list |
| src/handlers/encounter-tick.ts | 128 | Navy/hunter vs NPC: resolveCombat → generateEncounterSighting |
| src/strategy/narrative-sections.ts | 129 | sell_plunder urgent description: removed cargoHeatMax >= 30 requirement |
| src/engine/actions/shipwright-actions.ts | 130 | Cash check before deducting 50g upgrade cost from captain |

### Batch 18 Cascade Predictions

```
Fix 127 (clear market_prices) ──→ Coins start at zero on re-seed
                                 ──→ Port supply reflects actual production
                                 ──→ Market prices meaningful from Day 1
                                 ──→ Haven investments don't carry over

Fix 128 (navy sighting not combat) ──→ ~200+ cargo units no longer stranded on officers
                                     ──→ NPC merchant ships survive longer
                                     ──→ More cargo flowing through port trade
                                     ──→ Navy still hunts pirates via LLM decisions
                                     ──→ Combat events may drop ~30% (navy was generating many)

Fix 129 (urgent sell description) ──→ Pirate_hunters with heat=0 seized cargo see urgent prompt
                                    ──→ LLM more likely to choose sell_plunder
                                    ──→ More fence transactions from hunters
                                    ──→ Combined with Fix 128: less stranded cargo, more fenced cargo

Fix 130 (upgrade cash check) ──→ Captains stop accumulating debt from upgrades
                                ──→ Gaston Bonhomme scenario prevented
                                ──→ Combined with existing wage check: captains can't go deeply negative

Combined: Clean economy × less cargo stranding × better sell prompting × no debt from upgrades
         = healthier economic loop, more fence transactions, sustainable captain finances
```

---

### Run 41 — Final Results (180 Days Complete, Post Batch 18)

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-9B
- **Duration**: 4320 ticks, 46,375 decisions, 0 skipped, ~14.9 hours runtime
- **Result**: Best mortality and combat ever. Fence pipeline completely broken — zero transactions in 180 days.

#### Key Metrics

| Metric | Run 38 | Run 39 | Run 40 | **Run 41** |
|--------|--------|--------|--------|------------|
| Deaths | 42 (34%) | 46 (37%) | 56 (41%) | **6 (6%)** |
| Combat events | 625 | 637 | 858 | **981** |
| Combat collapsed? | 173→64 | Tapered | Tapered | **Never (172→170)** |
| Fence transactions | 71 | 96 | 80 | **0** |
| Seized cargo qty>0 | 2/52 | 45/45 | 52 | **48/48** |
| Pirate avg cash | -641 | +541 | — | **-1,084** |
| Bounties | 377 | — | — | **242** |
| Warrants | — | — | — | **183** |
| Arrests | — | — | — | **124** |

#### Combat Timeline (Never Collapsed)

| Period | Events |
|--------|--------|
| Day 1-30 | 172 |
| Day 31-60 | 144 |
| Day 61-90 | 159 |
| Day 91-120 | 153 |
| Day 121-150 | 183 |
| Day 151-180 | 170 |

Best combat sustainability in project history. Flat at 5.5/day for 180 days.

#### Deaths: Only 6

| Agent | Type |
|-------|------|
| Hernando Alvarez | naval_officer |
| Toussaint Stormborn | naval_officer |
| Hernando Navarro | pirate_hunter |
| Luis Cortez | pirate_hunter |
| Fernando Navarro | privateer_captain |
| Daniel Turner | pirate_captain |

All 6 died by Day ~50. Zero new deaths in the final 130 days.

#### Agent Cash at End (Living)

| Type | Avg Cash | Count |
|------|----------|-------|
| Tavern keeper | 3,669 | 7 |
| Harbor master | 2,718 | 6 |
| Surgeon | 1,356 | 6 |
| Port governor | 1,158 | 7 |
| Pirate hunter | 1,129 | 4 |
| Merchant captain | -209 | 7 |
| Privateer captain | -762 | 6 |
| **Pirate captain** | **-1,084** | **6** |

#### Root Cause Analysis: Why Zero Fence Transactions

**The Cargo Hot Potato** — three compounding failures:

**1. LLM never chooses sell_plunder (even with urgent prompting)**

Abel Smith (pirate_hunter) was in port at Petit-Goave with 4 seized lots (18 qty, heat 80) and a tier-3 fence available. The narrative prompt showed "SELL STOLEN CARGO NOW". He chose to sail away. The 9B model consistently deprioritizes sell_plunder in favor of sailing, patrolling, or gathering intel. Fernando Guerrero (pirate_captain) at sea with 10 qty never docked to fence before the run ended.

**2. Merchants inherit hot cargo they can never fence (47% of all seized cargo)**

When a pirate attacks a merchant and LOSES, combat-engagement.ts Path 2 (lines 861-873) transfers the pirate's cargo (including previously-seized hot goods) to the merchant. The merchant now has heat-30 cargo with seized_from set. Merchants can't use sell_plunder. 26 of 48 seized lots (78 qty) stranded on merchants.

**3. Naval officers accumulate seized cargo from LLM-decided combat (30% of seized cargo)**

Despite Fix 128 (navy sighting instead of auto-combat), naval officers still chose to attack ships via their LLM decisions. They accumulated 11 lots (50 qty) of seized cargo they can never fence.

#### Seized Cargo Ownership Breakdown

| Owner Type | Lots | Qty | % of Total | Can Fence? |
|------------|------|-----|------------|------------|
| Merchant captain | 26 | 78 | 47% | No |
| Naval officer | 11 | 50 | 30% | No |
| Pirate hunter | 4 | 18 | 11% | Yes (but didn't) |
| Pirate captain | 3 | 10 | 6% | Yes (at sea) |
| Fence | 3 | 7 | 4% | No |
| Privateer captain | 1 | 2 | 1% | Yes (imprisoned) |

Only 18% of seized cargo was on agents who could fence it, and none of them actually did.

---

### Fixes Applied (Batch 19 — Fence Pipeline & Cargo Flow)

#### Fix 131: Force-Fence — Deterministic sell_plunder for Pirate-Types in Port

- **harness.ts**: New force-fence block before the force-sail loop. If a pirate_captain, privateer_captain, or pirate_hunter is IN_PORT and owns seized cargo (heat > 0 OR seized_from, qty > 0), sell_plunder is executed deterministically — no LLM decision needed.
- **Root cause**: The Qwen 3.5-9B model consistently refuses to choose sell_plunder even with "SELL STOLEN CARGO NOW" in caps. Abel Smith (pirate_hunter) had 18 qty at heat 80 in port with a tier-3 fence and sailed away instead. Zero fence transactions in 180 days.
- **Historical basis**: Pirates who docked with hot cargo fenced it IMMEDIATELY. It was never a choice — holding stolen goods meant hanging. Fencing was reflexive, not strategic.
- **Expected outcome**: Every time a pirate-type agent docks with seized cargo, they auto-fence on the next action tick. The raid→seize→dock→fence→profit loop should complete within 24-48 game hours of capture.

#### Fix 132: Only Pirate-Types Receive Cargo in Agent-vs-Agent Combat

- **combat-engagement.ts**: Both cargo transfer paths (attacker wins Path 1, defender wins Path 2) now check if the winner is a LOOT_TYPE (pirate_captain, privateer_captain, pirate_hunter). Non-pirate winners (merchants, naval officers) no longer receive cargo.
- **Root cause**: In Run 41, merchants who repelled pirate attacks inherited the pirate's hot cargo (26 lots, 78 qty, 47% of total). They couldn't fence it. Merchants don't loot defeated pirates — they flee.
- **Historical basis**: A merchant captain who drove off a pirate didn't board the pirate ship to steal its cargo. He thanked God, repaired his rigging, and sailed on.
- **Expected outcome**: Zero seized cargo on merchant/naval agents. All captured cargo flows to pirate-types who can fence it.

#### Fix 133: Only Pirate-Types Receive Cargo in Auto-Combat

- **combat.ts**: Same LOOT_TYPES guard on the NPC auto-combat cargo transfer. Non-pirate attackers skip cargo transfer entirely.
- **Root cause**: NPC auto-combat path could transfer cargo to any winning captain type. Combined with Fix 128 (navy sighting), this is belt-and-suspenders — ensures navy/merchants never accumulate stranded cargo.
- **Expected outcome**: Consistent with Fix 132. Cargo only flows to agents who can sell it.

#### Fix 134: Recruit Crew Cash Check

- **tavern-actions.ts**: Before deducting recruitment cost (5g per recruit), checks captain's cash. If captain can't afford any recruits, returns failure. Limits recruit count to what captain can afford.
- **Root cause**: `addCash(captain.id, -(costPerRecruit * count))` deducted 5-15g without checking affordability. Combined with upgrade_ship (fixed in 130) and wages, this was a silent cash drain pushing captains deeply negative.
- **Expected outcome**: Captains never go negative from recruitment. Broke captains can't recruit until they earn income.

### Files Modified in Batch 19

| File | Fix # | Changes |
|------|-------|---------|
| src/sim/harness.ts | 131 | Force-fence block: deterministic sell_plunder for pirate-types with seized cargo |
| src/engine/combat-engagement.ts | 132 | LOOT_TYPES gate on both cargo transfer paths (attacker wins, defender wins) |
| src/engine/combat.ts | 133 | LOOT_TYPES gate on NPC auto-combat cargo transfer |
| src/engine/actions/tavern-actions.ts | 134 | Captain cash check before recruit_crew deduction |

### Batch 19 Cascade Predictions

```
Fix 131 (force-fence) ──→ Every pirate who docks with cargo sells immediately
                        ──→ Fence transactions activate from Day 1
                        ──→ Pirate income rises → cash flow positive
                        ──→ Haven investments become reachable
                        ──→ Fence trust builds → tiers advance → better cuts
                        ──→ FULL ECONOMY LOOP: raid → seize → dock → fence → profit

Fix 132+133 (loot gate) ──→ Zero cargo stranded on merchants/navy
                          ──→ 100% of seized cargo goes to agents who CAN fence
                          ──→ Combined with Fix 131: all seized cargo gets fenced
                          ──→ More gold circulating → economy healthier
                          ──→ Navy/merchants not penalized for winning combat

Fix 134 (recruit check) ──→ Broke captains can't recruit → stop bleeding cash
                          ──→ Combined with Fix 130 (upgrade): two debt sources eliminated
                          ──→ Pirates break even faster with fence income

Combined: Pirates always fence when docked × all cargo goes to fencing agents × no unchecked spending
         = the economy loop should sustain across 180 days for the first time
         = target: 50+ fence transactions, pirate avg cash positive
```

---

### Run 42 — Final Results (180 Days Complete, Post Batch 19)

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-9B
- **Duration**: 4320 ticks, 46,105 decisions, 0 skipped, ~13 hours
- **Result**: BEST RUN IN PROJECT HISTORY. Economy loop completing. Pirates profitable. Three issues found.

#### Key Metrics

| Metric | Run 39 | Run 40 | Run 41 | **Run 42** |
|--------|--------|--------|--------|------------|
| Deaths | 46 (37%) | 56 (41%) | 6 (6%) | **9 (9%)** |
| Combat | 637 | 858 | 981 | **709** |
| Fence transactions | 96 | 80 | 0 | **51 valid (9,022g)** |
| Pirate avg cash | +541 | — | -1,084 | **+1,148** |
| Bad cargo stranded | — | — | 78 qty | **0** |
| Havens | 20 | — | 9 | **16 (10 ports)** |
| Errors | 30 | 22 | 0 | **18 (parse only)** |

#### Batch 19 Confirmed Working

- **Fix 131 (force-fence)**: 51 successful sell_plunder transactions, 9,022g income. Pirates profitable.
- **Fix 132+133 (loot gates)**: Zero cargo on merchant/naval agents. All seized cargo on pirate-types.
- **Fix 134 (recruit cash check)**: No unchecked recruitment drains.

#### Star Pirates

| Captain | Cash | Infamy | Fence Sales |
|---------|------|--------|-------------|
| Nathaniel Bonnet | 2,215g | 32 | 2 sales, 241g |
| Pedro Medina | 2,178g | 40 | 7 sales, 302g |
| Thijs Kuiper | 1,695g | 36 | 5 sales, 3,172g |

#### Combat Timeline

| Period | Events |
|--------|--------|
| Day 1-30 | 128 |
| Day 31-60 | 164 |
| Day 61-90 | 139 |
| Day 91-120 | 134 |
| Day 121-150 | 88 |
| Day 151-180 | 56 |

Combat tapers from 164→56. Not collapsing but declining.

#### Three Issues Found

**Issue 1: Agent-vs-Agent Infighting (78% of combat)**

556 of 709 combat events (78%) are between named agent ships. Only 153 are NPC background combat. Pirates fight other pirates, pirate hunters, privateers, and naval officers constantly. The same ship pairs appear 5-10 times in the event log:
- "HMS Vengeance was captured by San Impetuous" (8 times)
- "Santa Desperada was captured by Bonnet's Revenge" (7 times)
- "San Cautious was captured by De Honest Lass" (7 times)

**Root cause**: When two LLM-captained ships encounter each other, encounter-tick generates sightings for both. Both agents independently choose `attack_ship`. Pirates attack other pirates because the LLM doesn't distinguish friend from foe — any ship is a target.

**Impact**: Pirates wound each other fighting armed ships (4-13 guns) instead of raiding defenseless NPC merchants. This drives wound accumulation, captain deaths, and combat taper as damaged captains drop out.

**Issue 2: Ships at Sea with Hull < 15 (No Force-Dock)**

George Fletcher (naval_officer) sailed 180 days at hull 1. Louis Duval (merchant) at hull 13. They can't fight, can't trade effectively, and take a slot in the sea zone that should be used by healthy ships. The force-dock mechanism only triggers after 4 failed actions — successful sailing doesn't trigger it regardless of hull condition.

**Issue 3: 14 "NaN" Fence Entries (FALSE POSITIVE)**

14 of 65 fences.jsonl entries have undefined payout. Investigation revealed these are `buy_stolen_goods` actions by **fence-type agents** (Yaw the Bold, Efua Stormborn, Akosua of Nassau, etc.) — the fence agents buying stolen goods from pirates. Both action types log to 'fences' category but with different data fields. Not a bug — the fence economy is working bidirectionally.

#### Also Noted (Not Code Issues)

- **Fernando Silva execution**: "Hanged for piracy at Tortuga" with evidence 115.6. The legal system working correctly. Only had 1 wound at sev 1 — wasn't a wound death.
- **Merchant debt (-182g avg)**: Crew wages (48-96g/day) exceed trade income. Balance issue, not code bug. 949 trades happened but margins are thin.
- **Rafael Ramirez at -3,647g**: Privateer outlier. 2 crew, hull 39, still sailing. Debt accumulated from early-run spending before cash checks were in place.

---

### Fixes Applied (Batch 20 — Combat Quality & Ship Safety)

#### Fix 135: Skip Sightings Between Same-Faction Agents

- **encounter-tick.ts**: Before generating sightings for two LLM-captained ships, checks faction membership. Three factions defined:
  - PIRATE: pirate_captain, privateer_captain
  - NAVY: naval_officer, pirate_hunter
  - MERCHANT: merchant_captain
  Same-faction pairs DON'T generate sightings. Cross-faction pairs DO.
- **Root cause**: 78% of Run 42 combat was agent-vs-agent infighting. Pirates attacked other pirates because the LLM doesn't distinguish friend from foe.
- **Historical basis**: Pirates rarely fought each other. They were "brothers of the coast" with a shared code. They fought merchants and the Navy, not fellow pirates. Same for Navy — Royal Navy ships don't attack each other.
- **Expected outcome**: Pirate-vs-pirate combat drops to near zero. Pirates only encounter NPC merchants (auto-combat) and cross-faction agents (navy, merchants). Combat quality improves — fewer wounds from armed-ship duels, more profitable merchant raids.
- **Does NOT prevent**: Pirate vs navy (the real enemy), pirate vs merchant (the real prey), navy vs pirate (hunting). All cross-faction encounters still generate sightings.

#### Fix 136: Hull-Based Force-Dock for Critically Damaged Ships

- **harness.ts**: New force-dock condition before the existing stuck-at-sea check. If a captain's ship has hull < 15 and they're AT_SEA, teleport to a random port. Ship status set to docked, agent to in_port.
- **Root cause**: George Fletcher (hull 1) and Louis Duval (hull 13) sailed the entire 180-day run at critical hull. The existing force-dock only triggered after 4 failed actions — successful sailing didn't trigger it regardless of hull condition. Passive hull repair (+3/tick, cap 70) only works when docked.
- **Historical basis**: No captain sails with hull breached to waterline level. Any rational mariner runs for the nearest port when the ship is taking water.
- **Expected outcome**: Ships at hull <15 immediately dock. Passive repair restores them to hull 70 within 5 days. Captains return to sea with serviceable ships instead of limping around at hull 1.

### Files Modified in Batch 20

| File | Fix # | Changes |
|------|-------|---------|
| src/handlers/encounter-tick.ts | 135 | Faction-based sighting filter (pirate/navy/merchant factions) |
| src/sim/harness.ts | 136 | Hull <15 force-dock for at-sea captains |

### Batch 20 Cascade Predictions

```
Fix 135 (faction sightings) ──→ Zero pirate-vs-pirate combat
                               ──→ Pirates fight NPC merchants (auto-combat) + cross-faction agents
                               ──→ ~78% fewer agent-vs-agent wound events
                               ──→ Fewer captain deaths from wound accumulation
                               ──→ More captains survive to Day 180
                               ──→ Combat quality: profitable raids vs costly duels
                               ──→ Risk: total combat count may drop (fewer agent encounters)
                               ──→ Mitigated: NPC auto-combat still generates majority of encounters

Fix 136 (hull force-dock) ──→ Ships at hull <15 immediately dock
                             ──→ Passive repair restores hull 70 in ~5 days
                             ──→ Captains return to sea with serviceable ships
                             ──→ Fewer permanently grounded captains
                             ──→ Combat taper reduced (ships get repaired, rejoin fleet)

Combined: Less infighting + ships repair when damaged
         = healthier captain population + sustained combat rate + better economy
         = target: <5% mortality, combat flat across 180 days, 70+ fence transactions
```

---

### Run 43 — Stopped at Day 7.5 (Batch 20 Bug Found)

- **Config**: 100 agents, 180 days, vLLM Qwen 3.5-9B
- **Stopped**: Day 7.5 (tick 181) — force-fence looping bug found

#### Bug Found: Force-Fence Loop (20 firings, 0 sales)

Force-fence fired 20 times for Thomas Vane and Cuffee of Nassau, but ALL failed. Cargo stayed, triggering the loop again every tick.

**Thomas Vane (privateer, bridgetown)**: force-fence called sell_plunder with in-memory `portId = "port_royal"`. But DB had `port_id = "bridgetown"`. Inside sellStolenGoods, the DB agent is re-fetched and `agent.port_id !== portId` fails → "Agent not at this port". **Root cause**: in-memory/DB port desync from imprisonment/release cycle.

**Cuffee of Nassau (privateer, portobelo)**: force-fence called sell_plunder at portobelo. But **no fence exists at portobelo** — it wasn't in the seeding list. sellStolenGoods returns "No fence available at this port". Every tick.

#### Also confirmed working (before stopping):
- Fix 135 (faction sightings): only 27 combat events (vs 32 at same point in Run 42). Fewer infighting events.
- Fix 136 (hull force-dock): 4 firings (Henri Marin, Piet de Ruyter ×2, Tobias Wright). Ships returned to port for repair.
- Zero deaths, zero errors, 0 bad cargo.

---

### Fixes Applied (Batch 20b — Force-Fence Reliability)

#### Fix 137: sell_plunder Uses DB Port Instead of In-Memory

- **trade-actions.ts**: `executeSellPlunder` now fetches agent from DB to get `port_id`, instead of using in-memory `agent.portId`. Falls back to in-memory if DB returns null.
- **Root cause**: In-memory `portId` desyncs from DB `port_id` during imprisonment→release→reclaim cycles. Run 43: Thomas Vane in-memory="port_royal" but DB="bridgetown". sellStolenGoods re-fetches from DB and fails the port mismatch check.
- **Expected outcome**: Force-fence always uses the authoritative DB port. No more port desync failures.

#### Fix 138: Portobelo Added to Fence Seeding, Duplicate Cartagena Removed

- **harness.ts**: Fence seeding list updated: removed duplicate `'cartagena'`, added `'portobelo'`. All 14 ports that agents can spawn at now have fences.
- **Root cause**: Cuffee of Nassau was at portobelo with seized cargo, but no fence existed there. Force-fence fired every tick, sell_plunder failed every tick.
- **Expected outcome**: Fences at all 14 ports. No more "no fence available" failures.

### Files Modified in Batch 20b

| File | Fix # | Changes |
|------|-------|---------|
| src/engine/actions/trade-actions.ts | 137 | executeSellPlunder reads port from DB, not in-memory |
| src/sim/harness.ts | 138 | Added portobelo to fence seeding, removed duplicate cartagena |

---

### Fixes Applied (Batch 21 — Historical Combat & Ship Rebalance)

**Context**: Pirates spawned with 4-gun sloops while merchants got 12-gun merchantmen. Historically inaccurate — Caribbean merchants in 1710-1725 mostly sailed lightly-armed sloops with small crews (10-20 men). Pirates succeeded through crew superiority (50-75 armed men vs 15-20 reluctant sailors), speed, and the black flag surrender convention (~90% of encounters ended without a broadside). The 2:1 gun-ratio surrender threshold meant a 4-gun pirate could never trigger surrender against a 12-gun merchant, forcing costly broadsides that drove wound accumulation, captain deaths, and combat taper (164→56 over 180 days in Run 42).

#### Fix 139: Merchant Ship Downgrade & Pirate Crew Boost

- **harness.ts**: Changed `merchant_captain` ship class from `merchantman` to `sloop`. Added per-type gun fraction map (`CAPTAIN_GUNS_FRACTION`) replacing flat `0.6` multiplier, and per-type starting crew map (`CAPTAIN_CREW_COUNT`) replacing `classData.crewMin`.
- **New spawn stats**:
  - Pirate captain: sloop, 6 guns (0.75 × 8), 50 crew — armed and overmanned for boarding
  - Merchant captain: sloop, 3 guns (0.375 × 8), 12 crew — skeleton trading crew
  - Naval officer: frigate, 21 guns (0.6 × 36), 150 crew — unchanged
  - Privateer captain: brigantine, 9 guns (0.6 × 16), 45 crew — unchanged
  - Pirate hunter: brig, 12 guns (0.6 × 20), 60 crew — unchanged
- **Historical basis**: Caribbean trading sloops carried 2-6 guns and 10-20 crew. Pirates packed 50-75 armed men onto the same hull specifically for boarding superiority. The crew ratio (50 vs 12 = 4.17) is what made piracy work — not superior firepower.
- **Balance result**: Pirate vs merchant gun ratio = 2.0 (triggers pre-broadside surrender). Crew ratio = 4.17 (overwhelming boarding). Merchants surrender without a fight — zero hull damage to pirates per raid.

#### Fix 140: Infamy-Based Surrender Mechanic

- **combat.ts**: Replaced flat gun-ratio surrender check (lines 66-82) with tiered system. Looks up attacker infamy via `AgentQueries.getById()` (already imported). Calculates `infamyBonus = infamy / 100` (0.0 to 1.0). Applies to effective ratios: `effectiveGunRatio = gunRatio * (1 + infamyBonus * 0.5)`, `effectiveCrewRatio = crewRatio * (1 + infamyBonus * 0.3)`.
- **Surrender thresholds by defender type**:
  - Merchant (or NPC): gunRatio ≥ 1.2 OR crewRatio ≥ 2.0 OR (infamy ≥ 60 AND gunRatio ≥ 0.8) OR (gunRatio ≥ 1.0 AND crewRatio ≥ 1.5) — merchants surrendered to any credible threat
  - Navy/Hunter: effectiveGunRatio ≥ 2.5 AND effectiveCrewRatio ≥ 2.0 — navy fought to the end, only overwhelming force
  - Other (pirate vs pirate): original thresholds (gunRatio ≥ 2.0 or 1.5+1.5)
- **Historical basis**: The black flag convention meant surrender = live, resist = everyone dies. Merchant crews had zero incentive to fight. A pirate with infamy 60+ (like Blackbeard) could take ships without firing a shot. Navy officers fought to the end — only massive superiority forced surrender.
- **NPC ships (no captain)**: Treated as merchant — surrender easily. Correct since vessel-spawner NPC ships are all merchant traffic.

#### Fix 141: NPC Merchant Armament Reduction

- **vessel-spawning.ts**: Reduced gunsFraction and crewFraction on NPC trading vessels:
  - trading_sloop: gunsFraction 0.4→0.25 (2 guns), crewFraction 0.4→0.15 (~24 crew)
  - trading_schooner: gunsFraction 0.4→0.3 (3-4 guns), crewFraction 0.4→0.2 (~32 crew)
  - bark: gunsFraction 0.5→0.35 (5 guns), crewFraction 0.5→0.25 (~39 crew)
  - merchantman: gunsFraction 0.6→0.4 (8 guns), crewFraction 0.5→0.3 (~55 crew)
  - fluyt: gunsFraction 0.3→0.2 (2 guns), crewFraction 0.6→0.3 (~23 crew)
- **Historical basis**: Caribbean traders carried minimal guns to save weight for cargo. Dutch fluyts were designed nearly defenseless — maximum cargo capacity. Only transatlantic merchantmen mounted serious armament.
- **Prey hierarchy created**: drogers (easy/small) → trading sloops (pirate bread and butter) → schooners → barks → merchantmen (hard/lucrative) → fluyts (jackpot: 2 guns, 280 cargo).

#### Fix 142: Claim Captured Ship as Flagship (claim_prize)

- **combat-actions.ts**: New `executeClaimPrize()` — pirate/privateer captain in port can swap to a captured ship. Finds captured ships at same port, picks best (highest guns + cargo_capacity score). Requires prize to be an upgrade over current ship. Requires enough crew to man the prize (crewMin gate). Transfers cargo from old ship. Releases old ship (docked, no captain) for NPC recycling.
- **action-executor.ts**: Registered `claim_prize` case.
- **action-filter.ts**: Gate: pirate_captain or privateer_captain, IN_PORT, has current ship.
- **agents.ts**: Added `claim_prize` to pirate_captain and privateer_captain tool lists.
- **harness.ts**: Added `claim_prize` to applyDecision in-memory sync (updates `sa.state.shipId`). Cooldown [12, 24].
- **auto-fill-params.ts**: Auto-fill with port.
- **narrative-sections.ts**: Description: "CLAIM A CAPTURED SHIP as your new flagship — upgrade to a bigger vessel".
- **Historical basis**: Blackbeard's Queen Anne's Revenge was a captured French slave ship. Black Sam's Whydah was a captured galley. This was THE pirate progression path — no pirate bought their flagship, they took it.

#### Fix 143: Ship Name Deduplication

- **name-generator.ts**: Added module-level `usedShipNames` Set and `resetShipNames()` function. `generateShipNameLLM()` checks for duplicates before returning — if duplicate found, generates variant using captain's first name. Random fallback retries up to 10 times. Last resort uses "Captain's [ship class]".
- **harness.ts**: Calls `resetShipNames()` at start of `seedAgents()`.
- **Root cause**: "Revenge" appeared 6 times and "HMS Vengeance" 3 times in Run 42. Noun pool of 30 items with no dedup check produced frequent collisions across 500+ ships.

#### Fix 144: Crew Count Preserved from Seeding

- **harness.ts**: Removed `ShipQueries.updateCrewCount(captain.state.shipId, 1)` from phase 2 crew assignment. Named crew agents are tracked in the `crew` table; `ship.crew_count` represents total hands aboard (including unnamed sailors) and is set correctly by `CAPTAIN_CREW_COUNT` at ship creation.
- **Root cause**: Phase 2 called `updateCrewCount(shipId, 1)` for each crew_member assigned, overwriting the pirate's 50-crew count to 1. In Run 44, pirate had crew_count=6 instead of 50.
- **Impact**: Pirates now keep their 50-crew advantage. Crew ratio (50 vs 12 = 4.17) reliably triggers merchant surrender via the crewRatio ≥ 2.0 path in addition to the gun ratio path.

### Files Modified in Batch 21

| File | Fix # | Changes |
|------|-------|---------|
| src/sim/harness.ts | 139, 142, 143, 144 | Merchant→sloop, per-type gun/crew maps, claim_prize applyDecision sync + cooldown, resetShipNames(), crew_count preserved |
| src/engine/combat.ts | 140 | Infamy-based surrender with defender-type tiers (merchant/navy/other) |
| src/config/vessel-spawning.ts | 141 | NPC trader gunsFraction & crewFraction reductions (5 profiles) |
| src/engine/actions/combat-actions.ts | 142 | New executeClaimPrize() function |
| src/engine/action-executor.ts | 142 | Register claim_prize case |
| src/strategy/action-filter.ts | 142 | claim_prize gate (pirate/privateer, in_port, has ship) |
| src/config/agents.ts | 142 | claim_prize added to pirate_captain and privateer_captain tools |
| src/strategy/auto-fill-params.ts | 142 | claim_prize auto-fill |
| src/strategy/narrative-sections.ts | 142 | claim_prize description |
| src/agents/name-generator.ts | 143 | Ship name dedup with usedShipNames Set |

### Batch 21 Cascade Predictions

```
Fix 139 (merchant sloop) ──→ Pirates outgun merchants 6:3 = 2:1 ratio
                           ──→ Pre-broadside surrender triggers every time
                           ──→ Zero hull damage per pirate raid
                           ──→ Pirates survive 180 days instead of dying by Day 50

Fix 140 (infamy surrender) ──→ High-infamy pirates terrify even armed merchants
                             ──→ Infamy rewards raiding (positive feedback loop)
                             ──→ Navy still resists (historically accurate)

Fix 141 (NPC armament)  ──→ NPC trading sloops have 2 guns, 24 crew
                          ──→ Auto-combat encounters are easy captures
                          ──→ More cargo seized per encounter
                          ──→ Richer prizes for pirate economy

Fix 142 (claim_prize)   ──→ Pirate captures brigantine/merchantman at port
                          ──→ Swaps from 6-gun sloop to 16-gun brigantine
                          ──→ Natural progression: sloop → brigantine → merchantman
                          ──→ Bigger cargo capacity = bigger fence payouts

Fix 143 (name dedup)    ──→ No more 6x "Revenge" in fleet
                          ──→ Better immersion

Fix 144 (crew preserved) ──→ Pirates keep 50-crew advantage
                           ──→ CrewRatio 4.17 reliably triggers surrender
                           ──→ Boarding phase overwhelming if broadside reached

Combined: Merchants surrender without a fight × pirates survive longer × 
         infamy rewards raiding × claim_prize progression × 
         more cargo per raid × better fencing economy
         = target: <5% mortality, 100+ fence transactions, pirate avg cash positive
```

---

### Run 44 — Batch 21 Validation (10 agents, 30 days)

- **Config**: 10 agents, 30 days, vLLM Qwen 3.5-9B
- **Duration**: 720 ticks, 833 decisions, 8 ticks skipped
- **Result**: All Batch 21 fixes confirmed working except claim_prize (insufficient agents to trigger).

#### Key Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| Deaths | **0** | All 10 agents alive through Day 30 |
| Combat events | 7 sea battles | Active |
| Navy cases | 1 | Legal pipeline activating |
| Reputation records | 32 | Growing |
| Wounds | 16 | Manageable |
| Fence trust | Nassau at 69 | Strong trust building |

#### Captain Status at Day 30

| Captain | Type | Ship | Guns | Crew | Hull | Cash | Infamy |
|---------|------|------|------|------|------|------|--------|
| Cudjoe One-Eye | pirate_captain | sloop | 6 | 6* | 83 | 24 | 10 |
| Richard Ward | merchant_captain | sloop | 3 | 8 | 70 | 105 | 0 |
| Esteban Mendoza | privateer_captain | brigantine | 9 | 23 | 49 | 12 | 12 |
| Pedro Mendoza | naval_officer | frigate | 21 | 139 | 70 | 265 | 8 |

*Pirate crew at 6 instead of 50 due to Fix 144 not yet applied in this run.

#### Batch 21 Validation

| Fix | Status | Evidence |
|-----|--------|----------|
| Fix 139 (merchant→sloop) | **CONFIRMED** | Merchant: sloop 3 guns/12 crew. Pirate: sloop 6 guns |
| Fix 140 (infamy surrender) | **CONFIRMED** | Pirate hull 83 after 7 battles — minimal broadside damage |
| Fix 141 (NPC armament) | **CONFIRMED** | NPC encounters producing surrenders |
| Fix 142 (claim_prize) | **NOT TRIGGERED** | No captured ships at pirate's port — needs 100 agents |
| Fix 143 (name dedup) | **CONFIRMED** | No duplicate ship names |
| Fix 144 (crew preserved) | **APPLIED POST-RUN** | Will be validated in Run 45 |

#### Notable Observations

- **Pirate hull 83 after 30 days of raiding** — previously pirates were at 40-50 after this many fights. Surrender mechanic preventing broadside damage.
- **Richard Ward (merchant) captured and reclaimed 5 times** — the capture→imprison→release→reclaim cycle working perfectly.
- **Force-dock fired 6 times** for stuck-at-sea captains — safety net working.
- **Zero deaths** in 30 days — previously 22% mortality at Day 25 (Run 39b).
- **Merchant sloop cargo capacity (40) is much less than merchantman (200)** — individual prizes are smaller but raids are free (no damage). To be monitored in full 180-day run.


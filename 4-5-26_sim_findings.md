# Sim Findings — April 5, 2026

Run: 100 agents, 90 days, Qwen3.5-9B-Q4_K_M on port 8081
25,220 decisions, 0 errors, 0 skipped ticks, ~3.3h runtime

---

## False Positives — What Looks Good But Isn't

### 1. "1,533 Negotiate actions" — ALL ARE HOLLOW

Every single negotiate outcome is `"Negotiated with [name] — terms agreed"`. The executor (`commerce-actions.ts:executeNegotiate`) just picks a random agent at the same port and adds +5 fondness / +3 trust to the relationship table. No gold changes hands, no deal is struck, no cargo moves. It's a relationship stat bump disguised as an action. Agents burn 6% of all decisions on what is effectively a no-op that the LLM thinks is meaningful.

### 2. "1,150 Eavesdrop actions" — Identical filler

Every single one: `"Overheard useful information"`. The executor creates one intel DB row about a random agent at the same port. No gold earned, no actionable outcome. Another ~5% of decisions wasted.

### 3. "874 sell_intel actions" — ALL pay exactly 5 gold

Every single sell_intel: `"Sold intel for 5"`. Hardcapped at 5g per sale (`Math.min(price, 5)` in `intel-actions.ts:30`). Informants execute this 874 times x 5g = 4,370g total revenue across ALL informants for 90 days. That's 624g per informant. Meanwhile the buyer loses 5g every time — it's just draining random agents at the port.

### 4. "381 broker_deal actions" — Pure relationship fluff

Same pattern: picks 2 random agents at port, adds +3 fondness/+2 trust. The "deal" message is cosmetic — `"Brokered a deal between X and Y"` but nothing actually trades. No gold, no cargo, no real deal.

### 5. Trade is ONLY luxury goods, quantities of 1

Buys: 51 coins, 26 silver, 18 emeralds, 14 silk, 13 cochineal. Zero sugar, rum, tobacco, cotton, rice — the actual bulk commodities. The `executeBuyCargo` smart-picker (`trade-actions.ts`) scores by `marginRatio * 100 + categoryBonus` where luxury gets +50 bonus. So every merchant buys 1 emerald for 400g or 1 silver for 100g. Nobody is doing bulk commodity trade.

Buy quantity distribution: 163 buys of quantity 1, 12 buys of quantity 6. Almost all single-unit purchases.

### 6. Trade math: Buying and selling at SAME ports

Examples from cargo-trade.jsonl:
- Hernando Mendoza at **santo_domingo** — sold emeralds for 320, bought emeralds for 400. Net: **-80g**
- Cudjoe Ironhand at **willemstad** — sold for 320, bought for 400. Net: **-80g**
- William Wright at **petit_goave** — sold for 340, bought for 400. Net: **-60g**

The `trade_cargo` action sells then immediately rebuys at the same port. Buy at 400, sell at 320 (80% spread). Guaranteed 20% loss on every cycle. Merchants aren't sailing between origin/destination ports to capture the route margin — they're churning at the same port.

### 7. Total trade economy: Spending > Earning

- 208 buys for 22,435g spent
- 145 sells for 20,756g earned
- **Net trade loss: -1,679g across the entire sim**

The trade system is a gold sink, not a gold generator.

### 8. "362 steal actions" — 61% fail

- 220 "Caught stealing — punished"
- 142 "Stole from the ship's stores"

Crew members stealing fails most of the time, and the "punishment" doesn't generate meaningful consequences.

### 9. Combat looks active but is 90% evasion

2,113 combat events. Breakdown of board_ship outcomes:
- 70 "escape/Defeat, hull damage 4"
- 69 "escape/Defeat, hull damage 2"
- 65 "escape/Defeat, hull damage 3"
- 65 "escape/Defeat, hull damage 1"
- 59 "Victory/Cargo seized/Ship captured"
- 53 "escape/Defeat, hull damage 0"
- 3 actual boarding victories

The vast majority of "combat" is flee/escape/surrender with 0-4 hull damage. Only 59 ship captures across 90 days.

### 10. Crew still stuck at 20

Despite adding `join_crew` to crew_member tools this session, crew total ended at 20. The LLM prefers gamble/steal/drink/fight over join_crew because those sound more fun to the model. The action is available but never chosen.

---

## What's Actually Generating Gold

The real economy is:
- **Pirates**: attack NPC ships -> seize cargo -> fence it (zero acquisition cost)
- **Officials**: accept_bribe (5-15g each, hundreds of times)
- **Tavern keepers**: serve_drinks (flat income per action)
- **Plantation owners**: sell_crop
- **Merchants**: docked income subsidy (the only thing keeping them alive)

Trade between ports — the intended core economy — is actually a net gold drain.

---

## Wealth Distribution (end of 90 days)

| Type | Avg Cash | Min | Max | Count |
|------|---------|-----|-----|-------|
| pirate_captain | 4,665 | 1,302 | 14,561 | 7 |
| privateer_captain | 2,308 | -408 | 8,985 | 6 |
| tavern_keeper | 1,940 | 1,468 | 2,541 | 7 |
| harbor_master | 1,661 | 632 | 4,591 | 6 |
| plantation_owner | 1,112 | 115 | 2,060 | 6 |
| pirate_hunter | 1,064 | 67 | 3,847 | 5 |
| port_governor | 1,031 | 82 | 2,489 | 7 |
| quartermaster | 1,008 | -36 | 4,684 | 7 |
| surgeon | 853 | 420 | 1,985 | 6 |
| informant | 382 | 38 | 930 | 7 |
| crew_member | 365 | -65 | 1,102 | 7 |
| shipwright | 336 | 215 | 439 | 6 |
| naval_officer | 298 | 53 | 458 | 7 |
| fence | 130 | -26 | 314 | 7 |
| merchant_captain | 69 | 2 | 192 | 7 |

Merchants start with 1,000g and end at 69g avg. Piracy is the only reliable wealth path.

---

## Data Integrity Issues Fixed This Session

1. **cargo-trade.jsonl was EMPTY** (557 rows in prior run, zero data fields) — `buyGoods()`/`sellGoods()` returned data at top-level not in `.data`. Fixed in `trade-actions.ts`.
2. **navigation arrivals missing agentId** (3,139/5,398 rows) — `travel-tick.ts` arrival logging didn't pass agentId. Fixed.
3. **Most JSONL categories were never written** — harness `logActionCounters` only incremented tick counters without calling `logger.log()`. Added log calls for all action categories.
4. **Daily agent-states and economy snapshots** — added at day boundary in harness tick loop.
5. **Memory creation logging** — now logs to memories.jsonl when cognitive memories are created.

---

## Balance Changes Made This Session

1. **Combat lethality**: 15% captain death chance when ship sinks (was 0%), combat wound generation (10-30% per engagement, severity 3-8)
2. **Crew system**: Added `join_crew` to crew_member tools (was missing entirely)
3. **Merchant recovery**: Scaled docked income — broke merchants get 8g/tick, normal 5g/tick
4. **Trade good consumption**: Destination ports now consume trade goods (0.003 per 1000 pop/tick) to create supply shortages

---

## Root Causes — ALL ADDRESSED (session 2)

1. ~~**trade_cargo sells and rebuys at same port**~~ — **FIXED.** See Fixes Applied #6-7 below.
2. ~~**Cargo picker always chooses luxury**~~ — **FIXED.** See Fixes Applied #6 below.
3. ~~**Negotiate/eavesdrop/broker_deal are hollow busywork**~~ — **FIXED.** See Fixes Applied #8-10 below.
4. ~~**sell_intel capped at 5g**~~ — **FIXED.** See Fixes Applied #11 below.
5. ~~**No route-based trade logic**~~ — **FIXED.** See Fixes Applied #6-7 below.
6. ~~**Combat is 90% evasion**~~ — **FIXED.** See Fixes Applied #12 below.
7. ~~**Crew join rate near zero**~~ — **FIXED.** See Fixes Applied #13-14 below.

---

## Fixes Applied — Session 2

### 6. Trade cargo picker: route-based profit scoring (replaces luxury bias)

**File:** `engine/src/engine/actions/trade-actions.ts` — `executeBuyCargo()` scoring block

**Was:** Scoring used `marginRatio * 100 + categoryBonus + basePrice * 0.1` where `marginRatio` was `sellPrice / buyPrice` **at the same port** (always < 1.0 due to buy/sell spread), so the +50 luxury `categoryBonus` dominated every decision. Every merchant bought 1 emerald at 400g.

**Now:** Scoring computes actual route profit:
- For each affordable cargo, finds the best sell price at any **destination port** via `calculatePrice(destPort, cargoType).sellPrice`
- `profitPerUnit = bestDestSellPrice - currentBuyPrice`
- `totalProfit = profitPerUnit * buyableQuantity` — naturally favors bulk commodities (sugar: 50 units × 15g margin = 750g profit vs emeralds: 1 unit × 100g margin = 100g profit)
- 1.5x origin bonus when the current port sources the cargo (cheapest prices)
- All category bonuses (`+50 luxury`, `+10 military`, etc.) **removed entirely**
- Goods with no profitable route (`profitPerUnit <= 0`) scored at 0 and filtered out
- If no goods have profitable routes from this port, returns `"No profitable trade routes from this port"` instead of buying

**Impact:** Merchants buy bulk commodities at origin ports (sugar at Port Royal for 16g) and must sail to destination ports (London/Boston) to sell profitably. Luxury goods only win when they genuinely have the best total profit potential across the route.

### 7. trade_cargo: eliminates same-port sell→rebuy churn

**File:** `engine/src/engine/actions/trade-actions.ts` — `executeTradeCargo()`

**Was:** After selling all cargo, unconditionally called `executeBuyCargo` which happily rebought at the same port. Merchants sold emeralds for 320g then bought emeralds for 400g = guaranteed -80g per cycle.

**Now:** The route-based scoring in fix #6 naturally solves this. When a merchant sells at a destination port (e.g., santo_domingo), the `executeBuyCargo` call finds that goods available here have low or negative route profit (destination prices are high, not origin prices), so it returns "No profitable trade routes" and the merchant just pockets the sale proceeds. The merchant then sails to an origin port to load up cheaply.

**Impact:** Trade becomes a real route: buy cheap at origin → sail → sell expensive at destination → sail to next origin. The -1,679g net trade loss should flip to net positive.

### 8. Negotiate: real gold exchange instead of +1g fluff

**File:** `engine/src/engine/actions/commerce-actions.ts` — `executeNegotiate()`

**Was:** Both parties got +1g and +5 fondness/+3 trust. 20% chance of generic trade route intel. 1,533 negotiations = 1,533g each = meaningless.

**Now:**
- Gold scales with port prosperity: `5 + floor(prosperity / 10)` = **5-15g per party** (prosperity 0-100)
- Trade route intel chance raised from 20% to **50%** — half of negotiations produce actionable route intel
- Message reflects actual value: `"Negotiated with X — deal struck for 12 gold each"`
- Relationship bonuses unchanged (+5 fondness, +3 trust)

**Impact:** 1,533 negotiations at avg 10g = ~15,330g per participant instead of 1,533g. Meaningful income for diplomatic agent types (governors, harbor masters).

### 9. Eavesdrop: actionable market/agent/piracy intel

**File:** `engine/src/engine/actions/commerce-actions.ts` — `executeEavesdrop()`

**Was:** Every single execution: `"Overheard useful information"` with a generic DB row about a random agent's cash. No gold earned, no actionable outcome.

**Now:** Three intel categories (weighted random):
- **40% Market intel** — identifies port shortages (demand > 80, supply < 20) or gluts (supply > 100, demand < 30) with specific cargo names and prices
- **30% Agent intel** — detailed ship sightings: captain name, ship class, gun count, approximate wealth
- **30% Piracy/military intel** — names high-infamy pirates prowling nearby waters
- **Always earns 2-5g** tip from selling overheard info on the spot
- Message includes the actual intel content, not generic filler

**Impact:** 1,150 eavesdrops at avg 3.5g = ~4,025g total income. Intel DB rows now contain actionable data (port shortage alerts, ship capabilities, pirate locations) that agents can reference in future decisions.

### 10. Broker Deal: actual cargo exchange + scaled fees

**File:** `engine/src/engine/actions/tavern-actions.ts` — `executeBrokerDeal()`

**Was:** Found 2 random agents, gave +3 fondness/+2 trust, tavern keeper earned flat 10g. No cargo moved, no real deal.

**Now:**
- Finds 2 agents at port sorted by cash (richest first — most likely to trade)
- **Attempts actual cargo exchange**: if agent1 has sellable cargo (heat 0, qty > 0) and agent2 has cash, brokers a real sale — transfers up to 5 units at market price. Cargo removed from seller, gold transferred
- **Broker fee**: 10% of deal value (min 5g) when cargo trades, or 10-20g flat fee scaled by port prosperity when no cargo available
- **Finder bonus**: both deal parties earn 3-8g for participating (their time isn't free)
- Relationship bonuses unchanged (+3 fondness, +2 trust)

**Impact:** 381 broker deals now move actual cargo between agents with real gold flows. Tavern keepers earn 15-40g per deal instead of flat 10g. The two deal participants each earn 3-8g finder bonus plus any trade profit.

### 11. sell_intel: removed 5g hardcap, quality-scaled pricing

**File:** `engine/src/engine/actions/intel-actions.ts` — `executeSellIntel()`

**Was:** `Math.min((params.price as number) ?? 5, 5)` — every sale was exactly 5g regardless of quality. 874 sales × 5g = 4,370g total across all informants for 90 days.

**Now:**
- Removed the `Math.min(price, 5)` hardcap entirely
- Price formula: `10 + floor(accuracy / 10) + floor(freshness / 20)` = **15-24g** range based on intel quality
- Capped at 50% of buyer's available cash (can't bankrupt the buyer)
- Floor of 5g (never sells for less than old cap)
- Buyers sorted by cash descending — informants sell to the richest buyer at port

**Impact:** 874 sales at avg ~19g = ~16,606g total revenue instead of 4,370g. Informants become a viable economic role (avg ~2,372g per informant vs 624g before). Still well below pirate earnings but no longer pocket change.

### 12. Combat escape chance: lowered from ~48% to ~5% for pirate-vs-merchant

**File:** `engine/src/engine/combat.ts` — `calculateEscapeChance()`

**Was:**
- Base 40% escape chance
- Only defender's speed + maneuverability counted; attacker's maneuverability **completely ignored**
- Formula: `0.4 + (defSpeed + defManeuver - atkSpeed) * 0.08`
- Typical merchant (speed 6, maneuver 3) vs pirate sloop (speed 8): `0.4 + (6+3-8)*0.08 = 0.48` = **48% escape**
- Floor 10%, cap 85%

**Now:**
- Base **20%** escape chance
- **Both** ships' speed + maneuverability compared: `(defSpeed + defManeuver) - (atkSpeed + atkManeuver)`
- Formula: `0.20 + mobilityDiff * 0.05`
- Same merchant vs pirate sloop (speed 8, maneuver 7): `0.20 + (9-15)*0.05 = -0.10` → clamped to **5% escape**
- Pirate vs pirate (matched): `0.20 + 0*0.05 = 0.20` = **20% escape**
- Fast schooner fleeing slow frigate: `0.20 + (9+8-7-4)*0.05 = 0.50` = **50% escape** (makes sense)
- Floor **5%**, cap **60%**
- Low visibility bonus reduced from +20% to +15%

**Impact:** The 90% evasion rate should drop dramatically. Merchant ships are now nearly guaranteed to be caught by pirate sloops/schooners (5% escape). Combat will produce more actual engagements, boarding actions, and cargo seizures. Fast ships fleeing slow pursuers can still escape at reasonable rates.

### 13. Force-join: mechanical crew assignment for unassigned crew_members

**File:** `engine/src/sim/harness.ts` — `processAgentBatch()` force-join block

**Was:** `join_crew` was available as an LLM choice but the model never selected it. Crew_members preferred gamble/steal/drink/fight. Crew count stuck at 20 for the entire 90-day sim.

**Now:** New force-join block in the harness (same pattern as force-fence and force-sail):
- Any `crew_member` agent without a ship assignment (`!shipId`) who is in port is **mechanically forced** to execute `join_crew`
- Fires before the LLM decision loop — the model never gets a chance to pick something else
- Logged as `[force-join]` in harness output

**Impact:** Every unassigned crew_member immediately joins the first available ship at their port. Crew counts will grow organically as crew_members are spawned or desert and rejoin.

### 14. Action filter: block entertainment for shipless crew_members

**File:** `engine/src/strategy/action-filter.ts` — `isActionAvailable()` crew action gates

**Was:** `fight`, `gamble`, `drink` only required `!!agent.shipId` — any agent with a ship could use them, but unassigned crew_members could also loiter since these were available to them via other paths.

**Now:** `fight`, `gamble`, `drink` additionally check `agent.type === 'crew_member' && !agent.shipId` → blocked. Unassigned crew_members can only choose `join_crew`, `negotiate`, `gather_intel`, or `do_nothing` (and do_nothing is stripped for crew_members in the harness). Combined with force-join (#13), this is belt-and-suspenders.

**Impact:** Even if force-join misses a crew_member (edge case: no ships at port with room), the LLM's available action list is stripped of entertainment distractions, making `join_crew` the dominant remaining choice.

---

## Files Modified — Session 2

| File | What changed |
|------|-------------|
| `engine/src/engine/actions/trade-actions.ts` | Route-based profit scoring, calculatePrice import, luxury bias removed |
| `engine/src/engine/actions/commerce-actions.ts` | Negotiate gold scaled 5-15g, eavesdrop produces 3 intel types + 2-5g |
| `engine/src/engine/actions/intel-actions.ts` | sell_intel 5g cap removed, price formula 15-24g quality-scaled |
| `engine/src/engine/actions/tavern-actions.ts` | broker_deal attempts real cargo exchange, fee scaled 5-40g |
| `engine/src/engine/combat.ts` | Escape chance base 40%→20%, both ships' maneuverability, cap 85%→60% |
| `engine/src/strategy/action-filter.ts` | fight/gamble/drink blocked for shipless crew_members |
| `engine/src/sim/harness.ts` | force-join block for unassigned crew_members |

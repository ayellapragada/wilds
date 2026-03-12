# Card & Evolution System Redesign

## Problem

The current card system has ~47 Pokemon cards but they feel samey (most effects are +distance, -cost, or +threshold variants), there's no real strategic tension in drafting, and synergies rarely come together into a satisfying "combo" moment. The game needs cards that create distinct playstyles, meaningful draft decisions, and genuine push-your-luck tension.

## Design Goals

1. **Combo payoff moments** — "I built this and it went off" (Slay the Spire feeling)
2. **Genuine push-your-luck tension** — "Do I draw one more?" should be a real sweat
3. **Distinct strategies** — different players should be building toward different things
4. **Async-safe interaction** — the draw loop stays solitaire; interaction happens between rounds

## Cost Scale

The cost scale compresses from 0-10 down to **0-3**. With a bust threshold of 8 (varies by route), every card is drawable and the tension shifts from "can I even play this" to "how many more can I fit."

| Cost | Meaning | Frequency |
|------|---------|-----------|
| 0 | Free — always safe, weaker or conditional | Rare, exciting to draw |
| 1 | Standard — most colored cards live here | Most common |
| 2 | Costly — real tradeoff, strong effects | Powerful cards, starters |
| 3 | Obstacle — actively dangerous | Duds only |

Every card has **at least 1 distance**. No dead draws. The tension is in the cost-to-value ratio, not whether a card does anything.

## Type Groups (Color Pie)

Pokemon types map to five color groups. The color pie is an **internal design framework** — players see Pokemon types, not colors. Each group has a philosophy, primary keyword, and secondary keyword.

### Red Types — Fire, Dragon, Fighting — "Go Deep"

Cards that reward drawing many cards in a round. High ceiling, requires commitment to long streaks.

- **Momentum**: "If X+ cards drawn this round, [bonus effect]"
- **Fury**: "Draw an extra card immediately"

### Blue Types — Psychic, Ghost, Water — "Know the Future"

Cards that give information and control over draw order. Reduces variance through skill expression.

- **Foresight**: "Peek at top N cards. You may reorder them."
- **Echo**: "This effect triggers again at start of next round"

### Green Types — Grass, Bug, Ground — "Build Wide"

Cards that scale with allies of the same type. Rewards going deep into one type.

- **Overgrowth**: "+X for each [type] drawn this round"
- **Ramp**: "Reduce cost of cards drawn this round by X"

### White Types — Steel, Rock, Ice, Normal — "Stand Firm"

Cards that increase bust threshold and absorb cost. Lower ceiling but nearly impossible to bust.

- **Shield**: "+X bust threshold this round"
- **Armor**: "Reduce cost of drawn cards by X." Single-target on common cards (next card only), broader on evolved/legendary cards (all duds, or all cards this round).

### Black Types — Dark, Poison, Electric — "Power at a Price"

Cards with broadcast effects that affect all players and bust interaction. The social color.

- **Broadcast**: "End of round: [effect for all players, stronger for you]"
- **Hex**: "On bust: [trigger effect]"

### Allied Pairs (natural synergy)

- Red/Black — reckless power, bust-as-feature
- Black/Blue — information + disruption
- Blue/White — total control
- White/Green — steady unstoppable scaling
- Green/Red — explosive synergy chains

### Enemy Pairs (harder to build, unique payoff)

- Red/White — aggression vs safety
- Blue/Green — precision vs volume
- Black/White — selfishness vs protection
- Red/Blue — speed vs patience
- Green/Black — self-improvement vs table impact

### Type-to-Group Mapping

| Type | Group | Notes |
|------|-------|-------|
| Fire | Red | |
| Dragon | Red | |
| Fighting | Red | |
| Psychic | Blue | |
| Ghost | Blue | Can flex Blue/Black on dual-type cards |
| Water | Blue | |
| Grass | Green | |
| Bug | Green | |
| Ground | Green | |
| Steel | White | |
| Rock | White | |
| Ice | White | |
| Normal | White | |
| Dark | Black | |
| Poison | Black | Can flex Black/Green on dual-type cards |
| Electric | Black | |
| Flying | Flex | Red (aggressive) or Blue (evasive) depending on the Pokemon |
| Fairy | Flex | White (protective) or Green (supportive) depending on the Pokemon |

Dual-type Pokemon naturally bridge groups. Gengar (Ghost/Poison) = Blue/Black. Bulbasaur (Grass/Poison) = Green/Black. This creates organic multicolor cards.

## Synergy Conditions

Synergy conditions reference **specific Pokemon types**, not color groups. Overgrowth says "+1 per Grass drawn" not "+1 per Green drawn." Going deep into one type within a group is stronger than spreading across the group, but cross-type cards within a group share compatible keywords.

## Evolution System

### Core Concept

Pokemon evolve relative to **when they were drafted**, not at fixed game tiers. Any evolution stage can appear in draft pools — you might draft a Charmander (Basic), a Charmeleon (Stage 1), or even a Charizard (Stage 2) directly.

### Evolution Stages

| Stage | Typical Cost | Typical Dist | Feel |
|-------|-------------|-------------|------|
| Basic | 2 | 1 | Almost a dud — investment piece |
| Stage 1 | 1 | 2-3 + effect | Solid, carries its weight |
| Stage 2 | 1 | 3-4 + strong effect | Payoff — one of your best cards |

### Evolution Speed

Each evolution line has a **tiers-to-evolve** number. Evolution happens automatically when enough tiers have passed since drafting.

| Speed | Tiers to evolve | Example |
|-------|----------------|---------|
| Fast | 1 tier | Pikachu → Raichu (2-stage line) |
| Standard | 2 tiers | Charmander → Charmeleon → Charizard |
| Slow | 3 tiers | Abra → Kadabra → Alakazam (huge payoff) |

### Draft Implications

- **Early draft of a Basic**: Weak now, will fully evolve. High investment, high payoff.
- **Late draft of a Basic**: May only reach Stage 1 before game ends. Lower value.
- **Drafting a Stage 1 directly**: Immediately useful, still evolves once. Safe pick.
- **Drafting a Stage 2 directly**: Full power immediately, no growth. Expensive but no waiting.
- **Single-stage cards** (Snorlax, Legendaries): Same value whenever drafted. Immediate power, no evolution.

### Route Pool Composition

| Tier | Pool Contents |
|------|--------------|
| 1-2 | Mostly Basics, occasional single-stage commons |
| 3-4 | Mix of Basics and Stage 1s, single-stage uncommons |
| 5-6 | Stage 1s and Stage 2s, single-stage rares |
| 7-8 | Stage 2s, legendaries |

## Starter Deck

10 cards total. 7 duds + 3 starter Pokemon (one Red, one Blue, one Green).

### Duds (not draftable, permanent)

| Card | Count | Cost | Distance |
|------|-------|------|----------|
| Minor Dud | 4 | 2 | 1 |
| Major Dud | 2 | 3 | 1 |
| Weak Dud | 1 | 1 | 1 |

Duds are **never removed** from the deck. Players manage them through dilution (adding better cards) and through White/Blue cards that mitigate their impact.

### Starters (evolve relative to game start)

| Card | Types | Cost | Dist | Effect | Evolves into |
|------|-------|------|------|--------|-------------|
| Charmander | Fire | 2 | 1 | Momentum: if 3+ cards drawn, +1 dist | Charmeleon → Charizard (standard speed) |
| Squirtle | Water | 2 | 1 | Foresight: peek top 1 | Wartortle → Blastoise (standard speed) |
| Bulbasaur | Grass/Poison | 2 | 1 | Overgrowth: +1 dist if Grass ally drawn | Ivysaur → Venusaur (standard speed) |

Starters begin as near-duds (cost 2, dist 1) but evolve into powerful cards, giving every player a personal progression arc.

## Card Pricing (Hub/Shop)

Price is determined by **rarity x current stage**:

| | Basic | Stage 1 | Stage 2 |
|---|---|---|---|
| **Common** | 2 | 4 | 7 |
| **Uncommon** | 3 | 5 | 8 |
| **Rare** | 5 | 7 | — |
| **Legendary** | 8 | — | — |

Draft economy questions: "Do I spend 2 on a Charmander and wait, or 7 on a Charizard right now?"

## Hub & Shop

- **Non-busted players**: 2 free picks from route's pokemon pool
- **Busted players**: 1 free pick (busting already hurts, total lockout is too punishing)
- **Shop**: 3-4 additional cards for purchase at rarity x stage pricing
- **Rest stops**: Scout (peek upcoming pools), Reinforce (duplicate a card)

## Broadcast System (Player Interaction)

All interaction happens **simultaneously between rounds**. The draw loop stays pure solitaire.

### Broadcast Categories

**Beneficial** (everyone gains, you gain more):
- "End of round: all players +1 currency, you +3"
- "End of round: all players +1 threshold next round, you +2"

**Taxing** (everyone pays a cost, you're exempt or reduced):
- "Next round: all players' first card costs +1, yours doesn't"
- Taxing effects are **rare** — reserved for Rare/Legendary Black cards only

**Conditional** (triggers based on game state):
- "End of round: if you drew 5+ cards, all players draw +1 next round"

### Collapse Resolution (No Stacking)

When multiple players have broadcasts of the same category, only the **strongest** version applies. Broadcasts collapse, they do not stack.

- Player A: "all players +1 currency, you +3"
- Player B: "all players +2 currency, you +4"
- **Result**: Everyone gets +2. Player A gets +3. Player B gets +4. Each owner keeps their personal bonus.

This means:
- One Black player at the table has full impact
- Multiple Black players have diminishing returns — broadcasts overlap
- Naturally discourages everyone going Black, promoting color diversity
- Black cards are most valuable when you're the only one running them

### Broadcast Visibility

All active broadcasts are shown on the TV screen between rounds: "Next round modifiers: +1 currency (Player 2's Poochyena), -1 threshold (Player 3's Darkrai)." Full transparency, no hidden gotchas.

### Design Rules

1. Never remove player agency — broadcasts modify numbers, never force actions
2. Always visible — no hidden effects
3. Beneficial > Taxing — most broadcasts help everyone, you just help yourself more
4. Collapse, don't stack — strongest effect wins per category

## Example Card Catalog (Representative, Not Exhaustive)

### Red — Fire / Dragon / Fighting

| Name | Types | Rarity | Cost | Dist | Effect |
|------|-------|--------|------|------|--------|
| Charmander | Fire | Common | 2 | 1 | Momentum: if 3+ cards drawn, +1 dist |
| Charmeleon | Fire | Common (Stage 1) | 1 | 3 | Fury: draw an extra card |
| Charizard | Fire/Flying | Common (Stage 2) | 1 | 4 | Momentum: +2 dist per Fire drawn. On bust: negate (once) |
| Machop | Fighting | Common | 1 | 2 | Momentum: if 4+ cards drawn, +2 dist |
| Dragonite | Dragon/Flying | Rare | 2 | 3 | Momentum: +1 dist per Dragon drawn. Fury: draw extra if 4+ cards |

### Blue — Psychic / Ghost / Water

| Name | Types | Rarity | Cost | Dist | Effect |
|------|-------|--------|------|------|--------|
| Squirtle | Water | Common | 2 | 1 | Foresight: peek top 1 |
| Wartortle | Water | Common (Stage 1) | 1 | 2 | Foresight: peek top 2 |
| Blastoise | Water | Common (Stage 2) | 1 | 3 | Foresight: peek 3, reorder. Shield: +2 threshold |
| Abra | Psychic | Common | 1 | 1 | Foresight: peek top 2, reorder |
| Alakazam | Psychic | Rare | 2 | 2 | Foresight: peek 3, reorder. Echo: peek 2 next round |
| Mewtwo | Psychic | Legendary | 2 | 3 | Foresight: peek 3, put 1 on bottom. Echo. Shield: +2 threshold |

### Green — Grass / Bug / Ground

| Name | Types | Rarity | Cost | Dist | Effect |
|------|-------|--------|------|------|--------|
| Bulbasaur | Grass/Poison | Common | 2 | 1 | Overgrowth: +1 dist if Grass ally drawn |
| Ivysaur | Grass/Poison | Common (Stage 1) | 1 | 2 | Overgrowth: +1 per Grass drawn |
| Venusaur | Grass/Poison | Common (Stage 2) | 1 | 3 | Overgrowth: +2 per Grass drawn. Ramp: -1 cost all this round |
| Caterpie | Bug | Common | 1 | 1 | Ramp: -1 cost to next card drawn |
| Flygon | Ground/Dragon | Rare | 2 | 3 | Overgrowth: +1 per Ground drawn. Momentum: +2 dist if 4+ cards |

### White — Steel / Rock / Ice / Normal

| Name | Types | Rarity | Cost | Dist | Effect |
|------|-------|--------|------|------|--------|
| Geodude | Rock/Ground | Common | 1 | 2 | Shield: +1 threshold |
| Aron | Steel | Common | 1 | 1 | Shield: +1 threshold. Armor: next card -1 cost |
| Skarmory | Steel/Flying | Uncommon | 1 | 2 | Shield: +2 threshold |
| Snorlax | Normal | Rare | 1 | 2 | Shield: +3 threshold. If drawn first, +2 dist |
| Aggron | Steel/Rock | Legendary | 2 | 2 | Shield: +4 threshold. Armor: all duds -1 cost this round |

### Black — Dark / Poison / Electric

| Name | Types | Rarity | Cost | Dist | Effect |
|------|-------|--------|------|------|--------|
| Poochyena | Dark | Common | 1 | 2 | Broadcast: end of round, all players +1 currency, you +2 |
| Pikachu | Electric | Common | 1 | 2 | Broadcast: all players +1 dist next round, you +2 |
| Sneasel | Ice/Dark | Uncommon | 1 | 3 | Hex: on bust, negate (once per game) |
| Gengar | Ghost/Poison | Rare | 1 | 2 | Foresight: peek 2. Hex: on bust, +3 currency instead of penalty |
| Darkrai | Dark | Legendary | 2 | 3 | Broadcast: all opponents +1 cost to first card next round. Hex: on bust, negate and keep distance |

## Catalog Structure

The full catalog consists of:
- **~20 evolution lines** (each 2-3 stages) — the core of the draft pool
- **~12 single-stage cards** (Rares and Legendaries) — immediate power, no growth
- **7 duds** (starter deck only, not draftable) — permanent danger

Evolution lines should be distributed across all five type groups, with dual-type cards bridging groups to create natural allied-pair synergies.

## Mechanical Definitions

### Bust Threshold

- Starting bust threshold: **8** (per route, may be modified by route modifiers)
- Shield effects add to the threshold for the current round only
- Cost can never go below 0 (floor of 0 on all cost reduction effects including Ramp and Armor)

### Fury (Extra Draw)

When a card with Fury is drawn, the extra draw happens **immediately** before the player's next hit/stop decision. The extra card's cost counts toward bust as normal. The extra draw can trigger its own on_draw abilities (including another Fury), but Fury chains are naturally limited by deck size and bust threshold.

### Echo

Echo effects trigger **once** at the start of the player's next round on the same route. The card does not need to be drawn again — the effect fires from wherever it is (draw pile, discard). Echo does not compound (an Echo'd effect does not Echo again). Echo resets between routes.

### Foresight (Peek/Reorder)

When a card with Foresight is drawn, the player sees the top N cards of their draw pile and may reorder them. This happens immediately after the card is drawn, before the next hit/stop decision. "Put on bottom" variants move a card to the bottom of the draw pile.

### Evolution Timing

Evolution happens **between routes** (during the hub phase transition). When a Pokemon has been in the player's deck for enough tiers (determined by its evolution speed), it automatically transforms into its next stage. The card is replaced in-place in the deck — same position in draw pile, drawn, or discard.

### Dual-Type Keyword Access

A card's keywords are determined by the designer based on the card's types and flavor, using the color pie as a guide. Dual-type cards may use keywords from **either or both** of their type groups. In rare cases, a fully evolved card (Stage 2) may gain a secondary keyword from an adjacent group to represent its power level — e.g., Blastoise (Water/Blue) gaining Shield (White) because Blue/White is an allied pair.

### Dual-Type Catalog Placement

Dual-type cards are placed in the catalog under **whichever type group best represents their primary playstyle**. Gengar (Ghost/Poison) is in the Black catalog because Broadcast/Hex is its defining mechanic, even though Ghost is a Blue type. This is a design decision per card, not a rigid rule.

### Single-Stage Cards

Single-stage cards (Snorlax, Legendaries) are classified as "Basic" stage for pricing purposes. They have no evolution line.

### Rarity Stage Caps

- **Common**: Up to 3 stages (Basic → Stage 1 → Stage 2)
- **Uncommon**: Up to 2 stages (Basic → Stage 1)
- **Rare**: Up to 2 stages (Basic → Stage 1)
- **Legendary**: 1 stage only (no evolution)

### "Ally" Definition

In Overgrowth and similar effects, "ally" means any **other** card of the specified type that was drawn this round (not the card itself).

### Broadcast Timing

Broadcasts resolve **after all players have completed their route** (stopped or busted), before the hub phase begins. "End of round" effects apply immediately (e.g., currency gains). "Next round" effects are applied as modifiers when the next route begins. All broadcasts are displayed on the TV during the transition.

### Broadcast Personal Bonus

Broadcast personal bonuses are **totals, not additive**. If Player A's card says "all +1 currency, you +3," Player A gets 3 currency total, not 1+3=4. The personal bonus replaces the base effect for the owner.

## Key Balance Knobs

- **Bust threshold** (base 8, varies by route): Controls overall risk level
- **Dud ratio in starter deck** (currently 7/10): Controls early-game danger
- **Evolution speed per line** (1-3 tiers): Controls investment vs immediacy
- **Route pool stage distribution**: Controls what's available when
- **Broadcast collapse rules**: Controls Black's table impact
- **Pricing matrix**: Controls economy pacing

# Wilds — Implementation Plan

## Phase E.1: Engine Gaps ✅

> Wire up unused engine mechanics with real content. 158 tests passing.

- Per-route bust threshold — RouteNode defines threshold (start=8, regular=7, elite=5-6, champion=5), trainers reset on route start
- `end_of_round` ability trigger — fires in handleStop and handleBustPenalty on all drawn Pokemon
- `bonus_currency` effect — applied to trainer currency on stop; on bust, only with keep_currency choice
- New Pokemon: Meowth (common, +1 currency/round), Aipom (uncommon, +3 if 4+ draws), Persian (rare, +5 if 5+ draws + on_draw distance)
- Route modifiers — generated per node (elite: cost/threshold penalty; tier 5+: distance bonus; random: type bonus), applied in handleHit
- Removed `baseBustThreshold` from Trainer (route defines the base)

## Phase E.2: Marketplace & Rest Stops

> Between-route phases for team building. Design questions still open.

- [ ] Node bonus types — `marketplace`, `rest_stop`, `event` handlers (deferred from E.1)
- [ ] Marketplace state, creature generation, pricing
- [ ] Buy/sell creatures, currency validation
- [ ] Rest stop logic (threshold boost, creature removal, preview — details TBD)
- [ ] Final scoring refinements for game_over

---

## Phase F: Full Integration Test (deferred)

> Programmatic bot plays entire run end-to-end.

- [ ] `engine/__tests__/full-game.test.ts` — Bot plays complete game loop

---

## Open Design Questions

- **Marketplace specifics:** Shared stock (competitive) vs individual offers? Trading between trainers?
- **Rest stops:** Heal threshold? Remove a creature? Preview draws?
- **Events (random):** Group effects — "a storm reduces everyone's threshold by 2 next route"
- **Turn order:** Random each route? Lowest score first (catchup)?
- **Timer on HIT/STOP:** Keep pacing tight with large groups?
- **Simultaneous mode:** Everyone draws at once instead of taking turns — better for 10+ trainers?
- **Tiebreak rules:** Random among tied options? Something else?
- **Node bonus types:** What happens when you land on a marketplace/rest_stop/event node?

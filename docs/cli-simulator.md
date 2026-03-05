# CLI Game Simulator

Run automated or interactive games from the terminal to test game balance without the full stack.

## Quick Start

```bash
npm run sim                    # 100 games, 3 players, random strategy
npm run sim:interactive        # Step through a game manually
```

## Bulk Mode

Run many games and get aggregate stats.

```bash
npm run sim -- --games 1000 --players 4 --strategy aggressive
```

**Flags:**
- `--games N` — number of games to run (default: 100)
- `--players N` — players per game (default: 3)
- `--strategy NAME` — strategy for all players (default: random)

**Output example:**
```
Strategy  Games  Avg Score  Avg Currency  Bust Rate  Draws/Round  Avg Rounds  Win Rate
--------  -----  ---------  ------------  ---------  -----------  ----------  --------
  random    150       42.7           9.3       4.3%         1.91        10.0     33.3%
```

## Interactive Mode

Step through a single game action by action.

```bash
npm run sim:interactive -- --players 2
```

**Commands:**

| Command | Action |
|---------|--------|
| `h` | Hit (draw a pokemon) |
| `s` | Stop exploring |
| `ks` | Keep score (bust penalty) |
| `kc` | Keep currency (bust penalty) |
| `sel <id>` | Select pokemon by ID (hub) |
| `confirm` | Confirm hub selections |
| `vote <id>` | Vote for a map node (world) |
| `auto` | Auto-play other trainers with conservative strategy |
| `state` | Dump full game state as JSON |
| `help` | Show command list |
| `quit` | Exit |

You control player 1. Other players are idle until you type `auto`, which plays them through the current phase using the conservative strategy.

## Strategies

| Name | Route Behavior | Bust Rate |
|------|---------------|-----------|
| `aggressive` | Always hit until bust or deck empty | ~100% |
| `conservative` | Stop when cost > 60% of threshold or 3+ pokemon drawn | ~2-3% |
| `random` | Must hit once, then 50/50 hit/stop | ~4-5% |

All strategies use the same hub behavior (select free picks, confirm) and world behavior (vote for random node).

## Writing Custom Strategies

Strategies live in `engine/sim/strategies.ts`. A strategy is:

```typescript
interface PlayerStrategy {
  name: string;
  route: (state: GameState, trainerId: string) => Action;
  hub: (state: GameState, trainerId: string) => Action[];
  world: (state: GameState, trainerId: string) => Action;
}
```

Add your strategy to the `strategies` record to make it available via `--strategy NAME`.

## File Structure

```
engine/sim/
  run.ts          # CLI entry point (bulk + interactive modes)
  runner.ts       # Core game loop
  strategies.ts   # Player strategy definitions
  stats.ts        # Stat aggregation and table formatting
```

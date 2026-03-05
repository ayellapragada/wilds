#!/usr/bin/env node

import { runGame } from "./runner";
import { aggregateResults, formatTable } from "./stats";
import { strategies, autoBustPenalty } from "./strategies";
import type { PlayerStrategy } from "./strategies";
import type { Action } from "../types";
import { createInitialState } from "../index";
import { resolveAction } from "../action-resolver";

// --- Arg parsing ---

const args = process.argv.slice(2);

function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function hasFlag(...names: string[]): boolean {
  return names.some((n) => args.includes(n));
}

const isInteractive = hasFlag("-i", "--interactive");
const numPlayers = parseInt(getArg("--players", "3"), 10);
const numGames = parseInt(getArg("--games", "100"), 10);
const strategyName = getArg("--strategy", "random");

// --- Helpers ---

function makePlayerStrategies(
  count: number,
  stratName: string,
): Record<string, PlayerStrategy> {
  const strat = strategies[stratName];
  if (!strat) {
    console.error(
      `Unknown strategy: "${stratName}". Available: ${Object.keys(strategies).join(", ")}`,
    );
    process.exit(1);
  }
  const record: Record<string, PlayerStrategy> = {};
  for (let i = 0; i < count; i++) {
    record[`player${i + 1}`] = strat;
  }
  return record;
}

// --- Bulk mode ---

function runBulk() {
  console.log(
    `Running ${numGames} games with ${numPlayers} players using "${strategyName}" strategy...\n`,
  );

  const results = [];
  for (let i = 0; i < numGames; i++) {
    const playerStrats = makePlayerStrategies(numPlayers, strategyName);
    results.push(runGame(playerStrats));
  }

  const stats = aggregateResults(results);
  console.log(formatTable(stats));

  const avgRounds =
    results.reduce((sum, r) => sum + r.rounds, 0) / results.length;
  console.log(`\nAvg rounds per game: ${avgRounds.toFixed(1)}`);
}

// --- Interactive mode ---

async function runInteractive() {
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  const trainerIds: string[] = [];
  for (let i = 0; i < numPlayers; i++) {
    trainerIds.push(`player${i + 1}`);
  }

  const myId = trainerIds[0];

  // Set up game
  let state = createInitialState("sim");
  let events: any[] = [];

  for (const id of trainerIds) {
    [state, events] = resolveAction(state, {
      type: "join_game",
      trainerName: id,
      sessionToken: id,
    });
  }

  [state, events] = resolveAction(state, {
    type: "start_game",
    trainerId: myId,
  });

  function showEvents(evts: any[]) {
    for (const e of evts) {
      console.log(`  [event] ${e.type}`, JSON.stringify(e));
    }
  }

  function showState() {
    const t = state.trainers[myId];
    console.log(`\n--- Phase: ${state.phase} | Route #${state.routeNumber} ---`);
    if (t) {
      console.log(
        `  You (${myId}): score=${t.score} currency=${t.currency} status=${t.status}`,
      );
      if (state.phase === "route") {
        console.log(
          `  Route progress: drawn=${t.routeProgress.pokemonDrawn} cost=${t.routeProgress.totalCost} threshold=${t.bustThreshold}`,
        );
        if (t.deck.drawn.length > 0) {
          console.log(
            `  Drawn pokemon: ${t.deck.drawn.map(p => `${p.name}(cost=${p.cost})`).join(", ")}`,
          );
        }
      }
    }

    // Other trainers
    for (const id of trainerIds) {
      if (id === myId) continue;
      const ot = state.trainers[id];
      if (ot) {
        console.log(
          `  ${id}: score=${ot.score} currency=${ot.currency} status=${ot.status}`,
        );
      }
    }

    // Hub info
    if (state.phase === "hub" && state.hub) {
      const freeOffers = state.hub.freePickOffers[myId] ?? [];
      console.log(
        `  Free picks: ${freeOffers.map((p) => `${p.name}(id=${p.id})`).join(", ") || "none"}`,
      );
      if (state.hub.shopPokemon.length > 0) {
        console.log(
          `  Shop: ${state.hub.shopPokemon.map((p) => `${p.name}(id=${p.id}, price=${state.hub!.shopPrices[p.id]})`).join(", ")}`,
        );
      }
      console.log(
        `  Confirmed: ${state.hub.confirmedTrainers.join(", ") || "none"}`,
      );
    }

    // World info
    if (state.phase === "world" && state.map) {
      const current = state.map.nodes[state.map.currentNodeId];
      console.log(`  Current node: ${state.map.currentNodeId}`);
      console.log(`  Available nodes: ${current.connections.join(", ")}`);
      if (state.votes) {
        console.log(`  Votes: ${JSON.stringify(state.votes)}`);
      }
    }
  }

  function showHelp() {
    console.log(`
Commands:
  h           - Hit (draw a pokemon)
  s           - Stop exploring
  ks          - Keep score (bust penalty)
  kc          - Keep currency (bust penalty)
  sel <id>    - Select pokemon by ID
  confirm     - Confirm hub selections
  vote <id>   - Vote for a map node
  auto        - Auto-play other trainers (conservative)
  state       - Dump full state as JSON
  help        - Show this help
  quit        - Exit
`);
  }

  function doAction(action: Action) {
    try {
      const [newState, newEvents] = resolveAction(state, action);
      state = newState;
      showEvents(newEvents);
    } catch (e: any) {
      console.log(`  [error] ${e.message}`);
    }
  }

  function autoPlayOthers() {
    const conservativeStrat = strategies.conservative;
    for (const id of trainerIds) {
      if (id === myId) continue;

      if (state.phase === "route") {
        let safety = 0;
        while (safety < 200) {
          const trainer = state.trainers[id];
          if (!trainer || trainer.status !== "exploring") break;
          const action = conservativeStrat.route(state, id);
          doAction(action);

          const updated = state.trainers[id];
          if (updated?.status === "busted") {
            doAction(autoBustPenalty(id));
            break;
          }
          if (updated?.status === "stopped" || action.type === "stop") break;
          safety++;
        }
      }

      if (state.phase === "hub") {
        const hubActions = conservativeStrat.hub(state, id);
        for (const action of hubActions) {
          doAction(action);
        }
      }

      if (state.phase === "world") {
        const alreadyVoted = state.votes && state.votes[id] !== undefined;
        if (!alreadyVoted) {
          const action = conservativeStrat.world(state, id);
          doAction(action);
        }
      }
    }
  }

  showEvents(events);
  showState();
  showHelp();

  while (state.phase !== "game_over") {
    const input = await prompt("\n> ");
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    switch (cmd) {
      case "h":
        doAction({ type: "hit", trainerId: myId });
        break;
      case "s":
        doAction({ type: "stop", trainerId: myId });
        break;
      case "ks":
        doAction({
          type: "choose_bust_penalty",
          trainerId: myId,
          choice: "keep_score",
        });
        break;
      case "kc":
        doAction({
          type: "choose_bust_penalty",
          trainerId: myId,
          choice: "keep_currency",
        });
        break;
      case "sel":
        if (parts[1]) {
          doAction({
            type: "select_pokemon",
            trainerId: myId,
            pokemonId: parts[1],
          });
        } else {
          console.log("Usage: sel <pokemonId>");
        }
        break;
      case "confirm":
        doAction({ type: "confirm_selections", trainerId: myId });
        break;
      case "vote":
        if (parts[1]) {
          doAction({ type: "cast_vote", trainerId: myId, nodeId: parts[1] });
        } else {
          console.log("Usage: vote <nodeId>");
        }
        break;
      case "auto":
        autoPlayOthers();
        break;
      case "state":
        console.log(JSON.stringify(state, null, 2));
        break;
      case "help":
        showHelp();
        break;
      case "quit":
      case "q":
        rl.close();
        process.exit(0);
      default:
        console.log('Unknown command. Type "help" for available commands.');
    }

    showState();
  }

  // Game over
  console.log("\n=== GAME OVER ===");
  for (const id of trainerIds) {
    const t = state.trainers[id];
    if (t) {
      console.log(`  ${id}: score=${t.score} currency=${t.currency}`);
    }
  }

  rl.close();
}

// --- Main ---

if (isInteractive) {
  runInteractive().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  runBulk();
}

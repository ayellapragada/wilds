import type { GameState, GamePhase, Trainer, TVViewState, PhoneViewState, TrainerPublicInfo } from "./types";

function computeRiskLevel(trainer: Trainer, phase: GamePhase): "safe" | "risky" | "danger" {
  if (phase !== "route" || trainer.bustThreshold === 0) return "safe";
  const ratio = trainer.routeProgress.totalCost / trainer.bustThreshold;
  if (ratio >= 0.75) return "danger";
  if (ratio >= 0.5) return "risky";
  return "safe";
}

function toPublicInfo(trainer: Trainer, phase: GamePhase): TrainerPublicInfo {
  return {
    id: trainer.id,
    name: trainer.name,
    avatar: trainer.avatar,
    score: trainer.score,
    currency: trainer.currency,
    status: trainer.status,
    bustThreshold: trainer.bustThreshold,
    routeProgress: trainer.routeProgress,
    finalRouteDistance: trainer.finalRouteDistance,
    finalRouteCost: trainer.finalRouteCost,
    deckSize: trainer.deck.drawPile.length + trainer.deck.drawn.length + trainer.deck.discard.length,
    bot: trainer.bot,
    riskLevel: computeRiskLevel(trainer, phase),
    stats: phase === "game_over" ? trainer.stats : undefined,
  };
}

export function createTVView(state: GameState): TVViewState {
  const trainers: Record<string, TrainerPublicInfo> = {};
  for (const [id, trainer] of Object.entries(state.trainers)) {
    trainers[id] = toPublicInfo(trainer, state.phase);
  }

  // Blind voting: redact vote choices until all trainers have voted
  let votes = state.votes;
  if (votes && state.phase === "world") {
    const trainerCount = Object.keys(state.trainers).length;
    const voteCount = Object.keys(votes).length;
    if (voteCount < trainerCount) {
      const redacted: Record<string, string> = {};
      for (const trainerId of Object.keys(votes)) {
        redacted[trainerId] = "__redacted__";
      }
      votes = redacted;
    }
  }

  return {
    type: "tv",
    roomCode: state.roomCode,
    phase: state.phase,
    trainers,
    map: state.map,
    currentRoute: state.currentRoute,
    hub: state.hub,
    votes,
    routeNumber: state.routeNumber,
    settings: state.settings,
    superlatives: state.superlatives,
    event: state.event,
  };
}

export function createPhoneView(state: GameState, trainerId: string): PhoneViewState {
  const me = state.trainers[trainerId];
  if (!me) throw new Error(`Trainer ${trainerId} not found in game state`);

  const otherTrainers: Record<string, TrainerPublicInfo> = {};
  for (const [id, trainer] of Object.entries(state.trainers)) {
    if (id !== trainerId) {
      otherTrainers[id] = toPublicInfo(trainer, state.phase);
    }
  }

  let meForView = me;
  if (state.event?.type === "fog" && state.phase === "route" && me.status === "exploring") {
    const gap = me.bustThreshold - me.routeProgress.totalCost;
    if (gap > 2) {
      meForView = { ...me, bustThreshold: -1 };
    }
  }

  return {
    type: "phone",
    roomCode: state.roomCode,
    phase: state.phase,
    me: meForView,
    otherTrainers,
    currentRoute: state.currentRoute,
    hub: state.hub,
    votes: state.votes,
    routeNumber: state.routeNumber,
    map: state.map,
    settings: state.settings,
    superlatives: state.superlatives,
    event: state.event,
  };
}

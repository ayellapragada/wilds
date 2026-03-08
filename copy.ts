export const copy = {
  // Game mechanics
  cost: "Fatigue",
  distance: "Distance",
  score: "Score",
  currency: "Currency",

  // Stat abbreviations (used inline like "+3d / +2c")
  costAbbr: "f",
  distanceAbbr: "d",

  // Trainer statuses
  statusExploring: "exploring",
  statusStopped: "stopped",
  statusBusted: "busted",

  // Buttons
  hitButton: "HIT",
  stopButton: "STOP",
  confirmButton: "Confirm",
  joinButton: "Join",
  startGameButton: "Start Game",
  keepScoreButton: "Keep Score",
  keepCurrencyButton: "Keep Currency",

  // Headings
  lobby: "Lobby",
  hub: "Hub",
  shop: "Shop",
  trainers: "Trainers",
  standings: "Standings",
  gameOver: "Game Over!",
  drawn: "Drawn",

  // Route types
  elite: "Elite",
  champion: "Champion",
  route: "Route",

  // Messages
  waitingForTrainers: "Waiting for trainers to join...",
  waitingForOthers: "Waiting for others...",
  waitingForStart: "Waiting for game to start...",
  bustMessage: "Busted!",
  choosePenalty: "Choose one to keep:",
  chooseRoute: "Choose Next Route",
  routeComplete: "Route complete! Waiting for votes.",
  votePrompt: "Tap a route to vote",
  votedFor: "You voted for",

  // Connection
  connecting: "Connecting...",
  reconnecting: "Reconnecting...",
  disconnected: "Disconnected. Refresh to try again.",

  // Labels
  free: "FREE",
  confirmed: "confirmed",
  voted: "voted",
  room: "Room",
  joinRoom: "Join a Room",
  roomCode: "Room code",
  tvDisplay: "TV Display",
  phoneController: "Phone Controller",
  playSolo: "Play Solo",
  yourScore: "Your Score",
  rank: "Rank",
  youAre: "You are",

  // Route modifier templates
  modHarshTerrain: "Harsh terrain: +1 fatigue to all draws",
  modThinAir: "Thin air: -1 bust threshold",
  modTailwind: "Tailwind: +1 distance to all draws",
} as const;

/** Build a type terrain modifier description */
export function modTypeTerrain(type: string): string {
  return `${type} terrain: ${type}-type Pokémon get +2 distance`;
}

/** Display label for route node types */
export function nodeTypeLabel(type: string): string {
  switch (type) {
    case "elite_route": return copy.elite;
    case "champion": return copy.champion;
    default: return copy.route;
  }
}

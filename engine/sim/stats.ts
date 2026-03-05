import type { GameResult } from "./runner";

export interface AggregateStats {
  strategy: string;
  games: number;
  avgScore: number;
  avgCurrency: number;
  avgBustRate: number;
  avgDrawsPerRound: number;
  avgRounds: number;
  winRate: number;
}

export function aggregateResults(results: GameResult[]): AggregateStats[] {
  // Group trainer results by strategy
  const byStrategy: Record<string, {
    games: number;
    totalScore: number;
    totalCurrency: number;
    totalBusts: number;
    totalStops: number;
    totalDrawn: number;
    totalRounds: number;
    wins: number;
  }> = {};

  for (const result of results) {
    // Determine winner(s) of this game
    let highScore = -1;
    for (const stats of Object.values(result.trainerStats)) {
      if (stats.score > highScore) highScore = stats.score;
    }

    for (const stats of Object.values(result.trainerStats)) {
      const strat = stats.strategy;
      if (!byStrategy[strat]) {
        byStrategy[strat] = {
          games: 0,
          totalScore: 0,
          totalCurrency: 0,
          totalBusts: 0,
          totalStops: 0,
          totalDrawn: 0,
          totalRounds: 0,
          wins: 0,
        };
      }

      const agg = byStrategy[strat];
      agg.games++;
      agg.totalScore += stats.score;
      agg.totalCurrency += stats.currency;
      agg.totalBusts += stats.bustCount;
      agg.totalStops += stats.stopCount;
      agg.totalDrawn += stats.totalDrawn;
      agg.totalRounds += result.rounds;
      if (stats.score === highScore) agg.wins++;
    }
  }

  const output: AggregateStats[] = [];
  for (const [strategy, agg] of Object.entries(byStrategy)) {
    const totalDecisions = agg.totalBusts + agg.totalStops;
    output.push({
      strategy,
      games: agg.games,
      avgScore: agg.totalScore / agg.games,
      avgCurrency: agg.totalCurrency / agg.games,
      avgBustRate: totalDecisions > 0 ? agg.totalBusts / totalDecisions : 0,
      avgDrawsPerRound: agg.totalRounds > 0 ? agg.totalDrawn / agg.totalRounds : 0,
      avgRounds: agg.totalRounds / agg.games,
      winRate: agg.wins / agg.games,
    });
  }

  return output.sort((a, b) => b.avgScore - a.avgScore);
}

export function formatTable(stats: AggregateStats[]): string {
  const headers = ["Strategy", "Games", "Avg Score", "Avg Currency", "Bust Rate", "Draws/Round", "Avg Rounds", "Win Rate"];

  const rows = stats.map(s => [
    s.strategy,
    String(s.games),
    s.avgScore.toFixed(1),
    s.avgCurrency.toFixed(1),
    (s.avgBustRate * 100).toFixed(1) + "%",
    s.avgDrawsPerRound.toFixed(2),
    s.avgRounds.toFixed(1),
    (s.winRate * 100).toFixed(1) + "%",
  ]);

  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const dataMax = rows.reduce((max, row) => Math.max(max, row[i].length), 0);
    return Math.max(h.length, dataMax);
  });

  // Format a row with right-aligned columns
  const formatRow = (cells: string[]) =>
    cells.map((cell, i) => cell.padStart(colWidths[i])).join("  ");

  const headerLine = formatRow(headers);
  const separator = colWidths.map(w => "-".repeat(w)).join("  ");
  const dataLines = rows.map(formatRow);

  return [headerLine, separator, ...dataLines].join("\n");
}

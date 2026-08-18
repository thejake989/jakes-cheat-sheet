import type { ScoringFormat } from "@/types/database";

export interface SeasonRecordRating {
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  grade: string;
}

export function computeSeasonRecordRating(results: { result: "win" | "loss" | "tie" }[]): SeasonRecordRating {
  const wins = results.filter((r) => r.result === "win").length;
  const losses = results.filter((r) => r.result === "loss").length;
  const ties = results.filter((r) => r.result === "tie").length;
  const decided = wins + losses + ties;
  const winPct = decided === 0 ? 0 : (wins + ties * 0.5) / decided;

  return { wins, losses, ties, winPct, grade: pctToGrade(winPct) };
}

export interface RosterStrengthInput {
  starterAvgPoints: number; // avg of starters' recent-form points (or projections, once available)
  leagueAvgPoints: number; // avg starter output across all Teams in this format, for relative grading
}

export interface RosterStrengthRating {
  starterAvgPoints: number;
  vsLeagueAvg: number; // percentage above/below league average
  grade: string;
}

export function computeRosterStrengthRating({ starterAvgPoints, leagueAvgPoints }: RosterStrengthInput): RosterStrengthRating {
  const vsLeagueAvg = leagueAvgPoints === 0 ? 0 : (starterAvgPoints - leagueAvgPoints) / leagueAvgPoints;
  // Center the grade curve on "vs league average" rather than raw points, since raw points
  // are scoring-format-dependent (PPR starters score higher than standard) and this keeps grading fair across formats.
  const pct = 0.5 + vsLeagueAvg; // 0% above average -> 50th percentile equivalent
  return { starterAvgPoints, vsLeagueAvg, grade: pctToGrade(Math.max(0, Math.min(1, pct))) };
}

function pctToGrade(pct: number): string {
  if (pct >= 0.9) return "A+";
  if (pct >= 0.8) return "A";
  if (pct >= 0.7) return "B+";
  if (pct >= 0.6) return "B";
  if (pct >= 0.5) return "C+";
  if (pct >= 0.4) return "C";
  if (pct >= 0.3) return "D+";
  if (pct >= 0.2) return "D";
  return "F";
}

export function fantasyPointsField(format: ScoringFormat): "fantasy_points_standard" | "fantasy_points_ppr" {
  return format === "ppr" ? "fantasy_points_ppr" : "fantasy_points_standard";
}

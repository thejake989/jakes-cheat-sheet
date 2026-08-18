import {
  computeRecentForm,
  computeMatchupFactor,
  computeVenueFactor,
  computeWeatherFactor,
  computePrimetimeFactor,
  computeHomeAwayFactor,
  computeRestFactor,
  computeInjuryDampening,
  computeAgeFactor,
} from "./factors";
import type { HistoricalGame, UpcomingContext, DefenseSplitLookup, ProjectionResult, FactorContribution } from "./types";

export const MODEL_VERSION = "v1";

export function computeProjection(
  games: HistoricalGame[],
  upcoming: UpcomingContext,
  defense: DefenseSplitLookup
): ProjectionResult {
  // Prefer the player's most recent 1-2 seasons of data as the baseline, but fall back to full career
  // history if recent seasons aren't ingested yet (e.g. mid-offseason before the new season's games exist) —
  // an empty "recent" window must never silently produce a baseline of 0, which corrupts every factor
  // that subtracts against it.
  const recentSeasonGames = games.filter((g) => g.season === upcoming.season || g.season === upcoming.season - 1);
  const seasonGames = recentSeasonGames.length ? recentSeasonGames : games;
  const overallAvgStandard = average(seasonGames.map((g) => g.fantasy_points_standard));
  const overallAvgPpr = average(seasonGames.map((g) => g.fantasy_points_ppr));

  const recentStandard = computeRecentForm(games, "fantasy_points_standard");
  const recentPpr = computeRecentForm(games, "fantasy_points_ppr");

  const baseStandard = recentStandard.value;
  const basePpr = recentPpr.value;

  const matchupStd = computeMatchupFactor(defense, "standard");
  const matchupPpr = computeMatchupFactor(defense, "ppr");
  const venue = computeVenueFactorBoth(games, upcoming, overallAvgStandard, overallAvgPpr);
  const weather = computeWeatherFactorBoth(games, upcoming, overallAvgStandard, overallAvgPpr);
  const primetime = computePrimetimeFactorBoth(games, upcoming, overallAvgStandard, overallAvgPpr);
  const homeAway = computeHomeAwayFactorBoth(games, upcoming, overallAvgStandard, overallAvgPpr);
  const rest = computeRestFactor(upcoming.rest_days);
  const injury = computeInjuryDampening(upcoming.reportStatus);
  const age = computeAgeFactor(upcoming.position, upcoming.birthDate, upcoming.season, baseStandard);

  const factors: FactorContribution[] = [
    { label: "Matchup", standard: matchupStd.standard, ppr: matchupPpr.ppr, detail: matchupStd.detail },
    venue,
    weather,
    primetime,
    homeAway,
    rest,
    injury,
    age,
  ];

  // Cap the combined adjustment magnitude relative to the base: individual factors are each modest and
  // defensible, but several pointing the same direction at once (e.g. good matchup + home + primetime boost)
  // could otherwise stack past any realistic single-game ceiling. +/-40% of the base is a generous but bounded swing.
  const capMagnitudeStandard = Math.max(3, baseStandard * 0.4);
  const capMagnitudePpr = Math.max(3, basePpr * 0.4);
  const adjustmentStandard = clamp(sum(factors.map((f) => f.standard)), -capMagnitudeStandard, capMagnitudeStandard);
  const adjustmentPpr = clamp(sum(factors.map((f) => f.ppr)), -capMagnitudePpr, capMagnitudePpr);

  const projectedStandard = Math.max(0, baseStandard + adjustmentStandard);
  const projectedPpr = Math.max(0, basePpr + adjustmentPpr);

  return { baseStandard, basePpr, projectedStandard, projectedPpr, factors };
}

function computeVenueFactorBoth(games: HistoricalGame[], upcoming: UpcomingContext, avgStd: number, avgPpr: number): FactorContribution {
  const std = computeVenueFactor(games, upcoming.stadium, "fantasy_points_standard", avgStd);
  const ppr = computeVenueFactor(games, upcoming.stadium, "fantasy_points_ppr", avgPpr);
  return { label: "Venue history", standard: std.standard, ppr: ppr.ppr, detail: std.detail };
}

function computeWeatherFactorBoth(games: HistoricalGame[], upcoming: UpcomingContext, avgStd: number, avgPpr: number): FactorContribution {
  const std = computeWeatherFactor(games, upcoming, "fantasy_points_standard", avgStd);
  const ppr = computeWeatherFactor(games, upcoming, "fantasy_points_ppr", avgPpr);
  return { label: "Weather", standard: std.standard, ppr: ppr.ppr, detail: std.detail };
}

function computePrimetimeFactorBoth(games: HistoricalGame[], upcoming: UpcomingContext, avgStd: number, avgPpr: number): FactorContribution {
  const std = computePrimetimeFactor(games, upcoming.is_primetime, "fantasy_points_standard", avgStd);
  const ppr = computePrimetimeFactor(games, upcoming.is_primetime, "fantasy_points_ppr", avgPpr);
  return { label: "Primetime", standard: std.standard, ppr: ppr.ppr, detail: std.detail };
}

function computeHomeAwayFactorBoth(games: HistoricalGame[], upcoming: UpcomingContext, avgStd: number, avgPpr: number): FactorContribution {
  const std = computeHomeAwayFactor(games, upcoming.is_home, "fantasy_points_standard", avgStd);
  const ppr = computeHomeAwayFactor(games, upcoming.is_home, "fantasy_points_ppr", avgPpr);
  return { label: "Home/away", standard: std.standard, ppr: ppr.ppr, detail: std.detail };
}

function average(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

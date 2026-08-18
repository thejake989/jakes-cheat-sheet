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
  const seasonGames = games.filter((g) => g.season === upcoming.season || g.season === upcoming.season - 1);
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

  const projectedStandard = Math.max(0, baseStandard + sum(factors.map((f) => f.standard)));
  const projectedPpr = Math.max(0, basePpr + sum(factors.map((f) => f.ppr)));

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

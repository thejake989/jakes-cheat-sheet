import { shrink } from "./shrinkage";
import type { HistoricalGame, UpcomingContext, DefenseSplitLookup, FactorContribution } from "./types";

// Recency weights for the "recent form" base rate: most recent game weighted highest,
// decaying over the last 5 games. Games beyond that fall back to the season-average prior via shrinkage.
const RECENCY_WEIGHTS = [1.0, 0.8, 0.6, 0.45, 0.35];

export function computeRecentForm(games: HistoricalGame[], field: "fantasy_points_standard" | "fantasy_points_ppr") {
  const sorted = [...games].sort((a, b) => b.season - a.season || b.week - a.week);
  const recent = sorted.slice(0, RECENCY_WEIGHTS.length);
  if (!recent.length) return { value: 0, detail: "No game history available" };

  let weightedSum = 0;
  let weightTotal = 0;
  recent.forEach((g, i) => {
    const w = RECENCY_WEIGHTS[i];
    weightedSum += g[field] * w;
    weightTotal += w;
  });
  const value = weightedSum / weightTotal;
  return { value, detail: `Recency-weighted avg over last ${recent.length} games` };
}

export function computeMatchupFactor(
  defense: DefenseSplitLookup,
  field: "standard" | "ppr"
): FactorContribution {
  const allowed = field === "standard" ? defense.fantasyPointsAllowedAvgStandard : defense.fantasyPointsAllowedAvgPpr;
  const leagueAvg = field === "standard" ? defense.leaguePositionAvgStandard : defense.leaguePositionAvgPpr;
  if (allowed == null || leagueAvg === 0) {
    return { label: "Matchup", standard: 0, ppr: 0, detail: "Insufficient defense data" };
  }
  const adjustment = allowed - leagueAvg;
  const value = field === "standard" ? adjustment : 0;
  const pprValue = field === "ppr" ? adjustment : 0;
  return {
    label: "Matchup",
    standard: field === "standard" ? adjustment : value,
    ppr: field === "ppr" ? adjustment : pprValue,
    detail: adjustment >= 0 ? "Opponent allows above-average production to this position" : "Opponent allows below-average production to this position",
  };
}

export function computeVenueFactor(
  games: HistoricalGame[],
  stadium: string | null,
  field: "fantasy_points_standard" | "fantasy_points_ppr",
  overallAvg: number
): FactorContribution {
  if (!stadium) return { label: "Venue history", standard: 0, ppr: 0, detail: "No stadium data for this game" };
  const atVenue = games.filter((g) => g.stadium === stadium);
  if (!atVenue.length) {
    return { label: "Venue history", standard: 0, ppr: 0, detail: `No prior games at ${stadium}` };
  }
  const rawAvg = atVenue.reduce((sum, g) => sum + g[field], 0) / atVenue.length;
  const shrunk = shrink(rawAvg, atVenue.length, overallAvg, 6);
  const adjustment = shrunk - overallAvg;
  const val = field === "fantasy_points_standard" ? adjustment : 0;
  const pprVal = field === "fantasy_points_ppr" ? adjustment : 0;
  return {
    label: "Venue history",
    standard: field === "fantasy_points_standard" ? adjustment : val,
    ppr: field === "fantasy_points_ppr" ? adjustment : pprVal,
    detail: `${atVenue.length} career game(s) at ${stadium}, avg ${rawAvg.toFixed(1)} pts (shrunk for sample size)`,
  };
}

function isOutdoorCold(temp: number | null, roof: string | null) {
  return (roof === "outdoors" || roof === "open") && temp != null && temp <= 40;
}
function isOutdoorWindy(wind: number | null, roof: string | null) {
  return (roof === "outdoors" || roof === "open") && wind != null && wind >= 15;
}

export function computeWeatherFactor(
  games: HistoricalGame[],
  upcoming: UpcomingContext,
  field: "fantasy_points_standard" | "fantasy_points_ppr",
  overallAvg: number
): FactorContribution {
  const upcomingCold = isOutdoorCold(upcoming.temp_f, upcoming.roof);
  const upcomingWindy = isOutdoorWindy(upcoming.wind_mph, upcoming.roof);

  if (!upcomingCold && !upcomingWindy) {
    return { label: "Weather", standard: 0, ppr: 0, detail: "No adverse weather expected" };
  }

  const condition = upcomingCold && upcomingWindy ? "cold/windy" : upcomingCold ? "cold" : "windy";
  const matchingGames = games.filter((g) =>
    upcomingCold ? isOutdoorCold(g.temp_f, g.roof) : isOutdoorWindy(g.wind_mph, g.roof)
  );

  if (!matchingGames.length) {
    return { label: "Weather", standard: 0, ppr: 0, detail: `No prior ${condition}-weather games on record` };
  }

  const rawAvg = matchingGames.reduce((sum, g) => sum + g[field], 0) / matchingGames.length;
  const shrunk = shrink(rawAvg, matchingGames.length, overallAvg, 4);
  const adjustment = shrunk - overallAvg;
  return {
    label: "Weather",
    standard: field === "fantasy_points_standard" ? adjustment : 0,
    ppr: field === "fantasy_points_ppr" ? adjustment : 0,
    detail: `${matchingGames.length} prior ${condition}-weather game(s), avg ${rawAvg.toFixed(1)} pts (shrunk for sample size)`,
  };
}

export function computePrimetimeFactor(
  games: HistoricalGame[],
  isPrimetimeUpcoming: boolean,
  field: "fantasy_points_standard" | "fantasy_points_ppr",
  overallAvg: number
): FactorContribution {
  if (!isPrimetimeUpcoming) {
    return { label: "Primetime", standard: 0, ppr: 0, detail: "Not a primetime game" };
  }
  const primetimeGames = games.filter((g) => g.is_primetime);
  if (!primetimeGames.length) {
    return { label: "Primetime", standard: 0, ppr: 0, detail: "No prior primetime games on record" };
  }
  const rawAvg = primetimeGames.reduce((sum, g) => sum + g[field], 0) / primetimeGames.length;
  const shrunk = shrink(rawAvg, primetimeGames.length, overallAvg, 4);
  const adjustment = shrunk - overallAvg;
  return {
    label: "Primetime",
    standard: field === "fantasy_points_standard" ? adjustment : 0,
    ppr: field === "fantasy_points_ppr" ? adjustment : 0,
    detail: `${primetimeGames.length} prior primetime game(s), avg ${rawAvg.toFixed(1)} pts (shrunk for sample size)`,
  };
}

export function computeHomeAwayFactor(
  games: HistoricalGame[],
  isHomeUpcoming: boolean,
  field: "fantasy_points_standard" | "fantasy_points_ppr",
  overallAvg: number
): FactorContribution {
  const matching = games.filter((g) => g.is_home === isHomeUpcoming);
  if (!matching.length) {
    return { label: "Home/away", standard: 0, ppr: 0, detail: "No prior data for this split" };
  }
  const rawAvg = matching.reduce((sum, g) => sum + g[field], 0) / matching.length;
  const shrunk = shrink(rawAvg, matching.length, overallAvg, 6);
  const adjustment = shrunk - overallAvg;
  return {
    label: "Home/away",
    standard: field === "fantasy_points_standard" ? adjustment : 0,
    ppr: field === "fantasy_points_ppr" ? adjustment : 0,
    detail: `${isHomeUpcoming ? "Home" : "Away"} avg ${rawAvg.toFixed(1)} pts over ${matching.length} games (shrunk)`,
  };
}

export function computeRestFactor(restDays: number | null): FactorContribution {
  if (restDays == null) return { label: "Rest", standard: 0, ppr: 0, detail: "No rest data" };
  if (restDays <= 4) {
    return { label: "Rest", standard: -1, ppr: -1, detail: `Short week (${restDays} days rest)` };
  }
  if (restDays >= 12) {
    return { label: "Rest", standard: 0.5, ppr: 0.5, detail: `Extra rest (${restDays} days, post-bye)` };
  }
  return { label: "Rest", standard: 0, ppr: 0, detail: `Normal rest (${restDays} days)` };
}

export function computeInjuryDampening(reportStatus: string | null): FactorContribution {
  switch (reportStatus) {
    case "Out":
    case "Doubtful":
      return { label: "Injury status", standard: -1, ppr: -1, detail: `${reportStatus} — projection heavily discounted`, };
    case "Questionable":
      return { label: "Injury status", standard: -0.5, ppr: -0.5, detail: "Questionable — projection modestly discounted" };
    default:
      return { label: "Injury status", standard: 0, ppr: 0, detail: "No injury concern reported" };
  }
}

// League-wide age-decline curve, approximated per position from well-documented fantasy aging patterns
// (RBs decline earliest, WR/TE later, QB latest). Applied as a soft multiplicative adjustment near/past
// the position's typical decline age, not a hard cutoff.
const DECLINE_AGE: Record<string, number> = { RB: 28, WR: 30, TE: 30, QB: 35, K: 35 };

export function computeAgeFactor(position: string, birthDate: string | null, asOfSeason: number, baseline: number): FactorContribution {
  if (!birthDate) return { label: "Age curve", standard: 0, ppr: 0, detail: "No birthdate on record" };
  const birthYear = new Date(birthDate).getFullYear();
  const age = asOfSeason - birthYear;
  const declineAge = DECLINE_AGE[position] ?? 32;
  if (age < declineAge) {
    return { label: "Age curve", standard: 0, ppr: 0, detail: `Age ${age}, below typical ${position} decline age (${declineAge})` };
  }
  const yearsPast = age - declineAge;
  // ~4% of baseline production per year past the position's decline age, capped at -30%
  const declinePct = Math.min(0.3, yearsPast * 0.04);
  const adjustment = -baseline * declinePct;
  return {
    label: "Age curve",
    standard: adjustment,
    ppr: adjustment,
    detail: `Age ${age}, ${yearsPast} year(s) past typical ${position} decline age — ${(declinePct * 100).toFixed(0)}% discount`,
  };
}

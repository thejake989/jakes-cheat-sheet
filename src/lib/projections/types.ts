export interface HistoricalGame {
  season: number;
  week: number;
  opponent: string;
  stadium: string | null;
  roof: string | null;
  temp_f: number | null;
  wind_mph: number | null;
  is_primetime: boolean;
  is_home: boolean;
  rest_days: number | null;
  fantasy_points_standard: number;
  fantasy_points_ppr: number;
}

export interface UpcomingContext {
  season: number;
  week: number;
  position: string;
  opponent: string;
  stadium: string | null;
  roof: string | null;
  temp_f: number | null;
  wind_mph: number | null;
  is_primetime: boolean;
  is_home: boolean;
  rest_days: number | null;
  birthDate: string | null;
  reportStatus: string | null; // Questionable / Doubtful / Out / null
}

export interface DefenseSplitLookup {
  fantasyPointsAllowedAvgStandard: number | null;
  fantasyPointsAllowedAvgPpr: number | null;
  leaguePositionAvgStandard: number; // league-wide avg allowed to this position, for normalizing the matchup factor
  leaguePositionAvgPpr: number;
}

export interface FactorContribution {
  label: string;
  standard: number; // additive adjustment, in fantasy points (standard scoring)
  ppr: number; // additive adjustment, in fantasy points (PPR scoring)
  detail: string; // human-readable explanation for the UI
}

export interface ProjectionResult {
  baseStandard: number;
  basePpr: number;
  projectedStandard: number;
  projectedPpr: number;
  factors: FactorContribution[];
}

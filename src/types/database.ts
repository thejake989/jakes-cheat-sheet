export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
export type ScoringFormat = "standard" | "ppr";
export type TrendType = "add" | "drop";

export interface Player {
  id: string;
  sleeper_id: string | null;
  espn_id: string | null;
  yahoo_id: string | null;
  full_name: string;
  position: Position;
  team: string | null;
  status: string | null;
}

export interface PlayerGame {
  id: string;
  player_id: string;
  season: number;
  week: number;
  game_id: string;
  team: string;
  opponent: string;
  is_home: boolean;
  stadium: string | null;
  roof: string | null;
  temp_f: number | null;
  wind_mph: number | null;
  is_primetime: boolean;
  kickoff_at: string | null;
  rest_days: number | null;
  fantasy_points_standard: number;
  fantasy_points_ppr: number;
}

export interface ProjectionFactors {
  recent_form?: number;
  matchup?: number;
  venue?: number;
  weather?: number;
  primetime?: number;
  home_away?: number;
  rest?: number;
  injury_dampening?: number;
}

export interface Projection {
  id: string;
  player_id: string;
  season: number;
  week: number;
  projected_points_standard: number;
  projected_points_ppr: number;
  model_version: string;
  factors: ProjectionFactors;
}

export interface InjuryReport {
  id: string;
  player_id: string;
  season: number;
  week: number;
  report_status: string | null;
  report_primary_injury: string | null;
  practice_status: string | null;
  practice_primary_injury: string | null;
  updated_at: string;
}

export interface TrendingPlayer {
  id: string;
  player_id: string | null;
  sleeper_id: string;
  trend_type: TrendType;
  trend_count: number;
  captured_at: string;
}

export interface Team {
  id: string;
  user_id: string;
  name: string;
  scoring_format: ScoringFormat;
  created_at: string;
}

export interface TeamPlayer {
  id: string;
  team_id: string;
  player_id: string;
  slot: string;
}

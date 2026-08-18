"use server";

import { createClient } from "@/lib/supabase/server";

const CURRENT_SEASON = 2026;
const CURRENT_WEEK = 1;

export interface ComparisonPlayer {
  id: string;
  full_name: string;
  position: string;
  team: string | null;
  projection: {
    projected_points_standard: number;
    projected_points_ppr: number;
    factors: Record<string, { standard: number; ppr: number; detail: string }>;
  } | null;
  injuryStatus: string | null;
  recentGames: { season: number; week: number; opponent: string; fantasy_points_standard: number; fantasy_points_ppr: number }[];
}

export async function getComparisonPlayers(playerIds: string[]): Promise<ComparisonPlayer[]> {
  if (!playerIds.length) return [];
  const supabase = await createClient();

  const [{ data: players }, { data: projections }, { data: injuries }, { data: games }] = await Promise.all([
    supabase.from("players").select("id, full_name, position, team").in("id", playerIds),
    supabase
      .from("projections")
      .select("player_id, projected_points_standard, projected_points_ppr, factors")
      .in("player_id", playerIds)
      .eq("season", CURRENT_SEASON)
      .eq("week", CURRENT_WEEK),
    supabase
      .from("injury_reports")
      .select("player_id, report_status")
      .in("player_id", playerIds)
      .eq("season", CURRENT_SEASON)
      .eq("week", CURRENT_WEEK),
    supabase
      .from("player_games")
      .select("player_id, season, week, opponent, fantasy_points_standard, fantasy_points_ppr")
      .in("player_id", playerIds)
      .order("season", { ascending: false })
      .order("week", { ascending: false }),
  ]);

  const projByPlayer = new Map((projections ?? []).map((p) => [p.player_id, p]));
  const injuryByPlayer = new Map((injuries ?? []).map((i) => [i.player_id, i.report_status]));
  const gamesByPlayer = new Map<string, typeof games>();
  for (const g of games ?? []) {
    const arr = gamesByPlayer.get(g.player_id) ?? [];
    if (arr.length < 5) arr.push(g);
    gamesByPlayer.set(g.player_id, arr as never[]);
  }

  // preserve the order the caller requested (selection order), not DB return order
  const byId = new Map((players ?? []).map((p) => [p.id, p]));
  return playerIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      position: p.position,
      team: p.team,
      projection: projByPlayer.get(p.id) ?? null,
      injuryStatus: injuryByPlayer.get(p.id) ?? null,
      recentGames: (gamesByPlayer.get(p.id) ?? []) as ComparisonPlayer["recentGames"],
    }));
}

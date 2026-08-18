import { createClient } from "@/lib/supabase/server";

const CURRENT_SEASON = 2026;
const CURRENT_WEEK = 1;

export async function getTopProjections(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projections")
    .select("player_id, projected_points_standard, projected_points_ppr, players(full_name, position, team)")
    .eq("season", CURRENT_SEASON)
    .eq("week", CURRENT_WEEK)
    .order("projected_points_ppr", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getHottestWaiverPickups(limit = 10) {
  const supabase = await createClient();
  // most recent snapshot only — trending_players accumulates over time via scheduled ingestion
  const { data: latestSnapshot } = await supabase
    .from("trending_players")
    .select("captured_at")
    .eq("trend_type", "add")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSnapshot) return [];

  const { data } = await supabase
    .from("trending_players")
    .select("player_id, trend_count, players(full_name, position, team)")
    .eq("trend_type", "add")
    .eq("captured_at", latestSnapshot.captured_at)
    .order("trend_count", { ascending: false })
    .limit(limit);
  return (data ?? []).filter((d) => d.players);
}

export interface DropAddSuggestion {
  teamId: string;
  teamName: string;
  benchPlayer: { id: string; name: string; position: string; projection: number };
  waiverPlayer: { id: string; name: string; position: string; projection: number; trendCount: number };
  edge: number;
}

export async function getDropAddSuggestions(): Promise<DropAddSuggestion[]> {
  const supabase = await createClient();

  const { data: teams } = await supabase.from("teams").select("id, name, scoring_format");
  if (!teams?.length) return [];

  const { data: latestSnapshot } = await supabase
    .from("trending_players")
    .select("captured_at")
    .eq("trend_type", "add")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latestSnapshot) return [];

  const { data: trending } = await supabase
    .from("trending_players")
    .select("player_id, trend_count, players(id, full_name, position, team)")
    .eq("trend_type", "add")
    .eq("captured_at", latestSnapshot.captured_at);

  const trendingByPosition = new Map<string, { id: string; name: string; position: string; trendCount: number }[]>();
  for (const t of trending ?? []) {
    const player = Array.isArray(t.players) ? t.players[0] : t.players;
    if (!player) continue;
    const arr = trendingByPosition.get(player.position) ?? [];
    arr.push({ id: player.id, name: player.full_name, position: player.position, trendCount: t.trend_count });
    trendingByPosition.set(player.position, arr);
  }

  const { data: projections } = await supabase
    .from("projections")
    .select("player_id, projected_points_standard, projected_points_ppr")
    .eq("season", CURRENT_SEASON)
    .eq("week", CURRENT_WEEK);
  const projByPlayer = new Map((projections ?? []).map((p) => [p.player_id, p]));

  const suggestions: DropAddSuggestion[] = [];

  for (const team of teams) {
    const { data: roster } = await supabase
      .from("team_players")
      .select("player_id, slot, players(id, full_name, position)")
      .eq("team_id", team.id)
      .eq("slot", "bench");

    for (const r of roster ?? []) {
      const player = Array.isArray(r.players) ? r.players[0] : r.players;
      if (!player) continue;
      const benchProj = projByPlayer.get(player.id);
      const benchPoints = benchProj
        ? team.scoring_format === "ppr"
          ? benchProj.projected_points_ppr
          : benchProj.projected_points_standard
        : 0;

      const candidates = trendingByPosition.get(player.position) ?? [];
      for (const candidate of candidates) {
        const candidateProj = projByPlayer.get(candidate.id);
        if (!candidateProj) continue;
        const candidatePoints = team.scoring_format === "ppr" ? candidateProj.projected_points_ppr : candidateProj.projected_points_standard;
        const edge = candidatePoints - benchPoints;
        if (edge > 2) {
          suggestions.push({
            teamId: team.id,
            teamName: team.name,
            benchPlayer: { id: player.id, name: player.full_name, position: player.position, projection: benchPoints },
            waiverPlayer: { id: candidate.id, name: candidate.name, position: candidate.position, projection: candidatePoints, trendCount: candidate.trendCount },
            edge,
          });
        }
      }
    }
  }

  return suggestions.sort((a, b) => b.edge - a.edge).slice(0, 10);
}

export interface RosteredInjury {
  teamName: string;
  playerId: string;
  playerName: string;
  position: string;
  reportStatus: string | null;
  practiceStatus: string | null;
  reportPrimaryInjury: string | null;
}

export async function getInjuryTracker(): Promise<RosteredInjury[]> {
  const supabase = await createClient();

  const { data: teams } = await supabase.from("teams").select("id, name");
  if (!teams?.length) return [];

  const results: RosteredInjury[] = [];
  for (const team of teams) {
    const { data: roster } = await supabase
      .from("team_players")
      .select("player_id, players(id, full_name, position)")
      .eq("team_id", team.id);

    const playerIds = (roster ?? []).map((r) => r.player_id);
    if (!playerIds.length) continue;

    const { data: injuries } = await supabase
      .from("injury_reports")
      .select("player_id, report_status, practice_status, report_primary_injury")
      .in("player_id", playerIds)
      .eq("season", CURRENT_SEASON)
      .eq("week", CURRENT_WEEK)
      .not("report_status", "is", null);

    const byId = new Map(
      (roster ?? []).map((r) => {
        const p = Array.isArray(r.players) ? r.players[0] : r.players;
        return [r.player_id, p];
      })
    );

    for (const inj of injuries ?? []) {
      const player = byId.get(inj.player_id);
      if (!player) continue;
      results.push({
        teamName: team.name,
        playerId: player.id,
        playerName: player.full_name,
        position: player.position,
        reportStatus: inj.report_status,
        practiceStatus: inj.practice_status,
        reportPrimaryInjury: inj.report_primary_injury,
      });
    }
  }

  return results;
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { computeRosterStrengthRating, computeSeasonRecordRating, fantasyPointsField } from "@/lib/ratings";
import { PlayerSearch } from "./player-search";
import { RosterRow } from "./roster-row";
import { RecordResultForm } from "./record-result-form";
import type { ScoringFormat } from "@/types/database";

const CURRENT_SEASON = new Date().getFullYear();

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: team } = await supabase.from("teams").select("*").eq("id", teamId).single();
  if (!team) notFound();

  const { data: rosterRows } = await supabase
    .from("team_players")
    .select("player_id, slot, players(id, full_name, position, team)")
    .eq("team_id", teamId);

  const { data: results } = await supabase
    .from("team_results")
    .select("season, week, result, team_score, opponent_score")
    .eq("team_id", teamId)
    .order("season", { ascending: false })
    .order("week", { ascending: false });

  const seasonRating = computeSeasonRecordRating(results ?? []);

  const starters = (rosterRows ?? []).filter((r) => r.slot !== "bench");
  const pointsField = fantasyPointsField(team.scoring_format as ScoringFormat);
  let starterAvgPoints = 0;
  if (starters.length) {
    const playerIds = starters.map((s) => s.player_id);
    const { data: recentGames } = await supabase
      .from("player_games")
      .select(`player_id, ${pointsField}`)
      .in("player_id", playerIds)
      .order("season", { ascending: false })
      .order("week", { ascending: false })
      .limit(playerIds.length * 5);

    const byPlayer = new Map<string, number[]>();
    for (const g of recentGames ?? []) {
      const arr = byPlayer.get(g.player_id) ?? [];
      if (arr.length < 5) arr.push((g as unknown as Record<string, number>)[pointsField]);
      byPlayer.set(g.player_id, arr);
    }
    const perPlayerAvg = [...byPlayer.values()].map((pts) => pts.reduce((a, b) => a + b, 0) / pts.length);
    starterAvgPoints = perPlayerAvg.length ? perPlayerAvg.reduce((a, b) => a + b, 0) / perPlayerAvg.length : 0;
  }
  // League-average baseline: until the projection engine (Phase 3) is live, approximate with a fixed
  // per-starter fantasy-point baseline; this keeps the rating meaningful without fabricating a cross-team average.
  const leagueAvgPoints = team.scoring_format === "ppr" ? 12 : 9;
  const rosterRating = computeRosterStrengthRating({ starterAvgPoints, leagueAvgPoints });

  const rosteredIds = (rosterRows ?? []).map((r) => r.player_id);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          <Badge variant="secondary" className="mt-1">
            {team.scoring_format === "ppr" ? "PPR" : "Standard"} scoring
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roster strength</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{rosterRating.grade}</div>
            <p className="text-sm text-muted-foreground">
              Starters avg {rosterRating.starterAvgPoints.toFixed(1)} pts/game (
              {rosterRating.vsLeagueAvg >= 0 ? "+" : ""}
              {(rosterRating.vsLeagueAvg * 100).toFixed(0)}% vs. baseline)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Season record</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{seasonRating.grade}</div>
            <p className="text-sm text-muted-foreground">
              {seasonRating.wins}-{seasonRating.losses}
              {seasonRating.ties ? `-${seasonRating.ties}` : ""} ({(seasonRating.winPct * 100).toFixed(0)}% win rate)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <PlayerSearch teamId={teamId} rosteredIds={rosteredIds} />
          <Separator />
          <div className="grid gap-2">
            {!rosterRows?.length ? (
              <p className="text-sm text-muted-foreground">No players yet. Search above to add your roster.</p>
            ) : (
              rosterRows.map((r) => {
                const player = Array.isArray(r.players) ? r.players[0] : r.players;
                if (!player) return null;
                return (
                  <RosterRow
                    key={r.player_id}
                    teamId={teamId}
                    playerId={r.player_id}
                    fullName={player.full_name}
                    position={player.position}
                    team={player.team}
                    slot={r.slot}
                  />
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly results</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <RecordResultForm teamId={teamId} currentSeason={CURRENT_SEASON} />
          <Separator />
          <div className="grid gap-1">
            {!results?.length ? (
              <p className="text-sm text-muted-foreground">No results recorded yet.</p>
            ) : (
              results.map((r) => (
                <div key={`${r.season}-${r.week}`} className="flex items-center justify-between text-sm">
                  <span>
                    {r.season} Week {r.week}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={r.result === "win" ? "default" : r.result === "loss" ? "destructive" : "secondary"}>
                      {r.result.toUpperCase()}
                    </Badge>
                    {r.team_score != null && r.opponent_score != null && (
                      <span className="text-muted-foreground">
                        {r.team_score} - {r.opponent_score}
                      </span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

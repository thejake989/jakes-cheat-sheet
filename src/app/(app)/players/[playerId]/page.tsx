import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CURRENT_SEASON = 2026;
const CURRENT_WEEK = 1;

export default async function PlayerDetailPage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const supabase = await createClient();

  const { data: player } = await supabase.from("players").select("*").eq("id", playerId).single();
  if (!player) notFound();

  const { data: games } = await supabase
    .from("player_games")
    .select("*")
    .eq("player_id", playerId)
    .order("season", { ascending: false })
    .order("week", { ascending: false });

  const { data: projection } = await supabase
    .from("projections")
    .select("*")
    .eq("player_id", playerId)
    .eq("season", CURRENT_SEASON)
    .eq("week", CURRENT_WEEK)
    .maybeSingle();

  const { data: injury } = await supabase
    .from("injury_reports")
    .select("*")
    .eq("player_id", playerId)
    .eq("season", CURRENT_SEASON)
    .eq("week", CURRENT_WEEK)
    .maybeSingle();

  const allGames = games ?? [];

  // Venue history: group by stadium
  const byStadium = new Map<string, typeof allGames>();
  for (const g of allGames) {
    if (!g.stadium) continue;
    const arr = byStadium.get(g.stadium) ?? [];
    arr.push(g);
    byStadium.set(g.stadium, arr);
  }
  const venueRows = [...byStadium.entries()]
    .map(([stadium, gs]) => ({
      stadium,
      games: gs.length,
      avgPpr: gs.reduce((s, g) => s + g.fantasy_points_ppr, 0) / gs.length,
      avgStd: gs.reduce((s, g) => s + g.fantasy_points_standard, 0) / gs.length,
    }))
    .sort((a, b) => b.games - a.games);

  // Weather splits
  const coldGames = allGames.filter((g) => (g.roof === "outdoors" || g.roof === "open") && g.temp_f != null && g.temp_f <= 40);
  const windyGames = allGames.filter((g) => (g.roof === "outdoors" || g.roof === "open") && g.wind_mph != null && g.wind_mph >= 15);
  const domeGames = allGames.filter((g) => g.roof === "dome" || g.roof === "closed");
  const overallAvgPpr = allGames.length ? allGames.reduce((s, g) => s + g.fantasy_points_ppr, 0) / allGames.length : 0;

  // Primetime split
  const primetimeGames = allGames.filter((g) => g.is_primetime);
  const regularGames = allGames.filter((g) => !g.is_primetime);

  function splitAvg(gs: typeof allGames) {
    return gs.length ? gs.reduce((s, g) => s + g.fantasy_points_ppr, 0) / gs.length : null;
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{player.full_name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{player.position}</Badge>
            {player.team && <span className="text-muted-foreground">{player.team}</span>}
            {injury?.report_status && <Badge variant="destructive">{injury.report_status}</Badge>}
          </div>
        </div>
        <Link href={`/compare?players=${playerId}`} className="text-sm text-muted-foreground underline underline-offset-4">
          Compare this player
        </Link>
      </div>

      {projection && (
        <Card>
          <CardHeader>
            <CardTitle>
              Week {CURRENT_WEEK} projection ({CURRENT_SEASON})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-8">
            <div>
              <div className="text-2xl font-semibold">{projection.projected_points_standard.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Standard</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{projection.projected_points_ppr.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">PPR</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weather splits (PPR avg)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <SplitRow label="Overall" value={overallAvgPpr} count={allGames.length} />
            <SplitRow label="Cold (≤40°F)" value={splitAvg(coldGames)} count={coldGames.length} />
            <SplitRow label="Windy (15+ mph)" value={splitAvg(windyGames)} count={windyGames.length} />
            <SplitRow label="Dome/closed roof" value={splitAvg(domeGames)} count={domeGames.length} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Primetime split (PPR avg)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <SplitRow label="Primetime games" value={splitAvg(primetimeGames)} count={primetimeGames.length} />
            <SplitRow label="Regular slate" value={splitAvg(regularGames)} count={regularGames.length} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Home/away split (PPR avg)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <SplitRow label="Home" value={splitAvg(allGames.filter((g) => g.is_home))} count={allGames.filter((g) => g.is_home).length} />
            <SplitRow label="Away" value={splitAvg(allGames.filter((g) => !g.is_home))} count={allGames.filter((g) => !g.is_home).length} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Venue history</CardTitle>
        </CardHeader>
        <CardContent>
          {!venueRows.length ? (
            <p className="text-sm text-muted-foreground">No venue history on record.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stadium</TableHead>
                  <TableHead>Games</TableHead>
                  <TableHead>Avg Standard</TableHead>
                  <TableHead>Avg PPR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venueRows.map((v) => (
                  <TableRow key={v.stadium}>
                    <TableCell>{v.stadium}</TableCell>
                    <TableCell>{v.games}</TableCell>
                    <TableCell>{v.avgStd.toFixed(1)}</TableCell>
                    <TableCell>{v.avgPpr.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Game log</CardTitle>
        </CardHeader>
        <CardContent>
          {!allGames.length ? (
            <p className="text-sm text-muted-foreground">No games on record.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Season</TableHead>
                  <TableHead>Wk</TableHead>
                  <TableHead>Opp</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Weather</TableHead>
                  <TableHead>Primetime</TableHead>
                  <TableHead>Std</TableHead>
                  <TableHead>PPR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allGames.map((g) => (
                  <TableRow key={g.game_id}>
                    <TableCell>{g.season}</TableCell>
                    <TableCell>{g.week}</TableCell>
                    <TableCell>
                      {g.is_home ? "vs" : "@"} {g.opponent}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{g.stadium ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.temp_f != null ? `${g.temp_f}°F` : g.roof === "dome" || g.roof === "closed" ? "Indoor" : "—"}
                      {g.wind_mph != null && g.wind_mph > 0 ? `, ${g.wind_mph}mph` : ""}
                    </TableCell>
                    <TableCell>{g.is_primetime ? "Yes" : ""}</TableCell>
                    <TableCell>{g.fantasy_points_standard.toFixed(1)}</TableCell>
                    <TableCell>{g.fantasy_points_ppr.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SplitRow({ label, value, count }: { label: string; value: number | null; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">
        {label} <span className="text-xs">({count})</span>
      </span>
      <span className="font-medium">{value != null ? value.toFixed(1) : "—"}</span>
    </div>
  );
}

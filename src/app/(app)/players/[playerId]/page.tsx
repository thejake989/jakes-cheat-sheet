import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PositionBadge } from "@/components/position-badge";
import { StatusPill } from "@/components/status-pill";

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

  const coldGames = allGames.filter((g) => (g.roof === "outdoors" || g.roof === "open") && g.temp_f != null && g.temp_f <= 40);
  const windyGames = allGames.filter((g) => (g.roof === "outdoors" || g.roof === "open") && g.wind_mph != null && g.wind_mph >= 15);
  const domeGames = allGames.filter((g) => g.roof === "dome" || g.roof === "closed");
  const overallAvgPpr = allGames.length ? allGames.reduce((s, g) => s + g.fantasy_points_ppr, 0) / allGames.length : 0;

  const primetimeGames = allGames.filter((g) => g.is_primetime);
  const regularGames = allGames.filter((g) => !g.is_primetime);

  function splitAvg(gs: typeof allGames) {
    return gs.length ? gs.reduce((s, g) => s + g.fantasy_points_ppr, 0) / gs.length : null;
  }

  return (
    <div className="grid gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-wide">{player.full_name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <PositionBadge position={player.position} className="px-2 py-1 text-sm" />
            {player.team && <span className="text-sm text-muted-foreground">{player.team}</span>}
            {injury?.report_status && <StatusPill status={injury.report_status} />}
          </div>
        </div>
        <Link
          href={`/compare?players=${playerId}`}
          className="rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          Sit/Start this player →
        </Link>
      </div>

      {projection && (
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-card p-6">
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary opacity-[0.12] blur-3xl" />
          <div className="relative flex flex-wrap items-end gap-10">
            <div>
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Week {CURRENT_WEEK} projection · {CURRENT_SEASON}
              </div>
            </div>
            <div>
              <div className="font-heading text-5xl leading-none tabular-nums text-foreground">
                {projection.projected_points_standard.toFixed(1)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Standard</div>
            </div>
            <div>
              <div
                className="font-heading text-5xl leading-none tabular-nums text-primary"
                style={{ textShadow: "0 0 28px oklch(0.80 0.15 75 / 40%)" }}
              >
                {projection.projected_points_ppr.toFixed(1)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">PPR</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Weather splits (PPR avg)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <SplitRow label="Overall" value={overallAvgPpr} count={allGames.length} />
            <SplitRow label="Cold (≤40°F)" value={splitAvg(coldGames)} count={coldGames.length} />
            <SplitRow label="Windy (15+ mph)" value={splitAvg(windyGames)} count={windyGames.length} />
            <SplitRow label="Dome/closed roof" value={splitAvg(domeGames)} count={domeGames.length} />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Primetime split (PPR avg)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <SplitRow label="Primetime games" value={splitAvg(primetimeGames)} count={primetimeGames.length} />
            <SplitRow label="Regular slate" value={splitAvg(regularGames)} count={regularGames.length} />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Home/away split (PPR avg)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <SplitRow label="Home" value={splitAvg(allGames.filter((g) => g.is_home))} count={allGames.filter((g) => g.is_home).length} />
            <SplitRow label="Away" value={splitAvg(allGames.filter((g) => !g.is_home))} count={allGames.filter((g) => !g.is_home).length} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-xl font-semibold tracking-wide">Venue history</CardTitle>
        </CardHeader>
        <CardContent>
          {!venueRows.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No venue history on record.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Stadium</TableHead>
                    <TableHead>Games</TableHead>
                    <TableHead>Avg Standard</TableHead>
                    <TableHead>Avg PPR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venueRows.map((v) => (
                    <TableRow key={v.stadium}>
                      <TableCell className="font-medium">{v.stadium}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{v.games}</TableCell>
                      <TableCell className="tabular-nums">{v.avgStd.toFixed(1)}</TableCell>
                      <TableCell className="tabular-nums text-primary">{v.avgPpr.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-xl font-semibold tracking-wide">Game log</CardTitle>
        </CardHeader>
        <CardContent>
          {!allGames.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No games on record.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
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
                      <TableCell className="tabular-nums text-muted-foreground">{g.season}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{g.week}</TableCell>
                      <TableCell className="font-medium">
                        {g.is_home ? "vs" : "@"} {g.opponent}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{g.stadium ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {g.temp_f != null ? `${g.temp_f}°F` : g.roof === "dome" || g.roof === "closed" ? "Indoor" : "—"}
                        {g.wind_mph != null && g.wind_mph > 0 ? `, ${g.wind_mph}mph` : ""}
                      </TableCell>
                      <TableCell>
                        {g.is_primetime && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </TableCell>
                      <TableCell className="tabular-nums">{g.fantasy_points_standard.toFixed(1)}</TableCell>
                      <TableCell className="tabular-nums text-primary">{g.fantasy_points_ppr.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
      <span className="tabular-nums font-medium">{value != null ? value.toFixed(1) : "—"}</span>
    </div>
  );
}

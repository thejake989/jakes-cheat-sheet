import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTopProjections, getHottestWaiverPickups, getDropAddSuggestions, getInjuryTracker } from "./data";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [topProjections, waiverPickups, dropAddSuggestions, injuries] = await Promise.all([
    getTopProjections(),
    getHottestWaiverPickups(),
    getDropAddSuggestions(),
    getInjuryTracker(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly top projections</CardTitle>
          </CardHeader>
          <CardContent>
            {!topProjections.length ? (
              <p className="text-sm text-muted-foreground">No projections available yet.</p>
            ) : (
              <div className="grid gap-2">
                {topProjections.map((p) => {
                  const player = Array.isArray(p.players) ? p.players[0] : p.players;
                  if (!player) return null;
                  return (
                    <div key={p.player_id} className="flex items-center justify-between text-sm">
                      <Link href={`/players/${p.player_id}`} className="flex items-center gap-2 underline-offset-4 hover:underline">
                        <span className="font-medium">{player.full_name}</span>
                        <Badge variant="outline">{player.position}</Badge>
                        <span className="text-muted-foreground">{player.team}</span>
                      </Link>
                      <span className="font-semibold">{p.projected_points_ppr.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hottest waiver pickups</CardTitle>
          </CardHeader>
          <CardContent>
            {!waiverPickups.length ? (
              <p className="text-sm text-muted-foreground">No trending data available yet.</p>
            ) : (
              <div className="grid gap-2">
                {waiverPickups.map((w) => {
                  const player = Array.isArray(w.players) ? w.players[0] : w.players;
                  if (!player) return null;
                  return (
                    <div key={w.player_id} className="flex items-center justify-between text-sm">
                      <Link href={`/players/${w.player_id}`} className="flex items-center gap-2 underline-offset-4 hover:underline">
                        <span className="font-medium">{player.full_name}</span>
                        <Badge variant="outline">{player.position}</Badge>
                        <span className="text-muted-foreground">{player.team}</span>
                      </Link>
                      <span className="text-muted-foreground">{w.trend_count.toLocaleString()} adds</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drop / add suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            {!dropAddSuggestions.length ? (
              <p className="text-sm text-muted-foreground">No suggestions right now — your bench looks solid against trending pickups.</p>
            ) : (
              <div className="grid gap-3">
                {dropAddSuggestions.map((s, i) => (
                  <div key={i} className="grid gap-1 rounded-md border p-2 text-sm">
                    <div className="text-xs text-muted-foreground">{s.teamName}</div>
                    <div className="flex items-center justify-between">
                      <span>
                        Drop <span className="font-medium">{s.benchPlayer.name}</span> ({s.benchPlayer.projection.toFixed(1)} pts)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>
                        Add <span className="font-medium">{s.waiverPlayer.name}</span> ({s.waiverPlayer.projection.toFixed(1)} pts,{" "}
                        {s.waiverPlayer.trendCount.toLocaleString()} adds)
                      </span>
                      <Badge>+{s.edge.toFixed(1)} pts</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Injury tracker</CardTitle>
          </CardHeader>
          <CardContent>
            {!injuries.length ? (
              <p className="text-sm text-muted-foreground">No injury concerns on your rosters.</p>
            ) : (
              <div className="grid gap-2">
                {injuries.map((inj) => (
                  <div key={`${inj.teamName}-${inj.playerId}`} className="flex items-center justify-between text-sm">
                    <Link href={`/players/${inj.playerId}`} className="flex items-center gap-2 underline-offset-4 hover:underline">
                      <span className="font-medium">{inj.playerName}</span>
                      <Badge variant="outline">{inj.position}</Badge>
                      <span className="text-xs text-muted-foreground">{inj.teamName}</span>
                    </Link>
                    <div className="flex items-center gap-2">
                      {inj.reportPrimaryInjury && <span className="text-xs text-muted-foreground">{inj.reportPrimaryInjury}</span>}
                      <Badge variant={inj.reportStatus === "Out" ? "destructive" : "secondary"}>{inj.reportStatus}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PositionBadge } from "@/components/position-badge";
import { StatusPill } from "@/components/status-pill";
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
    <div className="grid gap-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-wide">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <div className="hidden text-right sm:block">
          <div className="font-heading text-2xl text-primary">Week 1</div>
          <div className="text-xs text-muted-foreground">2026 Season</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-heading text-lg font-semibold tracking-wide">Weekly top projections</CardTitle>
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
          </CardHeader>
          <CardContent>
            {!topProjections.length ? (
              <EmptyState text="No projections available yet." />
            ) : (
              <div className="grid gap-1">
                {topProjections.map((p, i) => {
                  const player = Array.isArray(p.players) ? p.players[0] : p.players;
                  if (!player) return null;
                  return (
                    <Link
                      key={p.player_id}
                      href={`/players/${p.player_id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className="w-4 text-right font-heading text-muted-foreground">{i + 1}</span>
                        <span className="font-medium">{player.full_name}</span>
                        <PositionBadge position={player.position} />
                        <span className="text-xs text-muted-foreground">{player.team}</span>
                      </div>
                      <span className="font-heading text-lg tabular-nums text-primary">{p.projected_points_ppr.toFixed(1)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-heading text-lg font-semibold tracking-wide">Hottest waiver pickups</CardTitle>
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.62_0.17_145)] shadow-[0_0_8px_oklch(0.62_0.17_145)]" />
          </CardHeader>
          <CardContent>
            {!waiverPickups.length ? (
              <EmptyState text="No trending data available yet." />
            ) : (
              <div className="grid gap-1">
                {waiverPickups.map((w, i) => {
                  const player = Array.isArray(w.players) ? w.players[0] : w.players;
                  if (!player) return null;
                  return (
                    <Link
                      key={w.player_id}
                      href={`/players/${w.player_id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className="w-4 text-right font-heading text-muted-foreground">{i + 1}</span>
                        <span className="font-medium">{player.full_name}</span>
                        <PositionBadge position={player.position} />
                        <span className="text-xs text-muted-foreground">{player.team}</span>
                      </div>
                      <span className="text-sm tabular-nums text-muted-foreground">{w.trend_count.toLocaleString()} adds</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-heading text-lg font-semibold tracking-wide">Drop / add suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            {!dropAddSuggestions.length ? (
              <EmptyState text="No suggestions right now — your bench looks solid against trending pickups." />
            ) : (
              <div className="grid gap-2">
                {dropAddSuggestions.map((s, i) => (
                  <div key={i} className="grid gap-1.5 rounded-lg border border-border/60 bg-secondary/30 p-3 text-sm">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.teamName}</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        Drop <span className="font-medium text-foreground">{s.benchPlayer.name}</span>
                        <span className="tabular-nums"> ({s.benchPlayer.projection.toFixed(1)} pts)</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        Add <span className="font-medium text-foreground">{s.waiverPlayer.name}</span>
                        <span className="tabular-nums"> ({s.waiverPlayer.projection.toFixed(1)} pts)</span>
                      </span>
                      <Badge className="bg-[oklch(0.62_0.17_145/0.2)] text-[oklch(0.75_0.16_145)] tabular-nums">
                        +{s.edge.toFixed(1)} pts
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-heading text-lg font-semibold tracking-wide">Injury tracker</CardTitle>
          </CardHeader>
          <CardContent>
            {!injuries.length ? (
              <EmptyState text="No injury concerns on your rosters." />
            ) : (
              <div className="grid gap-1">
                {injuries.map((inj) => (
                  <Link
                    key={`${inj.teamName}-${inj.playerId}`}
                    href={`/players/${inj.playerId}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-2.5 text-sm">
                      <span className="font-medium">{inj.playerName}</span>
                      <PositionBadge position={inj.position} />
                      <span className="text-xs text-muted-foreground">{inj.teamName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {inj.reportPrimaryInjury && <span className="text-xs text-muted-foreground">{inj.reportPrimaryInjury}</span>}
                      {inj.reportStatus && <StatusPill status={inj.reportStatus} />}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

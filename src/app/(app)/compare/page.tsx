"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PositionBadge } from "@/components/position-badge";
import { StatusPill } from "@/components/status-pill";
import { searchPlayers } from "../teams/player-search-action";
import { getComparisonPlayers, type ComparisonPlayer } from "./actions";
import type { Player } from "@/types/database";

const MAX_PLAYERS = 4;

function ComparePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedIds = searchParams.get("players")?.split(",").filter(Boolean) ?? [];

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [players, setPlayers] = useState<ComparisonPlayer[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedIds.length) {
      setPlayers([]);
      return;
    }
    getComparisonPlayers(selectedIds).then(setPlayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("players")]);

  function updateSelection(ids: string[]) {
    const params = new URLSearchParams(searchParams);
    if (ids.length) params.set("players", ids.join(","));
    else params.delete("players");
    router.push(`/compare?${params.toString()}`);
  }

  function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const found = await searchPlayers(value);
      setResults(found);
    });
  }

  function addPlayer(id: string) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_PLAYERS) return;
    updateSelection([...selectedIds, id]);
    setQuery("");
    setResults([]);
  }

  function removePlayer(id: string) {
    updateSelection(selectedIds.filter((pid) => pid !== id));
  }

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="font-heading text-4xl font-semibold tracking-wide">Sit/Start</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select up to {MAX_PLAYERS} players to compare side by side.</p>
      </div>

      {selectedIds.length < MAX_PLAYERS && (
        <div className="grid gap-2">
          <Input placeholder="Search players by name..." value={query} onChange={(e) => handleSearch(e.target.value)} className="max-w-md" />
          {isPending && <p className="text-xs text-muted-foreground">Searching...</p>}
          {results.length > 0 && (
            <div className="grid max-w-md gap-1 rounded-lg border border-border/60 bg-card p-2">
              {results.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/50">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{p.full_name}</span>
                    <PositionBadge position={p.position} />
                    {p.team && <span className="text-xs text-muted-foreground">{p.team}</span>}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => addPlayer(p.id)} disabled={selectedIds.includes(p.id)}>
                    {selectedIds.includes(p.id) ? "Added" : "Add"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!players.length ? (
        <Card className="border-dashed border-border/60 bg-transparent">
          <CardContent className="py-14 text-center">
            <p className="text-sm text-muted-foreground">Search and add players above to compare their projections and stats.</p>
          </CardContent>
        </Card>
      ) : (
        <ComparisonTable players={players} onRemove={removePlayer} />
      )}
    </div>
  );
}

function ComparisonTable({ players, onRemove }: { players: ComparisonPlayer[]; onRemove: (id: string) => void }) {
  const factorLabels = [...new Set(players.flatMap((p) => Object.keys(p.projection?.factors ?? {})))];

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-secondary/40">
            <th className="w-40 p-3 text-left align-bottom text-xs font-medium tracking-wide text-muted-foreground uppercase">&nbsp;</th>
            {players.map((p) => (
              <th key={p.id} className="p-3 text-left align-bottom">
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <Link href={`/players/${p.id}`} className="font-heading text-lg font-semibold tracking-wide underline-offset-4 hover:underline">
                      {p.full_name}
                    </Link>
                    <Button
                      size="sm"
                      className="h-6 bg-destructive px-2 text-xs text-white hover:bg-destructive/85"
                      onClick={() => onRemove(p.id)}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <PositionBadge position={p.position} />
                    {p.team && <span className="text-xs text-muted-foreground">{p.team}</span>}
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/60">
            <td className="p-3 font-medium text-muted-foreground">Projection (Standard)</td>
            {players.map((p) => (
              <td key={p.id} className="p-3 font-heading text-2xl tabular-nums text-foreground">
                {p.projection ? p.projection.projected_points_standard.toFixed(1) : "—"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-border/60 bg-secondary/20">
            <td className="p-3 font-medium text-muted-foreground">Projection (PPR)</td>
            {players.map((p) => (
              <td key={p.id} className="p-3 font-heading text-2xl tabular-nums text-primary">
                {p.projection ? p.projection.projected_points_ppr.toFixed(1) : "—"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-border/60">
            <td className="p-3 font-medium text-muted-foreground">Injury status</td>
            {players.map((p) => (
              <td key={p.id} className="p-3">
                {p.injuryStatus ? (
                  <StatusPill status={p.injuryStatus} />
                ) : (
                  <span className="text-sm text-[oklch(0.75_0.16_145)]">Healthy</span>
                )}
              </td>
            ))}
          </tr>
          <tr className="border-t border-border/60">
            <td className="p-3 align-top font-medium text-muted-foreground">Last 5 games</td>
            {players.map((p) => (
              <td key={p.id} className="p-3 align-top">
                <div className="grid gap-0.5 text-xs tabular-nums text-muted-foreground">
                  {p.recentGames.length ? (
                    p.recentGames.map((g) => (
                      <div key={`${g.season}-${g.week}`}>
                        {g.season} W{g.week} vs {g.opponent}: <span className="text-foreground">{g.fantasy_points_ppr.toFixed(1)}</span> PPR
                      </div>
                    ))
                  ) : (
                    <span>No games on record</span>
                  )}
                </div>
              </td>
            ))}
          </tr>
          {factorLabels.map((label) => (
            <tr key={label} className="border-t border-border/60">
              <td className="p-3 font-medium text-muted-foreground">{label}</td>
              {players.map((p) => {
                const factor = p.projection?.factors?.[label];
                return (
                  <td key={p.id} className="p-3 align-top">
                    {factor ? (
                      <div className="grid gap-0.5">
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: factor.ppr >= 0 ? "oklch(0.75 0.16 145)" : "oklch(0.72 0.17 25)" }}
                        >
                          {factor.ppr >= 0 ? "+" : ""}
                          {factor.ppr.toFixed(1)} pts
                        </span>
                        <span className="text-xs text-muted-foreground">{factor.detail}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
      <ComparePageInner />
    </Suspense>
  );
}

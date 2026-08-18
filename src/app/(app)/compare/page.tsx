"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Compare Players</h1>
        <p className="text-sm text-muted-foreground">Select up to {MAX_PLAYERS} players to compare side by side.</p>
      </div>

      {selectedIds.length < MAX_PLAYERS && (
        <div className="grid gap-2">
          <Input placeholder="Search players by name..." value={query} onChange={(e) => handleSearch(e.target.value)} />
          {isPending && <p className="text-xs text-muted-foreground">Searching...</p>}
          {results.length > 0 && (
            <div className="grid gap-1 rounded-md border p-2">
              {results.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{p.full_name}</span>
                    <Badge variant="outline">{p.position}</Badge>
                    {p.team && <span className="text-muted-foreground">{p.team}</span>}
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
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Search and add players above to compare their projections and stats.
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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-40 border-b p-2 text-left align-bottom text-muted-foreground">&nbsp;</th>
            {players.map((p) => (
              <th key={p.id} className="border-b p-2 text-left align-bottom">
                <div className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/players/${p.id}`} className="font-semibold underline-offset-4 hover:underline">
                      {p.full_name}
                    </Link>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onRemove(p.id)}>
                      Remove
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{p.position}</Badge>
                    {p.team && <span className="text-muted-foreground">{p.team}</span>}
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b p-2 font-medium">Projection (Standard)</td>
            {players.map((p) => (
              <td key={p.id} className="border-b p-2 text-lg font-semibold">
                {p.projection ? p.projection.projected_points_standard.toFixed(1) : "—"}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border-b p-2 font-medium">Projection (PPR)</td>
            {players.map((p) => (
              <td key={p.id} className="border-b p-2 text-lg font-semibold">
                {p.projection ? p.projection.projected_points_ppr.toFixed(1) : "—"}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border-b p-2 font-medium">Injury status</td>
            {players.map((p) => (
              <td key={p.id} className="border-b p-2">
                {p.injuryStatus ? <Badge variant="destructive">{p.injuryStatus}</Badge> : <span className="text-muted-foreground">Healthy</span>}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border-b p-2 align-top font-medium">Last 5 games</td>
            {players.map((p) => (
              <td key={p.id} className="border-b p-2 align-top">
                <div className="grid gap-0.5 text-xs text-muted-foreground">
                  {p.recentGames.length ? (
                    p.recentGames.map((g) => (
                      <div key={`${g.season}-${g.week}`}>
                        {g.season} W{g.week} vs {g.opponent}: {g.fantasy_points_ppr.toFixed(1)} PPR
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
            <tr key={label}>
              <td className="border-b p-2 font-medium">{label}</td>
              {players.map((p) => {
                const factor = p.projection?.factors?.[label];
                return (
                  <td key={p.id} className="border-b p-2 align-top">
                    {factor ? (
                      <div className="grid gap-0.5">
                        <span className={factor.ppr >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
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

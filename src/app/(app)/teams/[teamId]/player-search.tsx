"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addPlayerToTeam } from "../actions";
import { searchPlayers } from "../player-search-action";
import type { Player } from "@/types/database";

export function PlayerSearch({ teamId, rosteredIds }: { teamId: string; rosteredIds: string[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const players = await searchPlayers(value);
      setResults(players);
    });
  }

  return (
    <div className="grid gap-2">
      <Input
        placeholder="Search players by name..."
        value={query}
        onChange={(e) => handleChange(e.target.value)}
      />
      {isPending && <p className="text-xs text-muted-foreground">Searching...</p>}
      {results.length > 0 && (
        <div className="grid gap-1 rounded-md border p-2">
          {results.map((p) => {
            const alreadyOnTeam = rosteredIds.includes(p.id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{p.full_name}</span>
                  <Badge variant="outline">{p.position}</Badge>
                  {p.team && <span className="text-muted-foreground">{p.team}</span>}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={alreadyOnTeam}
                  onClick={() => {
                    startTransition(async () => {
                      await addPlayerToTeam(teamId, p.id);
                      setQuery("");
                      setResults([]);
                    });
                  }}
                >
                  {alreadyOnTeam ? "Added" : "Add"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

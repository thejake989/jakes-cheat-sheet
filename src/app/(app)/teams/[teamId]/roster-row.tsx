"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { removePlayerFromTeam, setPlayerSlot } from "../actions";

const SLOTS = ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLEX", "K", "DEF", "bench"];

export function RosterRow({
  teamId,
  playerId,
  fullName,
  position,
  team,
  slot,
}: {
  teamId: string;
  playerId: string;
  fullName: string;
  position: string;
  team: string | null;
  slot: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{fullName}</span>
        <Badge variant="outline">{position}</Badge>
        {team && <span className="text-muted-foreground">{team}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Select
          defaultValue={slot}
          disabled={isPending}
          onValueChange={(value) => startTransition(() => setPlayerSlot(teamId, playerId, value))}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SLOTS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "bench" ? "Bench" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => startTransition(() => removePlayerFromTeam(teamId, playerId))}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

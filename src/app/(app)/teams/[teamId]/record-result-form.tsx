"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordTeamResult } from "../actions";

export function RecordResultForm({ teamId, currentSeason }: { teamId: string; currentSeason: number }) {
  return (
    <form action={recordTeamResult} className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end">
      <input type="hidden" name="team_id" value={teamId} />
      <div className="grid gap-1.5">
        <Label htmlFor="season">Season</Label>
        <Input id="season" name="season" type="number" defaultValue={currentSeason} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="week">Week</Label>
        <Input id="week" name="week" type="number" min={1} max={18} required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="result">Result</Label>
        <Select name="result" defaultValue="win">
          <SelectTrigger id="result">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="win">Win</SelectItem>
            <SelectItem value="loss">Loss</SelectItem>
            <SelectItem value="tie">Tie</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:col-span-1">
        <div className="grid gap-1.5">
          <Label htmlFor="team_score">Your pts</Label>
          <Input id="team_score" name="team_score" type="number" step="0.1" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="opponent_score">Opp pts</Label>
          <Input id="opponent_score" name="opponent_score" type="number" step="0.1" />
        </div>
      </div>
      <Button type="submit">Save result</Button>
    </form>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ScoringFormat } from "@/types/database";

export async function createTeam(formData: FormData) {
  const name = formData.get("name") as string;
  const scoringFormat = formData.get("scoring_format") as ScoringFormat;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("teams")
    .insert({ user_id: user.id, name, scoring_format: scoringFormat })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/teams");
  redirect(`/teams/${data.id}`);
}

export async function renameTeam(teamId: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").update({ name }).eq("id", teamId);
  if (error) throw new Error(error.message);
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
}

export async function setScoringFormat(teamId: string, scoringFormat: ScoringFormat) {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").update({ scoring_format: scoringFormat }).eq("id", teamId);
  if (error) throw new Error(error.message);
  revalidatePath(`/teams/${teamId}`);
}

export async function deleteTeam(teamId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw new Error(error.message);
  revalidatePath("/teams");
  redirect("/teams");
}

export async function addPlayerToTeam(teamId: string, playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("team_players").insert({ team_id: teamId, player_id: playerId, slot: "bench" });
  if (error) throw new Error(error.message);
  revalidatePath(`/teams/${teamId}`);
}

export async function removePlayerFromTeam(teamId: string, playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("team_players").delete().eq("team_id", teamId).eq("player_id", playerId);
  if (error) throw new Error(error.message);
  revalidatePath(`/teams/${teamId}`);
}

export async function setPlayerSlot(teamId: string, playerId: string, slot: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("team_players").update({ slot }).eq("team_id", teamId).eq("player_id", playerId);
  if (error) throw new Error(error.message);
  revalidatePath(`/teams/${teamId}`);
}

export async function recordTeamResult(formData: FormData) {
  const teamId = formData.get("team_id") as string;
  const season = Number(formData.get("season"));
  const week = Number(formData.get("week"));
  const result = formData.get("result") as "win" | "loss" | "tie";
  const teamScore = formData.get("team_score") ? Number(formData.get("team_score")) : null;
  const opponentScore = formData.get("opponent_score") ? Number(formData.get("opponent_score")) : null;

  const supabase = await createClient();
  const { error } = await supabase.from("team_results").upsert(
    {
      team_id: teamId,
      season,
      week,
      result,
      team_score: teamScore,
      opponent_score: opponentScore,
    },
    { onConflict: "team_id,season,week" }
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/teams/${teamId}`);
}

export async function deleteTeamResult(teamId: string, season: number, week: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("team_results").delete().eq("team_id", teamId).eq("season", season).eq("week", week);
  if (error) throw new Error(error.message);
  revalidatePath(`/teams/${teamId}`);
}

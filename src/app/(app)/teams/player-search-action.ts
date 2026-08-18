"use server";

import { createClient } from "@/lib/supabase/server";
import type { Player } from "@/types/database";

export async function searchPlayers(query: string): Promise<Player[]> {
  if (query.trim().length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, sleeper_id, espn_id, yahoo_id, full_name, position, team, status")
    .ilike("full_name", `%${query.trim()}%`)
    .order("full_name")
    .limit(15);

  if (error) throw new Error(error.message);
  return data as Player[];
}

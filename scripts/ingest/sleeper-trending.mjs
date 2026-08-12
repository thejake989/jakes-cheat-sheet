import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fetchTrending, fetchAllPlayers, buildNameMatchIndex, resolveSleeperPlayer } from "../lib/sleeper.mjs";

config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchAllOurPlayers() {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("players").select("id, full_name, position").range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Failed to fetch players: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function backfillSleeperIds(sleeperPlayersById, resolvedByPlayerId) {
  // For players we matched by gsis_id (i.e. Sleeper already told us the mapping), persist sleeper_id
  // so future lookups/UI can rely on it directly instead of re-resolving by name.
  // Plain per-row update (not upsert) since these rows already exist and must not be re-inserted with nulls.
  const updates = [];
  for (const [sleeperId, playerId] of resolvedByPlayerId) {
    const sp = sleeperPlayersById.get(sleeperId);
    if (sp?.gsis_id?.trim()) updates.push({ id: playerId, sleeper_id: sleeperId });
  }
  for (const { id, sleeper_id } of updates) {
    const { error } = await supabase.from("players").update({ sleeper_id }).eq("id", id);
    if (error) throw new Error(`sleeper_id backfill failed for ${id}: ${error.message}`);
  }
  return updates.length;
}

async function main() {
  console.log("=== Sleeper trending ingestion ===");

  console.log("Fetching Sleeper trending add/drop + full player map ...");
  const [trendingAdd, trendingDrop, sleeperPlayers, ourPlayers] = await Promise.all([
    fetchTrending("add", { lookbackHours: 24, limit: 50 }),
    fetchTrending("drop", { lookbackHours: 24, limit: 50 }),
    fetchAllPlayers(),
    fetchAllOurPlayers(),
  ]);

  const sleeperPlayersById = new Map(Object.entries(sleeperPlayers));
  const nameIndex = buildNameMatchIndex(ourPlayers);
  const knownIds = new Set(ourPlayers.map((p) => p.id));

  const rows = [];
  const resolvedByPlayerId = new Map(); // sleeper_id -> our player_id, for sleeper_id backfill
  let unresolved = 0;

  for (const [trendType, list] of [["add", trendingAdd], ["drop", trendingDrop]]) {
    for (const { player_id: sleeperId, count } of list) {
      const sp = sleeperPlayersById.get(sleeperId);
      if (!sp) {
        unresolved++;
        continue;
      }
      const ourPlayerId = resolveSleeperPlayer(sp, nameIndex);
      if (!ourPlayerId || !knownIds.has(ourPlayerId)) {
        unresolved++;
        continue;
      }
      resolvedByPlayerId.set(sleeperId, ourPlayerId);
      rows.push({
        player_id: ourPlayerId,
        sleeper_id: sleeperId,
        trend_type: trendType,
        trend_count: count,
      });
    }
  }

  if (rows.length) {
    const { error } = await supabase.from("trending_players").insert(rows);
    if (error) throw new Error(`Insert failed for trending_players: ${error.message}`);
  }

  const backfilled = await backfillSleeperIds(sleeperPlayersById, resolvedByPlayerId);

  console.log("=== Summary ===");
  console.log({
    trendingAddFetched: trendingAdd.length,
    trendingDropFetched: trendingDrop.length,
    resolved: rows.length,
    unresolved,
    sleeperIdsBackfilled: backfilled,
  });
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});

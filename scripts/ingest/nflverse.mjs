import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { fetchPlayerStats, fetchGames, fetchInjuries, fetchPlayers } from "../lib/nflverse.mjs";
import { buildGameContextIndex, isFantasyRelevant } from "../lib/transform.mjs";

config({ path: ".env.local" });

const CURRENT_SEASON = Number(process.argv[2]) || new Date().getFullYear();
const BATCH_SIZE = 500;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function upsertInBatches(table, rows, conflictTarget) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictTarget });
    if (error) throw new Error(`Upsert failed for ${table} (batch ${i}): ${error.message}`);
  }
  console.log(`  upserted ${rows.length} rows into ${table}`);
}

async function ingestPlayers() {
  console.log("Fetching players.csv ...");
  const players = await fetchPlayers();
  const rows = players
    .filter((p) => p.gsis_id && isFantasyRelevant(p.position))
    .map((p) => ({
      id: p.gsis_id,
      espn_id: p.espn_id ? String(p.espn_id) : null,
      full_name: p.display_name,
      position: p.position,
      team: p.latest_team || null,
      status: p.status || null,
      birth_date: p.birth_date || null,
    }));
  await upsertInBatches("players", rows, "id");
  return rows.length;
}

async function fetchKnownPlayerIds() {
  const knownIds = new Set();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("players").select("id").range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Failed to fetch known player ids: ${error.message}`);
    for (const p of data) knownIds.add(p.id);
    if (data.length < pageSize) break;
  }
  return knownIds;
}

async function ingestPlayerGamesAndDefenseSplits(season, knownIds) {
  console.log(`Fetching player_stats + games for ${season} ...`);
  const [stats, games] = await Promise.all([fetchPlayerStats(season), fetchGames()]);
  const gameContext = buildGameContextIndex(games.filter((g) => g.season === season));

  const playerGameRows = [];
  const defenseAccum = new Map(); // `${season}_${week}_${defenseTeam}_${pos}` -> { pointsSum, pointsPprSum, n }

  for (const s of stats) {
    if (!s.player_id || !isFantasyRelevant(s.position) || s.season_type !== "REG") continue;
    const ctx = gameContext.get(`${s.season}_${s.week}_${s.recent_team}`);
    if (!ctx) continue;

    playerGameRows.push({
      player_id: s.player_id,
      season: s.season,
      week: s.week,
      game_id: ctx.game_id,
      team: s.recent_team,
      opponent: ctx.opponent,
      is_home: ctx.is_home,
      stadium: ctx.stadium,
      roof: ctx.roof,
      temp_f: ctx.temp_f,
      wind_mph: ctx.wind_mph,
      is_primetime: ctx.is_primetime,
      kickoff_at: ctx.kickoff_at,
      rest_days: ctx.rest_days,
      pass_yards: s.passing_yards ?? 0,
      pass_tds: s.passing_tds ?? 0,
      interceptions: s.interceptions ?? 0,
      rush_yards: s.rushing_yards ?? 0,
      rush_tds: s.rushing_tds ?? 0,
      receptions: s.receptions ?? 0,
      rec_yards: s.receiving_yards ?? 0,
      rec_tds: s.receiving_tds ?? 0,
      fumbles_lost: (s.sack_fumbles_lost ?? 0) + (s.rushing_fumbles_lost ?? 0) + (s.receiving_fumbles_lost ?? 0),
      two_pt_conversions: (s.passing_2pt_conversions ?? 0) + (s.rushing_2pt_conversions ?? 0) + (s.receiving_2pt_conversions ?? 0),
      fantasy_points_standard: s.fantasy_points ?? 0,
      fantasy_points_ppr: s.fantasy_points_ppr ?? 0,
    });

    const key = `${s.season}_${s.week}_${ctx.opponent}_${s.position}`;
    const acc = defenseAccum.get(key) || { pointsStd: 0, pointsPpr: 0, n: 0 };
    acc.pointsStd += s.fantasy_points ?? 0;
    acc.pointsPpr += s.fantasy_points_ppr ?? 0;
    acc.n += 1;
    defenseAccum.set(key, acc);
  }

  const orphaned = playerGameRows.filter((r) => !knownIds.has(r.player_id));
  if (orphaned.length) {
    console.warn(`  ${orphaned.length} player_games rows reference unknown player_id (sample:`, orphaned.slice(0, 5).map((r) => r.player_id), ")");
  }
  const validPlayerGameRows = playerGameRows.filter((r) => knownIds.has(r.player_id));

  await upsertInBatches("player_games", validPlayerGameRows, "player_id,game_id");

  const defenseRows = [...defenseAccum.entries()].map(([key, acc]) => {
    const [season, week, team, position] = key.split("_");
    return {
      season: Number(season),
      week: Number(week),
      team,
      opponent_position: position,
      fantasy_points_allowed_avg_standard: acc.pointsStd / acc.n,
      fantasy_points_allowed_avg_ppr: acc.pointsPpr / acc.n,
      sample_size: acc.n,
    };
  });
  await upsertInBatches("defense_splits", defenseRows, "season,week,team,opponent_position");

  return { playerGames: validPlayerGameRows.length, defenseSplits: defenseRows.length, orphaned: orphaned.length };
}

async function ingestInjuries(season, knownIds) {
  console.log(`Fetching injuries for ${season} ...`);
  const injuries = await fetchInjuries(season);
  // Keep the latest report per player/week (file has one row per report date; we want the most recent)
  const latest = new Map();
  for (const r of injuries) {
    if (!r.gsis_id || !knownIds.has(r.gsis_id)) continue;
    const key = `${r.gsis_id}_${r.season}_${r.week}`;
    const existing = latest.get(key);
    if (!existing || (r.date_modified && r.date_modified > existing.date_modified)) {
      latest.set(key, r);
    }
  }
  const rows = [...latest.values()].map((r) => ({
    player_id: r.gsis_id,
    season: r.season,
    week: r.week,
    report_status: r.report_status || null,
    report_primary_injury: r.report_primary_injury || null,
    practice_status: r.practice_status || null,
    practice_primary_injury: r.practice_primary_injury || null,
  }));
  await upsertInBatches("injury_reports", rows, "player_id,season,week");
  return rows.length;
}

async function main() {
  console.log(`=== nflverse ingestion for season ${CURRENT_SEASON} ===`);
  const playerCount = await ingestPlayers();
  const knownIds = await fetchKnownPlayerIds();
  const { playerGames, defenseSplits, orphaned } = await ingestPlayerGamesAndDefenseSplits(CURRENT_SEASON, knownIds);
  const injuryCount = await ingestInjuries(CURRENT_SEASON, knownIds);
  console.log("=== Summary ===");
  console.log({ playerCount, playerGames, defenseSplits, orphaned, injuryCount });
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { computeProjection } from "../src/lib/projections/engine.ts";

config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const playerName = process.argv[2] || "Patrick Mahomes";
  const { data: player } = await supabase.from("players").select("*").ilike("full_name", playerName).single();
  if (!player) throw new Error(`Player not found: ${playerName}`);

  const { data: games } = await supabase
    .from("player_games")
    .select("*")
    .eq("player_id", player.id)
    .order("season", { ascending: false })
    .order("week", { ascending: false });

  console.log(`${player.full_name} (${player.position}, ${player.team}) — ${games.length} games on record`);

  // Simulate an upcoming context using a recent real game's opponent/venue (for a plausible test)
  const latest = games[0];
  const upcoming = {
    season: latest.season,
    week: latest.week + 1,
    position: player.position,
    opponent: latest.opponent,
    stadium: latest.stadium,
    roof: latest.roof,
    temp_f: 28,
    wind_mph: 18,
    is_primetime: true,
    is_home: latest.is_home,
    rest_days: 7,
    birthDate: player.birth_date,
    reportStatus: null,
  };

  const { data: defenseRows } = await supabase
    .from("defense_splits")
    .select("*")
    .eq("team", latest.opponent)
    .eq("opponent_position", player.position)
    .order("season", { ascending: false })
    .limit(5);

  const avgAllowedStd = defenseRows?.length
    ? defenseRows.reduce((s, r) => s + (r.fantasy_points_allowed_avg_standard ?? 0), 0) / defenseRows.length
    : null;
  const avgAllowedPpr = defenseRows?.length
    ? defenseRows.reduce((s, r) => s + (r.fantasy_points_allowed_avg_ppr ?? 0), 0) / defenseRows.length
    : null;

  const { data: allDefenseForPos } = await supabase
    .from("defense_splits")
    .select("fantasy_points_allowed_avg_standard, fantasy_points_allowed_avg_ppr")
    .eq("opponent_position", player.position);

  const leagueAvgStd = average(allDefenseForPos.map((r) => r.fantasy_points_allowed_avg_standard).filter(Boolean));
  const leagueAvgPpr = average(allDefenseForPos.map((r) => r.fantasy_points_allowed_avg_ppr).filter(Boolean));

  const defense = {
    fantasyPointsAllowedAvgStandard: avgAllowedStd,
    fantasyPointsAllowedAvgPpr: avgAllowedPpr,
    leaguePositionAvgStandard: leagueAvgStd,
    leaguePositionAvgPpr: leagueAvgPpr,
  };

  const result = computeProjection(games, upcoming, defense);
  console.log("\n=== Projection ===");
  console.log(`Base (recent form): ${result.baseStandard.toFixed(1)} std / ${result.basePpr.toFixed(1)} PPR`);
  console.log(`Final projection: ${result.projectedStandard.toFixed(1)} std / ${result.projectedPpr.toFixed(1)} PPR`);
  console.log("\nFactor breakdown:");
  for (const f of result.factors) {
    console.log(`  ${f.label}: ${f.standard >= 0 ? "+" : ""}${f.standard.toFixed(2)} std, ${f.ppr >= 0 ? "+" : ""}${f.ppr.toFixed(2)} PPR — ${f.detail}`);
  }
}

function average(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

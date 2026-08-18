import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { computeProjection, MODEL_VERSION } from "../../src/lib/projections/engine.ts";

config({ path: "../../.env.local" });
config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SEASONS = [2023, 2024];
const MIN_GAMES_HISTORY = 3; // skip players with too little prior data to project meaningfully

async function fetchAll(table, select) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

async function main() {
  console.log("Loading data for backtest ...");
  const [allGames, allPlayers, allDefense] = await Promise.all([
    fetchAll(
      "player_games",
      "player_id, season, week, opponent, stadium, roof, temp_f, wind_mph, is_primetime, is_home, rest_days, fantasy_points_standard, fantasy_points_ppr"
    ),
    fetchAll("players", "id, position, birth_date"),
    fetchAll(
      "defense_splits",
      "season, week, team, opponent_position, fantasy_points_allowed_avg_standard, fantasy_points_allowed_avg_ppr"
    ),
  ]);

  const playersById = new Map(allPlayers.map((p) => [p.id, p]));
  const gamesByPlayer = new Map();
  for (const g of allGames) {
    const arr = gamesByPlayer.get(g.player_id) ?? [];
    arr.push(g);
    gamesByPlayer.set(g.player_id, arr);
  }

  // Precompute league-wide avg allowed per position (final-season snapshot, used as the "leaguePositionAvg" normalizer)
  const leagueAvgByPosition = new Map();
  for (const pos of ["QB", "RB", "WR", "TE", "K"]) {
    const rows = allDefense.filter((d) => d.opponent_position === pos);
    const avgStd = average(rows.map((r) => r.fantasy_points_allowed_avg_standard).filter((v) => v != null));
    const avgPpr = average(rows.map((r) => r.fantasy_points_allowed_avg_ppr).filter((v) => v != null));
    leagueAvgByPosition.set(pos, { avgStd, avgPpr });
  }

  const errors = { standard: [], ppr: [] };
  let evaluated = 0;

  for (const season of SEASONS) {
    for (let week = 4; week <= 18; week++) {
      // week 4+ so there's at least some in-season history to project from
      const actualGamesThisWeek = allGames.filter((g) => g.season === season && g.week === week);

      for (const actual of actualGamesThisWeek) {
        const player = playersById.get(actual.player_id);
        if (!player) continue;

        const priorGames = (gamesByPlayer.get(actual.player_id) ?? []).filter(
          (g) => g.season < season || (g.season === season && g.week < week)
        );
        if (priorGames.length < MIN_GAMES_HISTORY) continue;

        const defenseRows = allDefense.filter(
          (d) => d.team === actual.opponent && d.opponent_position === player.position && (d.season < season || (d.season === season && d.week < week))
        );
        const avgAllowedStd = defenseRows.length ? average(defenseRows.map((r) => r.fantasy_points_allowed_avg_standard).filter((v) => v != null)) : null;
        const avgAllowedPpr = defenseRows.length ? average(defenseRows.map((r) => r.fantasy_points_allowed_avg_ppr).filter((v) => v != null)) : null;
        const leagueAvg = leagueAvgByPosition.get(player.position) ?? { avgStd: 0, avgPpr: 0 };

        const upcoming = {
          season,
          week,
          position: player.position,
          opponent: actual.opponent,
          stadium: actual.stadium,
          roof: actual.roof,
          temp_f: actual.temp_f,
          wind_mph: actual.wind_mph,
          is_primetime: actual.is_primetime,
          is_home: actual.is_home,
          rest_days: actual.rest_days,
          birthDate: player.birth_date,
          reportStatus: null, // historical injury status not replayed in this pass; see note in report
        };

        const defense = {
          fantasyPointsAllowedAvgStandard: avgAllowedStd,
          fantasyPointsAllowedAvgPpr: avgAllowedPpr,
          leaguePositionAvgStandard: leagueAvg.avgStd,
          leaguePositionAvgPpr: leagueAvg.avgPpr,
        };

        const result = computeProjection(priorGames, upcoming, defense);
        errors.standard.push(result.projectedStandard - actual.fantasy_points_standard);
        errors.ppr.push(result.projectedPpr - actual.fantasy_points_ppr);
        evaluated++;
      }
    }
  }

  console.log(`\n=== Backtest results (model ${MODEL_VERSION}, seasons ${SEASONS.join(", ")}, weeks 4-18) ===`);
  console.log(`Evaluated ${evaluated} player-weeks\n`);
  report("Standard", errors.standard);
  report("PPR", errors.ppr);
}

function report(label, errs) {
  const mae = average(errs.map(Math.abs));
  const bias = average(errs);
  const rmse = Math.sqrt(average(errs.map((e) => e * e)));
  console.log(`${label}: MAE=${mae.toFixed(2)} pts, bias=${bias >= 0 ? "+" : ""}${bias.toFixed(2)} pts, RMSE=${rmse.toFixed(2)} pts`);
}

function average(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

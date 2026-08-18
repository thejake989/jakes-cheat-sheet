import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { computeProjection, MODEL_VERSION } from "../../src/lib/projections/engine.ts";
import { fetchGames } from "../lib/nflverse.mjs";

config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SEASON = Number(process.argv[2]);
const WEEK = Number(process.argv[3]);
if (!SEASON || !WEEK) {
  console.error("Usage: node scripts/projections/compute-week.mjs <season> <week>");
  process.exit(1);
}

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

function average(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

async function main() {
  console.log(`Computing projections for season ${SEASON}, week ${WEEK} ...`);

  const [players, allGames, allDefense, injuries, schedule] = await Promise.all([
    fetchAll("players", "id, position, team, birth_date"),
    fetchAll(
      "player_games",
      "player_id, season, week, opponent, stadium, roof, temp_f, wind_mph, is_primetime, is_home, rest_days, fantasy_points_standard, fantasy_points_ppr"
    ),
    fetchAll(
      "defense_splits",
      "season, week, team, opponent_position, fantasy_points_allowed_avg_standard, fantasy_points_allowed_avg_ppr"
    ),
    fetchAll("injury_reports", `player_id, season, week, report_status`).then((rows) =>
      rows.filter((r) => r.season === SEASON && r.week === WEEK)
    ),
    fetchGames(),
  ]);

  const weekGames = schedule.filter((g) => g.season === SEASON && g.week === WEEK);
  if (!weekGames.length) {
    console.error(`No schedule found for season ${SEASON} week ${WEEK}`);
    process.exit(1);
  }

  // team -> upcoming game context, mirroring the ingestion script's approach
  const teamContext = new Map();
  for (const g of weekGames) {
    const primetime = isPrimetime(g.weekday, g.gametime);
    const shared = { stadium: g.stadium ?? null, roof: g.roof ?? null, temp_f: g.temp ?? null, wind_mph: g.wind ?? null, is_primetime: primetime };
    teamContext.set(g.home_team, { ...shared, opponent: g.away_team, is_home: true, rest_days: g.home_rest ?? null });
    teamContext.set(g.away_team, { ...shared, opponent: g.home_team, is_home: false, rest_days: g.away_rest ?? null });
  }

  const gamesByPlayer = new Map();
  for (const g of allGames) {
    const arr = gamesByPlayer.get(g.player_id) ?? [];
    arr.push(g);
    gamesByPlayer.set(g.player_id, arr);
  }

  const injuryByPlayer = new Map(injuries.map((i) => [i.player_id, i.report_status]));

  const leagueAvgByPosition = new Map();
  for (const pos of ["QB", "RB", "WR", "TE", "K"]) {
    const rows = allDefense.filter((d) => d.opponent_position === pos);
    leagueAvgByPosition.set(pos, {
      avgStd: average(rows.map((r) => r.fantasy_points_allowed_avg_standard).filter((v) => v != null)),
      avgPpr: average(rows.map((r) => r.fantasy_points_allowed_avg_ppr).filter((v) => v != null)),
    });
  }

  const rows = [];
  let skippedNoTeamGame = 0;
  let skippedNoHistory = 0;

  for (const player of players) {
    if (!player.team) continue;
    const ctx = teamContext.get(player.team);
    if (!ctx) {
      skippedNoTeamGame++;
      continue; // bye week or team not in this week's schedule
    }

    const priorGames = gamesByPlayer.get(player.id) ?? [];
    if (priorGames.length < 3) {
      skippedNoHistory++;
      continue;
    }

    const defenseRows = allDefense.filter((d) => d.team === ctx.opponent && d.opponent_position === player.position);
    const avgAllowedStd = defenseRows.length ? average(defenseRows.map((r) => r.fantasy_points_allowed_avg_standard).filter((v) => v != null)) : null;
    const avgAllowedPpr = defenseRows.length ? average(defenseRows.map((r) => r.fantasy_points_allowed_avg_ppr).filter((v) => v != null)) : null;
    const leagueAvg = leagueAvgByPosition.get(player.position) ?? { avgStd: 0, avgPpr: 0 };

    const upcoming = {
      season: SEASON,
      week: WEEK,
      position: player.position,
      opponent: ctx.opponent,
      stadium: ctx.stadium,
      roof: ctx.roof,
      temp_f: ctx.temp_f,
      wind_mph: ctx.wind_mph,
      is_primetime: ctx.is_primetime,
      is_home: ctx.is_home,
      rest_days: ctx.rest_days,
      birthDate: player.birth_date,
      reportStatus: injuryByPlayer.get(player.id) ?? null,
    };

    const defense = {
      fantasyPointsAllowedAvgStandard: avgAllowedStd,
      fantasyPointsAllowedAvgPpr: avgAllowedPpr,
      leaguePositionAvgStandard: leagueAvg.avgStd,
      leaguePositionAvgPpr: leagueAvg.avgPpr,
    };

    const result = computeProjection(priorGames, upcoming, defense);
    rows.push({
      player_id: player.id,
      season: SEASON,
      week: WEEK,
      projected_points_standard: Number(result.projectedStandard.toFixed(2)),
      projected_points_ppr: Number(result.projectedPpr.toFixed(2)),
      model_version: MODEL_VERSION,
      factors: Object.fromEntries(result.factors.map((f) => [f.label, { standard: f.standard, ppr: f.ppr, detail: f.detail }])),
    });
  }

  console.log(`Computed ${rows.length} projections (skipped ${skippedNoTeamGame} bye/no-game, ${skippedNoHistory} insufficient history)`);

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("projections").upsert(batch, { onConflict: "player_id,season,week,model_version" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }
  console.log(`Upserted ${rows.length} rows into projections`);
}

function isPrimetime(weekday, gametime) {
  if (!weekday || !gametime) return false;
  const hour = Number(gametime.split(":")[0]);
  if (Number.isNaN(hour)) return false;
  if (["Thursday", "Monday", "Sunday", "Saturday"].includes(weekday)) return hour >= 19;
  return false;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Primetime = Thursday/Sunday/Monday night windows (kickoff at or after 19:30 local),
// excluding early Sunday afternoon slate. nflverse `weekday` + `gametime` (HH:MM, 24h) let us derive this
// without an external schedule-of-record; Sunday afternoon games (1:00pm/4:xxpm ET) are never primetime.
export function isPrimetime(weekday, gametime) {
  if (!weekday || !gametime) return false;
  const [hourStr] = gametime.split(":");
  const hour = Number(hourStr);
  if (Number.isNaN(hour)) return false;

  if (weekday === "Thursday" || weekday === "Monday") return hour >= 19;
  if (weekday === "Sunday") return hour >= 19; // SNF; excludes 1pm/4:05/4:25 ET windows
  // Saturday primetime games (late season) and other flex placements
  if (weekday === "Saturday") return hour >= 19;
  return false;
}

export function kickoffTimestamp(gameday, gametime) {
  if (!gameday || !gametime) return null;
  // nflverse times are ET (naive); store as-is with an explicit offset so downstream ordering is still correct
  return `${gameday}T${gametime}:00-05:00`;
}

// Keyed by season_week_team (not game_id) since player_stats rows give recent_team/opponent_team
// without home/away ordering, so reconstructing nflverse's {away}_{home} game_id would require guessing.
export function buildGameContextIndex(games) {
  const index = new Map();
  for (const g of games) {
    if (!g.game_id || !g.home_team || !g.away_team) continue;
    const primetime = isPrimetime(g.weekday, g.gametime);
    const kickoff = kickoffTimestamp(g.gameday, g.gametime);
    const shared = {
      game_id: g.game_id,
      season: g.season,
      week: g.week,
      stadium: g.stadium ?? null,
      roof: g.roof ?? null,
      temp_f: g.temp ?? null,
      wind_mph: g.wind ?? null,
      is_primetime: primetime,
      kickoff_at: kickoff,
    };
    index.set(`${g.season}_${g.week}_${g.home_team}`, {
      ...shared,
      team: g.home_team,
      opponent: g.away_team,
      is_home: true,
      rest_days: g.home_rest ?? null,
    });
    index.set(`${g.season}_${g.week}_${g.away_team}`, {
      ...shared,
      team: g.away_team,
      opponent: g.home_team,
      is_home: false,
      rest_days: g.away_rest ?? null,
    });
  }
  return index;
}

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K"]);

export function isFantasyRelevant(position) {
  return FANTASY_POSITIONS.has(position);
}

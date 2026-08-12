import Papa from "papaparse";

const RELEASE_BASE = "https://github.com/nflverse/nflverse-data/releases/download";

async function fetchCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    const fatal = parsed.errors.filter((e) => e.type !== "FieldMismatch");
    if (fatal.length) throw new Error(`CSV parse errors for ${url}: ${JSON.stringify(fatal.slice(0, 3))}`);
  }
  return parsed.data;
}

export function fetchPlayerStats(season) {
  return fetchCsv(`${RELEASE_BASE}/player_stats/player_stats_${season}.csv`);
}

export function fetchGames() {
  return fetchCsv(`${RELEASE_BASE}/schedules/games.csv`);
}

export function fetchInjuries(season) {
  return fetchCsv(`${RELEASE_BASE}/injuries/injuries_${season}.csv`);
}

export function fetchPlayers() {
  return fetchCsv(`${RELEASE_BASE}/players/players.csv`);
}

const BASE = "https://api.sleeper.app/v1";

export async function fetchTrending(type, { lookbackHours = 24, limit = 25 } = {}) {
  const res = await fetch(`${BASE}/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`);
  if (!res.ok) throw new Error(`Sleeper trending/${type} failed: ${res.status}`);
  return res.json(); // [{ player_id, count }]
}

export async function fetchAllPlayers() {
  const res = await fetch(`${BASE}/players/nfl`);
  if (!res.ok) throw new Error(`Sleeper players fetch failed: ${res.status}`);
  return res.json(); // { [sleeper_id]: { full_name, position, team, gsis_id, ... } }
}

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[.'-]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv)\.?$/, "")
    .trim();
}

export function buildNameMatchIndex(players) {
  // key: "normalizedname_position" -> player row, for fallback matching when gsis_id is absent
  const index = new Map();
  for (const p of players) {
    if (!p.full_name || !p.position) continue;
    index.set(`${normalizeName(p.full_name)}_${p.position}`, p);
  }
  return index;
}

export function resolveSleeperPlayer(sleeperPlayer, nameIndex) {
  const gsisId = sleeperPlayer.gsis_id?.trim();
  if (gsisId) return gsisId;
  const key = `${normalizeName(sleeperPlayer.full_name)}_${sleeperPlayer.position}`;
  const match = nameIndex.get(key);
  return match ? match.id : null;
}

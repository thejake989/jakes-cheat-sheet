-- Jake's Cheat Sheet — initial schema
-- Shared/global stats tables (players, player_games, defense_splits, projections,
-- injury_reports, trending_players) hold no user data and are readable by any
-- authenticated user. Teams/team_players are per-user and RLS-scoped.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- Canonical player reference
-- ─────────────────────────────────────────────────────────────────────────
create table players (
  id text primary key,              -- nflverse gsis_id, canonical key
  sleeper_id text,
  espn_id text,
  yahoo_id text,
  full_name text not null,
  position text not null,           -- QB, RB, WR, TE, K, DEF
  team text,                        -- current NFL team abbreviation
  status text,                      -- Active, Injured Reserve, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index players_position_idx on players (position);
create index players_sleeper_id_idx on players (sleeper_id);
create index players_team_idx on players (team);

-- ─────────────────────────────────────────────────────────────────────────
-- Per-game historical stat lines (the deep-stats backbone)
-- ─────────────────────────────────────────────────────────────────────────
create table player_games (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references players (id) on delete cascade,
  season int not null,
  week int not null,
  game_id text not null,            -- nflverse game_id
  team text not null,
  opponent text not null,
  is_home boolean not null,
  stadium text,
  roof text,                        -- dome, outdoors, closed, open
  temp_f int,
  wind_mph int,
  is_primetime boolean not null default false,
  kickoff_at timestamptz,
  rest_days int,                    -- days since this player's team's prior game
  -- raw box score inputs
  pass_yards numeric default 0,
  pass_tds numeric default 0,
  interceptions numeric default 0,
  rush_yards numeric default 0,
  rush_tds numeric default 0,
  receptions numeric default 0,
  rec_yards numeric default 0,
  rec_tds numeric default 0,
  fumbles_lost numeric default 0,
  two_pt_conversions numeric default 0,
  -- precomputed fantasy points
  fantasy_points_standard numeric not null default 0,
  fantasy_points_ppr numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (player_id, game_id)
);
create index player_games_player_idx on player_games (player_id);
create index player_games_season_week_idx on player_games (season, week);
create index player_games_stadium_idx on player_games (stadium);
create index player_games_opponent_idx on player_games (opponent);

-- ─────────────────────────────────────────────────────────────────────────
-- Defense-vs-position splits (matchup difficulty input)
-- ─────────────────────────────────────────────────────────────────────────
create table defense_splits (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  week int not null,
  team text not null,               -- defense's team abbreviation
  opponent_position text not null,  -- position allowed-stats are computed against
  points_allowed_avg numeric,
  yards_allowed_avg numeric,
  fantasy_points_allowed_avg_standard numeric,
  fantasy_points_allowed_avg_ppr numeric,
  sample_size int not null default 0,
  created_at timestamptz not null default now(),
  unique (season, week, team, opponent_position)
);
create index defense_splits_team_pos_idx on defense_splits (team, opponent_position);

-- ─────────────────────────────────────────────────────────────────────────
-- App-computed weekly projections (the projection engine's output)
-- ─────────────────────────────────────────────────────────────────────────
create table projections (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references players (id) on delete cascade,
  season int not null,
  week int not null,
  projected_points_standard numeric not null,
  projected_points_ppr numeric not null,
  model_version text not null,      -- e.g. "v1" — ties a projection to a code version for backtesting
  factors jsonb not null default '{}'::jsonb, -- explainable breakdown: {recent_form, matchup, venue, weather, primetime, home_away, rest, injury_dampening}
  created_at timestamptz not null default now(),
  unique (player_id, season, week, model_version)
);
create index projections_season_week_idx on projections (season, week);
create index projections_player_idx on projections (player_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Current injury designations (from nflverse load_injuries)
-- ─────────────────────────────────────────────────────────────────────────
create table injury_reports (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references players (id) on delete cascade,
  season int not null,
  week int not null,
  report_status text,               -- Questionable, Doubtful, Out
  report_primary_injury text,
  practice_status text,
  practice_primary_injury text,
  updated_at timestamptz not null default now(),
  unique (player_id, season, week)
);
create index injury_reports_player_idx on injury_reports (player_id);
create index injury_reports_season_week_idx on injury_reports (season, week);

-- ─────────────────────────────────────────────────────────────────────────
-- Sleeper trending add/drop snapshot
-- ─────────────────────────────────────────────────────────────────────────
create table trending_players (
  id uuid primary key default gen_random_uuid(),
  player_id text references players (id) on delete cascade,
  sleeper_id text not null,
  trend_type text not null check (trend_type in ('add', 'drop')),
  trend_count int not null,
  captured_at timestamptz not null default now()
);
create index trending_players_type_idx on trending_players (trend_type, captured_at desc);
create index trending_players_player_idx on trending_players (player_id);

-- ─────────────────────────────────────────────────────────────────────────
-- User-owned Teams (rosters)
-- ─────────────────────────────────────────────────────────────────────────
create table teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  scoring_format text not null default 'standard' check (scoring_format in ('standard', 'ppr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teams_user_idx on teams (user_id);

create table team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  player_id text not null references players (id) on delete cascade,
  slot text not null default 'bench', -- e.g. QB, RB1, RB2, WR1, WR2, FLEX, TE, DEF, K, bench
  created_at timestamptz not null default now(),
  unique (team_id, player_id)
);
create index team_players_team_idx on team_players (team_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────
alter table players enable row level security;
alter table player_games enable row level security;
alter table defense_splits enable row level security;
alter table projections enable row level security;
alter table injury_reports enable row level security;
alter table trending_players enable row level security;
alter table teams enable row level security;
alter table team_players enable row level security;

-- Shared stats tables: readable by any authenticated user, writable only by service role (ingestion jobs)
create policy "players readable by authenticated" on players for select to authenticated using (true);
create policy "player_games readable by authenticated" on player_games for select to authenticated using (true);
create policy "defense_splits readable by authenticated" on defense_splits for select to authenticated using (true);
create policy "projections readable by authenticated" on projections for select to authenticated using (true);
create policy "injury_reports readable by authenticated" on injury_reports for select to authenticated using (true);
create policy "trending_players readable by authenticated" on trending_players for select to authenticated using (true);

-- Teams: owner-only read/write
create policy "teams select own" on teams for select to authenticated using (auth.uid() = user_id);
create policy "teams insert own" on teams for insert to authenticated with check (auth.uid() = user_id);
create policy "teams update own" on teams for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "teams delete own" on teams for delete to authenticated using (auth.uid() = user_id);

-- team_players: owner-only via parent team's user_id
create policy "team_players select own" on team_players for select to authenticated
  using (exists (select 1 from teams t where t.id = team_players.team_id and t.user_id = auth.uid()));
create policy "team_players insert own" on team_players for insert to authenticated
  with check (exists (select 1 from teams t where t.id = team_players.team_id and t.user_id = auth.uid()));
create policy "team_players update own" on team_players for update to authenticated
  using (exists (select 1 from teams t where t.id = team_players.team_id and t.user_id = auth.uid()))
  with check (exists (select 1 from teams t where t.id = team_players.team_id and t.user_id = auth.uid()));
create policy "team_players delete own" on team_players for delete to authenticated
  using (exists (select 1 from teams t where t.id = team_players.team_id and t.user_id = auth.uid()));

-- Weekly win/loss record per Team, entered manually by the user.
-- Season-record rating is computed on read from this table;
-- roster-strength rating is computed on read from team_players + projections.
-- Neither rating is stored, since both are derived and would go stale.

create table team_results (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  season int not null,
  week int not null,
  result text not null check (result in ('win', 'loss', 'tie')),
  team_score numeric,
  opponent_score numeric,
  created_at timestamptz not null default now(),
  unique (team_id, season, week)
);
create index team_results_team_idx on team_results (team_id);

alter table team_results enable row level security;

create policy "team_results select own" on team_results for select to authenticated
  using (exists (select 1 from teams t where t.id = team_results.team_id and t.user_id = auth.uid()));
create policy "team_results insert own" on team_results for insert to authenticated
  with check (exists (select 1 from teams t where t.id = team_results.team_id and t.user_id = auth.uid()));
create policy "team_results update own" on team_results for update to authenticated
  using (exists (select 1 from teams t where t.id = team_results.team_id and t.user_id = auth.uid()))
  with check (exists (select 1 from teams t where t.id = team_results.team_id and t.user_id = auth.uid()));
create policy "team_results delete own" on team_results for delete to authenticated
  using (exists (select 1 from teams t where t.id = team_results.team_id and t.user_id = auth.uid()));

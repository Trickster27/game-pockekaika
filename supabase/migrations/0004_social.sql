-- Каэлмор: таблицы лидеров, арена против игроков, карточка игрока.
-- Выполните в Supabase → SQL Editor после 0001–0003. Файл можно выполнять повторно.
-- Правила повторяют src/online/socialSim.ts и socialTypes.ts (PVP, eloDelta).

create table if not exists public.player_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  power int not null default 0,
  level int not null default 1,
  tower int not null default 0,
  collection int not null default 0,
  team jsonb not null default '[]',
  team_power int not null default 0,
  pvp_rating int not null default 1000,
  tower_base int not null default 0,
  tower_day int not null default 0,
  pvp_refresh int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists player_stats_pvp on public.player_stats (pvp_rating);

create table if not exists public.pvp_battles (
  id bigint generated always as identity primary key,
  attacker uuid not null references public.profiles (id) on delete cascade,
  defender uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null,
  started_at timestamptz not null default now(),
  won boolean,
  delta_att int not null default 0,
  delta_def int not null default 0,
  revenge_taken boolean not null default false
);
create index if not exists pvp_battles_attacker on public.pvp_battles (attacker, started_at desc);
create index if not exists pvp_battles_defender on public.pvp_battles (defender, started_at desc);

alter table public.player_stats enable row level security;
alter table public.pvp_battles enable row level security;
-- Напрямую таблицы не читаются и не пишутся: только через функции ниже.

-- Округление как Math.round в JavaScript (половина — вверх).
create or replace function public._jsround(x double precision) returns int language sql immutable as $$
  select floor(x + 0.5)::int;
$$;

create or replace function public._elo(me int, opp int, win boolean) returns int language sql immutable as $$
  select public._jsround(32 * ((case when win then 1 else 0 end) - 1 / (1 + power(10, (opp - me) / 400.0))));
$$;

create or replace function public._stats_row(p_user uuid) returns public.player_stats
language plpgsql security definer set search_path = public as $$
declare r player_stats;
begin
  insert into player_stats (user_id) values (p_user) on conflict do nothing;
  select * into r from player_stats where user_id = p_user;
  return r;
end $$;

-- Боец защиты: уровни и звёзды в допустимых границах, бонусы снаряжения обрезаны.
create or replace function public._clean_unit(e jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'defId', left(coalesce(e->>'defId', ''), 40),
    'level', greatest(1, least(60, coalesce((e->>'level')::int, 1))),
    'stars', greatest(1, least(6, coalesce((e->>'stars')::int, 1))),
    'awakened', coalesce((e->>'awakened')::boolean, false),
    'bonus', coalesce((select jsonb_object_agg(k, least(greatest((v #>> '{}')::numeric, 0), 6000))
      from jsonb_each(case when jsonb_typeof(e->'bonus') = 'object' then e->'bonus' else '{}' end) as b(k, v)
      where jsonb_typeof(v) = 'number'), '{}'),
    'bonusPct', coalesce((select jsonb_object_agg(k, least(greatest((v #>> '{}')::numeric, 0), 1.5))
      from jsonb_each(case when jsonb_typeof(e->'bonusPct') = 'object' then e->'bonusPct' else '{}' end) as b(k, v)
      where jsonb_typeof(v) = 'number'), '{}'));
$$;

-- Прогресс игрока. Сервер проверяет правдоподобие: сила не выше 150 000,
-- башня растёт не больше чем на 30 этажей за сутки, команда — до 5 бойцов с допустимыми уровнями.
create or replace function public.submit_stats(p_power int, p_level int, p_tower int, p_collection int, p_team jsonb, p_team_power int)
returns void language plpgsql security definer set search_path = public as $$
declare r player_stats := _stats_row(auth.uid()); d int := floor(extract(epoch from now()) / 86400)::int; base int; pw int;
begin
  base := case when r.tower_day = d then r.tower_base else r.tower end;
  pw := greatest(0, least(p_power, 150000));
  update player_stats set
    power = pw,
    level = greatest(1, least(200, p_level)),
    tower = greatest(r.tower, least(p_tower, base + 30)),
    tower_base = base,
    tower_day = d,
    collection = greatest(0, least(p_collection, 200)),
    team = (select coalesce(jsonb_agg(_clean_unit(e)), '[]') from (
      select e from jsonb_array_elements(case when jsonb_typeof(p_team) = 'array' then p_team else '[]' end) e limit 5) t),
    team_power = greatest(0, least(p_team_power, pw)),
    updated_at = now()
  where user_id = auth.uid();
end $$;

create or replace function public._clan_tag(p_user uuid) returns text language sql stable security definer set search_path = public as $$
  select c.tag from clan_members m join clans c on c.id = m.clan_id where m.user_id = p_user;
$$;

create or replace function public.leaderboard(p_kind text, p_scope text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); w int := floor((floor(extract(epoch from now()) / 86400) + 3) / 7.0)::int; res jsonb;
begin
  with cand as (
    select ps.*, p from player_stats ps join profiles p on p.id = ps.user_id
    where (jsonb_array_length(ps.team) > 0 or ps.user_id = me)
      and (p_scope <> 'friends' or ps.user_id = me or are_friends(me, ps.user_id))
      and (p_scope <> 'clan' or ps.user_id = me or exists (
        select 1 from clan_members a join clan_members b on a.clan_id = b.clan_id where a.user_id = me and b.user_id = ps.user_id))
  ), val as (
    select user_id, p, case p_kind
      when 'power' then power when 'level' then level when 'tower' then tower when 'pvp' then pvp_rating
      when 'collection' then collection
      when 'boss' then (select coalesce(sum(damage), 0)::bigint from clan_attempts a
        where a.user_id = cand.user_id and floor((a.day + 3) / 7.0)::int = w)
      else 0 end::bigint as v
    from cand
  ), ranked as (
    select row_number() over (order by v desc, user_id) as rank, user_id, p, v from val
  )
  select jsonb_build_object(
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('rank', rank, 'profile', _profile_json(p), 'value', v,
      'clan_tag', _clan_tag(user_id)) order by rank), '[]') from (select * from ranked order by rank limit 50) t),
    'me', (select jsonb_build_object('rank', rank, 'profile', _profile_json(p), 'value', v, 'clan_tag', _clan_tag(user_id))
      from ranked where user_id = me)) into res;
  return res;
end $$;

create or replace function public._pvp_opp(p_user uuid, p_revenge boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('profile', _profile_json(p), 'rating', ps.pvp_rating, 'power', ps.team_power,
    'team', ps.team, 'revenge', p_revenge)
  from player_stats ps join profiles p on p.id = ps.user_id where ps.user_id = p_user;
$$;

create or replace function public._pvp_state(p_refresh_bump boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r player_stats := _stats_row(auth.uid()); d int := floor(extract(epoch from now()) / 86400)::int;
  used int; rev uuid[];
begin
  if p_refresh_bump then
    update player_stats set pvp_refresh = pvp_refresh + 1 where user_id = me returning * into r;
  end if;
  select count(*) into used from pvp_battles where attacker = me and floor(extract(epoch from started_at) / 86400)::int = d;
  select coalesce(array_agg(attacker), '{}') into rev from (
    select distinct on (attacker) attacker, started_at from pvp_battles
    where defender = me and won = true and not revenge_taken order by attacker, started_at desc) t;
  return jsonb_build_object(
    'rating', r.pvp_rating,
    'attacks_left', greatest(0, 5 - used),
    'defense', r.team,
    'opponents', (
      select coalesce(jsonb_agg(o), '[]') from (
        select _pvp_opp(x, true) o from unnest(rev[1:2]) x
        union all
        select o from (
          select _pvp_opp(user_id, false) o, team_power from (
            select user_id, team_power from player_stats
            where user_id <> me and jsonb_array_length(team) > 0 and not (user_id = any (rev))
            order by abs(pvp_rating - r.pvp_rating) limit 8) near
          order by md5(me::text || r.pvp_refresh || user_id::text) limit 3) pick
        ) t),
    'log', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'attacker', _profile_json(pa), 'defender', _profile_json(pd),
        'attacker_won', b.won, 'delta', case when b.attacker = me then b.delta_att else b.delta_def end,
        'at', b.started_at, 'revenge', b.defender = me and b.won and not b.revenge_taken) order by b.started_at desc), '[]')
      from (select * from pvp_battles where (attacker = me or defender = me) and won is not null order by started_at desc limit 20) b
      join profiles pa on pa.id = b.attacker join profiles pd on pd.id = b.defender));
end $$;

create or replace function public.pvp_state() returns jsonb language sql security definer set search_path = public as $$
  select _pvp_state(false);
$$;
create or replace function public.pvp_refresh() returns jsonb language sql security definer set search_path = public as $$
  select _pvp_state(true);
$$;

create or replace function public.pvp_begin(p_defender uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d int := floor(extract(epoch from now()) / 86400)::int; b pvp_battles;
begin
  if p_defender = me then raise exception 'self'; end if;
  perform _stats_row(me);
  if (select count(*) from pvp_battles where attacker = me and floor(extract(epoch from started_at) / 86400)::int = d) >= 5 then
    raise exception 'no_attacks';
  end if;
  if not exists (select 1 from player_stats where user_id = p_defender and jsonb_array_length(team) > 0) then
    raise exception 'not_found';
  end if;
  insert into pvp_battles (attacker, defender, seed) values (me, p_defender, floor(random() * 2147483647)::bigint) returning * into b;
  return jsonb_build_object('battle_id', b.id, 'seed', b.seed, 'defender', _pvp_opp(p_defender, false));
end $$;

-- Итог боя. Бой старше 15 минут засчитывается как поражение. Рейтинг считает сервер.
create or replace function public.pvp_finish(p_battle bigint, p_won boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b pvp_battles; a player_stats; d player_stats; v_won boolean := p_won; da int; dd int;
begin
  select * into b from pvp_battles where id = p_battle and attacker = me for update;
  if b.id is null then raise exception 'not_found'; end if;
  if b.won is not null then raise exception 'already'; end if;
  if now() - b.started_at > interval '15 minutes' then v_won := false; end if;
  select * into a from player_stats where user_id = b.attacker for update;
  select * into d from player_stats where user_id = b.defender for update;
  da := _elo(a.pvp_rating, d.pvp_rating, v_won);
  dd := _jsround(_elo(d.pvp_rating, a.pvp_rating, not v_won) * 0.6);
  update pvp_battles set won = v_won, delta_att = da, delta_def = dd where id = b.id;
  update player_stats set pvp_rating = greatest(0, pvp_rating + da) where user_id = b.attacker;
  update player_stats set pvp_rating = greatest(0, pvp_rating + dd) where user_id = b.defender;
  update pvp_battles set revenge_taken = true where id = (
    select id from pvp_battles where attacker = b.defender and defender = me and won = true and not revenge_taken
    order by started_at desc limit 1);
  return jsonb_build_object('delta', da, 'rating', greatest(0, a.pvp_rating + da));
end $$;

create or replace function public.player_card(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r player_stats := _stats_row(p_user);
begin
  return (select jsonb_build_object('profile', _profile_json(p), 'power', r.power, 'level', r.level, 'tower', r.tower,
    'pvp_rating', r.pvp_rating, 'collection', r.collection, 'team', r.team,
    'clan_tag', (select c.tag from clan_members m join clans c on c.id = m.clan_id where m.user_id = p_user),
    'clan_name', (select c.name from clan_members m join clans c on c.id = m.clan_id where m.user_id = p_user))
    from profiles p where p.id = p_user);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.gen_friend_code() to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function
  public.clan_state(), public.search_clans(text), public.clan_messages_list(int),
  public.create_clan(text, text, text, text, text, text, int), public.join_clan(uuid), public.cancel_clan_request(uuid),
  public.respond_clan_request(uuid, boolean), public.leave_clan(), public.kick_clan_member(uuid),
  public.set_clan_role(uuid, text), public.transfer_clan_leader(uuid),
  public.update_clan(text, text, int, text, text), public.clan_checkin(), public.clan_donate(text),
  public.boss_begin(), public.boss_finish(bigint, bigint), public.claim_clan_kill(int),
  public.claim_clan_weekly(text, int), public.claim_clan_rank(), public.send_clan_message(text),
  public.submit_stats(int, int, int, int, jsonb, int), public.leaderboard(text, text),
  public.pvp_state(), public.pvp_refresh(), public.pvp_begin(uuid), public.pvp_finish(bigint, boolean),
  public.player_card(uuid)
to authenticated;

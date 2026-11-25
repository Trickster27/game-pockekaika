-- Каэлмор: кланы и босс клана. Выполните этот файл целиком в Supabase → SQL Editor после 0001 и 0002.
--
-- Все изменения идут через функции (security definer): клиент не может напрямую
-- менять клан, ключи или здоровье босса. Числа повторяют src/game/clan.ts —
-- тест tests/clan.test.ts сверяет их с этим файлом.

-- ———————————————————— таблицы ————————————————————

create table if not exists public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 20),
  tag text not null check (tag ~ '^[A-ZА-ЯЁ0-9]{2,4}$'),
  emblem text not null default 'shield',
  color text not null default '#d9a94a',
  description text not null default '' check (char_length(description) <= 200),
  join_mode text not null default 'open' check (join_mode in ('open', 'request', 'closed')),
  min_level int not null default 1 check (min_level between 1 and 100),
  xp int not null default 0,
  boss_level int not null default 1,
  boss_hp bigint not null,
  boss_kills int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists clans_name_lower on public.clans (lower(name));
create unique index if not exists clans_tag on public.clans (tag);

-- Один игрок — один клан (user_id первичный ключ).
create table if not exists public.clan_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  clan_id uuid not null references public.clans (id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'officer', 'member')),
  joined_at timestamptz not null default now(),
  contribution int not null default 0
);
create index if not exists clan_members_clan on public.clan_members (clan_id);

create table if not exists public.clan_requests (
  clan_id uuid not null references public.clans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);

-- Ежедневное: отметка, пожертвования и ключи. Ключи привязаны к игроку, а не к клану:
-- переход в другой клан не даёт лишних попыток.
create table if not exists public.clan_daily (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day int not null,
  checkin boolean not null default false,
  donations text[] not null default '{}',
  keys int not null default 0,
  primary key (user_id, day)
);

create table if not exists public.clan_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  clan_id uuid not null references public.clans (id) on delete cascade,
  day int not null,
  boss_level int not null,
  seed bigint not null,
  started_at timestamptz not null default now(),
  damage bigint
);
create index if not exists clan_attempts_clan_day on public.clan_attempts (clan_id, day);
create index if not exists clan_attempts_level on public.clan_attempts (clan_id, boss_level, user_id);

create table if not exists public.clan_kills (
  clan_id uuid not null references public.clans (id) on delete cascade,
  level int not null,
  killer uuid,
  killed_at timestamptz not null default now(),
  primary key (clan_id, level)
);

create table if not exists public.clan_week (
  clan_id uuid not null references public.clans (id) on delete cascade,
  week int not null,
  attacks int not null default 0,
  checkins int not null default 0,
  kills int not null default 0,
  primary key (clan_id, week)
);

-- Полученные награды: ключ вида kill:<клан>:<уровень>, week:<клан>:<неделя>:<цель>:<шаг>, rank:<день>.
create table if not exists public.clan_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.clan_messages (
  id bigint generated always as identity primary key,
  clan_id uuid not null references public.clans (id) on delete cascade,
  sender uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  kind text not null default 'chat' check (kind in ('chat', 'system')),
  created_at timestamptz not null default now()
);
create index if not exists clan_messages_clan on public.clan_messages (clan_id, created_at desc);

alter table public.profiles add column if not exists clan_left_at timestamptz;

-- ———————————————————— правила (повторяют src/game/clan.ts) ————————————————————

create or replace function public._clan_day() returns int language sql stable as $$
  select floor(extract(epoch from now()) / 86400)::int;
$$;
create or replace function public._clan_week(d int) returns int language sql immutable as $$
  select floor((d + 3) / 7.0)::int;
$$;
-- Здоровье босса: 300 000 × 1.25^(L−1).
create or replace function public._boss_hp(lvl int) returns bigint language sql immutable as $$
  select round(300000 * power(1.25, greatest(0, lvl - 1)))::bigint;
$$;
create or replace function public._clan_level(xp int) returns int language sql immutable as $$
  select count(*)::int from unnest(array[0, 300, 800, 1600, 2800, 4500, 7000, 10500, 15000, 21000]) t where xp >= t;
$$;
create or replace function public._member_cap(lvl int) returns int language sql immutable as $$
  select (array[15, 18, 20, 22, 24, 26, 27, 28, 29, 30])[greatest(1, least(10, lvl))];
$$;

create or replace function public._profile_json(p public.profiles) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'nickname', p.nickname, 'friend_code', p.friend_code, 'avatar', p.avatar,
    'level', p.level, 'power', p.power, 'arena_rating', p.arena_rating, 'last_seen', p.last_seen);
$$;

create or replace function public._clan_json(c public.clans) returns jsonb language sql stable as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'emblem', c.emblem, 'color', c.color,
    'description', c.description, 'join_mode', c.join_mode, 'min_level', c.min_level, 'xp', c.xp,
    'members', (select count(*) from public.clan_members m where m.clan_id = c.id),
    'boss_level', c.boss_level, 'boss_kills', c.boss_kills, 'created_at', c.created_at);
$$;

create or replace function public._clan_sys(p_clan uuid, p_body jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.clan_messages (clan_id, sender, body, kind) values (p_clan, null, p_body::text, 'system');
$$;

create or replace function public._nick(p_user uuid) returns text language sql stable as $$
  select nickname from public.profiles where id = p_user;
$$;

create or replace function public._clan_add_xp(p_clan uuid, p_user uuid, n int) returns void
language plpgsql security definer set search_path = public as $$
declare before int; after int;
begin
  select _clan_level(xp) into before from clans where id = p_clan;
  update clans set xp = xp + n where id = p_clan;
  if p_user is not null then
    update clan_members set contribution = contribution + n where user_id = p_user and clan_id = p_clan;
  end if;
  select _clan_level(xp) into after from clans where id = p_clan;
  if after > before then
    perform _clan_sys(p_clan, jsonb_build_object('k', 'levelUp', 'a', jsonb_build_object('level', after)));
  end if;
end $$;

create or replace function public._my_member() returns public.clan_members
language plpgsql stable security definer set search_path = public as $$
declare m clan_members;
begin
  select * into m from clan_members where user_id = auth.uid();
  if m.user_id is null then raise exception 'clan_none'; end if;
  return m;
end $$;

create or replace function public._daily(p_user uuid, p_day int) returns public.clan_daily
language plpgsql security definer set search_path = public as $$
declare d clan_daily;
begin
  insert into clan_daily (user_id, day) values (p_user, p_day) on conflict do nothing;
  select * into d from clan_daily where user_id = p_user and day = p_day for update;
  return d;
end $$;

create or replace function public._week_bump(p_clan uuid, p_week int, p_attacks int, p_checkins int, p_kills int) returns void
language sql security definer set search_path = public as $$
  insert into clan_week (clan_id, week, attacks, checkins, kills) values (p_clan, p_week, p_attacks, p_checkins, p_kills)
  on conflict (clan_id, week) do update set attacks = clan_week.attacks + excluded.attacks,
    checkins = clan_week.checkins + excluded.checkins, kills = clan_week.kills + excluded.kills;
$$;

create or replace function public._cooldown_check() returns void
language plpgsql stable security definer set search_path = public as $$
declare t timestamptz;
begin
  select clan_left_at into t from profiles where id = auth.uid();
  if t is not null and now() < t + interval '4 hours' then raise exception 'clan_cooldown'; end if;
end $$;

-- ———————————————————— чтение ————————————————————

create or replace function public.clan_state() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m clan_members;
  c clans;
  d int := _clan_day();
  w int := _clan_week(_clan_day());
  wk clan_week;
  y jsonb;
begin
  select * into m from clan_members where user_id = me;
  if m.user_id is null then return null; end if;
  select * into c from clans where id = m.clan_id;
  select * into wk from clan_week where clan_id = c.id and week = w;

  with sums as (
    select user_id, sum(damage) dmg from clan_attempts
    where clan_id = c.id and day = d - 1 and damage > 0 group by user_id
  ), ranked as (
    select user_id, dmg, rank() over (order by dmg desc) r, count(*) over () n from sums
  )
  select jsonb_build_object('rank', r, 'damage', dmg, 'of', n) into y from ranked
  where user_id = me and not exists (select 1 from clan_claims where user_id = me and key = 'rank:' || (d - 1));

  return jsonb_build_object(
    'clan', _clan_json(c),
    'me', jsonb_build_object('role', m.role, 'joined_at', m.joined_at, 'today', (
      select jsonb_build_object('keys', coalesce(cd.keys, 0), 'checkin', coalesce(cd.checkin, false),
        'donations', coalesce(to_jsonb(cd.donations), '[]'::jsonb),
        'damage', (select coalesce(sum(damage), 0) from clan_attempts a where a.user_id = me and a.clan_id = c.id and a.day = d))
      from (select 1) x left join clan_daily cd on cd.user_id = me and cd.day = d)),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'profile', _profile_json(p), 'role', cm.role, 'joined_at', cm.joined_at, 'contribution', cm.contribution,
        'today', jsonb_build_object('keys', coalesce(cd.keys, 0), 'checkin', coalesce(cd.checkin, false),
          'donations', coalesce(to_jsonb(cd.donations), '[]'::jsonb),
          'damage', (select coalesce(sum(damage), 0) from clan_attempts a where a.user_id = cm.user_id and a.clan_id = c.id and a.day = d)))), '[]'::jsonb)
      from clan_members cm join profiles p on p.id = cm.user_id
      left join clan_daily cd on cd.user_id = cm.user_id and cd.day = d
      where cm.clan_id = c.id),
    'boss', jsonb_build_object('level', c.boss_level, 'hp', c.boss_hp, 'hp_max', _boss_hp(c.boss_level), 'kills', c.boss_kills, 'day', d),
    'requests', case when m.role = 'member' then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object('profile', _profile_json(p), 'at', r.created_at)), '[]'::jsonb)
      from clan_requests r join profiles p on p.id = r.user_id where r.clan_id = c.id) end,
    'week', jsonb_build_object('week', w, 'attacks', coalesce(wk.attacks, 0), 'checkins', coalesce(wk.checkins, 0),
      'kills', coalesce(wk.kills, 0),
      'claimed', (select coalesce(jsonb_agg(split_part(key, ':', 4) || ':' || split_part(key, ':', 5)), '[]'::jsonb)
        from clan_claims where user_id = me and key like 'week:' || c.id || ':' || w || ':%')),
    'pending_kills', (select coalesce(jsonb_agg(k.level order by k.level), '[]'::jsonb) from clan_kills k
      where k.clan_id = c.id
        and exists (select 1 from clan_attempts a where a.clan_id = c.id and a.user_id = me and a.boss_level = k.level and a.damage > 0)
        and not exists (select 1 from clan_claims cl where cl.user_id = me and cl.key = 'kill:' || c.id || ':' || k.level)),
    'yesterday', y
  );
end $$;

create or replace function public.search_clans(p_query text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t timestamptz;
begin
  select clan_left_at into t from profiles where id = auth.uid();
  return jsonb_build_object(
    'clans', (select coalesce(jsonb_agg(j), '[]'::jsonb) from (
      select _clan_json(c) j from clans c
      where coalesce(p_query, '') = '' or c.name ilike '%' || p_query || '%' or c.tag ilike '%' || p_query || '%'
      order by (c.join_mode = 'closed'), _clan_level(c.xp) desc, (select count(*) from clan_members m where m.clan_id = c.id) desc
      limit 30) s),
    'requested', (select coalesce(jsonb_agg(clan_id), '[]'::jsonb) from clan_requests where user_id = auth.uid()),
    'cooldown_until', case when t is null then null else t + interval '4 hours' end
  );
end $$;

create or replace function public.clan_messages_list(p_limit int default 60) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m clan_members := _my_member();
begin
  return (select coalesce(jsonb_agg(j order by created_at), '[]'::jsonb) from (
    select jsonb_build_object('id', x.id, 'clan_id', x.clan_id, 'sender', x.sender, 'nickname', p.nickname,
      'body', x.body, 'kind', x.kind, 'created_at', x.created_at) j, x.created_at
    from clan_messages x left join profiles p on p.id = x.sender
    where x.clan_id = m.clan_id order by x.created_at desc limit least(p_limit, 200)) s);
end $$;

-- ———————————————————— состав ————————————————————

create or replace function public.create_clan(p_name text, p_tag text, p_emblem text, p_color text,
  p_description text, p_join_mode text, p_min_level int) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); new_id uuid; lvl int;
begin
  if exists (select 1 from clan_members where user_id = me) then raise exception 'clan_in'; end if;
  perform _cooldown_check();
  select level into lvl from profiles where id = me;
  if coalesce(lvl, 1) < 5 then raise exception 'clan_level'; end if;
  if p_emblem not in ('shield','sword','crown','flame','leaf','wave','moon','sun','skull','anvil','eye','star') then raise exception 'invalid'; end if;
  if p_color not in ('#d9a94a','#e0503a','#5fb070','#4fb3d9','#a37cff','#5fbfb2','#c98a45','#e6e0f0') then raise exception 'invalid'; end if;
  if exists (select 1 from clans where lower(name) = lower(trim(p_name)) or tag = upper(trim(p_tag))) then raise exception 'clan_taken'; end if;
  begin
    insert into clans (name, tag, emblem, color, description, join_mode, min_level, boss_hp)
    values (trim(p_name), upper(trim(p_tag)), p_emblem, p_color, trim(coalesce(p_description, '')), p_join_mode,
      greatest(1, least(100, p_min_level)), _boss_hp(1))
    returning id into new_id;
  exception when check_violation then raise exception 'invalid';
  end;
  insert into clan_members (user_id, clan_id, role) values (me, new_id, 'leader');
  delete from clan_requests where user_id = me;
  perform _clan_sys(new_id, jsonb_build_object('k', 'created', 'a', jsonb_build_object('name', _nick(me))));
  return new_id;
end $$;

create or replace function public.join_clan(p_clan uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c clans; lvl int;
begin
  if exists (select 1 from clan_members where user_id = me) then raise exception 'clan_in'; end if;
  perform _cooldown_check();
  select * into c from clans where id = p_clan for update;
  if c.id is null then raise exception 'not_found'; end if;
  select level into lvl from profiles where id = me;
  if coalesce(lvl, 1) < c.min_level then raise exception 'clan_level'; end if;
  if c.join_mode = 'closed' then raise exception 'clan_closed'; end if;
  if (select count(*) from clan_members where clan_id = c.id) >= _member_cap(_clan_level(c.xp)) then raise exception 'clan_full'; end if;
  if c.join_mode = 'open' then
    insert into clan_members (user_id, clan_id) values (me, c.id);
    delete from clan_requests where user_id = me;
    perform _clan_sys(c.id, jsonb_build_object('k', 'join', 'a', jsonb_build_object('name', _nick(me))));
    return 'joined';
  end if;
  if exists (select 1 from clan_requests where clan_id = c.id and user_id = me) then raise exception 'already'; end if;
  insert into clan_requests (clan_id, user_id) values (c.id, me);
  return 'requested';
end $$;

create or replace function public.cancel_clan_request(p_clan uuid) returns void
language sql security definer set search_path = public as $$
  delete from clan_requests where clan_id = p_clan and user_id = auth.uid();
$$;

create or replace function public.respond_clan_request(p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); c clans;
begin
  if m.role = 'member' then raise exception 'clan_rights'; end if;
  if not exists (select 1 from clan_requests where clan_id = m.clan_id and user_id = p_user) then raise exception 'not_found'; end if;
  delete from clan_requests where clan_id = m.clan_id and user_id = p_user;
  if not p_accept then return; end if;
  if exists (select 1 from clan_members where user_id = p_user) then raise exception 'clan_in'; end if;
  select * into c from clans where id = m.clan_id for update;
  if (select count(*) from clan_members where clan_id = c.id) >= _member_cap(_clan_level(c.xp)) then raise exception 'clan_full'; end if;
  insert into clan_members (user_id, clan_id) values (p_user, c.id);
  delete from clan_requests where user_id = p_user;
  perform _clan_sys(c.id, jsonb_build_object('k', 'join', 'a', jsonb_build_object('name', _nick(p_user))));
end $$;

create or replace function public.leave_clan() returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); heir clan_members;
begin
  delete from clan_members where user_id = m.user_id;
  update profiles set clan_left_at = now() where id = m.user_id;
  if not exists (select 1 from clan_members where clan_id = m.clan_id) then
    delete from clans where id = m.clan_id;
    return;
  end if;
  perform _clan_sys(m.clan_id, jsonb_build_object('k', 'leave', 'a', jsonb_build_object('name', _nick(m.user_id))));
  if m.role = 'leader' then
    select * into heir from clan_members where clan_id = m.clan_id
      order by case role when 'officer' then 0 else 1 end, joined_at limit 1;
    update clan_members set role = 'leader' where user_id = heir.user_id;
    perform _clan_sys(m.clan_id, jsonb_build_object('k', 'leader', 'a', jsonb_build_object('name', _nick(heir.user_id))));
  end if;
end $$;

create or replace function public.kick_clan_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); t clan_members;
begin
  select * into t from clan_members where user_id = p_user and clan_id = m.clan_id;
  if t.user_id is null or t.user_id = m.user_id then raise exception 'not_found'; end if;
  if not (m.role = 'leader' or (m.role = 'officer' and t.role = 'member')) then raise exception 'clan_rights'; end if;
  delete from clan_members where user_id = p_user;
  perform _clan_sys(m.clan_id, jsonb_build_object('k', 'kick', 'a', jsonb_build_object('name', _nick(p_user))));
end $$;

create or replace function public.set_clan_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); t clan_members;
begin
  if m.role <> 'leader' then raise exception 'clan_rights'; end if;
  if p_role not in ('officer', 'member') then raise exception 'invalid'; end if;
  select * into t from clan_members where user_id = p_user and clan_id = m.clan_id;
  if t.user_id is null or t.user_id = m.user_id then raise exception 'not_found'; end if;
  if t.role = p_role then return; end if;
  if p_role = 'officer' and (select count(*) from clan_members where clan_id = m.clan_id and role = 'officer') >= 3 then
    raise exception 'clan_officers';
  end if;
  update clan_members set role = p_role where user_id = p_user;
  perform _clan_sys(m.clan_id, jsonb_build_object('k', case when p_role = 'officer' then 'promote' else 'demote' end,
    'a', jsonb_build_object('name', _nick(p_user))));
end $$;

create or replace function public.transfer_clan_leader(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member();
begin
  if m.role <> 'leader' then raise exception 'clan_rights'; end if;
  if p_user = m.user_id or not exists (select 1 from clan_members where user_id = p_user and clan_id = m.clan_id) then
    raise exception 'not_found';
  end if;
  update clan_members set role = 'leader' where user_id = p_user;
  update clan_members set role = 'officer' where user_id = m.user_id;
  perform _clan_sys(m.clan_id, jsonb_build_object('k', 'leader', 'a', jsonb_build_object('name', _nick(p_user))));
end $$;

create or replace function public.update_clan(p_description text, p_join_mode text, p_min_level int, p_emblem text, p_color text) returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member();
begin
  if m.role = 'member' then raise exception 'clan_rights'; end if;
  if p_emblem is not null and p_emblem not in ('shield','sword','crown','flame','leaf','wave','moon','sun','skull','anvil','eye','star') then raise exception 'invalid'; end if;
  if p_color is not null and p_color not in ('#d9a94a','#e0503a','#5fb070','#4fb3d9','#a37cff','#5fbfb2','#c98a45','#e6e0f0') then raise exception 'invalid'; end if;
  begin
    update clans set
      description = coalesce(trim(p_description), description),
      join_mode = coalesce(p_join_mode, join_mode),
      min_level = coalesce(greatest(1, least(100, p_min_level)), min_level),
      emblem = coalesce(p_emblem, emblem),
      color = coalesce(p_color, color)
    where id = m.clan_id;
  exception when check_violation then raise exception 'invalid';
  end;
end $$;

-- ———————————————————— ежедневное ————————————————————

create or replace function public.clan_checkin() returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); d clan_daily := _daily(auth.uid(), _clan_day());
begin
  if d.checkin then raise exception 'already'; end if;
  update clan_daily set checkin = true where user_id = d.user_id and day = d.day;
  perform _week_bump(m.clan_id, _clan_week(d.day), 0, 1, 0);
  perform _clan_add_xp(m.clan_id, m.user_id, 10);
end $$;

create or replace function public.clan_donate(p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); d clan_daily := _daily(auth.uid(), _clan_day());
begin
  if p_kind not in ('gold', 'shards') then raise exception 'invalid'; end if;
  if p_kind = any (d.donations) then raise exception 'already'; end if;
  update clan_daily set donations = array_append(donations, p_kind) where user_id = d.user_id and day = d.day;
  perform _clan_add_xp(m.clan_id, m.user_id, case p_kind when 'gold' then 25 else 60 end);
end $$;

-- ———————————————————— босс ————————————————————

-- Начало попытки: списывает ключ и выдаёт seed боя.
create or replace function public.boss_begin() returns jsonb
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); d clan_daily := _daily(auth.uid(), _clan_day()); c clans; att_id bigint; s bigint;
begin
  if d.keys >= 2 then raise exception 'no_keys'; end if;
  update clan_daily set keys = keys + 1 where user_id = d.user_id and day = d.day;
  select * into c from clans where id = m.clan_id;
  s := floor(random() * 2147483647)::bigint;
  insert into clan_attempts (user_id, clan_id, day, boss_level, seed) values (m.user_id, c.id, d.day, c.boss_level, s)
  returning id into att_id;
  return jsonb_build_object('attempt_id', att_id, 'seed', s, 'level', c.boss_level, 'hp', c.boss_hp,
    'hp_max', _boss_hp(c.boss_level), 'day', d.day);
end $$;

-- Итог попытки: урон ограничен (сила × 60, не меньше 60 000, не больше здоровья босса этого уровня).
create or replace function public.boss_finish(p_attempt bigint, p_damage bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a clan_attempts; c clans; pw int; dmg bigint; killed boolean := false; in_clan boolean;
begin
  select * into a from clan_attempts where id = p_attempt and user_id = auth.uid() for update;
  if a.id is null then raise exception 'not_found'; end if;
  if a.damage is not null then raise exception 'already'; end if;
  if now() - a.started_at > interval '30 minutes' then
    update clan_attempts set damage = 0 where id = a.id;
    raise exception 'expired';
  end if;
  select power into pw from profiles where id = auth.uid();
  dmg := greatest(0, least(p_damage, greatest(60000, coalesce(pw, 0)::bigint * 60), _boss_hp(a.boss_level)));
  update clan_attempts set damage = dmg where id = a.id;
  select * into c from clans where id = a.clan_id for update;
  if c.id is null then
    return jsonb_build_object('damage', dmg, 'level', a.boss_level, 'killed', false, 'boss_level', 0, 'boss_hp', 0);
  end if;
  in_clan := exists (select 1 from clan_members where user_id = auth.uid() and clan_id = c.id);
  perform _week_bump(c.id, _clan_week(a.day), 1, 0, 0);
  perform _clan_add_xp(c.id, case when in_clan then auth.uid() else null end, 5);
  c.boss_hp := c.boss_hp - dmg;
  if c.boss_hp <= 0 then
    killed := true;
    insert into clan_kills (clan_id, level, killer) values (c.id, c.boss_level, auth.uid()) on conflict do nothing;
    perform _clan_sys(c.id, jsonb_build_object('k', 'kill', 'a', jsonb_build_object('level', c.boss_level, 'name', _nick(auth.uid()))));
    c.boss_level := c.boss_level + 1;
    c.boss_hp := _boss_hp(c.boss_level);
    c.boss_kills := c.boss_kills + 1;
    perform _week_bump(c.id, _clan_week(a.day), 0, 0, 1);
  end if;
  update clans set boss_hp = c.boss_hp, boss_level = c.boss_level, boss_kills = c.boss_kills where id = c.id;
  if killed then perform _clan_add_xp(c.id, null, 100); end if;
  return jsonb_build_object('damage', dmg, 'level', a.boss_level, 'killed', killed, 'boss_level', c.boss_level, 'boss_hp', c.boss_hp);
end $$;

create or replace function public.claim_clan_kill(p_level int) returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); k text := 'kill:' || m.clan_id || ':' || p_level;
begin
  if not exists (select 1 from clan_kills where clan_id = m.clan_id and level = p_level)
    or not exists (select 1 from clan_attempts where clan_id = m.clan_id and user_id = m.user_id and boss_level = p_level and damage > 0) then
    raise exception 'not_found';
  end if;
  insert into clan_claims (user_id, key) values (m.user_id, k);
exception when unique_violation then raise exception 'already';
end $$;

create or replace function public.claim_clan_weekly(p_goal text, p_step int) returns void
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); w int := _clan_week(_clan_day()); wk clan_week; have int; need int;
begin
  select * into wk from clan_week where clan_id = m.clan_id and week = w;
  have := case p_goal when 'attacks' then coalesce(wk.attacks, 0) when 'checkins' then coalesce(wk.checkins, 0)
    when 'kills' then coalesce(wk.kills, 0) else null end;
  need := case p_goal when 'attacks' then (array[20, 50, 100])[p_step + 1] when 'checkins' then (array[25, 60, 100])[p_step + 1]
    when 'kills' then (array[1, 3, 6])[p_step + 1] else null end;
  if have is null or need is null or have < need then raise exception 'invalid'; end if;
  insert into clan_claims (user_id, key) values (m.user_id, 'week:' || m.clan_id || ':' || w || ':' || p_goal || ':' || p_step);
exception when unique_violation then raise exception 'already';
end $$;

create or replace function public.claim_clan_rank() returns jsonb
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); d int := _clan_day() - 1; res jsonb;
begin
  with sums as (
    select user_id, sum(damage) dmg from clan_attempts where clan_id = m.clan_id and day = d and damage > 0 group by user_id
  ), ranked as (select user_id, dmg, rank() over (order by dmg desc) r, count(*) over () n from sums)
  select jsonb_build_object('rank', r, 'damage', dmg, 'of', n) into res from ranked where user_id = m.user_id;
  if res is null then return null; end if;
  insert into clan_claims (user_id, key) values (m.user_id, 'rank:' || d);
  return res;
exception when unique_violation then return null;
end $$;

-- ———————————————————— чат ————————————————————

create or replace function public.send_clan_message(p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m clan_members := _my_member(); x clan_messages;
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 500 then raise exception 'invalid'; end if;
  insert into clan_messages (clan_id, sender, body, kind) values (m.clan_id, m.user_id, trim(p_body), 'chat') returning * into x;
  return jsonb_build_object('id', x.id, 'clan_id', x.clan_id, 'sender', x.sender, 'nickname', _nick(m.user_id),
    'body', x.body, 'kind', x.kind, 'created_at', x.created_at);
end $$;

-- ———————————————————— доступ ————————————————————

alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_requests enable row level security;
alter table public.clan_daily enable row level security;
alter table public.clan_attempts enable row level security;
alter table public.clan_kills enable row level security;
alter table public.clan_week enable row level security;
alter table public.clan_claims enable row level security;
alter table public.clan_messages enable row level security;

-- Напрямую можно только читать: список кланов и составы видны всем, сообщения — только своим.
drop policy if exists clans_read on public.clans;
create policy clans_read on public.clans for select to authenticated using (true);
drop policy if exists clan_members_read on public.clan_members;
create policy clan_members_read on public.clan_members for select to authenticated using (true);
drop policy if exists clan_messages_read on public.clan_messages;
create policy clan_messages_read on public.clan_messages for select to authenticated
  using (exists (select 1 from public.clan_members m where m.user_id = auth.uid() and m.clan_id = clan_messages.clan_id));

grant select on public.clans, public.clan_members, public.clan_messages to authenticated;

-- Свой профиль игрок правит только по этим столбцам: отметку выхода из клана (clan_left_at)
-- ставит сервер, сбросить её, чтобы обойти паузу перед новым кланом, нельзя.
revoke insert, update on public.profiles from authenticated;
grant insert (id, nickname, avatar) on public.profiles to authenticated;
grant update (nickname, avatar, level, power, arena_rating, last_seen) on public.profiles to authenticated;

-- Служебные функции (с подчёркиванием) напрямую не вызываются.
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
  public.claim_clan_weekly(text, int), public.claim_clan_rank(), public.send_clan_message(text)
to authenticated;

-- Realtime: новые сообщения клана (и системные события) приходят сразу.
do $$
begin
  begin
    alter publication supabase_realtime add table public.clan_messages;
  exception when duplicate_object then null;
  end;
end $$;

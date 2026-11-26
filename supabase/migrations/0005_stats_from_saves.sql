-- Каэлмор: игроки попадают в таблицы лидеров и на арену прямо из облачного сохранения.
-- Выполните в Supabase → SQL Editor после 0001–0004. Файл можно выполнять повторно.
--
-- Зачем: статистику для таблиц и защиту для арены присылает сама игра (submit_stats).
-- Игроки на старой версии игры или те, кто давно не заходил, её не присылают — и их не видно.
-- Но их облачное сохранение (saves) уже на сервере: в нём есть команда, герои, башня и уровень.
-- Здесь сервер сам собирает из сохранения статистику и защитную команду:
--   1) один раз — для всех, у кого уже есть сохранение;
--   2) дальше — при каждой записи сохранения, если игра давно (10+ минут) не присылала статистику сама.
-- Свежие данные от игры (с бонусами снаряжения) не перезаписываются.

create or replace function public._stats_from_save(p_user uuid, p_force boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  d jsonb;
  st player_stats;
  v_team jsonb;
  v_collection int;
  v_tower int;
  v_level int;
  v_power int;
begin
  select data into d from saves where user_id = p_user;
  if d is null or not exists (select 1 from profiles where id = p_user) then return; end if;
  select * into st from player_stats where user_id = p_user;
  -- Игра недавно прислала статистику сама — её данные точнее (учитывают снаряжение).
  if not p_force and st.user_id is not null and jsonb_array_length(st.team) > 0
     and st.updated_at > now() - interval '10 minutes' then
    return;
  end if;

  -- Боевая команда: uid из save.team → герои из save.heroes (порядок команды сохраняется).
  select coalesce(jsonb_agg(_clean_unit(jsonb_build_object(
           'defId', h->>'heroId',
           'level', h->'level',
           'stars', h->'stars',
           'awakened', coalesce(h->'awakened', 'false'::jsonb))) order by t.ord), '[]')
    into v_team
    from jsonb_array_elements_text(case when jsonb_typeof(d->'team') = 'array' then d->'team' else '[]' end)
         with ordinality as t(uid, ord)
    join lateral (
      select h from jsonb_array_elements(case when jsonb_typeof(d->'heroes') = 'array' then d->'heroes' else '[]' end) h
      where h->>'uid' = t.uid limit 1) hh on true
   where t.ord <= 5;

  select count(distinct h->>'heroId')::int into v_collection
    from jsonb_array_elements(case when jsonb_typeof(d->'heroes') = 'array' then d->'heroes' else '[]' end) h;
  v_tower := greatest(0, least(coalesce((d->'tower'->>'floor')::numeric, 0), 10000))::int;
  v_level := greatest(1, least(coalesce((d->'player'->>'level')::numeric, 1), 200))::int;
  select greatest(0, least(power, 150000)) into v_power from profiles where id = p_user;

  insert into player_stats (user_id, power, level, tower, collection, team, team_power, updated_at)
  values (p_user, coalesce(v_power, 0), v_level, v_tower, least(v_collection, 200), v_team, coalesce(v_power, 0),
          now() - interval '10 minutes')
  on conflict (user_id) do update set
    level = greatest(player_stats.level, excluded.level),
    tower = greatest(player_stats.tower, excluded.tower),
    collection = greatest(player_stats.collection, excluded.collection),
    power = case when player_stats.power > 0 then player_stats.power else excluded.power end,
    team = case when jsonb_array_length(excluded.team) > 0 then excluded.team else player_stats.team end,
    team_power = case when player_stats.team_power > 0 then player_stats.team_power else excluded.team_power end,
    -- Метка «собрано сервером»: следующее сохранение снова обновит данные, пока игра молчит.
    updated_at = least(player_stats.updated_at, now() - interval '10 minutes');
end $$;

-- При каждой записи облачного сохранения.
create or replace function public._saves_to_stats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform _stats_from_save(new.user_id);
  return new;
exception when others then
  -- Сохранение важнее статистики: ошибка здесь не должна мешать записи сейва.
  return new;
end $$;

drop trigger if exists saves_to_stats on public.saves;
create trigger saves_to_stats after insert or update on public.saves
  for each row execute function public._saves_to_stats();

-- Разовое заполнение для всех, у кого уже есть сохранение.
do $$
declare r record;
begin
  for r in select user_id from public.saves loop
    begin
      perform public._stats_from_save(r.user_id, true);
    exception when others then
      raise notice 'skip %: %', r.user_id, sqlerrm;
    end;
  end loop;
end $$;

revoke execute on function public._stats_from_save(uuid, boolean) from public, anon, authenticated;
revoke execute on function public._saves_to_stats() from public, anon, authenticated;

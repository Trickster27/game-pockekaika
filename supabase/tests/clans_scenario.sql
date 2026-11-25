-- Сценарий проверки кланов (см. run.sh). Выполняется от имени роли authenticated, как в Supabase.
\set ON_ERROR_STOP 1
create or replace function public.t_err(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
grant execute on function public.t_err(text) to authenticated;
create or replace function public.t_as(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false); $$;
grant execute on function public.t_as(text) to authenticated;

insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000c');
insert into profiles (id, nickname, level, power) values
  ('00000000-0000-0000-0000-00000000000a', 'Альфа', 10, 10000),
  ('00000000-0000-0000-0000-00000000000b', 'Бета', 8, 1000),
  ('00000000-0000-0000-0000-00000000000c', 'Гамма', 2, 1000);

set role authenticated;
select t_as('00000000-0000-0000-0000-00000000000c');
select 'c create (low level)' as step, t_err($$select create_clan('Гамма','ГМ','sun','#d9a94a','','open',1)$$);
select t_as('00000000-0000-0000-0000-00000000000a');
select 'a bad emblem' as step, t_err($$select create_clan('Рассвет','РСВ','nope','#d9a94a','','open',1)$$);
select 'a bad tag' as step, t_err($$select create_clan('Рассвет','R','sun','#d9a94a','','open',1)$$);
select 'a create' as step, t_err($$select create_clan('Рассвет','рсв','sun','#d9a94a','Тест','request',5)$$);
select 'a again' as step, t_err($$select create_clan('Другой','ДР','sun','#d9a94a','','open',1)$$);
select 'state name/tag/role' as step, clan_state()->'clan'->>'name', clan_state()->'clan'->>'tag', clan_state()->'me'->>'role';

select t_as('00000000-0000-0000-0000-00000000000b');
select 'b search' as step, jsonb_array_length(search_clans('')->'clans');
select 'b join (request)' as step, join_clan((select id from clans limit 1));
select 'b join again' as step, t_err($$select join_clan((select id from clans limit 1))$$);
select 'b state (none)' as step, clan_state() is null;
select t_as('00000000-0000-0000-0000-00000000000c');
select 'c join (min level)' as step, t_err($$select join_clan((select id from clans limit 1))$$);

select t_as('00000000-0000-0000-0000-00000000000a');
select 'a sees requests' as step, jsonb_array_length(clan_state()->'requests');
select 'a accept' as step, t_err($$select respond_clan_request('00000000-0000-0000-0000-00000000000b', true)$$);
select 'members' as step, jsonb_array_length(clan_state()->'members');
select 'a checkin' as step, t_err('select clan_checkin()');
select 'a checkin twice' as step, t_err('select clan_checkin()');
select 'a donate gold' as step, t_err($$select clan_donate('gold')$$);
select 'a donate gold twice' as step, t_err($$select clan_donate('gold')$$);
select 'xp after' as step, clan_state()->'clan'->>'xp';

-- босс: попытка, лимит урона, убийство
select (boss_begin()->>'attempt_id') as att \gset
select 'a finish huge' as step, boss_finish(:att, 999999999);
select 'a finish twice' as step, t_err('select boss_finish(' || :att || ', 5)');
select 'a begin 2' as step, (boss_begin()->>'level');
select 'a begin 3 (no keys)' as step, t_err('select boss_begin()');
select 'boss after' as step, clan_state()->'boss';
select 'pending kills a' as step, clan_state()->'pending_kills';
select 'claim kill' as step, t_err('select claim_clan_kill(1)');
select 'claim kill twice' as step, t_err('select claim_clan_kill(1)');
select 'week' as step, clan_state()->'week';
select 'weekly kills step0' as step, t_err($$select claim_clan_weekly('kills', 0)$$);
select 'weekly kills step1 (not enough)' as step, t_err($$select claim_clan_weekly('kills', 1)$$);

select t_as('00000000-0000-0000-0000-00000000000b');
select (boss_begin()->>'attempt_id') as batt \gset
select 'b finish capped (power 1000 -> 60000)' as step, boss_finish(:batt, 500000)->>'damage';
select 'b finish other attempt' as step, t_err('select boss_finish(' || :att || ', 5)');
select 'b claim kill (not participant)' as step, t_err('select claim_clan_kill(1)');
select 'b kick a (rights)' as step, t_err($$select kick_clan_member('00000000-0000-0000-0000-00000000000a')$$);
select 'b chat' as step, send_clan_message('Привет клан')->>'body';
select 'b messages' as step, jsonb_array_length(clan_messages_list(50));
reset role;
insert into clan_attempts (user_id, clan_id, day, boss_level, seed, damage) values
  ('00000000-0000-0000-0000-00000000000a', (select id from clans limit 1), _clan_day() - 1, 1, 1, 5000),
  ('00000000-0000-0000-0000-00000000000b', (select id from clans limit 1), _clan_day() - 1, 1, 1, 9000);
set role authenticated;
select 'b yesterday' as step, clan_state()->'yesterday';
select 'b claim rank' as step, claim_clan_rank();
select 'b claim rank twice' as step, coalesce(claim_clan_rank()::text, 'null');
select 'b yesterday after' as step, coalesce((clan_state()->'yesterday')::text, 'null');
select 'b direct table write' as step, t_err($$update clans set boss_hp = 1$$);
select 'b direct member write' as step, t_err($$update clan_members set role = 'leader'$$);
select 'b reset own cooldown' as step, t_err($$update profiles set clan_left_at = null where id = auth.uid()$$);
select 'b update nickname ok' as step, t_err($$update profiles set level = 9 where id = auth.uid()$$);
select 'b internal fn' as step, t_err($$select _clan_add_xp((select id from clans limit 1), null, 99999)$$);

select t_as('00000000-0000-0000-0000-00000000000a');
select 'a promote b' as step, t_err($$select set_clan_role('00000000-0000-0000-0000-00000000000b', 'officer')$$);
select 'a leave -> b leader' as step, t_err('select leave_clan()');
select 'a cooldown join' as step, t_err($$select join_clan((select id from clans limit 1))$$);
select t_as('00000000-0000-0000-0000-00000000000b');
select 'b role' as step, clan_state()->'me'->>'role';
select 'sys messages' as step, (select string_agg(body::jsonb->>'k', ',' order by id) from clan_messages where kind = 'system');
select 'b leave (disband)' as step, t_err('select leave_clan()');
reset role;
select 'clans left' as step, count(*) from clans;

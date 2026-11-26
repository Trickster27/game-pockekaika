-- Сценарий проверки лидеров и PvP (см. run.sh). Выполняется от имени роли authenticated.
\set ON_ERROR_STOP 1
create or replace function public.t_err(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
grant execute on function public.t_err(text) to authenticated;
create or replace function public.t_as(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false); $$;
grant execute on function public.t_as(text) to authenticated;

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1')
  on conflict do nothing;
insert into profiles (id, nickname, level, power) values
  ('00000000-0000-0000-0000-0000000000a1', 'Альфа2', 20, 20000),
  ('00000000-0000-0000-0000-0000000000b1', 'Бета2', 15, 15000),
  ('00000000-0000-0000-0000-0000000000c1', 'Гамма2', 5, 3000) on conflict do nothing;

set role authenticated;
select t_as('00000000-0000-0000-0000-0000000000a1');
select 'a submit (cheat power, tower)' as step, t_err($$select submit_stats(999999, 20, 500, 12,
  '[{"defId":"ardan","level":99,"stars":9,"bonus":{"atk":99999},"bonusPct":{"atk":5}},{"defId":"ivy","level":20,"stars":3},{"defId":"x","level":1,"stars":1},{"defId":"y","level":1,"stars":1},{"defId":"z","level":1,"stars":1},{"defId":"w","level":1,"stars":1}]'::jsonb, 999999)$$);
select 'a card' as step, player_card(auth.uid())->>'power', player_card(auth.uid())->>'tower',
  jsonb_array_length(player_card(auth.uid())->'team'), player_card(auth.uid())->'team'->0->>'level', player_card(auth.uid())->'team'->0->>'stars',
  player_card(auth.uid())->'team'->0->'bonus'->>'atk', player_card(auth.uid())->'team'->0->'bonusPct'->>'atk';
select 'a tower +30 same day' as step, t_err($$select submit_stats(20000, 20, 80, 12, '[{"defId":"ardan","level":20,"stars":3}]', 20000)$$), player_card(auth.uid())->>'tower';

select t_as('00000000-0000-0000-0000-0000000000b1');
select 'b submit' as step, t_err($$select submit_stats(15000, 15, 10, 8, '[{"defId":"ivy","level":15,"stars":3}]', 15000)$$);
select t_as('00000000-0000-0000-0000-0000000000c1');
select 'c submit' as step, t_err($$select submit_stats(3000, 5, 2, 4, '[{"defId":"chirk","level":5,"stars":1}]', 3000)$$);

select 'lb power all' as step, (select string_agg(r->'profile'->>'nickname' || '=' || (r->>'value'), ',') from jsonb_array_elements(leaderboard('power', 'all')->'rows') r);
select 'lb me' as step, leaderboard('power', 'all')->'me'->>'rank';
select 'lb friends (no friends)' as step, jsonb_array_length(leaderboard('power', 'friends')->'rows');

select 'pvp state' as step, pvp_state()->>'rating', pvp_state()->>'attacks_left', jsonb_array_length(pvp_state()->'opponents');
select 'pvp self' as step, t_err($$select pvp_begin('00000000-0000-0000-0000-0000000000c1')$$);
select (pvp_begin('00000000-0000-0000-0000-0000000000a1')->>'battle_id') as bid \gset
select 'c wins vs a' as step, pvp_finish(:bid, true);
select 'finish twice' as step, t_err('select pvp_finish(' || :bid || ', true)');
select 'ratings after' as step, (player_card('00000000-0000-0000-0000-0000000000a1')->>'pvp_rating'), (player_card(auth.uid())->>'pvp_rating');
select 'c attacks left' as step, pvp_state()->>'attacks_left';
select 'limit 5' as step, t_err($$select pvp_begin('00000000-0000-0000-0000-0000000000b1')$$), t_err($$select pvp_begin('00000000-0000-0000-0000-0000000000b1')$$),
  t_err($$select pvp_begin('00000000-0000-0000-0000-0000000000b1')$$), t_err($$select pvp_begin('00000000-0000-0000-0000-0000000000b1')$$),
  t_err($$select pvp_begin('00000000-0000-0000-0000-0000000000b1')$$);

select t_as('00000000-0000-0000-0000-0000000000a1');
select 'a log & revenge' as step, pvp_state()->'log'->0->>'attacker_won', pvp_state()->'log'->0->>'revenge', pvp_state()->'log'->0->>'delta',
  (select bool_or((o->>'revenge')::boolean) from jsonb_array_elements(pvp_state()->'opponents') o);
select (pvp_begin('00000000-0000-0000-0000-0000000000c1')->>'battle_id') as rbid \gset
select 'a revenge win' as step, pvp_finish(:rbid, true)->>'delta';
select 'revenge gone' as step, (select count(*) from jsonb_array_elements(pvp_state()->'opponents') o where (o->>'revenge')::boolean);
select 'lb pvp' as step, (select string_agg(r->'profile'->>'nickname' || '=' || (r->>'value'), ',') from jsonb_array_elements(leaderboard('pvp', 'all')->'rows') r);
select 'direct read' as step, t_err('select count(*) from player_stats');
select 'direct write' as step, t_err($$update player_stats set pvp_rating = 9999$$);
reset role;
select 'elo parity' as step, _elo(1000, 1000, true), _elo(1000, 1200, true), _elo(1200, 1000, false), _jsround(-2.5), _jsround(2.5);

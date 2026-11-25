-- Каэлмор: права ролей Supabase на таблицы онлайна.
-- В новых проектах Supabase таблицам, созданным через SQL, права выдаются не автоматически,
-- поэтому без этого файла приложение получает «permission denied for table profiles».
-- Что именно можно делать с каждой строкой, по-прежнему решают политики RLS из 0001_online.sql.

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.saves to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update on public.messages to authenticated;

grant execute on function public.gen_friend_code() to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

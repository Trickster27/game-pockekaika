-- Каэлмор: онлайн-часть. Выполните этот файл в Supabase → SQL Editor (или `supabase db push`).
-- Таблицы: профили игроков, облачные сейвы, дружба, личные сообщения.
-- Доступ ограничен политиками RLS: каждый видит только то, что ему положено.

create extension if not exists pgcrypto;

-- Короткий код друга: 6 символов без похожих букв.
create or replace function public.gen_friend_code() returns text
language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  friend_code text not null unique default public.gen_friend_code(),
  avatar text not null default 'knight',
  level int not null default 1,
  power int not null default 0,
  arena_rating int not null default 1000,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_nickname_lower on public.profiles (lower(nickname));

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  version int not null,
  updated_at timestamptz not null,
  device text
);

create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
-- Одна запись на пару игроков в любом направлении.
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null references public.profiles (id) on delete cascade,
  recipient uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_pair on public.messages (least(sender, recipient), greatest(sender, recipient), created_at desc);

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.friendships enable row level security;
alter table public.messages enable row level security;

-- Профили видят все вошедшие игроки (для поиска друзей), менять можно только свой.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Сейв — только свой.
drop policy if exists saves_own on public.saves;
create policy saves_own on public.saves for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Дружба: видят оба участника; заявку создаёт только отправитель; принимает только получатель; удалить может любой из двух.
drop policy if exists friends_read on public.friendships;
create policy friends_read on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists friends_request on public.friendships;
create policy friends_request on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
drop policy if exists friends_accept on public.friendships;
create policy friends_accept on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
drop policy if exists friends_delete on public.friendships;
create policy friends_delete on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

-- Сообщения: читают отправитель и получатель; писать можно только друзьям; отметку «прочитано» ставит получатель.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (auth.uid() in (sender, recipient));
drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated with check (sender = auth.uid() and public.are_friends(sender, recipient));
drop policy if exists messages_mark_read on public.messages;
create policy messages_mark_read on public.messages for update to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());

-- Realtime: новые сообщения и заявки приходят сразу.
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.friendships;
  exception when duplicate_object then null;
  end;
end $$;

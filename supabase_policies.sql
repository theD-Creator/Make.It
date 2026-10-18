-- Make.It Supabase setup. Run once in the Supabase SQL Editor.
-- New accounts use Supabase Auth. Do not put a service-role/secret key in the app.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null default '',
  password_hash text,
  bio text not null default '',
  avatar_url text,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  caption text not null default '',
  image_url text,
  emoji text,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.followers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  follower_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, follower_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  sender_id uuid not null references public.users(id),
  recipient_id uuid references public.users(id),
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;
alter table public.users alter column password_hash drop not null;
alter table public.messages add column if not exists recipient_id uuid references public.users(id) on delete cascade;

create index if not exists users_auth_user_id_idx on public.users (auth_user_id);
create index if not exists posts_user_created_at_idx on public.posts (user_id, created_at desc);
create index if not exists followers_follower_id_idx on public.followers (follower_id);
create index if not exists messages_sender_created_at_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_recipient_created_at_idx on public.messages (recipient_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare requested_username text;
begin
  requested_username := lower(coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, ''), '@', 1)
  ));
  if requested_username !~ '^[a-z0-9_.]{3,30}$' then
    raise exception 'Nutzername ungültig';
  end if;
  insert into public.users (username, name, avatar_url, auth_user_id)
  values (
    requested_username,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    '😊',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.followers enable row level security;
alter table public.messages enable row level security;

do $$
declare item record;
begin
  for item in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('users', 'posts', 'followers', 'messages')
  loop
    execute format('drop policy %I on %I.%I', item.policyname, item.schemaname, item.tablename);
  end loop;
end;
$$;

revoke all on table public.users, public.posts, public.followers, public.messages from anon, authenticated;
grant select (id, username, name, bio, avatar_url, followers_count, following_count, created_at)
  on public.users to anon, authenticated;
grant select (auth_user_id) on public.users to authenticated;
grant update (username, name, bio, avatar_url) on public.users to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select on public.posts to anon;
grant select on public.followers to anon, authenticated;
grant insert, delete on public.followers to authenticated;
grant select, insert, delete on public.messages to authenticated;

create policy "users_public_read" on public.users for select to anon, authenticated using (true);
create policy "users_update_own" on public.users for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create policy "posts_public_read" on public.posts for select to anon, authenticated using (true);
create policy "posts_insert_own" on public.posts for insert to authenticated
  with check (exists (select 1 from public.users p where p.id = posts.user_id and p.auth_user_id = (select auth.uid())));
create policy "posts_update_own" on public.posts for update to authenticated
  using (exists (select 1 from public.users p where p.id = posts.user_id and p.auth_user_id = (select auth.uid())))
  with check (exists (select 1 from public.users p where p.id = posts.user_id and p.auth_user_id = (select auth.uid())));
create policy "posts_delete_own" on public.posts for delete to authenticated
  using (exists (select 1 from public.users p where p.id = posts.user_id and p.auth_user_id = (select auth.uid())));

create policy "followers_public_read" on public.followers for select to anon, authenticated using (true);
create policy "followers_insert_own" on public.followers for insert to authenticated
  with check (exists (select 1 from public.users p where p.id = followers.follower_id and p.auth_user_id = (select auth.uid())));
create policy "followers_delete_own" on public.followers for delete to authenticated
  using (exists (select 1 from public.users p where p.id = followers.follower_id and p.auth_user_id = (select auth.uid())));

create policy "messages_participant_read" on public.messages for select to authenticated
  using (
    exists (select 1 from public.users p where p.id = messages.sender_id and p.auth_user_id = (select auth.uid()))
    or exists (select 1 from public.users p where p.id = messages.recipient_id and p.auth_user_id = (select auth.uid()))
  );
create policy "messages_insert_sender" on public.messages for insert to authenticated
  with check (
    recipient_id is not null
    and messages.sender_id <> messages.recipient_id
    and exists (select 1 from public.users sender_profile where sender_profile.id = messages.sender_id and sender_profile.auth_user_id = (select auth.uid()))
    and exists (select 1 from public.users recipient_profile where recipient_profile.id = messages.recipient_id and recipient_profile.auth_user_id is not null)
  );
create policy "messages_delete_sender" on public.messages for delete to authenticated
  using (exists (select 1 from public.users p where p.id = messages.sender_id and p.auth_user_id = (select auth.uid())));

insert into storage.buckets (id, name, public)
values ('snapgram-images', 'snapgram-images', true)
on conflict (id) do update set public = true;

drop policy if exists "storage_public_read_snapgram_images" on storage.objects;
drop policy if exists "storage_public_insert_snapgram_images" on storage.objects;
drop policy if exists "storage_public_update_snapgram_images" on storage.objects;
drop policy if exists "storage_public_delete_snapgram_images" on storage.objects;
drop policy if exists "snapgram_images_public_read" on storage.objects;
drop policy if exists "snapgram_images_insert_own" on storage.objects;
drop policy if exists "snapgram_images_update_own" on storage.objects;
drop policy if exists "snapgram_images_delete_own" on storage.objects;

create policy "snapgram_images_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'snapgram-images');
create policy "snapgram_images_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'snapgram-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "snapgram_images_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'snapgram-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'snapgram-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "snapgram_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'snapgram-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

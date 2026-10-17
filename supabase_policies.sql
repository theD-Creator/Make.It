-- SnapGram RLS + Storage Policies
-- WICHTIG:
-- Deine App nutzt aktuell Username/Passwort in der users-Tabelle
-- OHNE Supabase Auth Session/JWT.
-- Damit kann Postgres keinen echten "aktuellen User" erkennen.
-- Ergebnis: sichere "nur eigener User darf schreiben"-Policies sind so nicht möglich.

-- =========================================================
-- 1) RLS aktivieren
-- =========================================================
alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.followers enable row level security;
alter table public.messages enable row level security;

-- =========================================================
-- 2) MINDEST-SETUP für aktuelle App (funktional, aber offen)
-- =========================================================
drop policy if exists "users_select_all" on public.users;
create policy "users_select_all"
on public.users for select
to anon
using (true);

drop policy if exists "users_insert_all" on public.users;
create policy "users_insert_all"
on public.users for insert
to anon
with check (true);

drop policy if exists "users_update_all" on public.users;
create policy "users_update_all"
on public.users for update
to anon
using (true)
with check (true);

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
on public.posts for select
to anon
using (true);

drop policy if exists "posts_insert_all" on public.posts;
create policy "posts_insert_all"
on public.posts for insert
to anon
with check (true);

drop policy if exists "posts_update_all" on public.posts;
create policy "posts_update_all"
on public.posts for update
to anon
using (true)
with check (true);

drop policy if exists "followers_select_all" on public.followers;
create policy "followers_select_all"
on public.followers for select
to anon
using (true);

drop policy if exists "followers_insert_all" on public.followers;
create policy "followers_insert_all"
on public.followers for insert
to anon
with check (true);

drop policy if exists "messages_select_all" on public.messages;
create policy "messages_select_all"
on public.messages for select
to anon
using (true);

drop policy if exists "messages_insert_all" on public.messages;
create policy "messages_insert_all"
on public.messages for insert
to anon
with check (true);

-- =========================================================
-- 3) Storage Bucket + Policies für Bilder
-- =========================================================
insert into storage.buckets (id, name, public)
values ('snapgram-images', 'snapgram-images', true)
on conflict (id) do nothing;

drop policy if exists "storage_public_read_snapgram_images" on storage.objects;
create policy "storage_public_read_snapgram_images"
on storage.objects for select
to anon
using (bucket_id = 'snapgram-images');

drop policy if exists "storage_public_insert_snapgram_images" on storage.objects;
create policy "storage_public_insert_snapgram_images"
on storage.objects for insert
to anon
with check (bucket_id = 'snapgram-images');

drop policy if exists "storage_public_update_snapgram_images" on storage.objects;
create policy "storage_public_update_snapgram_images"
on storage.objects for update
to anon
using (bucket_id = 'snapgram-images')
with check (bucket_id = 'snapgram-images');

drop policy if exists "storage_public_delete_snapgram_images" on storage.objects;
create policy "storage_public_delete_snapgram_images"
on storage.objects for delete
to anon
using (bucket_id = 'snapgram-images');

-- =========================================================
-- 4) EMPFOHLEN (sicher):
-- =========================================================
-- Wechsle auf echte Supabase Auth (auth.users + JWT),
-- dann können Policies mit auth.uid() pro User korrekt gesichert werden.

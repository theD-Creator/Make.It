# Supabase Integration für SnapGram

## Schritt 1: Projekt
1. Auf [supabase.com](https://supabase.com) ein Projekt erstellen.
2. Projektname z. B. `snapgram`.

## Schritt 2: Tabellen
Im SQL Editor ausführen:

```sql
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username varchar unique not null,
  name varchar,
  password_hash text not null,
  bio text,
  avatar_url varchar,
  followers_count int default 0,
  following_count int default 0,
  created_at timestamp default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  caption text,
  image_url varchar,
  emoji varchar,
  likes_count int default 0,
  comments_count int default 0,
  created_at timestamp default now()
);

create table if not exists public.followers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  follower_id uuid not null references public.users(id),
  created_at timestamp default now(),
  unique(user_id, follower_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  sender_id uuid not null references public.users(id),
  text text not null,
  created_at timestamp default now()
);
```

Falls `users` schon existiert:
```sql
alter table public.users add column if not exists password_hash text;
```

## Schritt 3: API Keys
Unter `Settings -> API`:
- `Project URL`
- `anon public key`

In `D:\Snapgram\js\supabase.js` eintragen.

## Schritt 4: Auth-Modell
Diese App nutzt aktuell nur **Username + Passwort** über die Tabelle `users` (ohne Supabase E-Mail-Auth im Frontend).

## Schritt 5: RLS + Storage
Im SQL Editor den Inhalt von `D:\Snapgram\supabase_policies.sql` ausführen.

Das erstellt:
- RLS-Policies für `users`, `posts`, `followers`, `messages`
- Storage-Bucket `snapgram-images`
- Storage-Policies für Bild-Upload/Lesen

## Ehrlich wichtig
- Mit dem aktuellen Modell (ohne Supabase JWT pro User) sind nur offene Policies möglich.
- Das ist funktional, aber nicht wirklich sicher.
- Für echte Sicherheit sollte als Nächstes auf Supabase Auth mit Session/JWT umgestellt werden.

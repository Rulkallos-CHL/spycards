-- supabase.sql
-- Run this in your Supabase SQL Editor to create minimal schema

create table profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  spy_coin int default 0,
  client_state text default 'idle', -- idle, available, occupied
  created_at timestamptz default now()
);

create table cards (
  id uuid default gen_random_uuid() primary key,
  owner uuid references profiles(id),
  name text,
  qty_owned int default 1,
  meta jsonb,
  created_at timestamptz default now()
);

create table decks (
  id uuid default gen_random_uuid() primary key,
  owner uuid references profiles(id),
  name text,
  description text,
  created_at timestamptz default now()
);

create table deck_cards (
  id uuid default gen_random_uuid() primary key,
  deck_id uuid references decks(id) on delete cascade,
  card_id uuid references cards(id),
  qty int default 1
);

create table store_items (
  id uuid default gen_random_uuid() primary key,
  name text,
  description text,
  price int default 0,
  payload jsonb,
  created_at timestamptz default now()
);

create table purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  item_id uuid references store_items(id),
  price int,
  created_at timestamptz default now()
);

create table matches (
  id uuid default gen_random_uuid() primary key,
  host_user uuid references profiles(id),
  guest_user uuid references profiles(id),
  play_code text,
  status text default 'waiting', -- waiting, started, finished, cancelled
  created_at timestamptz default now()
);

-- Example RLS: allow profile owner to update their profile, others cannot.
-- Enable RLS and policies (run in SQL Editor with RLS on)
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Example policy:
-- CREATE POLICY "profiles_owner_only" ON profiles
-- FOR ALL
-- USING ( auth.role() = 'authenticated' AND id = auth.uid() )
-- WITH CHECK ( auth.uid() = id );

-- For tables like matches or purchases, prefer server-side insertion (Edge Function)
-- If allowing client inserts, write restrictive policies (e.g., only allow inserting matches if host_user == auth.uid()).

-- NOTE: In production, always create explicit RLS policies per-table; do not leave tables open.
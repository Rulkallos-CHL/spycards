```sql
-- supabase.sql
-- Run in Supabase SQL Editor. Creates schema, game_states table, and seeds all registered users with a starter deck of 40 Soldiers.

-- ENABLE extension for uuid and random id if not present
create extension if not exists "pgcrypto";

-- Profiles table (if not already present)
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  spy_coin int default 0,
  client_state text default 'idle',
  created_at timestamptz default now()
);

create table if not exists cards (
  id uuid default gen_random_uuid() primary key,
  owner uuid references profiles(id),
  name text,
  qty_owned int default 1,
  meta jsonb,
  created_at timestamptz default now()
);

create table if not exists decks (
  id uuid default gen_random_uuid() primary key,
  owner uuid references profiles(id),
  name text,
  description text,
  created_at timestamptz default now()
);

create table if not exists deck_cards (
  id uuid default gen_random_uuid() primary key,
  deck_id uuid references decks(id) on delete cascade,
  card_id uuid references cards(id),
  qty int default 1
);

create table if not exists store_items (
  id uuid default gen_random_uuid() primary key,
  name text,
  description text,
  price int default 0,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id),
  item_id uuid references store_items(id),
  price int,
  created_at timestamptz default now()
);

create table if not exists matches (
  id uuid default gen_random_uuid() primary key,
  host_user uuid references profiles(id),
  guest_user uuid references profiles(id),
  play_code text,
  status text default 'waiting',
  created_at timestamptz default now()
);

-- Game state sync table
create table if not exists game_states (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id),
  state jsonb,
  updated_at timestamptz default now()
);

-- SEED: Give all registered users a starter deck of 40 Soldiers
-- This inserts a deck per auth.users user (only users that exist at time of running).
with new_decks as (
  insert into decks (owner, name, description)
  select id, 'Starter Deck', '40 Soldiers (Starter)' from auth.users
  returning id, owner
),
new_cards as (
  insert into cards (owner, name, qty_owned, meta)
  select owner, 'Soldier', 40, jsonb_build_object('atk',1,'hp',2,'cost',1) from new_decks
  returning id, owner
)
insert into deck_cards (deck_id, card_id, qty)
select nd.id, nc.id, 40 from new_decks nd join new_cards nc on nd.owner = nc.owner
on conflict do nothing;

-- RLS: strongly recommended. Example policy for profiles:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "profiles_owner_only" ON profiles
-- FOR ALL
-- USING ( auth.role() = 'authenticated' AND id = auth.uid() )
-- WITH CHECK ( auth.uid() = id );

-- For production, enable RLS on other tables and create appropriate policies:
-- - matches: restrict who can insert/update to players or server-side functions
-- - game_states: allow only players in the match or server-side to write
-- The demo client assumes open writes; move sensitive logic server-side before public release.
```

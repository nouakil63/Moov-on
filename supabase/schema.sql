-- =====================================================================
-- Moov'On — schéma Supabase (maquette)
-- À exécuter dans le SQL Editor de votre projet Supabase (bouton Run).
-- Idempotent : ré-exécutable sans casser les données existantes.
--
-- AVERTISSEMENT : les politiques RLS ci-dessous sont OUVERTES (lecture et
-- écriture anonymes) — c'est voulu pour une maquette de démonstration sans
-- authentification. Ne pas utiliser telles quelles en production.
-- =====================================================================

-- ------------------------------------------------ missions
create table if not exists public.missions (
  id    text primary key,
  name  text not null,
  org   text not null,
  per   integer not null,          -- ⚡ nécessaires pour 1 unité
  unit  text not null,             -- libellé de l'unité financée
  goal  bigint  not null,          -- objectif collectif en ⚡
  got   bigint  not null default 0,-- ⚡ collectés
  icon  text not null              -- cross | paw | heart | tree | bowl
);

insert into public.missions (id, name, org, per, unit, goal, got, icon) values
  ('secours', 'Urgence & Secours',   'Premiers Secours Solidaires', 500,  'kit de secours distribué',  2000000, 1240000, 'cross'),
  ('animaux', 'Refuge animalier',    'Les Quatre Pattes',           300,  'repas pour un animal',      1500000,  890000, 'paw'),
  ('enfants', 'Enfants à l''hôpital','Cœur d''Enfants',             1000, 'heure d''animation offerte',3000000, 2210000, 'heart'),
  ('arbres',  'La forêt Corélis',    'Canopée Demain',              5000, 'arbre planté',              2500000, 2090000, 'tree'),
  ('repas',   'Repas chauds',        'Table Ouverte',               500,  'repas chaud servi',         2000000, 1560000, 'bowl')
on conflict (id) do nothing;

-- ------------------------------------------------ activités publiées
create table if not exists public.activities (
  id         uuid primary key default gen_random_uuid(),
  author     text not null,
  team       text not null,
  title      text not null,
  dist       integer not null,     -- mètres (= ⚡ récoltés)
  duration   text,                 -- « 32:10 » ou null pour saisie manuelle
  pace       text,                 -- « 5:11 » ou null
  created_at timestamptz not null default now()
);
create index if not exists activities_created_idx on public.activities (created_at desc);

-- ------------------------------------------------ dons d'énergie
create table if not exists public.donations (
  id         uuid primary key default gen_random_uuid(),
  mission_id text not null references public.missions(id),
  author     text not null,
  amount     bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists donations_mission_idx on public.donations (mission_id);

-- ------------------------------------------------ RLS démo (ouvert)
alter table public.missions   enable row level security;
alter table public.activities enable row level security;
alter table public.donations  enable row level security;

drop policy if exists "demo_missions_read"    on public.missions;
drop policy if exists "demo_missions_update"  on public.missions;
drop policy if exists "demo_activities_read"  on public.activities;
drop policy if exists "demo_activities_write" on public.activities;
drop policy if exists "demo_donations_read"   on public.donations;
drop policy if exists "demo_donations_write"  on public.donations;

create policy "demo_missions_read"    on public.missions   for select using (true);
create policy "demo_missions_update"  on public.missions   for update using (true) with check (true);
create policy "demo_activities_read"  on public.activities for select using (true);
create policy "demo_activities_write" on public.activities for insert with check (true);
create policy "demo_donations_read"   on public.donations  for select using (true);
create policy "demo_donations_write"  on public.donations  for insert with check (true);

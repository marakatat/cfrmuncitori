-- User-owned custom itinerary tables
create extension if not exists pgcrypto;

create table if not exists public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  route_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.route_segments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.saved_routes(id) on delete cascade,
  step_order int not null,
  start_station_id text not null,
  end_station_id text not null,
  train_number text not null,
  duration text not null,
  created_at timestamptz not null default now()
);

alter table public.saved_routes enable row level security;
alter table public.route_segments enable row level security;

-- Read access is public (including unauthenticated) for shareable route links.
create policy if not exists "saved_routes_public_read"
  on public.saved_routes
  for select
  using (true);

create policy if not exists "route_segments_public_read"
  on public.route_segments
  for select
  using (true);

-- Only the owner (anonymous auth user id) can create or delete their routes.
create policy if not exists "saved_routes_owner_insert"
  on public.saved_routes
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "saved_routes_owner_delete"
  on public.saved_routes
  for delete
  using (auth.uid() = user_id);

create policy if not exists "route_segments_owner_insert"
  on public.route_segments
  for insert
  with check (
    exists (
      select 1
      from public.saved_routes sr
      where sr.id = route_segments.route_id
        and sr.user_id = auth.uid()
    )
  );

create policy if not exists "route_segments_owner_delete"
  on public.route_segments
  for delete
  using (
    exists (
      select 1
      from public.saved_routes sr
      where sr.id = route_segments.route_id
        and sr.user_id = auth.uid()
    )
  );

create index if not exists idx_route_segments_route_id_step_order
  on public.route_segments(route_id, step_order);

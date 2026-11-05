-- Zaman Atlası initial schema. Years use historical numbering: negative = BCE, no year 0.
create extension if not exists postgis;

create type event_category as enum ('savas', 'antlasma', 'kurulus', 'kultur', 'bilim', 'goc', 'isyan', 'diger');
create type date_precision as enum ('year', 'month', 'day');
create type source_type as enum ('birincil', 'ikincil', 'ansiklopedi');

create table events (
  id text primary key,
  title text not null,
  summary text not null default '',
  description text not null default '',
  start_year integer not null check (start_year <> 0),
  end_year integer check (end_year is null or (end_year <> 0 and end_year >= start_year)),
  date_precision date_precision not null,
  geometry geometry(Geometry, 4326) not null check (GeometryType(geometry) in ('POINT', 'LINESTRING')),
  category event_category not null,
  region_tags text[] not null check (cardinality(region_tags) > 0),
  wikidata_id text,
  image_url text,
  content_lang text not null default 'tr',
  needs_review boolean not null default false
);
create index events_geometry_idx on events using gist (geometry);
create index events_years_idx on events (start_year, end_year);
create index events_category_idx on events (category);
create index events_region_tags_idx on events using gin (region_tags);

create table sources (
  id text primary key,
  event_id text not null references events (id) on delete cascade,
  type source_type not null,
  author text,
  title text,
  year integer,
  publisher text,
  url text,
  pages text,
  reliability smallint not null check (reliability between 1 and 3),
  accessed_at date,
  needs_review boolean not null default false
);
create index sources_event_id_idx on sources (event_id);

create table people (
  id text primary key,
  name text not null,
  birth_year integer check (birth_year is null or birth_year <> 0),
  death_year integer check (death_year is null or death_year <> 0),
  wikidata_id text
);

create table routes (
  id text primary key,
  person_id text references people (id) on delete set null,
  title text not null,
  geometry geometry(LineString, 4326) not null,
  start_year integer not null check (start_year <> 0),
  end_year integer not null check (end_year <> 0),
  waypoints jsonb not null,
  needs_review boolean not null default false
);

create table tours (
  id text primary key,
  title text not null,
  description text not null default '',
  steps jsonb not null,
  needs_review boolean not null default false
);

-- The adapter expects PostgREST to serialize geometry as GeoJSON through the PostGIS json cast.
-- Verify this on the first real deployment: it has not been run against a live database.

-- Content is public to read. Writes need the service role, which bypasses RLS.
alter table events enable row level security;
alter table sources enable row level security;
alter table people enable row level security;
alter table routes enable row level security;
alter table tours enable row level security;

create policy "public read" on events for select using (true);
create policy "public read" on sources for select using (true);
create policy "public read" on people for select using (true);
create policy "public read" on routes for select using (true);
create policy "public read" on tours for select using (true);

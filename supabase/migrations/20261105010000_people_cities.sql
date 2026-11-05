-- Person pages and city timelines. Not yet run against a live database, like the initial migration.
alter table people
  add column summary text not null default '',
  add column description text not null default '',
  add column image_url text,
  add column content_lang text not null default 'tr',
  add column birth_place jsonb,
  add column death_place jsonb,
  add column events jsonb not null default '[]',
  add column sources jsonb not null default '[]',
  add column needs_review boolean not null default false;

create table cities (
  id text primary key,
  name text not null,
  wikidata_id text,
  lng double precision not null,
  lat double precision not null,
  summary text not null default '',
  content_lang text not null default 'tr',
  periods jsonb not null default '[]',
  other_names text[] not null default '{}',
  rulers jsonb not null default '[]',
  sources jsonb not null default '[]',
  needs_review boolean not null default false
);

alter table cities enable row level security;
create policy "public read" on cities for select using (true);

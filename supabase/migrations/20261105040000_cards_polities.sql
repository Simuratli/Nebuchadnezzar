-- Event cards and the states timeline. Not yet run against a live database, like the earlier migrations.
alter table events add column card jsonb;

create table polities (
  id text primary key,
  "group" text not null,
  "from" integer not null check ("from" <> 0),
  "to" integer check ("to" is null or "to" <> 0),
  manual_dates boolean not null default false,
  wikidata_id text,
  url text not null,
  i18n jsonb not null default '{}'
);

alter table polities enable row level security;
create policy "public read" on polities for select using (true);

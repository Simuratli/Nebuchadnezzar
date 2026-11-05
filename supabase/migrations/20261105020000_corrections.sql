-- South Caucasus correction layer. Geometry stays in a static file; this holds the dated periods.
-- Not yet run against a live database, like the earlier migrations.
create table corrections (
  id text primary key,
  slices jsonb not null,
  needs_review boolean not null default true
);

alter table corrections enable row level security;
create policy "public read" on corrections for select using (true);

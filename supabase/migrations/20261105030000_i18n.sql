-- Multilingual content lives in an i18n jsonb column, keyed by language.
-- Not yet run against a live database, like the earlier migrations.
alter table events
  add column i18n jsonb not null default '{}',
  drop column title,
  drop column summary,
  drop column description,
  drop column content_lang;

alter table sources add column lang text;

alter table people
  add column i18n jsonb not null default '{}',
  drop column name,
  drop column summary,
  drop column description,
  drop column content_lang;

alter table cities
  add column i18n jsonb not null default '{}',
  drop column name,
  drop column summary,
  drop column content_lang;

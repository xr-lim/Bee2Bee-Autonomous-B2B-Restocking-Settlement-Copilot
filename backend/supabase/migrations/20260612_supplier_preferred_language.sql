alter table public.suppliers
  add column if not exists preferred_language varchar(10) default 'en';

update public.suppliers
set preferred_language = 'en'
where preferred_language is null
   or btrim(preferred_language) = ''
   or preferred_language not in ('en', 'ms', 'zh');

alter table public.suppliers
  alter column preferred_language set default 'en';

alter table public.suppliers
  alter column preferred_language set not null;

alter table public.suppliers
  drop constraint if exists suppliers_preferred_language_check;

alter table public.suppliers
  add constraint suppliers_preferred_language_check
  check (preferred_language in ('en', 'ms', 'zh'));

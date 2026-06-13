alter table public.suppliers
  add column if not exists preferred_language_code text default 'en';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'suppliers'
      and column_name = 'preferred_language'
  ) then
    update public.suppliers
    set preferred_language_code = case
      when preferred_language_code is not null and btrim(preferred_language_code) <> ''
        then preferred_language_code
      when preferred_language is not null and btrim(preferred_language) <> ''
        then preferred_language
      else 'en'
    end;
  else
    update public.suppliers
    set preferred_language_code = coalesce(nullif(btrim(preferred_language_code), ''), 'en');
  end if;
end $$;

update public.suppliers
set preferred_language_code = 'en'
where preferred_language_code is null
   or btrim(preferred_language_code) = ''
   or preferred_language_code !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$';

alter table public.suppliers
  alter column preferred_language_code set default 'en';

alter table public.suppliers
  alter column preferred_language_code set not null;

alter table public.suppliers
  drop constraint if exists suppliers_preferred_language_code_check;

alter table public.suppliers
  add constraint suppliers_preferred_language_code_check
  check (preferred_language_code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$');

alter table public.suppliers
  drop column if exists preferred_language;

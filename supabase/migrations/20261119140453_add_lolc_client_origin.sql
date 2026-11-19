alter table public.applications drop constraint applications_source_check;
alter table public.applications add constraint applications_source_check
  check (source in ('website','office','agent','referral','lolc'));

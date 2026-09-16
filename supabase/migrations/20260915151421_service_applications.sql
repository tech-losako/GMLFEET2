-- Additive migration for the existing applications table.
-- Review live column types, constraints, grants and RLS policies before applying.
-- No existing rows or access policies are removed or broadened.
begin;
alter table public.applications
    add column if not exists application_type text not null default 'vehicle',
    add column if not exists service text,
    add column if not exists service_details jsonb not null default '{}'::jsonb;
comment on column public.applications.service_details is
    'Service-specific form metadata. Filenames are metadata, not uploaded documents.';
notify pgrst, 'reload schema';
commit;

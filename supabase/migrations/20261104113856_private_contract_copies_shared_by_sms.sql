begin;
-- Only the hash of a high-entropy download token is persisted. Links expire after 7 days.
create table public.contract_sms_shares(
 id uuid primary key,application_id bigint not null references public.applications(id),created_by uuid not null references public.staff_members(user_id),
 object_path text not null unique,token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),recipient text not null,created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '7 days'),revoked_at timestamptz
);
create index contract_sms_shares_application on public.contract_sms_shares(application_id);
create index contract_sms_shares_actor on public.contract_sms_shares(created_by);
alter table public.contract_sms_shares enable row level security;
revoke all on public.contract_sms_shares from public,anon,authenticated;
grant select,insert,update on public.contract_sms_shares to service_role;
create policy contract_share_service on public.contract_sms_shares to service_role using(true) with check(true);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('contract-copies','contract-copies',false,10485760,array['application/pdf']);
create policy contract_copy_staff_insert on storage.objects for insert to authenticated with check(bucket_id='contract-copies' and (select private.is_staff()) and exists(select 1 from public.applications a where a.id::text=split_part(name,'/',1) and a.program_type in('FLEET_OWNER','PARTNER_DRIVER','YANGO')));
create policy contract_copy_staff_read on storage.objects for select to authenticated using(bucket_id='contract-copies' and (select private.is_staff()));
create function private.validate_contract_copy(p jsonb) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'Accès personnel requis';end if;
 return exists(select 1 from storage.objects where bucket_id='contract-copies' and name=p->>'object_path' and owner_id=auth.uid()::text and metadata->>'mimetype'='application/pdf' and (metadata->>'size')::bigint between 1 and 10485760);
end $$;
create function public.validate_contract_copy(p jsonb) returns boolean language sql security invoker set search_path='' as $$select private.validate_contract_copy(p)$$;
revoke all on function private.validate_contract_copy(jsonb),public.validate_contract_copy(jsonb) from public,anon;
grant execute on function private.validate_contract_copy(jsonb),public.validate_contract_copy(jsonb) to authenticated;
commit;



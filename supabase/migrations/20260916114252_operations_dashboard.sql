begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.staff_members (
 user_id uuid primary key references auth.users(id),
 display_name text not null,
 role text not null default 'agent' check (role in ('admin','agent','cashier')),
 active boolean not null default true
);
alter table public.staff_members enable row level security;
insert into public.staff_members(user_id,display_name,role)
select id,'Administration GM Fleet','admin' from auth.users where email='admin@losakoholding.cd';

create function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.staff_members where user_id=auth.uid() and active);
$$;
revoke all on function private.is_staff() from public,anon;
grant execute on function private.is_staff() to authenticated;
create policy staff_directory on public.staff_members for select to authenticated using ((select private.is_staff()));
revoke all on public.staff_members from anon,authenticated;
grant select on public.staff_members to authenticated;

alter table public.applications
 add column program_type text generated always as (case
 when service='Chauffeur Yango' then 'YANGO'
 when service='Gestion de flotte' then 'FLEET_OWNER'
 when service in ('Recrutement','Recrutement Chauffeur') then 'PARTNER_DRIVER'
 else 'DRIVE_TO_OWN' end) stored,
 add column source text not null default 'website' check(source in ('website','office','agent','referral')),
 add column workflow_stage text not null default 'new',
 add column lolc_status text not null default 'not_submitted' check(lolc_status in ('not_submitted','pending','information_required','approved','rejected')),
 add column lolc_reference text,
 add column assigned_to uuid references public.staff_members(user_id),
 add column next_action text,
 add column follow_up_on date,
 add column preparation jsonb not null default '{}'::jsonb check(jsonb_typeof(preparation)='object'),
 add column whatsapp text,
 add column email text,
 add column birth_date date,
 add column revision integer not null default 1,
 add column updated_at timestamptz not null default now();
alter table public.applications add constraint workflow_stage_valid check (workflow_stage in
 ('new','to_contact','contacted','appointment','screening','kyc','lolc_pending','approved','vehicle_arrangements','paperwork_check','inspection','preparation','ready','handed_over','available','on_hold','rejected','withdrawn'));
create index applications_assigned_idx on public.applications(assigned_to);
create index applications_followup_idx on public.applications(follow_up_on) where follow_up_on is not null;
create index applications_program_created_idx on public.applications(program_type,created_at desc);

create table public.appointments (
 id uuid primary key default gen_random_uuid(),
 application_id bigint not null references public.applications(id),
 starts_at timestamptz not null,
 location text not null check(length(trim(location))>0),
 assigned_to uuid not null references public.staff_members(user_id),
 instructions text not null default '',
 briefing_confirmed boolean not null check(briefing_confirmed),
 status text not null default 'scheduled' check(status in ('scheduled','confirmed','completed','missed','cancelled','rescheduled')),
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references public.staff_members(user_id)
);
create index appointments_application_idx on public.appointments(application_id);
create index appointments_starts_idx on public.appointments(starts_at);
create index appointments_agent_idx on public.appointments(assigned_to);
create index appointments_creator_idx on public.appointments(created_by);
create table public.admin_notes (
 id uuid primary key default gen_random_uuid(),
 application_id bigint not null references public.applications(id),
 body text not null check(length(trim(body)) between 1 and 10000),
 created_by uuid not null default auth.uid() references public.staff_members(user_id),
 created_at timestamptz not null default now()
);
create index notes_application_idx on public.admin_notes(application_id,created_at desc);
create index notes_creator_idx on public.admin_notes(created_by);
create table public.documents (
 id uuid primary key default gen_random_uuid(),
 application_id bigint not null references public.applications(id),
 name text not null,
 storage_path text not null unique,
 mime_type text not null,
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=10485760),
 created_by uuid not null default auth.uid() references public.staff_members(user_id),
 created_at timestamptz not null default now(),
 check(split_part(storage_path,'/',1)=application_id::text)
);
create index documents_application_idx on public.documents(application_id);
create index documents_creator_idx on public.documents(created_by);
create table public.audit_logs (
 id bigint generated always as identity primary key,
 application_id bigint not null references public.applications(id),
 actor_id uuid references auth.users(id),
 entity text not null,
 action text not null,
 changes jsonb not null,
 created_at timestamptz not null default now()
);
create index audit_application_idx on public.audit_logs(application_id,created_at desc);
create index audit_actor_idx on public.audit_logs(actor_id);

create function private.audit_case() returns trigger language plpgsql security definer set search_path='' as $$
declare case_id bigint;
begin
 case_id := (to_jsonb(new)->>case when tg_table_name='applications' then 'id' else 'application_id' end)::bigint;
 insert into public.audit_logs(application_id,actor_id,entity,action,changes)
 values(case_id,auth.uid(),tg_table_name,tg_op,
 case when tg_op='UPDATE' then jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new)) else jsonb_build_object('after',to_jsonb(new)) end);
 return new;
end $$;
revoke all on function private.audit_case() from public,anon,authenticated;

create function private.validate_case() returns trigger language plpgsql set search_path='' as $$
begin
 if coalesce(new.service,'') not in ('Chauffeur Yango','Gestion de flotte','Recrutement','Recrutement Chauffeur')
    and new.workflow_stage in ('approved','vehicle_arrangements','paperwork_check','inspection','preparation','ready','handed_over')
    and new.lolc_status<>'approved' then raise exception 'LOLC approval is required for this stage'; end if;
 if new.workflow_stage='handed_over' and coalesce(new.service,'') not in ('Chauffeur Yango','Gestion de flotte','Recrutement','Recrutement Chauffeur')
    and not (coalesce(new.preparation->>'paperwork','false')='true' and coalesce(new.preparation->>'tracker','false')='true' and coalesce(new.preparation->>'yango','false')='true')
    then raise exception 'Complete paperwork, tracker and Yango preparation before handover'; end if;
 if tg_op='UPDATE' then new.revision:=old.revision+1; end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function private.validate_case() from public,anon,authenticated;
create trigger validate_case before insert or update on public.applications for each row execute function private.validate_case();

do $$ declare t text; begin
 foreach t in array array['applications','appointments','admin_notes','documents'] loop
 execute format('create trigger audit_case after insert or update on public.%I for each row execute function private.audit_case()',t);
 end loop;
 foreach t in array array['appointments','admin_notes','documents','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy staff_read on public.%I for select to authenticated using ((select private.is_staff()))',t);
 end loop;
 foreach t in array array['appointments','admin_notes','documents'] loop
 execute format('grant insert on public.%I to authenticated',t);
 execute format('create policy staff_insert on public.%I for insert to authenticated with check ((select private.is_staff()) and created_by=(select auth.uid()))',t);
 end loop;
end $$;
grant update(status) on public.appointments to authenticated;
create policy staff_update on public.appointments for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

drop policy "Anyone can submit applications" on public.applications;
drop policy "Authenticated admins can read applications" on public.applications;
drop policy "Authenticated admins can update applications" on public.applications;
create policy public_intake on public.applications for insert to anon,authenticated with check
 (source='website' and workflow_stage='new' and lolc_status='not_submitted' and lolc_reference is null and assigned_to is null and status='En attente' and next_action is null and follow_up_on is null and preparation='{}'::jsonb and revision=1 and note is null);
create policy staff_intake on public.applications for insert to authenticated with check ((select private.is_staff()));
create policy staff_read on public.applications for select to authenticated using ((select private.is_staff()));
create policy staff_update on public.applications for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
revoke all on public.applications from anon,authenticated;
grant insert(name,phone,address,experience,co_borrower_name,co_borrower_phone,co_borrower_address,plan_duration_months,vehicle,created_on,status,note,license_file_name,application_type,service,service_details,whatsapp,email,birth_date) on public.applications to anon;
grant select,insert,update on public.applications to authenticated;
grant usage on sequence public.applications_id_seq to anon,authenticated;

drop policy "Authenticated admins can manage vehicles" on public.vehicles;
drop policy "Authenticated admins can manage payments" on public.payments;
create policy staff_manage on public.vehicles for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy staff_manage on public.payments for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('application-documents','application-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy staff_document_read on storage.objects for select to authenticated using (bucket_id='application-documents' and (select private.is_staff()));
create policy staff_document_upload on storage.objects for insert to authenticated with check (bucket_id='application-documents' and (select private.is_staff()) and exists(select 1 from public.applications where id::text=split_part(storage.objects.name,'/',1)));
create policy staff_document_cleanup on storage.objects for delete to authenticated using (bucket_id='application-documents' and (select private.is_staff()));
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;

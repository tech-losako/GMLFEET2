begin;
alter table public.documents alter column created_by drop not null;
create table private.public_submissions(request_id uuid primary key,fingerprint text not null,payload jsonb not null,files jsonb not null,application_id bigint not null unique,completed boolean not null default false,created_at timestamptz not null default now());
alter table private.public_submissions enable row level security;
revoke all on private.public_submissions from public,anon,authenticated;
create function private.reserve_public_submission(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item private.public_submissions;
begin
 perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',16));
 select * into item from private.public_submissions where request_id=(p->>'request_id')::uuid;
 if found then
  if item.fingerprint<>p->>'fingerprint' then raise exception 'Cette demande a changé. Actualisez le formulaire avant de recommencer';end if;
 else
  insert into private.public_submissions(request_id,fingerprint,payload,files,application_id) values((p->>'request_id')::uuid,p->>'fingerprint',p->'application',p->'files',nextval(pg_get_serial_sequence('public.applications','id'))) returning * into item;
 end if;
 return jsonb_build_object('application_id',item.application_id,'completed',item.completed);
end $$;
create function private.complete_public_submission(request uuid) returns bigint language plpgsql security definer set search_path='' as $$
declare item private.public_submissions;a jsonb;f jsonb;path text;
begin
 select * into item from private.public_submissions where request_id=request for update;
 if not found then raise exception 'Demande introuvable';end if;
 if item.completed then return item.application_id;end if;
 a:=item.payload;
 for f in select value from jsonb_array_elements(item.files) loop
  path:=item.application_id::text||'/'||request::text||'/'||(f->>'key');
  if not exists(select 1 from storage.objects where bucket_id='application-documents' and name=path) then raise exception 'Un fichier manque. Réessayez l’envoi';end if;
 end loop;
 insert into public.applications(id,name,phone,address,experience,co_borrower_name,co_borrower_phone,co_borrower_address,plan_duration_months,vehicle,application_type,service,service_details,license_file_name,source)
 values(item.application_id,a->>'name',a->>'phone',a->>'address',a->>'experience',a->>'co_borrower_name',a->>'co_borrower_phone',a->>'co_borrower_address',(a->>'plan_duration_months')::integer,a->>'vehicle',a->>'application_type',a->>'service',coalesce(a->'service_details','{}'::jsonb),a->>'license_file_name','website');
 for f in select value from jsonb_array_elements(item.files) loop
  insert into public.documents(application_id,name,storage_path,mime_type,size_bytes,created_by) values(item.application_id,f->>'name',item.application_id::text||'/'||request::text||'/'||(f->>'key'),f->>'type',(f->>'size')::bigint,null);
 end loop;
 update private.public_submissions set completed=true where request_id=request;
 return item.application_id;
end $$;
create function public.reserve_public_submission(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.reserve_public_submission(p)$$;
create function public.complete_public_submission(request uuid) returns bigint language sql security invoker set search_path='' as $$select private.complete_public_submission(request)$$;
revoke all on function private.reserve_public_submission(jsonb),public.reserve_public_submission(jsonb),private.complete_public_submission(uuid),public.complete_public_submission(uuid) from public,anon,authenticated;
grant execute on function private.reserve_public_submission(jsonb),public.reserve_public_submission(jsonb),private.complete_public_submission(uuid),public.complete_public_submission(uuid) to service_role;
notify pgrst,'reload schema';
commit;

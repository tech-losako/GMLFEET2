begin;
alter table public.staff_members add column deleted_at timestamptz;
alter table public.staff_members add constraint deleted_staff_inactive check(deleted_at is null or not active);
create table private.staff_email_changes(id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id),target_id uuid not null references auth.users(id),old_email text not null,new_email text not null,state text not null default 'pending' check(state in ('pending','completed','failed')),created_at timestamptz not null default now());
alter table private.staff_email_changes enable row level security;
revoke all on private.staff_email_changes from public,anon,authenticated;
create unique index staff_email_pending on private.staff_email_changes(target_id) where state='pending';
create index staff_email_actor on private.staff_email_changes(actor_id);
-- Existing staff mutations may not restore deleted users or race an Auth email change.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('private.manage_staff(jsonb)'::regprocedure);
 definition:=replace(definition,'if found and previous.revision',E'if previous.deleted_at is not null then raise exception ''Compte supprimé'';end if;\n if exists(select 1 from private.staff_email_changes where target_id=target and state=''pending'') then raise exception ''Modification e-mail en cours : terminez-la avant de modifier ce compte'';end if;\n if found and previous.revision');
 execute definition;
end $$;
create or replace function private.list_staff_accounts() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_super_admin() then raise exception 'Accès réservé au Super Admin';end if;
 return (select coalesce(jsonb_agg(to_jsonb(t) order by t.display_name),'[]'::jsonb) from (select s.*,u.email,u.email_confirmed_at is not null as confirmed,(select new_email from private.staff_email_changes where target_id=s.user_id and state='pending') as pending_email from public.staff_members s join auth.users u on u.id=s.user_id where s.deleted_at is null) t);
end $$;
create function private.delete_staff(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare member public.staff_members;target uuid:=(p->>'user_id')::uuid;
begin
 perform pg_advisory_xact_lock(914162023);
 if not private.is_super_admin() then raise exception 'Accès réservé au Super Admin';end if;
 if target=auth.uid() then raise exception 'Vous ne pouvez pas supprimer votre propre compte';end if;
 select * into member from public.staff_members where user_id=target for update;
 if not found then raise exception 'Compte introuvable';end if;
 if member.deleted_at is not null then return target;end if;
 if member.revision is distinct from (p->>'revision')::integer then raise exception 'Ce compte a changé. Actualisez la liste';end if;
 if exists(select 1 from private.staff_email_changes where target_id=target and state='pending') then raise exception 'Terminez la modification e-mail avant de supprimer ce compte';end if;
 update public.staff_members set active=false,deleted_at=now(),revision=revision+1 where user_id=target;
 insert into public.staff_events(actor_id,target_id,action,changes) values(auth.uid(),target,'deleted',jsonb_build_object('before',to_jsonb(member)));
 return target;
end $$;
create function private.begin_staff_email(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.staff_members;job private.staff_email_changes;target uuid:=(p->>'user_id')::uuid;new_address text:=lower(trim(p->>'email'));old_address text;
begin
 perform pg_advisory_xact_lock(914162023);
 if not private.is_super_admin() then raise exception 'Accès réservé au Super Admin';end if;
 select * into member from public.staff_members where user_id=target for update;
 if not found or member.deleted_at is not null then raise exception 'Compte introuvable';end if;
 if new_address is null or length(new_address)>254 or new_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Adresse e-mail invalide';end if;
 select * into job from private.staff_email_changes where target_id=target and state='pending';
 if found then
  if job.new_email<>new_address then raise exception 'Terminez la modification e-mail déjà en cours';end if;
  return to_jsonb(job);
 end if;
 if member.revision is distinct from (p->>'revision')::integer then raise exception 'Ce compte a changé. Actualisez la liste';end if;
 select email into old_address from auth.users where id=target;
 insert into private.staff_email_changes(actor_id,target_id,old_email,new_email) values(auth.uid(),target,old_address,new_address) returning * into job;
 insert into public.staff_events(actor_id,target_id,action,changes) values(auth.uid(),target,'email_change_requested',jsonb_build_object('old_email',old_address,'new_email',new_address));
 return to_jsonb(job);
end $$;
-- Only the server may finish an Auth operation; verify actual Auth state rather than trusting a supplied success flag.
create function private.finish_staff_email(job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job private.staff_email_changes;actual text;next_revision integer;
begin
 perform pg_advisory_xact_lock(914162023);
 select * into job from private.staff_email_changes where id=job_id for update;
 if not found then raise exception 'Opération introuvable';end if;
 if job.state='pending' then
  select lower(email) into actual from auth.users where id=job.target_id;
  job.state:=case when actual=job.new_email then 'completed' else 'failed' end;
  update private.staff_email_changes set state=job.state where id=job_id;
  update public.staff_members set revision=revision+1 where user_id=job.target_id;
  insert into public.staff_events(actor_id,target_id,action,changes) values(job.actor_id,job.target_id,'email_change_'||job.state,jsonb_build_object('old_email',job.old_email,'new_email',job.new_email));
 end if;
 select revision into next_revision from public.staff_members where user_id=job.target_id;
 return jsonb_build_object('state',job.state,'revision',next_revision);
end $$;
create function public.delete_staff(p jsonb) returns uuid language sql security invoker set search_path='' as $$select private.delete_staff(p)$$;
create function public.begin_staff_email(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.begin_staff_email(p)$$;
create function public.finish_staff_email(job_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.finish_staff_email(job_id)$$;
revoke all on function private.delete_staff(jsonb),public.delete_staff(jsonb),private.begin_staff_email(jsonb),public.begin_staff_email(jsonb),private.finish_staff_email(uuid),public.finish_staff_email(uuid) from public,anon,authenticated;
grant execute on function private.delete_staff(jsonb),public.delete_staff(jsonb),private.begin_staff_email(jsonb),public.begin_staff_email(jsonb) to authenticated;
grant usage on schema private to service_role;
grant execute on function private.finish_staff_email(uuid),public.finish_staff_email(uuid) to service_role;
notify pgrst,'reload schema';
commit;

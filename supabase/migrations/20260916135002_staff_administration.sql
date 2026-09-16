begin;
alter table public.staff_members drop constraint staff_members_role_check;
alter table public.staff_members add constraint staff_members_role_check check(role in ('super_admin','admin','agent','cashier'));
alter table public.staff_members add column revision integer not null default 1;
update public.staff_members set role='super_admin' where user_id in(select id from auth.users where lower(email)='admin@losakoholding.cd');
create function private.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.staff_members where user_id=auth.uid() and active and role='super_admin');
$$;
revoke all on function private.is_super_admin() from public,anon;
grant execute on function private.is_super_admin() to authenticated;
create or replace function private.is_cashier() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.staff_members where user_id=auth.uid() and active and role in ('super_admin','admin','cashier'));
$$;
do $$ begin execute replace(pg_get_functiondef('private.void_contract(jsonb)'::regprocedure),'role=''admin''','role in (''super_admin'',''admin'')');end $$;
create table public.staff_events(id bigint generated always as identity primary key,actor_id uuid not null references auth.users(id),target_id uuid not null references auth.users(id),action text not null,changes jsonb not null,created_at timestamptz not null default now());
alter table public.staff_events enable row level security;
revoke all on public.staff_events from anon,authenticated;
grant select on public.staff_events to authenticated;
create policy super_admin_staff_events on public.staff_events for select to authenticated using((select private.is_super_admin()));
create index staff_events_actor_idx on public.staff_events(actor_id);
create index staff_events_target_idx on public.staff_events(target_id);
create function private.list_staff_accounts() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_super_admin() then raise exception 'Accès réservé au Super Admin';end if;
 return (select coalesce(jsonb_agg(to_jsonb(t) order by t.display_name),'[]'::jsonb) from (select s.*,u.email,u.email_confirmed_at is not null as confirmed from public.staff_members s join auth.users u on u.id=s.user_id) t);
end $$;
create function private.manage_staff(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid:=(p->>'user_id')::uuid; previous public.staff_members; next_role text:=p->>'role'; next_name text:=trim(p->>'display_name'); next_active boolean:=(p->>'active')::boolean;
begin
 -- Serialize account changes, including concurrent demotions and invitations.
 perform pg_advisory_xact_lock(914162023);
 if not private.is_super_admin() then raise exception 'Accès réservé au Super Admin';end if;
 if target is null or next_role is null or next_role not in ('super_admin','admin','agent','cashier') or next_name is null or length(next_name) not between 1 and 200 or next_active is null then raise exception 'Nom, rôle et statut valides requis';end if;
 if target=auth.uid() and (next_role<>'super_admin' or not next_active) then raise exception 'Vous ne pouvez pas retirer votre propre accès Super Admin';end if;
 select * into previous from public.staff_members where user_id=target for update;
 if found and previous.revision is distinct from (p->>'revision')::integer then raise exception 'Ce compte a changé. Actualisez la liste';end if;
 if previous.user_id is null and coalesce((p->>'revision')::integer,0)<>0 then raise exception 'Compte introuvable';end if;
 insert into public.staff_members(user_id,display_name,role,active) values(target,next_name,next_role,next_active)
 on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active,revision=public.staff_members.revision+1;
 insert into public.staff_events(actor_id,target_id,action,changes) values(auth.uid(),target,case when previous.user_id is null then 'created' else 'updated' end,jsonb_build_object('before',to_jsonb(previous),'after',jsonb_build_object('display_name',next_name,'role',next_role,'active',next_active)));
 return target;
end $$;
create function public.list_staff_accounts() returns jsonb language sql security invoker set search_path='' as $$select private.list_staff_accounts()$$;
create function public.manage_staff(p jsonb) returns uuid language sql security invoker set search_path='' as $$select private.manage_staff(p)$$;
revoke all on function private.list_staff_accounts(),private.manage_staff(jsonb),public.list_staff_accounts(),public.manage_staff(jsonb) from public,anon,authenticated;
grant execute on function private.list_staff_accounts(),private.manage_staff(jsonb),public.list_staff_accounts(),public.manage_staff(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;

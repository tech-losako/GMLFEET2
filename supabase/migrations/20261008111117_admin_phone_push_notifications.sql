begin;

alter table public.staff_members
 add column phone text,
 add constraint staff_members_phone_check check(phone is null or phone ~ '^\+243[0-9]{9}$');

create table public.staff_push_tokens (
 token text primary key check(length(token) between 20 and 4096),
 user_id uuid not null references public.staff_members(user_id) on delete cascade,
 platform text not null default 'web' check(platform in ('web')),
 user_agent text,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now()
);
create index staff_push_tokens_user_idx on public.staff_push_tokens(user_id) where active;
alter table public.staff_push_tokens enable row level security;
revoke all on public.staff_push_tokens from anon,authenticated;

create or replace function private.list_staff_accounts() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_super_admin() then raise exception 'Accès réservé au Super Admin';end if;
 return (select coalesce(jsonb_agg(to_jsonb(t) order by t.display_name),'[]'::jsonb) from (select s.*,u.email,u.email_confirmed_at is not null as confirmed,(select new_email from private.staff_email_changes where target_id=s.user_id and state='pending') as pending_email from public.staff_members s join auth.users u on u.id=s.user_id where s.deleted_at is null) t);
end $$;

create or replace function private.manage_staff(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare
 target uuid:=(p->>'user_id')::uuid;
 previous public.staff_members;
 next_role text:=p->>'role';
 next_name text:=trim(p->>'display_name');
 next_active boolean:=(p->>'active')::boolean;
 next_phone text:=nullif(regexp_replace(coalesce(p->>'phone',''),'\s','','g'),'');
begin
 -- Serialize account changes, including concurrent demotions and invitations.
 perform pg_advisory_xact_lock(914162023);
 if not private.is_super_admin() then raise exception 'Accès réservé au Super Admin';end if;
 if target is null or next_role is null or next_role not in ('super_admin','admin','agent','cashier') or next_name is null or length(next_name) not between 1 and 200 or next_active is null then raise exception 'Nom, rôle et statut valides requis';end if;
 if next_phone is not null and next_phone !~ '^\+243[0-9]{9}$' then raise exception 'Téléphone administratif invalide : utilisez +243 suivi de 9 chiffres'; end if;
 if target=auth.uid() and (next_role<>'super_admin' or not next_active) then raise exception 'Vous ne pouvez pas retirer votre propre accès Super Admin';end if;
 select * into previous from public.staff_members where user_id=target for update;
 if found and previous.deleted_at is not null then raise exception 'Compte supprimé';end if;
 if found and exists(select 1 from private.staff_email_changes where target_id=target and state='pending') then raise exception 'Modification e-mail en cours : terminez-la avant de modifier ce compte';end if;
 if found and previous.revision is distinct from (p->>'revision')::integer then raise exception 'Ce compte a changé. Actualisez la liste';end if;
 if previous.user_id is null and coalesce((p->>'revision')::integer,0)<>0 then raise exception 'Compte introuvable';end if;
 insert into public.staff_members(user_id,display_name,role,active,phone) values(target,next_name,next_role,next_active,next_phone)
 on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active,phone=excluded.phone,revision=public.staff_members.revision+1;
 insert into public.staff_events(actor_id,target_id,action,changes) values(auth.uid(),target,case when previous.user_id is null then 'created' else 'updated' end,jsonb_build_object('before',to_jsonb(previous),'after',jsonb_build_object('display_name',next_name,'role',next_role,'active',next_active,'phone',next_phone)));
 return target;
end $$;

create function private.save_staff_push_token(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare
 token_value text:=trim(coalesce(p->>'token',''));
 platform_value text:=coalesce(nullif(trim(p->>'platform'),''),'web');
 user_agent_value text:=left(nullif(trim(coalesce(p->>'user_agent','')),''),500);
begin
 if not private.is_staff() then raise exception 'Accès personnel requis'; end if;
 if platform_value<>'web' then raise exception 'Plateforme de notification invalide'; end if;
 if length(token_value) not between 20 and 4096 then raise exception 'Jeton de notification invalide'; end if;
 insert into public.staff_push_tokens(token,user_id,platform,user_agent,active,last_seen_at)
 values(token_value,auth.uid(),platform_value,user_agent_value,true,now())
 on conflict(token) do update set user_id=excluded.user_id,platform=excluded.platform,user_agent=excluded.user_agent,active=true,last_seen_at=now();
end $$;

create function public.save_staff_push_token(p jsonb) returns void language sql security invoker set search_path='' as $$select private.save_staff_push_token(p);$$;
revoke all on function private.save_staff_push_token(jsonb),public.save_staff_push_token(jsonb) from public,anon,authenticated;
grant execute on function private.save_staff_push_token(jsonb),public.save_staff_push_token(jsonb) to authenticated;

alter table public.operations_notifications alter column application_id drop not null;
alter table public.operations_notifications add column quote_id uuid references public.equipment_quotes(id);
alter table public.operations_notifications drop constraint operations_notifications_kind_check;
alter table public.operations_notifications add constraint operations_notifications_kind_check check(kind in ('intake','accepted','rejected','appointment','quote'));
alter table public.operations_notifications add constraint operations_notifications_target_check check(application_id is not null or quote_id is not null);
create index operations_notifications_quote_idx on public.operations_notifications(quote_id,created_at desc) where quote_id is not null;

create function private.equipment_quote_notifications() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.operations_notifications(quote_id,kind,channel,status,body)
 values(new.id,'quote','internal','unread','Nouvelle demande de devis : '||coalesce(new.payload->>'name','client')||'. À traiter par l’équipe commerciale.');
 return new;
end $$;
revoke all on function private.equipment_quote_notifications() from public,anon,authenticated;
create trigger equipment_quote_notifications after insert on public.equipment_quotes for each row execute function private.equipment_quote_notifications();

notify pgrst,'reload schema';
commit;

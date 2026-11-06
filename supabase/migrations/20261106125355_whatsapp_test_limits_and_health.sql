begin;
create or replace function private.create_own_whatsapp_test(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ph text;begin
 select phone into ph from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role in('admin','super_admin');
 if ph is null or not coalesce((p->>'consent')::boolean,false) then raise exception 'Compte administrateur avec téléphone et autorisation de test requis';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if not exists(select 1 from private.whatsapp_tests where id=(p->>'request_id')::uuid) and (select count(*) from private.whatsapp_tests where created_by=auth.uid() and authorized_until>now())>=5 then raise exception 'Limite de cinq tests par heure atteinte';end if;
 return private.authorize_whatsapp_test(ph,'Test WhatsApp autorisé sur mon numéro équipe',coalesce((p->>'force_failure')::boolean,false),(p->>'request_id')::uuid);
end $$;
do $patch$declare definition text;begin
 definition:=pg_get_functiondef('private.claim_sms_dispatch(jsonb)'::regprocedure);
 definition:=replace(definition,'select * into n from public.sms_dispatches q', 'update public.sms_dispatches s set status=''cancelled'',error=''Autorisation du test WhatsApp expirée'' where s.kind=''whatsapp_test'' and s.fallback_of is null and s.status=''pending'' and not exists(select 1 from private.whatsapp_tests t where t.sms_id=s.id and t.authorized_until>now()); select * into n from public.sms_dispatches q');execute definition;
 definition:=pg_get_functiondef('private.whatsapp_health()'::regprocedure);
 definition:=replace(definition,'where t.force_failure)','where t.force_failure and n.status in(''accepted'',''sent'',''delivered''))');execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;

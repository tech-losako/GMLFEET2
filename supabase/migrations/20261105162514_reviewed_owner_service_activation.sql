begin;
-- This review reads existing amounts/schedules; it never changes the ledger.
create function private.contract_identity_missing(a public.applications,v public.vehicles default null) returns jsonb language plpgsql stable set search_path='' as $$
declare s jsonb:=coalesce(a.service_details,'{}');items jsonb:='[]';k text;label text;value text;
begin
 for k,label in select * from (values('name','Nom complet'),('phone','Téléphone'),('idNumber','Pièce d’identité'),('address','Adresse'),('email','E-mail'),('carBrand','Marque'),('carYear','Année du véhicule'),('carModel','Modèle'),('carPlate','Plaque'),('carChassis','Châssis / VIN'),('birthPlace','Lieu de naissance'),('birthDate','Date de naissance'),('nationality','Nationalité'),('addressNumber','Numéro de résidence'),('addressAvenue','Avenue'),('addressQuarter','Quartier'),('addressCommune','Commune'),('licenseNumber','Numéro de permis'),('licenseCategory','Catégorie du permis'))x(k,l) loop
  if (a.program_type='FLEET_OWNER' and k=any(array['name','phone','idNumber','address','email','carBrand','carYear','carModel','carPlate','carChassis'])) or (a.program_type='PARTNER_DRIVER' and k=any(array['name','phone','idNumber','birthPlace','birthDate','nationality','addressNumber','addressAvenue','addressQuarter','addressCommune','licenseNumber','licenseCategory'])) then
   value:=case k when 'name' then a.name when 'phone' then a.phone when 'address' then a.address when 'email' then coalesce(nullif(a.email,''),s->>'email') when 'birthDate' then coalesce(a.birth_date::text,s->>'birthDate') when 'carModel' then coalesce(v.model,s->>'carModel') when 'carPlate' then coalesce(v.plate,s->>'carPlate') when 'carChassis' then coalesce(v.vin,s->>'carChassis') else s->>k end;
   if nullif(btrim(value),'') is null then items:=items||jsonb_build_array(label);end if;
  end if;
 end loop;return items;
end $$;
create function private.owner_service_setup(vid bigint,did bigint,as_of date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.vehicles;o public.applications;d public.applications;m public.fleet_mandates;r jsonb;costs jsonb;issues jsonb;blockers jsonb:='[]';snapshot jsonb;fingerprint text;
begin
 select * into v from public.vehicles where id=vid;select * into o from public.applications where id=v.owner_application_id;
 if o.id is null then raise exception 'Véhicule propriétaire requis';end if;
 select * into d from public.applications where id=did;
 select * into m from public.fleet_mandates where vehicle_id=vid and status in('active','awaiting_driver') order by created_at desc limit 1;
 r:=private.owner_financial_recap(o.id,as_of);
 select coalesce(jsonb_agg(jsonb_build_object('id',va.id,'kind',va.kind,'description',va.description,'principal',va.principal,'fee',va.fee,'total',va.total,'months',va.months,'recovery_start',va.recovery_start,'issue_id',va.issue_id) order by va.id),'[]') into costs from public.vehicle_advances va where va.application_id=o.id and va.debtor='owner';
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'description',i.description,'status',i.status) order by i.id),'[]') into issues from public.vehicle_issues i where (i.vehicle_id=vid or i.application_id=o.id) and i.status='open';
 if m.id is null then blockers:=blockers||jsonb_build_array('Signer le mandat propriétaire');end if;
 if jsonb_array_length(private.contract_identity_missing(o,v))>0 then blockers:=blockers||jsonb_build_array('Compléter la fiche propriétaire : '||(select string_agg(x,', ') from jsonb_array_elements_text(private.contract_identity_missing(o,v))x));end if;
 if did is not null and (d.id is null or d.program_type<>'PARTNER_DRIVER') then blockers:=blockers||jsonb_build_array('Choisir un chauffeur partenaire');
 elsif did is not null and jsonb_array_length(private.contract_identity_missing(d))>0 then blockers:=blockers||jsonb_build_array('Compléter la fiche chauffeur : '||(select string_agg(x,', ') from jsonb_array_elements_text(private.contract_identity_missing(d))x));end if;
 if jsonb_array_length(issues)>0 then blockers:=blockers||jsonb_build_array('Terminer ou résoudre les réparations signalées avant le départ');end if;
 if exists(select 1 from public.vehicle_advances where application_id=o.id and debtor='owner' and (lower(btrim(description)) in('n.a','n/a','na','n.a.') or (kind<>'fuel' and (lower(btrim(approval_reference)) in('n.a','n/a','na','n.a.') or lower(btrim(expense_reference)) in('n.a','n/a','na','n.a.'))))) then blockers:=blockers||jsonb_build_array('Préciser le libellé et les justificatifs des frais : N.A ne décrit pas une dépense');end if;
 snapshot:=jsonb_build_object('vehicle',to_jsonb(v)-'status'-'driver','owner',jsonb_build_object('name',o.name,'phone',o.phone,'address',o.address,'email',o.email,'legal',o.service_details),'driver',jsonb_build_object('id',d.id,'name',d.name,'phone',d.phone,'address',d.address,'birth_date',d.birth_date,'legal',d.service_details),'mandate',to_jsonb(m)-'command_payload','costs',costs,'issues',issues,'recap',r,'start_date',as_of);
 fingerprint:=encode(sha256(convert_to(snapshot::text,'UTF8')),'hex');
 return jsonb_build_object('owner_application_id',o.id,'owner_name',o.name,'vehicle_id',v.id,'vehicle',v.model||' · '||v.plate,'driver_application_id',d.id,'driver_name',d.name,'mandate_reference',m.reference,'active_contract',(select signed_reference from public.contracts where vehicle_id=vid and status='active' limit 1),'blockers',blockers,'costs',costs,'issues',issues,'recap',r,'fingerprint',fingerprint);
end $$;
create function private.get_owner_service_setup(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not private.is_staff() then raise exception 'Accès personnel requis';end if;
 return private.owner_service_setup((p->>'vehicle_id')::bigint,nullif(p->>'driver_application_id','')::bigint,coalesce(nullif(p->>'start_date','')::date,(now() at time zone 'Africa/Kinshasa')::date));end $$;
create function private.guard_owner_service_review() returns trigger language plpgsql security definer set search_path='' as $$
declare review jsonb;
begin
 if not exists(select 1 from public.vehicles where id=new.vehicle_id and owner_application_id is not null) then return new;end if;
 review:=private.owner_service_setup(new.vehicle_id,new.application_id,new.start_date);
 if jsonb_array_length(review->'blockers')>0 then raise exception '%',(select string_agg(x,' · ') from jsonb_array_elements_text(review->'blockers')x);end if;
 if new.command_payload->'owner_setup_reviewed' is distinct from 'true'::jsonb or new.command_payload->>'owner_setup_fingerprint' is distinct from review->>'fingerprint' then raise exception 'Relisez et confirmez le bilan propriétaire avant activation : les informations ou frais ont changé';end if;
 return new;
end $$;
-- Runs before the existing managed-assignment trigger starts the owner's mandate.
create trigger a_owner_service_review before insert on public.contracts for each row execute function private.guard_owner_service_review();

create function private.correct_vehicle_advance_details(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.vehicle_advances;i public.vehicle_issues;old public.audit_logs;updated public.vehicle_advances;
begin
 if not private.is_cashier() then raise exception 'Administration / caisse requise';end if;
 if p->>'request_id' is null or coalesce(length(btrim(p->>'reason')),0)<5 then raise exception 'Identifiant et motif détaillé requis';end if;
 perform (p->>'request_id')::uuid;perform pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 select * into old from public.audit_logs where entity='vehicle_advances' and action='correct_vehicle_advance_details' and changes->>'request_id'=p->>'request_id';
 if found then if old.actor_id<>auth.uid() or old.changes->'command'<>p then raise exception 'Requête réutilisée';end if;return (old.changes->>'advance_id')::uuid;end if;
 select * into a from public.vehicle_advances where id=(p->>'advance_id')::uuid for update;
 if not found or a.debtor<>'owner' then raise exception 'Avance propriétaire introuvable';end if;
 if p->>'kind' not in('fuel','repair','document') or coalesce(length(btrim(p->>'description')),0)<3 then raise exception 'Catégorie et libellé précis requis';end if;
 if p->>'kind'='repair' then
  select * into i from public.vehicle_issues where id=(p->>'issue_id')::uuid and responsibility='owner' and (vehicle_id=a.vehicle_id or application_id=a.application_id) for update;
  if not found then raise exception 'Sélectionnez le constat de réparation de ce véhicule';end if;
  if exists(select 1 from public.vehicle_advances where issue_id=i.id and id<>a.id) then raise exception 'Cette réparation a déjà son coût';end if;
 end if;
 update public.vehicle_advances set kind=p->>'kind',description=btrim(p->>'description'),issue_id=case when p->>'kind'='repair' then i.id end,
 expense_reference=case when p ? 'expense_reference' then btrim(p->>'expense_reference') else expense_reference end,
 approval_reference=case when p ? 'approval_reference' then nullif(btrim(p->>'approval_reference'),'') else approval_reference end where id=a.id returning * into updated;
 insert into public.audit_logs(application_id,actor_id,entity,action,changes) values(a.application_id,auth.uid(),'vehicle_advances','correct_vehicle_advance_details',jsonb_build_object('advance_id',a.id,'request_id',p->>'request_id','command',p,'before',to_jsonb(a)-'command_payload','after',to_jsonb(updated)-'command_payload'));
 return a.id;
end $$;

create function private.owner_activation_message(cid uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare ct public.contracts;a public.applications;v public.vehicles;o public.applications;r jsonb;item jsonb;cost_text text:='';
begin
 select * into ct from public.contracts where id=cid;select * into a from public.applications where id=ct.application_id;select * into v from public.vehicles where id=ct.vehicle_id;select * into o from public.applications where id=v.owner_application_id;
 if o.id is null then return null;end if;
 r:=private.owner_financial_recap(o.id,ct.start_date);
 for item in select value from jsonb_array_elements(r->'advances') where (value->>'remaining')::numeric>0 loop
  cost_text:=cost_text||' '||(item->>'description')||' : '||(item->>'principal')||' + 15% uniques '||(item->>'fee')||' = '||(item->>'total')||' USD, solde '||(item->>'remaining')||', '||(item->>'months')||' mois dès '||to_char((item->>'recovery_start')::date,'DD/MM/YYYY')||'.';
 end loop;
 return 'GM Fleet : Bonjour '||o.name||', véhicule '||v.model||' ('||v.plate||') confié à '||a.name||' dès le '||to_char(ct.start_date,'DD/MM/YYYY')||'. Mandat '||(select reference from public.fleet_mandates where vehicle_id=v.id and status='active' limit 1)||'. Cible propriétaire '||coalesce(r->>'owner_target','0')||' USD/mois.'||case when cost_text='' then ' Aucune avance GML.' else cost_text end||' Dette totale restante '||(r->>'remaining')||' USD. Prochaine retenue '||(r->>'next_deduction')||' USD ; net prévisionnel '||(r->>'projected_net')||' USD au '||to_char((r->>'next_payout_date')::date,'DD/MM/YYYY')||', sous réserve des encaissements et ajustements convenus. Votre agent transmet la copie juridique par lien séparé.';
end $$;
create or replace function private.queue_contract_sms() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.applications;v public.vehicles;o public.applications;msg text;
begin
 select * into a from public.applications where id=new.application_id;select * into v from public.vehicles where id=new.vehicle_id;select * into o from public.applications where id=v.owner_application_id;
 msg:='GM Fleet : Bonjour '||a.name||case when o.id is not null then ', vous êtes affecté au véhicule ' else ', votre contrat est activé. Véhicule : ' end||v.model||' ('||v.plate||').';
 if o.id is not null then msg:=msg||' Propriétaire : '||o.name||'.';end if;
 msg:=msg||' Début du service : '||to_char(new.start_date,'DD/MM/YYYY')||'. Premier versement : '||to_char(new.first_payment_date,'DD/MM/YYYY')||'. Contrat '||new.signed_reference||'.';
 perform private.queue_sms('contract:'||new.id,'contract_activated',a.phone,msg,a.id);
 if o.id is not null then perform private.queue_sms('contract:'||new.id||':owner','owner_assignment',o.phone,private.owner_activation_message(new.id),o.id);end if;
 return new;
end $$;
-- Intentionally no per-advance owner SMS and no replay of old activations.
do $$declare f text;begin foreach f in array array['get_owner_service_setup','correct_vehicle_advance_details'] loop
 execute format('create function public.%I(p jsonb) returns %s language sql security invoker set search_path='''' as %L',f,case when f='get_owner_service_setup' then 'jsonb' else 'uuid' end,'select private.'||f||'(p)');
 execute format('revoke all on function private.%I(jsonb),public.%I(jsonb) from public,anon',f,f);execute format('grant execute on function private.%I(jsonb),public.%I(jsonb) to authenticated',f,f);end loop;end $$;
revoke all on function private.contract_identity_missing(public.applications,public.vehicles),private.owner_service_setup(bigint,bigint,date),private.guard_owner_service_review(),private.owner_activation_message(uuid),private.queue_contract_sms() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;

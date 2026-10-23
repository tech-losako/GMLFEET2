begin;
create function private.require_reviewed_documents() returns trigger language plpgsql security definer set search_path='' as $$
declare total integer; pending integer; refused integer;
begin
 if new.review_status is distinct from old.review_status and new.review_status in ('accepted','rejected') then
  select count(*),count(*) filter(where d.review_status='pending'),count(*) filter(where d.review_status='rejected') into total,pending,refused
  from public.documents d where d.application_id=new.id and not exists(select 1 from public.documents n where n.replaces_document_id=d.id);
  if total=0 then raise exception 'Ajoutez et vérifiez les photos et documents avant la décision GML';end if;
  if pending>0 then raise exception 'Vérifiez chaque photo et document avant la décision GML (% restant)',pending;end if;
  if new.review_status='accepted' and refused>0 then raise exception 'Remplacez et validez les pièces refusées avant d’accepter le dossier';end if;
 end if;
 return new;
end $$;
revoke all on function private.require_reviewed_documents() from public,anon,authenticated;
create trigger reviewed_documents_before_decision before update of review_status on public.applications for each row execute function private.require_reviewed_documents();

create or replace function private.validate_case_equipment(details jsonb) returns void language plpgsql set search_path='' as $$
declare prefix text; label text;
begin
 if details->>'equipment_package' is null or details->>'equipment_package' not in ('tracker','tracker_camera') then raise exception 'Choisissez tracker seul ou tracker et caméra';end if;
 if coalesce(length(btrim(details->>'tracker_id')),0) not between 2 and 120 then raise exception 'Identifiant tracker requis (2 à 120 caractères)';end if;
 if details->>'equipment_package'='tracker_camera' and coalesce(length(btrim(details->>'dashcam_id')),0) not between 2 and 120 then raise exception 'Identifiant caméra requis pour tracker et caméra';end if;
 foreach prefix in array case when details->>'equipment_package'='tracker_camera' then array['','dashcam_'] else array[''] end loop
  label:=case when prefix='' then 'tracker' else 'caméra' end;
  if coalesce(details->>(prefix||'sim_number'),'') !~ '^\+?[0-9][0-9 -]{5,29}$' then raise exception 'Numéro de téléphone de la SIM du % requis',label;end if;
  if coalesce(length(btrim(details->>(prefix||'sim_operator'))),0) not between 2 and 60 then raise exception 'Opérateur SIM du % requis',label;end if;
  if coalesce(details->>(prefix||'sim_iccid'),'')<>'' and details->>(prefix||'sim_iccid') !~ '^[0-9]{18,22}$' then raise exception 'ICCID du % : 18 à 22 chiffres ou vide',label;end if;
 end loop;
end $$;
revoke all on function private.validate_case_equipment(jsonb) from public,anon,authenticated;
do $patch$
declare definition text; marker text;
begin
 definition:=pg_get_functiondef('private.save_case_equipment(jsonb)'::regprocedure);
 marker:=' perform private.validate_case_equipment(details);';
 if position(marker in definition)=0 then raise exception 'Unexpected equipment function';end if;
 definition:=replace(definition,marker,$new$ details:=details||jsonb_build_object('dashcam_sim_number',case when details->>'equipment_package'='tracker_camera' then btrim(p->'details'->>'dashcam_sim_number') else '' end,'dashcam_sim_operator',case when details->>'equipment_package'='tracker_camera' then btrim(p->'details'->>'dashcam_sim_operator') else '' end,'dashcam_sim_iccid',case when details->>'equipment_package'='tracker_camera' then coalesce(btrim(p->'details'->>'dashcam_sim_iccid'),'') else '' end);
 perform private.validate_case_equipment(details);$new$);
 execute definition;
end $patch$;
notify pgrst,'reload schema';
commit;

begin;
create function private.validate_case_equipment(details jsonb) returns void language plpgsql set search_path='' as $$
begin
 if details->>'equipment_package' is null or details->>'equipment_package' not in ('tracker','tracker_camera') then raise exception 'Choisissez tracker seul ou tracker et caméra';end if;
 if coalesce(length(btrim(details->>'tracker_id')),0) not between 2 and 120 then raise exception 'Identifiant tracker requis (2 à 120 caractères)';end if;
 if coalesce(details->>'sim_number','') !~ '^\+?[0-9][0-9 -]{5,29}$' then raise exception 'Numéro de téléphone de la SIM du tracker requis';end if;
 if coalesce(length(btrim(details->>'sim_operator')),0) not between 2 and 60 then raise exception 'Opérateur de la SIM requis';end if;
 if coalesce(details->>'sim_iccid','')<>'' and details->>'sim_iccid' !~ '^[0-9]{18,22}$' then raise exception 'ICCID : 18 à 22 chiffres, ou laissez vide si inconnu';end if;
 if details->>'equipment_package'='tracker_camera' and coalesce(length(btrim(details->>'dashcam_id')),0) not between 2 and 120 then raise exception 'Identifiant caméra requis pour tracker et caméra';end if;
end $$;
revoke all on function private.validate_case_equipment(jsonb) from public,anon,authenticated;

do $patch$
declare definition text; old_block text; new_block text;
begin
 definition:=pg_get_functiondef('private.record_case_step(jsonb)'::regprocedure);
 old_block:=$old$   when 'gml_inspection' then
    if choice<>'inspection_passed' then raise exception 'Decision inspection invalide';end if;
    prep:=prep||'{"gml_inspected":true}'::jsonb;target:='lolc_inspection';action_value:='Obtenir le controle favorable LOLC';
   when 'lolc_inspection' then
    if choice<>'inspection_passed' then raise exception 'Decision inspection LOLC invalide';end if;
    prep:=prep||'{"lolc_inspected":true}'::jsonb;target:='client_validation';action_value:='Faire valider le vehicule par le candidat';
   when 'client_validation' then
    if choice<>'vehicle_accepted' then raise exception 'Decision client invalide';end if;
    prep:=prep||'{"client_validated":true}'::jsonb;target:='custody';action_value:='Confirmer achat et reception chez GML';$old$;
 new_block:=$new$   when 'gml_inspection','lolc_inspection','client_validation' then
    if choice='vehicle_validated' then
     if result_value->>'gml_result' is distinct from 'passed' or result_value->>'lolc_result' is distinct from 'passed' then raise exception 'Contrôles GML et LOLC favorables requis avant acceptation du véhicule';end if;
     prep:=prep||jsonb_build_object('gml_inspected',true,'lolc_inspected',true,'client_validated',true,'vehicle_review',result_value||jsonb_build_object('client_decision','accepted','recorded_at',now(),'actor_id',auth.uid()));
     target:='custody';action_value:='Confirmer achat et reception chez GML';
    elsif choice='vehicle_change' then
     if notes_value is null or length(notes_value)<3 then raise exception 'Indiquez pourquoi le véhicule doit être changé';end if;
     if coalesce(result_value->>'gml_result','') not in ('passed','failed','not_done') or coalesce(result_value->>'lolc_result','') not in ('passed','failed','not_done') then raise exception 'Précisez les résultats GML et LOLC (ou non effectué)';end if;
     prep:=(prep-array['vehicle_found','purchased_vehicle','gml_inspected','lolc_inspected','client_validated','vehicle_review','vehicle_received','vehicle_bought_on','tracker','dashcam','equipment','equipment_draft','installed_on','paperwork','yango','handover','handover_on'])
      ||jsonb_build_object('vehicle_history',coalesce(prep->'vehicle_history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('vehicle',prep->'purchased_vehicle','review',result_value,'reason',notes_value,'actor_id',auth.uid(),'recorded_at',now())));
     target:='sourcing';action_value:='Enregistrer un autre véhicule puis reprendre les contrôles GML et LOLC';
    else raise exception 'Utilisez la décision groupée : accepter ou changer le véhicule';end if;$new$;
 if position(old_block in definition)=0 then raise exception 'Unexpected inspection workflow definition';end if;
 definition:=replace(definition,old_block,new_block);
 definition:=replace(definition,$old$prep:=prep||jsonb_build_object('vehicle_found',true,'purchased_vehicle',result_value);$old$,$new$prep:=(prep-array['gml_inspected','lolc_inspected','client_validated','vehicle_review'])||jsonb_build_object('vehicle_found',true,'purchased_vehicle',result_value);$new$);
 definition:=replace(definition,$old$action_value:=notes_value;
 elsif a.program_type$old$,$new$action_value:=notes_value;
  if a.program_type='DRIVE_TO_OWN' and a.process_step in ('gml_inspection','lolc_inspection','client_validation') then prep:=prep||jsonb_build_object('vehicle_review',result_value||jsonb_build_object('client_decision','pending'));end if;
  if a.program_type in ('DRIVE_TO_OWN','FLEET_OWNER') and a.process_step='equipment' then prep:=prep||jsonb_build_object('equipment_draft',result_value);end if;
 elsif a.program_type$new$);
 definition:=replace(definition,$old$if choice<>'installed' or coalesce(length(btrim(result_value->>'tracker_id')),0)<2 then raise exception 'Installation terminee et identifiant tracker requis';end if;$old$,$new$if choice<>'installed' then raise exception 'Confirmation installation requise';end if;perform private.validate_case_equipment(result_value);$new$);
 definition:=replace(definition,$old$prep:=prep||jsonb_build_object('tracker',true,'equipment',result_value,'installed_on',today);$old$,$new$prep:=(prep-'equipment_draft')||jsonb_build_object('tracker',true,'dashcam',result_value->>'equipment_package'='tracker_camera','equipment',result_value,'installed_on',today);$new$);
 definition:=replace(definition,$old$if coalesce(length(btrim(result_value->>'tracker_id')),0)<2 or coalesce(length(btrim(result_value->>'dashcam_id')),0)<2 then raise exception 'Identifiants tracker et dashcam requis';end if;$old$,$new$perform private.validate_case_equipment(result_value);$new$);
 definition:=replace(definition,$old$prep:=prep||jsonb_build_object('tracker',true,'dashcam',true,'equipment',result_value);$old$,$new$prep:=(prep-'equipment_draft')||jsonb_build_object('tracker',true,'dashcam',result_value->>'equipment_package'='tracker_camera','equipment',result_value);$new$);
 execute definition;
 definition:=pg_get_functiondef('private.guard_case_lifecycle()'::regprocedure);
 definition:=replace(definition,$old$new.process_step='ready' and not new.preparation @> '{"tracker":true,"dashcam":true}'$old$,$new$new.process_step='ready' and (not new.preparation @> '{"tracker":true}' or (new.preparation->'equipment'->>'equipment_package' is distinct from 'tracker' and not new.preparation @> '{"dashcam":true}'))$new$);
 execute definition;
 definition:=pg_get_functiondef('private.onboard_owner_vehicle(jsonb)'::regprocedure);
 definition:=replace(definition,$old$not a.preparation @> '{"roadworthy":true,"carte_rose":true,"insurance":true,"transport_authorization":true,"vignette":true,"technical_control":true,"tracker":true,"dashcam":true}'$old$,$new$(not a.preparation @> '{"roadworthy":true,"carte_rose":true,"insurance":true,"transport_authorization":true,"vignette":true,"technical_control":true,"tracker":true}' or (a.preparation->'equipment'->>'equipment_package' is distinct from 'tracker' and not a.preparation @> '{"dashcam":true}'))$new$);
 execute definition;
end $patch$;

create function private.save_case_equipment(p jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare a public.applications; details jsonb; previous jsonb; request uuid;
begin
 if not private.is_staff() then raise exception 'Accès personnel requis';end if;
 request:=(p->>'request_id')::uuid;if request is null then raise exception 'Identifiant de requête requis';end if;
 details:=jsonb_build_object('equipment_package',p->'details'->>'equipment_package','tracker_id',btrim(p->'details'->>'tracker_id'),'sim_number',btrim(p->'details'->>'sim_number'),'sim_operator',btrim(p->'details'->>'sim_operator'),'sim_iccid',coalesce(btrim(p->'details'->>'sim_iccid'),''),'dashcam_id',case when p->'details'->>'equipment_package'='tracker_camera' then btrim(p->'details'->>'dashcam_id') else '' end);
 perform private.validate_case_equipment(details);
 select * into a from public.applications where id=(p->>'application_id')::bigint for update;
 if not found or a.program_type not in ('DRIVE_TO_OWN','FLEET_OWNER') or a.review_status<>'accepted' or not a.preparation @> '{"tracker":true}' then raise exception 'Installation existante requise';end if;
 previous:=a.preparation->'last_equipment_update';
 if previous->>'request_id'=request::text then if previous->'details'<>details then raise exception 'Requête réutilisée avec des détails différents';end if;return a.id;end if;
 if a.revision is distinct from (p->>'revision')::integer then raise exception 'Le dossier a changé. Actualisez-le';end if;
 if details->>'equipment_package' is distinct from coalesce(a.preparation->'equipment'->>'equipment_package',case when a.preparation @> '{"dashcam":true}' or nullif(a.preparation->'equipment'->>'dashcam_id','') is not null then 'tracker_camera' else 'tracker' end) or details->>'tracker_id' is distinct from a.preparation->'equipment'->>'tracker_id' or (details->>'equipment_package'='tracker_camera' and details->>'dashcam_id' is distinct from a.preparation->'equipment'->>'dashcam_id') then raise exception 'Cette fiche modifie uniquement les renseignements SIM ; les équipements installés restent inchangés';end if;
 update public.applications set preparation=preparation||jsonb_build_object('equipment',coalesce(preparation->'equipment','{}'::jsonb)||details,'last_equipment_update',jsonb_build_object('request_id',request,'details',details,'actor_id',auth.uid(),'recorded_at',now())) where id=a.id;
 return a.id;
end $$;
create function public.save_case_equipment(p jsonb) returns bigint language sql security invoker set search_path='' as $$select private.save_case_equipment(p)$$;
revoke all on function private.save_case_equipment(jsonb),public.save_case_equipment(jsonb) from public,anon;
grant execute on function private.save_case_equipment(jsonb),public.save_case_equipment(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;

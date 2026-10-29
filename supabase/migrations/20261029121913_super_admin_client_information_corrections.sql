begin;
create function private.edit_client_information(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.applications; d jsonb; ph text; wa text; reason text; updated public.applications;
begin
 if not exists(select 1 from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role='super_admin') then raise exception 'Modification réservée au super administrateur';end if;
 select * into a from public.applications where id=(p->>'application_id')::bigint for update;
 if not found then raise exception 'Dossier introuvable';end if;
 if a.revision is distinct from (p->>'revision')::integer then raise exception 'Le dossier a changé. Actualisez-le avant de modifier les informations.';end if;
 reason:=btrim(coalesce(p->>'reason',''));
 if length(reason) not between 3 and 1000 then raise exception 'Indiquez le motif de la correction (3 à 1000 caractères)';end if;
 if length(btrim(coalesce(p->>'name',''))) not between 2 and 200 then raise exception 'Nom requis (2 à 200 caractères)';end if;
 ph:=regexp_replace(coalesce(p->>'phone',''),'[[:space:]().-]','','g');
 if ph ~ '^0[0-9]{9}$' then ph:='+243'||substr(ph,2);elsif ph ~ '^[0-9]{9}$' then ph:='+243'||ph;elsif ph ~ '^243[0-9]{9}$' then ph:='+'||ph;elsif ph ~ '^00[1-9][0-9]{7,14}$' then ph:='+'||substr(ph,3);end if;
 if ph !~ '^[+][1-9][0-9]{7,14}$' then raise exception 'Téléphone invalide : utilisez +243, 09… ou 9 chiffres';end if;
 wa:=nullif(regexp_replace(coalesce(p->>'whatsapp',''),'[[:space:]().-]','','g'),'');
 if wa ~ '^0[0-9]{9}$' then wa:='+243'||substr(wa,2);elsif wa ~ '^[0-9]{9}$' then wa:='+243'||wa;elsif wa ~ '^243[0-9]{9}$' then wa:='+'||wa;elsif wa ~ '^00[1-9][0-9]{7,14}$' then wa:='+'||substr(wa,3);end if;
 if wa is not null and wa !~ '^[+][1-9][0-9]{7,14}$' then raise exception 'Numéro WhatsApp invalide';end if;
 if length(coalesce(p->>'email',''))>254 or (nullif(btrim(p->>'email'),'') is not null and btrim(p->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then raise exception 'Adresse e-mail invalide';end if;
 if length(coalesce(p->>'address',''))>1000 or length(coalesce(p->>'idNumber',''))>120 or length(coalesce(p->>'licenseNumber',''))>120 then raise exception 'Coordonnées trop longues';end if;
 if nullif(p->>'birth_date','')::date>(now() at time zone 'Africa/Kinshasa')::date then raise exception 'Date de naissance invalide';end if;
 d:=coalesce(a.service_details,'{}')||jsonb_build_object('email',nullif(btrim(p->>'email'),''),'idNumber',nullif(btrim(p->>'idNumber'),''),'licenseNumber',nullif(btrim(p->>'licenseNumber'),''));
 update public.applications set name=btrim(p->>'name'),phone=ph,whatsapp=wa,email=nullif(btrim(p->>'email'),''),address=nullif(btrim(p->>'address'),''),birth_date=nullif(p->>'birth_date','')::date,service_details=d where id=a.id returning * into updated;
 update public.drivers set full_name=updated.name,phone=updated.phone where application_id=a.id;
 if updated.phone is distinct from a.phone then
  delete from private.driver_phone_access x using public.contracts c,public.drivers dr where x.contract_id=c.id and c.driver_id=dr.id and dr.application_id=a.id;
  update public.sms_dispatches set status='cancelled',error='Coordonnées corrigées par le super administrateur : ancien numéro abandonné' where application_id=a.id and (recipient=a.phone or private.normalize_driver_phone(recipient)=private.normalize_driver_phone(a.phone) or regexp_replace(recipient,'[^0-9]','','g')='243'||regexp_replace(a.phone,'[^0-9]','','g')) and status in('pending','failed','not_configured');
  update public.operations_notifications n set delivery_status='cancelled',delivery_error='Numéro client modifié avant envoi' where exists(select 1 from public.sms_dispatches s where s.notification_id=n.id and s.application_id=a.id and s.status='cancelled') and n.delivery_status in('pending','failed','not_configured');
 end if;
 insert into public.admin_notes(application_id,body,created_by) values(a.id,'Correction des informations client (super administrateur) : '||reason,auth.uid());
 return jsonb_build_object('id',updated.id,'revision',updated.revision,'phone',updated.phone);
end $$;
create function public.edit_client_information(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.edit_client_information(p);$$;
revoke all on function private.edit_client_information(jsonb),public.edit_client_information(jsonb) from public,anon;
grant execute on function private.edit_client_information(jsonb),public.edit_client_information(jsonb) to authenticated;
create function private.guard_final_client_information() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (old.review_status<>'pending' or exists(select 1 from public.drivers where application_id=old.id)) and
 (row(new.name,new.phone,new.whatsapp,new.email,new.address,new.birth_date) is distinct from row(old.name,old.phone,old.whatsapp,old.email,old.address,old.birth_date) or
 (new.service_details->'idNumber') is distinct from (old.service_details->'idNumber') or (new.service_details->'licenseNumber') is distinct from (old.service_details->'licenseNumber') or (new.service_details->'email') is distinct from (old.service_details->'email')) and
 not exists(select 1 from public.staff_members where user_id=auth.uid() and active and deleted_at is null and role='super_admin') then raise exception 'Modification des informations client réservée au super administrateur';end if;
 return new;
end $$;
revoke all on function private.guard_final_client_information() from public,anon,authenticated;
create trigger final_client_information_guard before update on public.applications for each row execute function private.guard_final_client_information();
commit;

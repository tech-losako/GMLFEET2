begin;

alter table public.documents
 add column category text not null default 'other',
 add column review_status text not null default 'pending',
 add column review_reason text,
 add column reviewed_by uuid references public.staff_members(user_id),
 add column reviewed_at timestamptz,
 add column revision integer not null default 1,
 add column replaces_document_id uuid references public.documents(id),
 add column replacement_note text,
 add constraint documents_category_check check (category in ('identity','license','residence','yango','registration','insurance','cv','vehicle_photo','other')),
 add constraint documents_review_status_check check (review_status in ('pending','approved','rejected')),
 add constraint documents_review_reason_check check (review_status <> 'rejected' or length(btrim(coalesce(review_reason,''))) between 3 and 2000),
 add constraint documents_review_actor_check check ((review_status='pending' and reviewed_by is null and reviewed_at is null) or (review_status<>'pending' and reviewed_by is not null and reviewed_at is not null)),
 add constraint documents_revision_check check (revision > 0),
 add constraint documents_replacement_note_check check (length(coalesce(replacement_note,'')) <= 2000);

create unique index documents_replacement_idx on public.documents(replaces_document_id) where replaces_document_id is not null;
create index documents_reviewer_idx on public.documents(reviewed_by) where reviewed_by is not null;

create function private.validate_document_review() returns trigger
language plpgsql security invoker set search_path='' as $$
declare previous public.documents;
begin
 if tg_op='INSERT' then
  new.review_status:='pending';
  new.review_reason:=null;
  new.reviewed_by:=null;
  new.reviewed_at:=null;
  new.revision:=1;
  new.replacement_note:=nullif(btrim(new.replacement_note),'');
  if new.replaces_document_id is not null then
   if not private.is_staff() then raise exception 'Accès personnel requis pour remplacer une pièce'; end if;
   select * into previous from public.documents where id=new.replaces_document_id for update;
   if not found or previous.application_id<>new.application_id then raise exception 'La pièce doit appartenir au même dossier'; end if;
   if exists(select 1 from public.documents where replaces_document_id=previous.id) then raise exception 'Cette pièce a déjà été remplacée. Actualisez le dossier'; end if;
   new.category:=previous.category;
  end if;
  if new.mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') then raise exception 'Format de fichier non pris en charge'; end if;
  if length(btrim(new.name)) not between 1 and 250 then raise exception 'Nom de fichier invalide'; end if;
  if not exists(select 1 from storage.objects where bucket_id='application-documents' and name=new.storage_path) then raise exception 'Le fichier doit être téléversé avant son enregistrement'; end if;
 else
  if not private.is_staff() then raise exception 'Accès personnel requis pour vérifier une pièce'; end if;
  if row(new.id,new.application_id,new.name,new.storage_path,new.mime_type,new.size_bytes,new.created_by,new.created_at,new.category,new.replaces_document_id,new.replacement_note)
    is distinct from row(old.id,old.application_id,old.name,old.storage_path,old.mime_type,old.size_bytes,old.created_by,old.created_at,old.category,old.replaces_document_id,old.replacement_note) then
   raise exception 'Le fichier original est conservé. Téléversez une nouvelle version pour le remplacer';
  end if;
  if exists(select 1 from public.documents where replaces_document_id=old.id) then raise exception 'Cette version a été remplacée. Vérifiez la pièce actuelle'; end if;
  new.review_reason:=nullif(btrim(new.review_reason),'');
  if length(coalesce(new.review_reason,''))>2000 then raise exception 'Les observations sont limitées à 2 000 caractères'; end if;
  new.revision:=old.revision+1;
  if new.review_status='pending' then
   new.review_reason:=null;
   new.reviewed_by:=null;
   new.reviewed_at:=null;
  else
   new.reviewed_by:=auth.uid();
   new.reviewed_at:=now();
  end if;
 end if;
 return new;
end;
$$;
revoke all on function private.validate_document_review() from public,anon,authenticated;
create trigger validate_document_review before insert or update on public.documents for each row execute function private.validate_document_review();

grant update(review_status,review_reason) on public.documents to authenticated;
create policy staff_review on public.documents for update to authenticated
 using ((select private.is_staff())) with check ((select private.is_staff()));

notify pgrst,'reload schema';
commit;

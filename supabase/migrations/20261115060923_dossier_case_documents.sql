-- Private case notes and immutable originals. File completion is server-verified.
alter table public.dossier_versions add column original_name text;
alter table public.dossier_uploads add column original_name text not null default '';
alter table public.dossier_uploads add column source text not null default '';
create index dossier_documents_case_idx on public.dossier_documents(case_id,created_at desc);
create index dossier_uploads_pending_idx on public.dossier_uploads(created_by,expires_at) where not completed;

create function private.dossier_save_note(p_id uuid,p_office uuid,p_client uuid,p_case uuid,p_title text,p_body text,p_expected integer) returns integer
language plpgsql security definer set search_path='' as $$
declare doc public.dossier_documents; next_version integer;
begin
 if auth.uid() is null or not private.dossier_staff(p_office) then raise exception 'Sem acesso ao escritório' using errcode='42501'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 240 or p_body is null or length(btrim(p_body)) not between 1 and 20000 or p_expected is null or p_expected<0 then raise exception 'Nota inválida' using errcode='22023'; end if;
 if not exists(select from public.dossier_cases where id=p_case and client_id=p_client and office_id=p_office) then raise exception 'Caso inválido' using errcode='42501'; end if;
 -- Serializes creation and edits of the same document, including simultaneous retries.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into doc from public.dossier_documents where id=p_id for update;
 if found then
  if doc.kind<>'note' or doc.office_id<>p_office or doc.client_id is distinct from p_client or doc.case_id is distinct from p_case or doc.personal_owner is not null then raise exception 'Nota indisponível' using errcode='42501'; end if;
  if doc.head_version<>p_expected then raise exception 'A nota mudou. Recarregue antes de editar' using errcode='PT409'; end if;
 else
  if p_expected<>0 then raise exception 'Nota não encontrada' using errcode='PT409'; end if;
  insert into public.dossier_documents(id,office_id,client_id,case_id,title,kind,created_by)
   values(p_id,p_office,p_client,p_case,btrim(p_title),'note',auth.uid());
 end if;
 next_version:=p_expected+1;
 insert into public.dossier_versions(document_id,version,body,stage,created_by,source)
  values(p_id,next_version,p_body,'draft',auth.uid(),'Nota interna do escritório');
 update public.dossier_documents set head_version=next_version,title=btrim(p_title) where id=p_id;
 insert into public.dossier_audit(office_id,actor_id,document_id,client_id,case_id,action,version)
  values(p_office,auth.uid(),p_id,p_client,p_case,case when p_expected=0 then 'note.created' else 'note.revised' end,next_version);
 return next_version;
end $$;
create function public.dossier_save_note(p_id uuid,p_office uuid,p_client uuid,p_case uuid,p_title text,p_body text,p_expected integer) returns integer language sql security invoker set search_path='' as $$ select private.dossier_save_note(p_id,p_office,p_client,p_case,p_title,p_body,p_expected); $$;
revoke all on function private.dossier_save_note(uuid,uuid,uuid,uuid,text,text,integer),public.dossier_save_note(uuid,uuid,uuid,uuid,text,text,integer) from public,anon;
grant execute on function private.dossier_save_note(uuid,uuid,uuid,uuid,text,text,integer),public.dossier_save_note(uuid,uuid,uuid,uuid,text,text,integer) to authenticated;

create function private.dossier_prepare_upload(p_id uuid,p_office uuid,p_client uuid,p_case uuid,p_title text,p_kind text,p_mime text,p_size bigint,p_sha256 text,p_original_name text,p_source text)
returns table(upload_id uuid,storage_path text) language plpgsql security definer set search_path='' as $$
declare u public.dossier_uploads; new_path text;
begin
 if auth.uid() is null or not private.dossier_staff(p_office) then raise exception 'Sem acesso ao escritório' using errcode='42501'; end if;
 if not exists(select from public.dossier_cases where id=p_case and client_id=p_client and office_id=p_office) then raise exception 'Caso inválido' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('file','evidence') or p_title is null or length(btrim(p_title)) not between 1 and 240 or p_original_name is null or length(p_original_name) not between 1 and 180
  or p_size is null or p_size not between 1 and 10485760 or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_source is null or length(btrim(p_source)) not between 1 and 500
  or p_mime is null or p_mime not in ('application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','audio/mpeg','audio/wav','audio/mp4') then raise exception 'Arquivo inválido' using errcode='22023'; end if;
 new_path:=p_office::text||'/'||p_client::text||'/'||p_case::text||'/'||p_id::text||'/original';
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into u from public.dossier_uploads where id=p_id;
 if found then
  if u.created_by<>auth.uid() or u.path<>new_path or u.sha256<>p_sha256 or u.size_bytes<>p_size or u.original_name<>p_original_name or u.kind<>p_kind or u.title<>p_title or u.mime<>p_mime or u.source<>p_source or u.completed or u.expires_at<=now() then raise exception 'Reserva indisponível' using errcode='42501'; end if;
 else
  insert into public.dossier_uploads(id,document_id,office_id,client_id,case_id,title,kind,expected_version,purpose,path,mime,size_bytes,sha256,created_by,original_name,source)
   values(p_id,p_id,p_office,p_client,p_case,p_title,p_kind,0,'original',new_path,p_mime,p_size,p_sha256,auth.uid(),p_original_name,p_source);
 end if;
 return query select p_id,new_path;
end $$;
create function public.dossier_prepare_upload(p_id uuid,p_office uuid,p_client uuid,p_case uuid,p_title text,p_kind text,p_mime text,p_size bigint,p_sha256 text,p_original_name text,p_source text)
returns table(upload_id uuid,storage_path text) language sql security invoker set search_path='' as $$ select * from private.dossier_prepare_upload(p_id,p_office,p_client,p_case,p_title,p_kind,p_mime,p_size,p_sha256,p_original_name,p_source); $$;
revoke all on function private.dossier_prepare_upload(uuid,uuid,uuid,uuid,text,text,text,bigint,text,text,text),public.dossier_prepare_upload(uuid,uuid,uuid,uuid,text,text,text,bigint,text,text,text) from public,anon;
grant execute on function private.dossier_prepare_upload(uuid,uuid,uuid,uuid,text,text,text,bigint,text,text,text),public.dossier_prepare_upload(uuid,uuid,uuid,uuid,text,text,text,bigint,text,text,text) to authenticated;

-- Only the server can attest the hash of the downloaded bytes and publish a file.
create function private.dossier_commit_upload(p_upload uuid,p_actor uuid,p_sha256 text) returns uuid language plpgsql security definer set search_path='' as $$
declare u public.dossier_uploads;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Operação exclusiva do servidor' using errcode='42501'; end if;
 select * into u from public.dossier_uploads where id=p_upload for update;
 if not found or p_actor is null or u.created_by<>p_actor or not exists(select from public.dossier_members where office_id=u.office_id and user_id=p_actor) then raise exception 'Reserva indisponível' using errcode='42501'; end if;
 if u.completed then return u.document_id; end if;
 if u.expires_at<=now() or u.sha256 is distinct from p_sha256 then raise exception 'Arquivo não verificado' using errcode='22023'; end if;
 if not exists(select from storage.objects where bucket_id='dossier-originals' and name=u.path and (metadata->>'size')::bigint=u.size_bytes and split_part(metadata->>'mimetype',';',1)=u.mime) then raise exception 'Arquivo incompleto' using errcode='22023'; end if;
 insert into public.dossier_documents(id,office_id,client_id,case_id,title,kind,head_version,created_by)
  values(u.document_id,u.office_id,u.client_id,u.case_id,u.title,u.kind,1,p_actor);
 insert into public.dossier_versions(document_id,version,stage,storage_path,mime,size_bytes,sha256,source,original_name,created_by)
  values(u.document_id,1,'received',u.path,u.mime,u.size_bytes,p_sha256,u.source,u.original_name,p_actor);
 insert into public.dossier_audit(office_id,actor_id,document_id,client_id,case_id,action,version)
  values(u.office_id,p_actor,u.document_id,u.client_id,u.case_id,'file.received',1);
 update public.dossier_uploads set completed=true where id=u.id;
 return u.document_id;
end $$;
create function public.dossier_commit_upload(p_upload uuid,p_actor uuid,p_sha256 text) returns uuid language sql security invoker set search_path='' as $$ select private.dossier_commit_upload(p_upload,p_actor,p_sha256); $$;
revoke all on function private.dossier_commit_upload(uuid,uuid,text),public.dossier_commit_upload(uuid,uuid,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.dossier_commit_upload(uuid,uuid,text),public.dossier_commit_upload(uuid,uuid,text) to service_role;

create function public.dossier_case_entries(p_case uuid) returns table(id uuid,title text,kind text,version integer,body text,original_name text,mime text,size_bytes bigint,sha256 text,source text,created_at timestamptz,version_created_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select d.id,d.title,d.kind,v.version,v.body,v.original_name,v.mime,v.size_bytes,v.sha256,v.source,d.created_at,v.created_at
 from public.dossier_documents d join public.dossier_versions v on v.document_id=d.id
 where d.case_id=p_case and v.version=(case when private.dossier_staff(d.office_id) then d.head_version else d.shared_version end)
 order by d.created_at desc,d.id limit 100;
$$;
revoke all on function public.dossier_case_entries(uuid) from public,anon;
grant execute on function public.dossier_case_entries(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dossier-originals','dossier-originals',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','audio/mpeg','audio/wav','audio/mp4']);
create function private.dossier_object_write(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.dossier_uploads u where u.path=object_path and u.created_by=auth.uid() and not u.completed and u.expires_at>now() and private.dossier_staff(u.office_id));
$$;
create function private.dossier_object_read(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select private.dossier_object_write(object_path) or exists(select from public.dossier_versions v where v.storage_path=object_path and private.dossier_document_access(v.document_id,v.version));
$$;
revoke all on function private.dossier_object_write(text),private.dossier_object_read(text) from public,anon;
grant execute on function private.dossier_object_write(text),private.dossier_object_read(text) to authenticated;
create policy dossier_object_insert on storage.objects for insert to authenticated with check(bucket_id='dossier-originals' and private.dossier_object_write(name));
create policy dossier_object_select on storage.objects for select to authenticated using(bucket_id='dossier-originals' and private.dossier_object_read(name));
-- No UPDATE or DELETE policy: originals cannot be overwritten by browser clients.

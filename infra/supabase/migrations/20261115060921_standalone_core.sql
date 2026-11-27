-- Empty independent Supabase/PostgreSQL backend only. Do not replay against legacy data.
create schema if not exists private;
create table public.profiles (
 id uuid primary key references auth.users, display_name text not null default '', avatar_url text not null default '',
 oab_number text not null default '', created_at timestamptz not null default now()
);
create table public.user_roles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users,
 role text not null check(role in ('client','lawyer')), unique(user_id,role)
);
create function private.has_legal_role(who uuid,wanted text) returns boolean
language sql stable security definer set search_path='' as $$
 select who=auth.uid() and exists(select from public.user_roles where user_id=who and role=wanted);
$$;
revoke all on function private.has_legal_role(uuid,text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.has_legal_role(uuid,text) to authenticated;
create function public.has_legal_role(who uuid,wanted text) returns boolean language sql stable security invoker set search_path='' as $$ select private.has_legal_role(who,wanted); $$;
revoke all on function public.has_legal_role(uuid,text) from public,anon;
grant execute on function public.has_legal_role(uuid,text) to authenticated;
create function private.create_account_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),180));
 insert into public.user_roles(user_id,role) values(new.id,'client');
 return new;
end $$;
revoke all on function private.create_account_profile() from public,anon,authenticated;
create trigger incasus_profile_created after insert on auth.users for each row execute function private.create_account_profile();
create table public.legal_process_records (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users,
 cnj text not null check(length(btrim(cnj)) between 1 and 100),subject text not null check(length(btrim(subject)) between 1 and 500),
 status text not null default 'active' check(status in ('active','closed')),created_at timestamptz not null default now()
);
create table public.legal_document_records (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users,process_id uuid references public.legal_process_records,
 name text not null,category text not null default 'outros',analysis_status text not null default 'review',
 reviewed_items jsonb not null default '[]',reviewer_id uuid references auth.users,reviewed_at timestamptz,created_at timestamptz not null default now()
);
create table public.resource_permissions (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,grantee_id uuid not null references auth.users,
 resource_type text not null check(resource_type in ('process','document')),resource_id uuid not null,permission text not null check(permission='read'),
 created_at timestamptz not null default now(),unique(resource_type,resource_id,grantee_id)
);
create table public.calendar_records (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,client_id uuid references auth.users,
 process_id uuid references public.legal_process_records,title text not null,kind text not null check(kind in ('hearing','meeting','deadline','call')),
 starts_at timestamptz not null,responsible text not null,location text not null default '',notes text not null default '',created_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,actor_id uuid references auth.users,
 actor_label text not null default '',entity_type text not null,entity_id uuid not null,action text not null,
 before_data jsonb,after_data jsonb,changed_fields text[] not null default '{}',occurred_at timestamptz not null default now()
);
create function private.legal_owns(kind text,record_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (kind='process' and exists(select from public.legal_process_records where id=record_id and owner_id=auth.uid()))
 or (kind='document' and exists(select from public.legal_document_records where id=record_id and owner_id=auth.uid()));
$$;
create function private.legal_read(kind text,record_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.legal_owns(kind,record_id) or exists(select from public.resource_permissions where resource_type=kind and resource_id=record_id and grantee_id=auth.uid());
$$;
revoke all on function private.legal_owns(text,uuid),private.legal_read(text,uuid) from public,anon;
grant execute on function private.legal_owns(text,uuid),private.legal_read(text,uuid) to authenticated;
create function private.validate_legal_links() returns trigger language plpgsql set search_path='' as $$
begin
 if new.process_id is not null and not private.legal_owns('process',new.process_id) then raise exception 'Vínculo de processo inválido' using errcode='42501'; end if;
 if tg_table_name='calendar_records' then
  if new.client_id is not null and new.process_id is not null and not exists(select from public.resource_permissions where resource_type='process' and resource_id=new.process_id and grantee_id=new.client_id and owner_id=new.owner_id) then
   raise exception 'O cliente não tem acesso ao processo' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_legal_links() from public,anon,authenticated;
create trigger document_links before insert or update on public.legal_document_records for each row execute function private.validate_legal_links();
create trigger calendar_links before insert or update on public.calendar_records for each row execute function private.validate_legal_links();
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','legal_process_records','legal_document_records','resource_permissions','calendar_records','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant update(display_name,avatar_url,oab_number) on public.profiles to authenticated;
grant insert,update,delete on public.legal_process_records,public.legal_document_records,public.resource_permissions,public.calendar_records to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy edit_profile on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy own_roles on public.user_roles for select to authenticated using(user_id=auth.uid());
create policy process_read on public.legal_process_records for select to authenticated using(private.legal_read('process',id));
create policy process_create on public.legal_process_records for insert to authenticated with check(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy process_edit on public.legal_process_records for update to authenticated using(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer')) with check(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy process_delete on public.legal_process_records for delete to authenticated using(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy document_read on public.legal_document_records for select to authenticated using(private.legal_read('document',id) or (process_id is not null and private.legal_read('process',process_id)));
create policy document_create on public.legal_document_records for insert to authenticated with check(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy document_edit on public.legal_document_records for update to authenticated using(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer')) with check(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy document_delete on public.legal_document_records for delete to authenticated using(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy permission_read on public.resource_permissions for select to authenticated using(owner_id=auth.uid() or grantee_id=auth.uid());
create policy permission_create on public.resource_permissions for insert to authenticated with check(owner_id=auth.uid() and private.legal_owns(resource_type,resource_id) and public.has_legal_role(auth.uid(),'lawyer'));
create policy permission_edit on public.resource_permissions for update to authenticated using(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer')) with check(owner_id=auth.uid() and private.legal_owns(resource_type,resource_id) and public.has_legal_role(auth.uid(),'lawyer'));
create policy permission_delete on public.resource_permissions for delete to authenticated using(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy calendar_read on public.calendar_records for select to authenticated using(owner_id=auth.uid() or (client_id=auth.uid() and (process_id is null or private.legal_read('process',process_id))));
create policy calendar_create on public.calendar_records for insert to authenticated with check(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy calendar_edit on public.calendar_records for update to authenticated using(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer')) with check(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy calendar_delete on public.calendar_records for delete to authenticated using(owner_id=auth.uid() and public.has_legal_role(auth.uid(),'lawyer'));
create policy audit_read on public.audit_logs for select to authenticated using(owner_id=auth.uid());
create function private.legal_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; owner uuid; entity uuid;
begin
 if tg_op='DELETE' then row_data:=to_jsonb(old); else row_data:=to_jsonb(new); end if;
 owner:=(row_data->>'owner_id')::uuid; entity:=(row_data->>'id')::uuid;
 insert into public.audit_logs(owner_id,actor_id,actor_label,entity_type,entity_id,action,changed_fields)
 values(owner,auth.uid(),coalesce((select display_name from public.profiles where id=auth.uid()),'Sistema'),
 case tg_table_name when 'legal_process_records' then 'process' when 'legal_document_records' then 'document' else 'permission' end,entity,lower(tg_op),
 case when tg_op='UPDATE' then array(select key from jsonb_each(to_jsonb(new)) where value is distinct from to_jsonb(old)->key) else '{}' end);
 return null;
end $$;
create function private.legal_audit_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Auditoria imutável'; end $$;
revoke all on function private.legal_audit_change(),private.legal_audit_immutable() from public,anon,authenticated;
create trigger audit_process after insert or update or delete on public.legal_process_records for each row execute function private.legal_audit_change();
create trigger audit_document after insert or update or delete on public.legal_document_records for each row execute function private.legal_audit_change();
create trigger audit_permission after insert or update or delete on public.resource_permissions for each row execute function private.legal_audit_change();
create trigger audit_immutable before update or delete on public.audit_logs for each row execute function private.legal_audit_immutable();
create index roles_user_idx on public.user_roles(user_id);
create index processes_owner_idx on public.legal_process_records(owner_id);
create index documents_owner_idx on public.legal_document_records(owner_id);
create index documents_process_idx on public.legal_document_records(process_id);
create index calendar_owner_idx on public.calendar_records(owner_id,starts_at);
create index calendar_client_idx on public.calendar_records(client_id);
create index permission_grantee_idx on public.resource_permissions(grantee_id,resource_type,resource_id);
create index audit_owner_idx on public.audit_logs(owner_id,occurred_at desc);

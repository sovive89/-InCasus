-- Private dossier foundation. Targets the current Lovable Cloud schema (user_roles).
-- Does not change or migrate existing application records.
create schema if not exists private;
create table public.dossier_offices (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 180), created_at timestamptz not null default now()
);
create table public.dossier_members (
 office_id uuid references public.dossier_offices on delete cascade, user_id uuid references auth.users on delete cascade,
 role text not null check(role in ('owner','lawyer')), primary key(office_id,user_id)
);
create table public.dossier_clients (
 id uuid primary key default gen_random_uuid(), office_id uuid not null references public.dossier_offices,
 account_id uuid references auth.users, name text not null check(length(name) between 1 and 180), email text not null default '', phone text not null default '',
 identity jsonb not null default '{}', created_at timestamptz not null default now(), unique(office_id,account_id), unique(office_id,id)
);
create table public.dossier_invitations (
 client_id uuid primary key references public.dossier_clients on delete cascade, email text not null, expires_at timestamptz not null, created_by uuid not null references auth.users
);
create table public.dossier_cases (
 id uuid primary key default gen_random_uuid(), office_id uuid not null references public.dossier_offices, client_id uuid not null,
 title text not null check(length(title) between 1 and 240), matter text not null check(length(matter) between 1 and 180), created_at timestamptz not null default now(),
 foreign key(office_id,client_id) references public.dossier_clients(office_id,id), unique(office_id,client_id,id)
);
create table public.dossier_process_links (
 id uuid primary key default gen_random_uuid(), office_id uuid not null, client_id uuid not null, case_id uuid not null, cnj text not null, court text not null default '',
 foreign key(office_id,client_id,case_id) references public.dossier_cases(office_id,client_id,id), unique(case_id,cnj), unique(office_id,client_id,case_id,id)
);
create table public.dossier_templates (
 id uuid primary key default gen_random_uuid(), office_id uuid not null references public.dossier_offices, name text not null,
 body text not null check(length(body) between 1 and 120000), created_by uuid not null references auth.users, created_at timestamptz not null default now()
);
create table public.dossier_documents (
 id uuid primary key, office_id uuid not null references public.dossier_offices, client_id uuid, case_id uuid, process_id uuid,
 title text not null check(length(title) between 1 and 240), kind text not null check(kind in ('power','draft','note','summary','study','evidence','file')),
 personal_owner uuid references auth.users, head_version integer not null default 0, shared_version integer, signature_state text not null default 'not_requested' check(signature_state in ('not_requested','awaiting','received')),
 created_by uuid not null references auth.users, created_at timestamptz not null default now(),
 foreign key(office_id,client_id) references public.dossier_clients(office_id,id),
 foreign key(office_id,client_id,case_id) references public.dossier_cases(office_id,client_id,id),
 foreign key(office_id,client_id,case_id,process_id) references public.dossier_process_links(office_id,client_id,case_id,id),
 check((client_id is not null and personal_owner is null) or (client_id is null and personal_owner is not null and case_id is null and process_id is null)),
 check(case_id is null or client_id is not null), check(process_id is null or case_id is not null), check(shared_version is null or (client_id is not null and kind not in ('note','study')))
);
create table public.dossier_versions (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.dossier_documents, version integer not null,
 body text not null default '' check(length(body)<=120000), stage text not null check(stage in ('draft','in_review','approved','received')),
 storage_path text unique, mime text, size_bytes bigint, sha256 text, source text not null default '', template_id uuid references public.dossier_templates,
 created_by uuid not null references auth.users, created_at timestamptz not null default now(), unique(document_id,version),
 check(stage<>'received' or storage_path is not null)
);
alter table public.dossier_documents add constraint dossier_shared_version_fk foreign key(id,shared_version) references public.dossier_versions(document_id,version) deferrable initially deferred;
create table public.dossier_notices (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users, document_id uuid not null references public.dossier_documents,
 version integer not null, kind text not null, title text not null, read_at timestamptz, created_at timestamptz not null default now(),
 unique(recipient_id,document_id,version,kind)
);
create table public.dossier_audit (
 id uuid primary key default gen_random_uuid(), office_id uuid not null references public.dossier_offices, actor_id uuid not null references auth.users,
 document_id uuid references public.dossier_documents, client_id uuid references public.dossier_clients, action text not null, version integer, created_at timestamptz not null default clock_timestamp()
);
create table public.dossier_uploads (
 id uuid primary key, document_id uuid, office_id uuid not null, client_id uuid, case_id uuid, process_id uuid, personal_owner uuid,
 title text not null, kind text not null, expected_version integer not null, purpose text not null check(purpose in ('original','signed')),
 path text not null unique, mime text not null, size_bytes bigint not null check(size_bytes between 1 and 10485760), sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users, expires_at timestamptz not null default now()+interval '30 minutes', completed boolean not null default false
);
create function private.dossier_staff(office uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dossier_members where office_id=office and user_id=(select auth.uid()));
$$;
create function private.dossier_client(client uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dossier_clients where id=client and account_id=(select auth.uid()));
$$;
create function private.dossier_document_access(doc uuid, ver integer default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dossier_documents d where d.id=doc and
 ((private.dossier_staff(d.office_id) and (d.personal_owner is null or d.personal_owner=auth.uid()))
 or (private.dossier_client(d.client_id) and d.shared_version is not null and (ver is null or ver=d.shared_version))));
$$;
revoke all on function private.dossier_staff(uuid),private.dossier_client(uuid),private.dossier_document_access(uuid,integer) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.dossier_staff(uuid),private.dossier_client(uuid),private.dossier_document_access(uuid,integer) to authenticated;
-- All business writes go through a transaction below; no public role can promote itself or alter history.
do $$ declare t text; begin
 foreach t in array array['dossier_offices','dossier_members','dossier_clients','dossier_invitations','dossier_cases','dossier_process_links','dossier_templates','dossier_documents','dossier_versions','dossier_notices','dossier_audit','dossier_uploads'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy office_read on public.dossier_offices for select to authenticated using(private.dossier_staff(id) or exists(select 1 from public.dossier_clients c where c.office_id=id and c.account_id=auth.uid()));
create policy member_read on public.dossier_members for select to authenticated using(user_id=auth.uid());
create policy client_read on public.dossier_clients for select to authenticated using(private.dossier_staff(office_id) or account_id=auth.uid());
create policy invitation_read on public.dossier_invitations for select to authenticated using(exists(select 1 from public.dossier_clients c where c.id=client_id and private.dossier_staff(c.office_id)));
create policy case_read on public.dossier_cases for select to authenticated using(private.dossier_staff(office_id) or private.dossier_client(client_id));
create policy process_read on public.dossier_process_links for select to authenticated using(private.dossier_staff(office_id) or private.dossier_client(client_id));
create policy template_read on public.dossier_templates for select to authenticated using(private.dossier_staff(office_id));
create policy document_read on public.dossier_documents for select to authenticated using(private.dossier_document_access(id));
create policy version_read on public.dossier_versions for select to authenticated using(private.dossier_document_access(document_id,version));
create policy notice_read on public.dossier_notices for select to authenticated using(recipient_id=auth.uid());
create policy audit_read on public.dossier_audit for select to authenticated using(private.dossier_staff(office_id) and (document_id is null or private.dossier_document_access(document_id)));
create policy upload_read on public.dossier_uploads for select to authenticated using(created_by=auth.uid());
create function private.dossier_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Histórico imutável'; end $$;
revoke all on function private.dossier_immutable() from public,anon,authenticated;
create trigger dossier_versions_immutable before update or delete on public.dossier_versions for each row execute function private.dossier_immutable();
create trigger dossier_audit_immutable before update or delete on public.dossier_audit for each row execute function private.dossier_immutable();
create index dossier_clients_office_idx on public.dossier_clients(office_id);
create index dossier_clients_account_idx on public.dossier_clients(account_id);
create index dossier_cases_client_idx on public.dossier_cases(client_id);
create index dossier_documents_client_idx on public.dossier_documents(client_id,created_at desc);
create index dossier_notices_recipient_idx on public.dossier_notices(recipient_id,created_at desc);

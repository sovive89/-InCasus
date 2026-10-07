-- InCasus — biblioteca de modelos (petições, procurações, contratos...)
-- Conceito: um modelo é um texto com variáveis {{cliente.nome}}. Modelos "do sistema" (is_system)
-- são o ponto de partida para todos os advogados e só podem ser duplicados; os do escritório
-- (office_id) são editáveis por qualquer advogado do escritório. Cada edição guarda a versão anterior.

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references public.offices (id) on delete cascade,
  name text not null,
  category text not null default 'outros' check (category in (
    'peticao', 'contestacao', 'recurso', 'procuracao', 'contrato', 'declaracao', 'notificacao', 'outros')),
  description text not null default '',
  body text not null,
  variables text[] not null default '{}',
  is_system boolean not null default false,
  archived boolean not null default false,
  version integer not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_system and office_id is null) or (not is_system and office_id is not null))
);
create index on public.document_templates (office_id);
create index on public.document_templates (created_by);

create table public.document_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates (id) on delete cascade,
  version integer not null,
  name text not null,
  body text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);
create index on public.document_template_versions (changed_by);

-- Guarda a versão anterior sempre que nome ou texto mudam.
create function private.snapshot_template_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.body is distinct from old.body or new.name is distinct from old.name then
    insert into public.document_template_versions (template_id, version, name, body, changed_by)
    values (old.id, old.version, old.name, old.body, (select auth.uid()));
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger document_templates_versioning
  before update on public.document_templates
  for each row execute function private.snapshot_template_version();

create function private.can_read_template(tid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_templates t
    where t.id = tid
      and ((t.is_system and private.is_lawyer())
           or (t.office_id is not null and private.is_office_member(t.office_id)))
  );
$$;
revoke execute on function private.can_read_template(uuid) from anon, public;
grant execute on function private.can_read_template(uuid) to authenticated;

alter table public.document_templates enable row level security;
alter table public.document_template_versions enable row level security;

create policy "modelos: ler" on public.document_templates for select to authenticated
  using ((is_system and (select private.is_lawyer()))
         or (office_id is not null and (select private.is_office_member(office_id))));
create policy "modelos: criar do escritório" on public.document_templates for insert to authenticated
  with check (not is_system and office_id is not null and (select private.is_office_member(office_id)));
create policy "modelos: editar do escritório" on public.document_templates for update to authenticated
  using (not is_system and office_id is not null and (select private.is_office_member(office_id)))
  with check (not is_system and office_id is not null and (select private.is_office_member(office_id)));
create policy "modelos: excluir do escritório" on public.document_templates for delete to authenticated
  using (not is_system and office_id is not null and (select private.is_office_member(office_id)));
create policy "versões: ler" on public.document_template_versions for select to authenticated
  using ((select private.can_read_template(template_id)));

revoke insert, update, delete on public.document_template_versions from anon, authenticated;
revoke all on public.document_templates, public.document_template_versions from anon;

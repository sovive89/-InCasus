-- InCasus — camada de dados jurídicos (multi-provider)
-- Conceito: dados públicos dos tribunais (DataJud, Escavador, ...) ficam em tabelas "legal_*",
-- normalizadas e independentes do fornecedor. A gestão do escritório (clients/cases/processes)
-- continua separada; o elo entre as duas é o número CNJ.
--
-- Escrita: somente o servidor (service role). O navegador só lê, via RLS,
-- processos aos quais o advogado tem acesso (legal_process_access).

-- ---------- Perfil de advogado / OAB ----------
create table public.lawyer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  oab_number text not null check (oab_number ~ '^[0-9]{1,7}$'),
  oab_state char(2) not null check (oab_state ~ '^[A-Z]{2}$'),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, oab_number, oab_state)
);

-- ---------- Processos (dado público normalizado) ----------
create table public.legal_processes (
  id uuid primary key default gen_random_uuid(),
  cnj_number text not null unique,          -- formato canônico NNNNNNN-DD.AAAA.J.TR.OOOO
  court text not null default '',           -- órgão julgador
  tribunal text not null default '',        -- sigla (TJDFT, TRF1, ...)
  degree text,                              -- grau (G1, G2, JE...)
  class_name text not null default '',
  class_code integer,
  subject text not null default '',
  jurisdiction text,
  judge text,
  status text,
  distribution_date timestamptz,
  secrecy_level integer not null default 0, -- 0 = público; > 0 tratar como sigiloso
  last_movement_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_parties (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.legal_processes (id) on delete cascade,
  name text not null,
  document text,
  type text,
  role text
);

create table public.legal_lawyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  oab_number text not null,
  oab_state char(2) not null,
  unique (oab_number, oab_state)
);

create table public.legal_process_lawyers (
  process_id uuid not null references public.legal_processes (id) on delete cascade,
  lawyer_id uuid not null references public.legal_lawyers (id) on delete cascade,
  party_id uuid references public.legal_parties (id) on delete set null,
  primary key (process_id, lawyer_id)
);

create table public.legal_movements (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.legal_processes (id) on delete cascade,
  external_id text,
  movement_code text,
  title text not null,
  description text not null default '',
  movement_date timestamptz not null,
  provider text not null,
  provider_payload_hash text,
  dedup_key text not null,                  -- processo + data + código/título + hash do conteúdo normalizado
  -- camada de IA (fase 6): nada vai ao cliente sem aprovação do advogado
  ai_summary text,
  ai_generated_at timestamptz,
  lawyer_approved boolean not null default false,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (process_id, dedup_key)
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.legal_processes (id) on delete cascade,
  movement_id uuid references public.legal_movements (id) on delete set null,
  name text not null,
  document_type text,
  provider text not null,
  external_url text,
  storage_path text,
  available_until timestamptz,
  created_at timestamptz not null default now()
);

-- Procedência: uma entidade pode ter dados vindos de várias fontes
create table public.legal_data_sources (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  provider text not null,
  external_id text,
  retrieved_at timestamptz not null default now(),
  raw_hash text,
  unique (entity_type, entity_id, provider)
);

-- Quem pode ver cada processo (isolamento por advogado)
create table public.legal_process_access (
  process_id uuid not null references public.legal_processes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (process_id, user_id)
);

-- Monitoramento
create table public.process_subscriptions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.legal_processes (id) on delete cascade,
  lawyer_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  external_subscription_id text,
  active boolean not null default true,
  last_checked_at timestamptz,
  next_check_at timestamptz,
  created_at timestamptz not null default now(),
  unique (process_id, lawyer_id, provider)
);

-- Auditoria de chamadas e custos (nunca guarda segredos)
create table public.provider_requests (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  operation text not null,
  process_id uuid references public.legal_processes (id) on delete set null,
  requested_by uuid references public.profiles (id) on delete set null,
  success boolean not null,
  cached boolean not null default false,
  status_code integer,
  error_code text,
  duration_ms integer,
  estimated_cost numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);

-- Configuração das integrações (SEM credenciais: elas vivem em variáveis de ambiente do servidor)
create table public.legal_provider_settings (
  provider text primary key check (provider in ('datajud', 'escavador', 'jusbrasil')),
  enabled boolean not null default false,
  priority integer not null default 100,
  environment text not null default 'production',
  last_sync_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
insert into public.legal_provider_settings (provider, enabled, priority) values
  ('datajud', true, 10), ('escavador', false, 20), ('jusbrasil', false, 30);

-- 'economy' = cache → DataJud (gratuito); 'full' = também provedores pagos como fallback
create table public.legal_integration_settings (
  id boolean primary key default true check (id),
  mode text not null default 'economy' check (mode in ('economy', 'full')),
  updated_at timestamptz not null default now()
);
insert into public.legal_integration_settings (id) values (true);

-- ---------- Índices ----------
create index on public.lawyer_profiles (user_id);
create index on public.legal_parties (process_id);
create index on public.legal_process_lawyers (lawyer_id);
create index on public.legal_process_lawyers (party_id);
create index on public.legal_movements (process_id, movement_date desc);
create index on public.legal_movements (approved_by);
create index on public.legal_documents (process_id);
create index on public.legal_documents (movement_id);
create index on public.legal_data_sources (entity_type, entity_id);
create index on public.legal_process_access (user_id);
create index on public.process_subscriptions (lawyer_id);
create index on public.process_subscriptions (next_check_at) where active;
create index on public.provider_requests (process_id);
create index on public.provider_requests (requested_by);
create index on public.provider_requests (created_at desc);

-- ---------- Segurança (RLS) ----------
create function private.has_process_access(pid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.legal_process_access
    where process_id = pid and user_id = (select auth.uid())
  );
$$;
revoke execute on function private.has_process_access(uuid) from anon, public;
grant execute on function private.has_process_access(uuid) to authenticated;

alter table public.lawyer_profiles enable row level security;
alter table public.legal_processes enable row level security;
alter table public.legal_parties enable row level security;
alter table public.legal_lawyers enable row level security;
alter table public.legal_process_lawyers enable row level security;
alter table public.legal_movements enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_data_sources enable row level security;
alter table public.legal_process_access enable row level security;
alter table public.process_subscriptions enable row level security;
alter table public.provider_requests enable row level security;
alter table public.legal_provider_settings enable row level security;
alter table public.legal_integration_settings enable row level security;

-- Perfil de advogado: o próprio usuário (apenas advogados). 'verified' só o servidor altera.
create policy "oab: ler a própria" on public.lawyer_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "oab: cadastrar a própria" on public.lawyer_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_lawyer()) and verified = false);
create policy "oab: remover a própria" on public.lawyer_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- Dados jurídicos: leitura somente de processos com acesso concedido; escrita só pelo servidor
create policy "processo: ler com acesso" on public.legal_processes for select to authenticated
  using ((select private.has_process_access(id)));
create policy "partes: ler com acesso" on public.legal_parties for select to authenticated
  using ((select private.has_process_access(process_id)));
create policy "movimentações: ler com acesso" on public.legal_movements for select to authenticated
  using ((select private.has_process_access(process_id)));
create policy "documentos: ler com acesso" on public.legal_documents for select to authenticated
  using ((select private.has_process_access(process_id)));
create policy "advogados do processo: ler com acesso" on public.legal_process_lawyers for select to authenticated
  using ((select private.has_process_access(process_id)));
create policy "advogados: ler quando vinculados a processo acessível" on public.legal_lawyers for select to authenticated
  using (exists (select 1 from public.legal_process_lawyers pl
                 where pl.lawyer_id = legal_lawyers.id and (select private.has_process_access(pl.process_id))));
create policy "procedência: ler com acesso" on public.legal_data_sources for select to authenticated
  using (entity_type = 'process' and (select private.has_process_access(entity_id)));
create policy "acesso: ver o próprio" on public.legal_process_access for select to authenticated
  using (user_id = (select auth.uid()));

-- Monitoramento: cada advogado gerencia o seu
create policy "monitoramento: ler o próprio" on public.process_subscriptions for select to authenticated
  using (lawyer_id = (select auth.uid()));

-- Custos: cada advogado vê as próprias chamadas
create policy "chamadas: ler as próprias" on public.provider_requests for select to authenticated
  using (requested_by = (select auth.uid()));

-- Configurações: só advogados leem; só advogados alteram (sem segredos nessas tabelas)
create policy "provedores: advogado lê" on public.legal_provider_settings for select to authenticated
  using ((select private.is_lawyer()));
create policy "provedores: advogado altera" on public.legal_provider_settings for update to authenticated
  using ((select private.is_lawyer())) with check ((select private.is_lawyer()));
create policy "modo: advogado lê" on public.legal_integration_settings for select to authenticated
  using ((select private.is_lawyer()));
create policy "modo: advogado altera" on public.legal_integration_settings for update to authenticated
  using ((select private.is_lawyer())) with check ((select private.is_lawyer()));
revoke update on public.legal_provider_settings from authenticated;
grant update (enabled, priority, environment) on public.legal_provider_settings to authenticated;
revoke update on public.legal_integration_settings from authenticated;
grant update (mode) on public.legal_integration_settings to authenticated;

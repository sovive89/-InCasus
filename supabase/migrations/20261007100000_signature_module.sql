-- InCasus — módulo de assinatura eletrônica (Fase 1: infraestrutura independente de fornecedor)
--
-- Conceito: o InCasus é dono da experiência; o provedor de assinatura é só infraestrutura.
-- Tudo aqui é isolado por ESCRITÓRIO (office_id). Como o app ainda não tinha a noção de
-- escritório, criamos o mínimo: offices + office_members. As tabelas antigas não são tocadas.
--
-- Escrita: somente o servidor (service role). O navegador só LÊ, via RLS, dados do próprio escritório.
-- Segredos (API keys) ficam em tabela sem nenhuma policy, criptografados pela aplicação.

-- ---------- Escritórios (tenant) ----------
create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Meu escritório',
  created_at timestamptz not null default now()
);

create table public.office_members (
  office_id uuid not null references public.offices (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'lawyer' check (role in ('admin', 'lawyer')),
  created_at timestamptz not null default now(),
  primary key (office_id, user_id)
);
create index on public.office_members (user_id);

create function private.is_office_member(oid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.office_members
    where office_id = oid and user_id = (select auth.uid())
  );
$$;

create function private.is_office_admin(oid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.office_members
    where office_id = oid and user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function private.is_office_member(uuid) from anon, public;
revoke execute on function private.is_office_admin(uuid) from anon, public;
grant execute on function private.is_office_member(uuid) to authenticated;
grant execute on function private.is_office_admin(uuid) to authenticated;

-- ---------- Configuração dos provedores (SEM segredos) ----------
create table public.signature_provider_settings (
  office_id uuid not null references public.offices (id) on delete cascade,
  provider text not null,
  enabled boolean not null default false,
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,          -- opções NÃO sensíveis
  connection_status text not null default 'not_configured'
    check (connection_status in ('not_configured', 'configured', 'connected', 'error')),
  last_checked_at timestamptz,
  last_communication_at timestamptz,
  last_error text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (office_id, provider)
);
-- no máximo um provedor padrão por escritório
create unique index signature_one_default_per_office
  on public.signature_provider_settings (office_id) where is_default;
create index on public.signature_provider_settings (updated_by);

-- Credenciais: criptografadas (AES-GCM) pelo servidor. Nenhuma policy = o navegador nunca lê.
create table public.signature_provider_credentials (
  office_id uuid not null references public.offices (id) on delete cascade,
  provider text not null,
  ciphertext text not null,
  iv text not null,
  hint text not null default '',                       -- só os 4 últimos caracteres, para exibir mascarado
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (office_id, provider)
);
create index on public.signature_provider_credentials (updated_by);

-- ---------- Envelopes ----------
create table public.signature_envelopes (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  case_id uuid references public.cases (id) on delete set null,
  process_id uuid references public.processes (id) on delete set null,
  provider text not null,                              -- vínculo definitivo até concluir/cancelar
  provider_environment text not null default 'sandbox' check (provider_environment in ('sandbox', 'production')),
  external_id text,
  title text not null,
  message text not null default '',
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'PREPARING', 'PENDING', 'SENT', 'VIEWED', 'PARTIALLY_SIGNED',
    'SIGNED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'ERROR')),
  signature_level text not null default 'SIMPLE' check (signature_level in ('SIMPLE', 'ADVANCED', 'QUALIFIED')),
  sequential boolean not null default false,
  expires_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  last_activity_at timestamptz not null default now(),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.signature_envelopes (office_id, status);
create index on public.signature_envelopes (client_id);
create index on public.signature_envelopes (process_id);
create index on public.signature_envelopes (created_by);
create index on public.signature_envelopes (case_id);
create unique index signature_envelope_external on public.signature_envelopes (provider, external_id)
  where external_id is not null;

-- Original, assinado e evidências ficam SEPARADOS; o original nunca é sobrescrito.
create table public.signature_documents (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.signature_envelopes (id) on delete cascade,
  office_id uuid not null references public.offices (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  kind text not null check (kind in ('ORIGINAL', 'SIGNED', 'EVIDENCE')),
  name text not null,
  storage_path text,
  sha256 text,
  size_bytes bigint,
  external_id text,
  created_at timestamptz not null default now()
);
create index on public.signature_documents (envelope_id);
create index on public.signature_documents (office_id);
create index on public.signature_documents (document_id);

create table public.signature_signers (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.signature_envelopes (id) on delete cascade,
  office_id uuid not null references public.offices (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  email text,
  phone text,
  role text not null default 'CLIENT' check (role in ('CLIENT', 'LAWYER', 'WITNESS', 'REPRESENTATIVE', 'OTHER')),
  document_number text,                                -- CPF só quando o método/provedor exigir
  sign_order integer not null default 1,
  status text not null default 'PENDING' check (status in (
    'PENDING', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'EXPIRED')),
  external_id text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.signature_signers (envelope_id);
create index on public.signature_signers (office_id);
create index on public.signature_signers (client_id);
create index on public.signature_signers (profile_id);

-- Link de assinatura do provedor = credencial de quem assina. Só o servidor lê/entrega ao dono.
create table public.signature_signer_links (
  signer_id uuid primary key references public.signature_signers (id) on delete cascade,
  office_id uuid not null references public.offices (id) on delete cascade,
  signing_url text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.signature_signer_links (office_id);

-- ---------- Auditoria imutável ----------
create table public.signature_events (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  envelope_id uuid references public.signature_envelopes (id) on delete set null,
  signer_id uuid references public.signature_signers (id) on delete set null,
  type text not null,
  source text not null default 'SYSTEM' check (source in ('SYSTEM', 'USER', 'PROVIDER')),
  actor_id uuid references public.profiles (id) on delete set null,
  provider text,
  data jsonb not null default '{}'::jsonb,             -- sem segredos
  created_at timestamptz not null default now()
);
create index on public.signature_events (envelope_id, created_at desc);
create index on public.signature_events (office_id, created_at desc);
create index on public.signature_events (signer_id);
create index on public.signature_events (actor_id);

create function private.block_signature_event_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'signature_events é um registro de auditoria imutável';
end $$;

create trigger signature_events_immutable
  before update or delete on public.signature_events
  for each row execute function private.block_signature_event_changes();
create trigger signature_events_no_truncate
  before truncate on public.signature_events
  for each statement execute function private.block_signature_event_changes();

-- ---------- Idempotência de webhooks ----------
-- A primeira vez que um evento chega, a linha é criada; repetições batem na chave única e são ignoradas.
create table public.signature_webhook_events (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text,
  unique (office_id, provider, external_event_id)
);

-- ---------- Telemetria de consumo / custo ----------
create table public.signature_usage (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  envelope_id uuid references public.signature_envelopes (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  provider text not null,
  operation text not null,
  success boolean not null,
  status_code integer,
  duration_ms integer,
  estimated_cost numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);
create index on public.signature_usage (office_id, created_at desc);
create index on public.signature_usage (envelope_id);
create index on public.signature_usage (user_id);

create view public.signature_envelope_metrics with (security_invoker = true) as
select
  office_id,
  provider,
  created_by,
  count(*) as envelopes_total,
  count(*) filter (where status = 'SIGNED') as envelopes_signed,
  round(100.0 * count(*) filter (where status = 'SIGNED') / nullif(count(*) filter (where status <> 'DRAFT'), 0), 1)
    as completion_rate_pct
from public.signature_envelopes
group by office_id, provider, created_by;

create view public.signature_cost_summary with (security_invoker = true) as
select
  office_id,
  provider,
  user_id,
  date_trunc('month', created_at) as month,
  count(*) as calls,
  sum(estimated_cost) as estimated_cost
from public.signature_usage
group by office_id, provider, user_id, date_trunc('month', created_at);

-- ---------- Storage privado ----------
insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

-- Convenção do caminho: <office_id>/<envelope_id>/<arquivo>
create function private.can_read_signature_object(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare first_part text := split_part(object_name, '/', 1);
begin
  if first_part !~ '^[0-9a-fA-F-]{36}$' then return false; end if;
  return private.is_office_member(first_part::uuid);
end $$;
revoke execute on function private.can_read_signature_object(text) from anon, public;
grant execute on function private.can_read_signature_object(text) to authenticated;

create policy "assinaturas: ler arquivos do escritório" on storage.objects for select to authenticated
  using (bucket_id = 'signatures' and (select private.can_read_signature_object(name)));

-- ---------- Segurança (RLS) ----------
alter table public.offices enable row level security;
alter table public.office_members enable row level security;
alter table public.signature_provider_settings enable row level security;
alter table public.signature_provider_credentials enable row level security;
alter table public.signature_envelopes enable row level security;
alter table public.signature_documents enable row level security;
alter table public.signature_signers enable row level security;
alter table public.signature_signer_links enable row level security;
alter table public.signature_events enable row level security;
alter table public.signature_webhook_events enable row level security;
alter table public.signature_usage enable row level security;

create policy "escritório: membro lê" on public.offices for select to authenticated
  using ((select private.is_office_member(id)));
create policy "membros: ler do próprio escritório" on public.office_members for select to authenticated
  using ((select private.is_office_member(office_id)));

create policy "provedores: membro lê" on public.signature_provider_settings for select to authenticated
  using ((select private.is_office_member(office_id)));

create policy "envelopes: membro lê" on public.signature_envelopes for select to authenticated
  using ((select private.is_office_member(office_id)));
create policy "documentos de assinatura: membro lê" on public.signature_documents for select to authenticated
  using ((select private.is_office_member(office_id)));
create policy "signatários: membro lê" on public.signature_signers for select to authenticated
  using ((select private.is_office_member(office_id)));
create policy "eventos: membro lê" on public.signature_events for select to authenticated
  using ((select private.is_office_member(office_id)));
create policy "consumo: membro lê" on public.signature_usage for select to authenticated
  using ((select private.is_office_member(office_id)));

-- Cliente final: vê apenas o que é seu (para "Você possui um documento aguardando assinatura")
create function private.is_signer_of(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.signature_signers s
    where s.envelope_id = eid
      and (s.profile_id = (select auth.uid()) or s.client_id in (select private.my_client_ids()))
  );
$$;
revoke execute on function private.is_signer_of(uuid) from anon, public;
grant execute on function private.is_signer_of(uuid) to authenticated;

create policy "envelopes: signatário lê" on public.signature_envelopes for select to authenticated
  using ((select private.is_signer_of(id)));
create policy "signatários: o próprio lê" on public.signature_signers for select to authenticated
  using (profile_id = (select auth.uid()) or client_id in (select private.my_client_ids()));

-- Nenhuma policy de INSERT/UPDATE/DELETE: toda escrita passa pelo servidor (service role).
-- Segredos e links: nenhuma policy e nenhum privilégio para o navegador.
revoke all on public.signature_provider_credentials from anon, authenticated;
revoke all on public.signature_signer_links from anon, authenticated;
revoke all on public.signature_webhook_events from anon, authenticated;
revoke insert, update, delete, truncate on
  public.offices, public.office_members, public.signature_provider_settings,
  public.signature_envelopes, public.signature_documents, public.signature_signers,
  public.signature_events, public.signature_usage
  from anon, authenticated;
revoke all on public.signature_envelope_metrics, public.signature_cost_summary from anon;

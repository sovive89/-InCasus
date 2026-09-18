-- InCasus — esquema inicial
-- Espelha src/lib/domain/types.ts. Modelo de acesso (MVP, um escritório):
--   * advogado (role = 'lawyer'): lê e escreve todos os dados do escritório
--   * cliente  (role = 'client'): lê apenas o que está ligado ao seu cadastro em `clients`

-- ---------- Tipos ----------
create type public.user_role as enum ('lawyer', 'client');
create type public.attention_level as enum ('critical', 'important', 'followup', 'info');
create type public.client_status as enum ('new', 'active', 'waiting', 'pending');
create type public.case_status as enum ('intake', 'active', 'negotiation', 'judicial', 'closed');
create type public.document_category as enum ('peticoes', 'decisoes', 'contratos', 'pessoais', 'comprovantes', 'outros');
create type public.analysis_status as enum ('pending', 'processing', 'analyzed', 'review');
create type public.appointment_kind as enum ('hearing', 'meeting', 'deadline', 'call');
create type public.notification_state as enum ('unread', 'read', 'archived');
create type public.chat_author as enum ('client', 'agent', 'lawyer');
create type public.chat_channel as enum ('pwa', 'whatsapp');
create type public.ai_action_kind as enum ('analysis', 'document', 'research', 'alert', 'draft');
create type public.draft_status as enum ('draft', 'in_review', 'reviewed', 'final');

-- ---------- Perfis (1:1 com auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  role public.user_role not null default 'client',
  phone text,
  created_at timestamptz not null default now()
);

-- Cria o perfil automaticamente no cadastro. Todo mundo nasce 'client';
-- promover a 'lawyer' é feito pelo painel/SQL com a service role.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers usados nas políticas (security definer evita recursão de RLS)
create function public.is_lawyer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'lawyer');
$$;

-- ---------- Clientes do escritório ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null, -- login do cliente (opcional)
  name text not null,
  email text,
  phone text,
  status public.client_status not null default 'new',
  last_contact_at timestamptz,
  next_activity text,
  created_at timestamptz not null default now()
);

create function public.my_client_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select id from public.clients where profile_id = (select auth.uid());
$$;

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  area text not null,
  subject text not null,
  description text not null default '',
  status public.case_status not null default 'intake',
  priority public.attention_level not null default 'info',
  created_at timestamptz not null default now()
);

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  cnj text not null unique,
  client_id uuid not null references public.clients (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  court text not null default '',
  class_name text not null default '',
  subject text not null default '',
  last_movement text,
  last_movement_at timestamptz,
  last_checked_at timestamptz,
  attention public.attention_level not null default 'info',
  parties jsonb not null default '[]'::jsonb, -- [{ role, name }]
  created_at timestamptz not null default now()
);

create table public.process_events (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.processes (id) on delete cascade,
  date timestamptz not null,
  title text not null,
  description text not null default ''
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.document_category not null default 'outros',
  client_id uuid not null references public.clients (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  process_id uuid references public.processes (id) on delete set null,
  storage_path text,          -- caminho no Storage (quando o upload for persistido)
  size_bytes bigint,
  analysis_status public.analysis_status not null default 'pending',
  analysis jsonb,             -- resumo, pontos principais e prazos gerados pela IA
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid not null references public.clients (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  starts_at timestamptz not null,
  location text,
  kind public.appointment_kind not null default 'meeting',
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_id uuid references public.clients (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  due_at timestamptz,
  done boolean not null default false,
  attention public.attention_level not null default 'info',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  level public.attention_level not null default 'info',
  state public.notification_state not null default 'unread',
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  title text not null default '',
  channel public.chat_channel not null default 'pwa',
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  author public.chat_author not null,
  content text not null,
  channel public.chat_channel not null default 'pwa',
  created_at timestamptz not null default now()
);

create table public.case_facts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  field text not null,
  value text not null,
  confidence numeric(3, 2) not null default 0 check (confidence between 0 and 1),
  source_message_id uuid references public.messages (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  kind public.ai_action_kind not null,
  title text not null,
  summary text not null default '',
  client_id uuid references public.clients (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default '',
  client_id uuid not null references public.clients (id) on delete cascade,
  case_id uuid references public.cases (id) on delete set null,
  status public.draft_status not null default 'draft',
  content text not null default '',
  sources text[] not null default '{}',
  documents text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Índices das chaves estrangeiras ----------
create index on public.cases (client_id);
create index on public.processes (client_id);
create index on public.processes (case_id);
create index on public.process_events (process_id);
create index on public.documents (client_id);
create index on public.documents (case_id);
create index on public.documents (process_id);
create index on public.documents (uploaded_by);
create index on public.appointments (client_id);
create index on public.appointments (case_id);
create index on public.tasks (client_id);
create index on public.tasks (case_id);
create index on public.notifications (recipient_id);
create index on public.conversations (client_id);
create index on public.conversations (case_id);
create index on public.messages (conversation_id);
create index on public.case_facts (case_id);
create index on public.case_facts (source_message_id);
create index on public.ai_actions (client_id);
create index on public.ai_actions (case_id);
create index on public.drafts (client_id);
create index on public.drafts (case_id);
create index on public.drafts (created_by);

-- ---------- Segurança (RLS) ----------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.cases enable row level security;
alter table public.processes enable row level security;
alter table public.process_events enable row level security;
alter table public.documents enable row level security;
alter table public.appointments enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.case_facts enable row level security;
alter table public.ai_actions enable row level security;
alter table public.drafts enable row level security;

-- Perfis: cada um vê o seu; advogado vê todos. Só nome/telefone são editáveis pelo usuário.
create policy "perfil: ler o próprio ou advogado" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_lawyer()));
create policy "perfil: editar o próprio" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (name, phone) on public.profiles to authenticated;

-- Advogado: acesso total às tabelas do escritório
do $$
declare t text;
begin
  foreach t in array array['clients','cases','processes','process_events','documents','appointments',
                           'tasks','conversations','messages','case_facts','ai_actions','drafts']
  loop
    execute format('create policy "advogado: acesso total" on public.%I for all to authenticated
                    using ((select public.is_lawyer())) with check ((select public.is_lawyer()))', t);
  end loop;
end $$;

-- Cliente: somente leitura do que é dele
create policy "cliente: ler o próprio cadastro" on public.clients for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "cliente: ler seus casos" on public.cases for select to authenticated
  using (client_id in (select public.my_client_ids()));
create policy "cliente: ler seus processos" on public.processes for select to authenticated
  using (client_id in (select public.my_client_ids()));
create policy "cliente: ler movimentações" on public.process_events for select to authenticated
  using (process_id in (select id from public.processes where client_id in (select public.my_client_ids())));
create policy "cliente: ler seus documentos" on public.documents for select to authenticated
  using (client_id in (select public.my_client_ids()));
create policy "cliente: ler sua agenda" on public.appointments for select to authenticated
  using (client_id in (select public.my_client_ids()));
create policy "cliente: ler suas conversas" on public.conversations for select to authenticated
  using (client_id in (select public.my_client_ids()));
create policy "cliente: ler suas mensagens" on public.messages for select to authenticated
  using (conversation_id in (select id from public.conversations where client_id in (select public.my_client_ids())));
create policy "cliente: enviar mensagem" on public.messages for insert to authenticated
  with check (author = 'client' and conversation_id in
    (select id from public.conversations where client_id in (select public.my_client_ids())));

-- Notificações: cada usuário vê e marca como lida as suas
create policy "notificação: ler as próprias" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "notificação: atualizar as próprias" on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy "notificação: advogado cria" on public.notifications for insert to authenticated
  with check ((select public.is_lawyer()));

-- Funções helper não devem ser chamáveis por anônimos
revoke execute on function public.is_lawyer() from anon, public;
revoke execute on function public.my_client_ids() from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.is_lawyer() to authenticated;
grant execute on function public.my_client_ids() to authenticated;

-- InCasus — Clientes e Casos passam a pertencer a um ESCRITÓRIO (multi-tenant) e ganham a
-- ficha cadastral necessária para gerar procurações/contratos (CPF, RG, endereço...).
-- Segurança: a policy antiga "advogado: acesso total" (qualquer advogado vê tudo) é trocada
-- por uma por escritório nestas duas tabelas. As demais tabelas serão escopadas quando
-- cada tela migrar do mock para o banco.

alter table public.clients
  add column office_id uuid references public.offices (id) on delete cascade,
  add column document_number text,      -- CPF/CNPJ (dado pessoal: LGPD, só advogados do escritório leem)
  add column rg text,
  add column nationality text,
  add column marital_status text,
  add column profession text,
  add column address text;

alter table public.cases
  add column office_id uuid references public.offices (id) on delete cascade;

create index on public.clients (office_id);
create index on public.cases (office_id);

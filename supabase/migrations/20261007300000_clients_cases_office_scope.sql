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

drop policy "advogado: acesso total" on public.clients;
drop policy "advogado: acesso total" on public.cases;

create policy "clientes: advogado do escritório" on public.clients for all to authenticated
  using (office_id is not null and (select private.is_office_member(office_id)))
  with check (office_id is not null and (select private.is_office_member(office_id)));

-- O caso só pode apontar para um cliente do MESMO escritório.
create policy "casos: advogado do escritório" on public.cases for all to authenticated
  using (office_id is not null and (select private.is_office_member(office_id)))
  with check (
    office_id is not null and (select private.is_office_member(office_id))
    and exists (select 1 from public.clients c where c.id = client_id and c.office_id = cases.office_id)
  );

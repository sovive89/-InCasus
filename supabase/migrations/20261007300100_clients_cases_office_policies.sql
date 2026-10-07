-- PENDENTE DE APLICAÇÃO: o aprovador do Supabase cancelou este comando (remove policies).
-- Aplicar pelo SQL Editor do painel. Até lá, qualquer advogado ainda enxerga todos os clientes.

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

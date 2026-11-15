# Teste de isolamento do prontuário

Use somente um banco PostgreSQL descartável. O bootstrap cria um contrato mínimo de Auth e papéis, sem reproduzir todos os serviços do Supabase.

Em um banco vazio, execute com `psql -v ON_ERROR_STOP=1`, nesta ordem:

1. `tests/database/bootstrap.sql`
2. `supabase/migrations/20261113022610_office_procurement.sql`
3. `supabase/migrations/20261115053909_dossier_client_case_records.sql`
4. `tests/database/dossier.sql`

O teste confere isolamento de escritórios, vínculo de cliente e caso, inquérito sem CNJ, ativação idempotente, restrições por coluna, ausência de autopromoção, leitura por cliente vinculado e auditoria imutável. Ele usa IDs e dados fictícios.

Isto não testa a API HTTP, o Storage nem substitui a validação no Supabase de homologação.

-- Funções auxiliares de RLS fora do schema exposto pela API (evita /rest/v1/rpc/*)
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.is_lawyer() set schema private;
alter function public.my_client_ids() set schema private;
alter function public.handle_new_user() set schema private;

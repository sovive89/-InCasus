-- Minimal auth/role contract for isolated PostgreSQL tests. Not a migration.
\set ON_ERROR_STOP on
do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if; end $$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.test_legal_roles(user_id uuid,role text);
create function public.has_legal_role(who uuid,wanted text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select from public.test_legal_roles r where r.user_id=who and r.role=wanted); $$;

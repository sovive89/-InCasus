\set password `printenv POSTGRES_PASSWORD`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password :'password';
create role supabase_auth_admin login noinherit createrole password :'password';
create role supabase_storage_admin login noinherit createrole bypassrls password :'password';
grant anon,authenticated,service_role to authenticator,supabase_storage_admin;
create schema auth authorization supabase_auth_admin;
create schema storage authorization supabase_storage_admin;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant all on schema public to service_role;
grant all on database postgres to supabase_auth_admin,supabase_storage_admin;
create function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid;
$$;
create function auth.role() returns text language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'role');
$$;
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
$$;
grant execute on all functions in schema auth to anon,authenticated,service_role;
alter role supabase_auth_admin set search_path=auth;
alter role supabase_storage_admin set search_path=storage,public;
alter function auth.uid() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;
alter function auth.jwt() owner to supabase_auth_admin;

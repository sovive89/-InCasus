-- Run after GoTrue's initial migrations in the vanilla-Postgres development stack.
-- PostgREST v14 stores all claims in a single JSON setting.
create or replace function auth.uid() returns uuid language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid;
$$;
create or replace function auth.role() returns text language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'role');
$$;
create or replace function auth.jwt() returns jsonb language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
$$;
grant execute on function auth.uid(),auth.role(),auth.jwt() to anon,authenticated,service_role;

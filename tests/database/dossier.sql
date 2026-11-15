-- Run only in a disposable PostgreSQL database after the two dossier migrations.
\set ON_ERROR_STOP on
create function pg_temp.assert_ok(ok boolean, message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end $$;
insert into auth.users(id) values
 ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003'),('10000000-0000-4000-8000-000000000004');
insert into public.test_legal_roles values ('10000000-0000-4000-8000-000000000001','lawyer'),('10000000-0000-4000-8000-000000000002','lawyer');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.dossier_start_office('Escritório A') as office_a \gset
select pg_temp.assert_ok(public.dossier_start_office('Nome repetido')=:'office_a'::uuid,'activation is idempotent');
insert into public.dossier_clients(id,office_id,name,email,phone) values('20000000-0000-4000-8000-000000000001',:'office_a','Cliente A','','');
insert into public.dossier_cases(id,office_id,client_id,title,matter,phase) values('30000000-0000-4000-8000-000000000001',:'office_a','20000000-0000-4000-8000-000000000001','Investigação sem CNJ','Criminal','investigation');
select pg_temp.assert_ok((select count(*)=1 from public.dossier_cases),'inquiry saved without process number');
update public.dossier_cases set phase='judicial' where id='30000000-0000-4000-8000-000000000001';
select pg_temp.assert_ok((select count(*)=4 from public.dossier_audit),'office, client, case and phase change audited');
-- Column privileges prevent linking an arbitrary authenticated user.
do $$ begin
 begin update public.dossier_clients set account_id='10000000-0000-4000-8000-000000000003'; raise exception 'FAIL: account linking permitted'; exception when insufficient_privilege then null; end;
 begin update public.dossier_audit set action='changed'; raise exception 'FAIL: mutable audit'; exception when insufficient_privilege then null; end;
 begin insert into public.dossier_members values(gen_random_uuid(),auth.uid(),'owner'); raise exception 'FAIL: membership write'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.dossier_start_office('Escritório B') as office_b \gset
select pg_temp.assert_ok((select count(*)=0 from public.dossier_clients),'other office cannot read client');
select pg_temp.assert_ok((select count(*)=0 from public.dossier_cases),'other office cannot read case');
select pg_temp.assert_ok((select count(*)=1 from public.dossier_audit),'other office cannot read audit');
insert into public.dossier_clients(id,office_id,name,email,phone) values('20000000-0000-4000-8000-000000000002',:'office_b','Cliente B','','');
-- FK scopes the client to its office, even for a valid member of B.
\set office_for_cross_check :office_b
select set_config('test.office_b',:'office_b',false);
select set_config('test.office_a',:'office_a',false);
do $$ begin
 begin insert into public.dossier_cases(id,office_id,client_id,title,matter,phase) values(gen_random_uuid(),current_setting('test.office_b')::uuid,'20000000-0000-4000-8000-000000000001','Cross-office','Criminal','intake'); raise exception 'FAIL: cross-office client link'; exception when foreign_key_violation then null; end;
 begin insert into public.dossier_clients(id,office_id,name,email,phone) values(gen_random_uuid(),current_setting('test.office_a')::uuid,'Intruso','',''); raise exception 'FAIL: cross-office insert'; exception when insufficient_privilege then null; end;
end $$;
-- Client cannot self-provision an office, add clients, or view unlinked records.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
select pg_temp.assert_ok((select count(*)=0 from public.dossier_offices),'unlinked client sees no office');
do $$ begin
 begin perform public.dossier_start_office('Autopromoção'); raise exception 'FAIL: client promotion'; exception when insufficient_privilege then null; end;
 begin insert into public.dossier_clients(id,office_id,name,email,phone) values(gen_random_uuid(),current_setting('test.office_a')::uuid,'Intruso','',''); raise exception 'FAIL: client write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Administrative account binding is not available to the app's write API.
update public.dossier_clients set account_id='10000000-0000-4000-8000-000000000003' where id='20000000-0000-4000-8000-000000000001';
set role authenticated;
select pg_temp.assert_ok((select count(*)=1 from public.dossier_clients),'linked client sees own record');
select pg_temp.assert_ok((select count(*)=1 from public.dossier_cases),'linked client sees own case');
select pg_temp.assert_ok((select count(*)=0 from public.dossier_audit),'client does not see internal audit');
update public.dossier_cases set phase='closed';
select pg_temp.assert_ok((select phase='judicial' from public.dossier_cases limit 1),'client cannot change phase');
reset role;
set role anon;
do $$ begin
 begin perform public.dossier_start_office('Anon'); raise exception 'FAIL: anonymous function access'; exception when insufficient_privilege then null; end;
 begin perform count(*) from public.dossier_clients; raise exception 'FAIL: anonymous read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: dossier isolation, grants, inquiries, audit, idempotency and account binding' as result;

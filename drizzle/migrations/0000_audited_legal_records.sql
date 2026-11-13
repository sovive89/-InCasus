CREATE TABLE public.legal_process_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, cnj text NOT NULL, subject text NOT NULL, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_process_records TO authenticated;
GRANT ALL ON public.legal_process_records TO service_role;
ALTER TABLE public.legal_process_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_owner ON public.legal_process_records TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TABLE public.legal_document_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, process_id uuid REFERENCES public.legal_process_records(id), name text NOT NULL, category text NOT NULL DEFAULT 'outros', analysis_status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_document_records TO authenticated;
GRANT ALL ON public.legal_document_records TO service_role;
ALTER TABLE public.legal_document_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_owner ON public.legal_document_records TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND (process_id IS NULL OR EXISTS (SELECT 1 FROM public.legal_process_records p WHERE p.id = process_id AND p.owner_id = auth.uid())));
CREATE TABLE public.resource_permissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, grantee_id uuid NOT NULL, resource_type text NOT NULL CHECK (resource_type IN ('process','document')), resource_id uuid NOT NULL, permission text NOT NULL CHECK (permission IN ('read','write')), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(resource_type, resource_id, grantee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_permissions TO authenticated;
GRANT ALL ON public.resource_permissions TO service_role;
ALTER TABLE public.resource_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permission_owner ON public.resource_permissions TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND ((resource_type = 'process' AND EXISTS (SELECT 1 FROM public.legal_process_records p WHERE p.id = resource_id AND p.owner_id = auth.uid())) OR (resource_type = 'document' AND EXISTS (SELECT 1 FROM public.legal_document_records d WHERE d.id = resource_id AND d.owner_id = auth.uid()))));
COMMENT ON TABLE public.resource_permissions IS 'Resource permission assignments. Not application roles; resource sharing enforcement is not yet enabled.';
CREATE TABLE public.audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, actor_id uuid, actor_label text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(), entity_type text NOT NULL CHECK (entity_type IN ('process','document','permission')), entity_id uuid NOT NULL, action text NOT NULL CHECK (action IN ('create','update','delete')), before_data jsonb, after_data jsonb, changed_fields text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_owner_read ON public.audit_logs FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE INDEX audit_logs_owner_time ON public.audit_logs(owner_id, occurred_at DESC);
CREATE INDEX audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE FUNCTION public.capture_legal_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_row jsonb; new_row jsonb; row_data jsonb; actor uuid; fields text[];
BEGIN
 IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
 IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
 row_data := coalesce(new_row, old_row);
 actor := auth.uid();
 SELECT coalesce(array_agg(k ORDER BY k), '{}') INTO fields FROM jsonb_object_keys(row_data) k WHERE (old_row -> k) IS DISTINCT FROM (new_row -> k);
 INSERT INTO public.audit_logs(owner_id, actor_id, actor_label, entity_type, entity_id, action, before_data, after_data, changed_fields)
 VALUES ((row_data->>'owner_id')::uuid, actor, CASE WHEN actor IS NULL THEN 'Sistema / operação administrativa' ELSE actor::text END, TG_ARGV[0], (row_data->>'id')::uuid, lower(TG_OP), old_row, new_row, fields);
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_legal_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_process AFTER INSERT OR UPDATE OR DELETE ON public.legal_process_records FOR EACH ROW EXECUTE FUNCTION public.capture_legal_audit('process');
CREATE TRIGGER audit_document AFTER INSERT OR UPDATE OR DELETE ON public.legal_document_records FOR EACH ROW EXECUTE FUNCTION public.capture_legal_audit('document');
CREATE TRIGGER audit_permission AFTER INSERT OR UPDATE OR DELETE ON public.resource_permissions FOR EACH ROW EXECUTE FUNCTION public.capture_legal_audit('permission');
CREATE FUNCTION public.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN RAISE EXCEPTION 'Audit records cannot be changed or deleted'; END; $$;
REVOKE ALL ON FUNCTION public.reject_audit_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.reject_audit_mutation();
COMMENT ON TABLE public.audit_logs IS 'Append-only legal record audit. Actor and timestamp captured by database triggers. No document content or secrets stored.';
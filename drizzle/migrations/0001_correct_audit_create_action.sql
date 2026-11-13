CREATE OR REPLACE FUNCTION public.capture_legal_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_row jsonb; new_row jsonb; row_data jsonb; actor uuid; fields text[];
BEGIN
 IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
 IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
 row_data := coalesce(new_row, old_row);
 actor := auth.uid();
 SELECT coalesce(array_agg(k ORDER BY k), '{}') INTO fields FROM jsonb_object_keys(row_data) k WHERE (old_row -> k) IS DISTINCT FROM (new_row -> k);
 INSERT INTO public.audit_logs(owner_id, actor_id, actor_label, entity_type, entity_id, action, before_data, after_data, changed_fields)
 VALUES ((row_data->>'owner_id')::uuid, actor, CASE WHEN actor IS NULL THEN 'Sistema / operação administrativa' ELSE actor::text END, TG_ARGV[0], (row_data->>'id')::uuid, CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE lower(TG_OP) END, old_row, new_row, fields);
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_legal_audit() FROM PUBLIC, anon, authenticated;
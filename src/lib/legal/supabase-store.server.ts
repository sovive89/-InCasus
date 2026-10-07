/**
 * Persistência (somente servidor). Usa a service role porque as tabelas legal_*
 * só aceitam escrita do servidor; a leitura pelo navegador é filtrada por RLS.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { movementDedupKey, movementPayloadHash } from "./dedup";
import type { CachedProcess, LegalStore } from "./legal-data-service";
import type { RouterSettings } from "./provider-router";
import type { IntegrationMode, ProviderId } from "./types";

export const supabaseLegalStore: LegalStore = {
  async loadSettings(): Promise<RouterSettings> {
    const [{ data: mode }, { data: providers }] = await Promise.all([
      supabaseAdmin.from("legal_integration_settings").select("mode").maybeSingle(),
      supabaseAdmin.from("legal_provider_settings").select("provider, enabled, priority"),
    ]);
    const map: RouterSettings["providers"] = {};
    for (const p of providers ?? []) map[p.provider as ProviderId] = { enabled: p.enabled, priority: p.priority };
    return { mode: (mode?.mode as IntegrationMode | undefined) ?? "economy", providers: map };
  },

  async findCached(cnj): Promise<CachedProcess | null> {
    const { data: p } = await supabaseAdmin.from("legal_processes").select("*").eq("cnj_number", cnj).maybeSingle();
    if (!p) return null;
    const { data: moves } = await supabaseAdmin
      .from("legal_movements").select("*").eq("process_id", p.id)
      .order("movement_date", { ascending: false }).limit(200);
    return {
      process: {
        cnj: p.cnj_number, tribunal: p.tribunal, court: p.court, degree: p.degree,
        className: p.class_name, classCode: p.class_code, subject: p.subject,
        jurisdiction: p.jurisdiction, judge: p.judge, status: p.status,
        distributionDate: p.distribution_date, secrecyLevel: p.secrecy_level,
        lastMovementAt: p.last_movement_at, parties: [], lastSyncAt: p.last_sync_at,
      },
      movements: (moves ?? []).map((m) => ({
        externalId: m.external_id, code: m.movement_code, title: m.title,
        description: m.description, date: m.movement_date, provider: m.provider as ProviderId,
      })),
    };
  },

  async save(result) {
    const now = new Date().toISOString();
    const pr = result.process;
    const { data: row, error } = await supabaseAdmin.from("legal_processes").upsert(
      {
        cnj_number: pr.cnj, tribunal: pr.tribunal, court: pr.court, degree: pr.degree,
        class_name: pr.className, class_code: pr.classCode, subject: pr.subject,
        jurisdiction: pr.jurisdiction, judge: pr.judge, status: pr.status,
        distribution_date: pr.distributionDate, secrecy_level: pr.secrecyLevel,
        last_movement_at: pr.lastMovementAt, last_sync_at: now, updated_at: now,
      },
      { onConflict: "cnj_number" },
    ).select("id").single();
    if (error || !row) throw new Error("Falha ao gravar processo.");

    if (result.movements.length > 0) {
      const rows = await Promise.all(result.movements.map(async (m) => ({
        process_id: row.id, external_id: m.externalId, movement_code: m.code, title: m.title,
        description: m.description, movement_date: m.date, provider: result.provider,
        provider_payload_hash: await movementPayloadHash(m), dedup_key: await movementDedupKey(m),
      })));
      // ignoreDuplicates: movimentação já vinda de outra fonte não é gravada nem notificada de novo
      await supabaseAdmin.from("legal_movements").upsert(rows, { onConflict: "process_id,dedup_key", ignoreDuplicates: true });
    }

    await supabaseAdmin.from("legal_data_sources").upsert(
      { entity_type: "process", entity_id: row.id, provider: result.provider, external_id: result.externalId, raw_hash: result.rawHash, retrieved_at: now },
      { onConflict: "entity_type,entity_id,provider" },
    );
    return { lastSyncAt: now };
  },

  async grantAccess(cnj, userId) {
    const { data } = await supabaseAdmin.from("legal_processes").select("id").eq("cnj_number", cnj).maybeSingle();
    if (!data) return;
    await supabaseAdmin.from("legal_process_access").upsert(
      { process_id: data.id, user_id: userId }, { onConflict: "process_id,user_id", ignoreDuplicates: true },
    );
  },

  async logRequest(e) {
    let processId: string | null = null;
    if (e.cnj) {
      const { data } = await supabaseAdmin.from("legal_processes").select("id").eq("cnj_number", e.cnj).maybeSingle();
      processId = data?.id ?? null;
    }
    await supabaseAdmin.from("provider_requests").insert({
      provider: e.provider, operation: e.operation, process_id: processId, requested_by: e.userId,
      success: e.success, cached: e.cached, error_code: e.errorCode ?? null, status_code: e.statusCode ?? null,
      duration_ms: e.durationMs, estimated_cost: e.estimatedCost,
    });
  },

  async recordProviderStatus(provider, error) {
    await supabaseAdmin.from("legal_provider_settings").update(
      error === null
        ? { last_sync_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }
        : { last_error: error.slice(0, 300), updated_at: new Date().toISOString() },
    ).eq("provider", provider);
  },
};

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AuditEntry } from "./audit";
export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditEntry[]> => {
    const { data, error } = await context.supabase.from("audit_logs").select("*").order("occurred_at", { ascending: false }).limit(500);
    if (error) throw new Error("Não foi possível consultar o histórico oficial.");
    return (data ?? []).map((row) => ({
      id: row.id, actor: row.actor_label, occurredAt: row.occurred_at,
      entityType: row.entity_type as AuditEntry["entityType"], entityId: row.entity_id,
      action: row.action, details: { camposAlterados: row.changed_fields },
      before: row.before_data as AuditEntry["before"], after: row.after_data as AuditEntry["after"], source: "cloud",
    }));
  });
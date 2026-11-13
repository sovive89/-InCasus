import { getSession } from "@/lib/auth/session";
import { auditSchema, type AuditEntry } from "@/lib/services/audit";
const KEY = "incasus.audit.demo.v1";
export function readDemoAudit(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try { const result = auditSchema.array().safeParse(JSON.parse(localStorage.getItem(KEY) ?? "[]")); return result.success ? result.data : []; }
  catch { return []; }
}
export function recordDemoDocumentAction(entityId: string, action: string, details: Record<string, unknown>) {
  const entry: AuditEntry = { id: crypto.randomUUID(), actor: getSession()?.profile.name ?? "Sessão demonstrativa", occurredAt: new Date().toISOString(), entityType: "document", entityId, action, details, before: null, after: null, source: "demo" };
  localStorage.setItem(KEY, JSON.stringify([...readDemoAudit(), auditSchema.parse(entry)]));
}
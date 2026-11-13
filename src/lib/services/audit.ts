import { z } from "zod";
export const auditSchema = z.object({
  id: z.string(), actor: z.string().min(1), occurredAt: z.string().datetime(),
  entityType: z.enum(["process", "document", "permission"]), entityId: z.string(),
  action: z.string().min(1), details: z.record(z.string(), z.unknown()),
  before: z.record(z.string(), z.unknown()).nullable(), after: z.record(z.string(), z.unknown()).nullable(),
  source: z.enum(["demo", "cloud"]),
});
export type AuditEntry = z.infer<typeof auditSchema>;
export function filterAudit(entries: AuditEntry[], filters: { entityType: string; search: string; from: string; to: string }) {
  const query = filters.search.trim().toLocaleLowerCase("pt-BR");
  return entries.filter((entry) => (!filters.entityType || entry.entityType === filters.entityType)
    && (!filters.from || entry.occurredAt.slice(0, 10) >= filters.from)
    && (!filters.to || entry.occurredAt.slice(0, 10) <= filters.to)
    && (!query || `${entry.actor} ${entry.action} ${entry.entityId} ${JSON.stringify(entry.details)}`.toLocaleLowerCase("pt-BR").includes(query)))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
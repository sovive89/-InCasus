import { test } from "node:test";
import assert from "node:assert/strict";
import { auditSchema, filterAudit, type AuditEntry } from "./audit";
const entry: AuditEntry = { id: "a-1", actor: "Ricardo Ferreira", occurredAt: "2026-11-13T00:22:00.000Z", entityType: "process", entityId: "p-1", action: "update", details: { subject: "Guarda" }, before: { status: "active" }, after: { status: "closed" }, source: "cloud" };
test("auditoria exige usuário e data válida", () => {
  assert.equal(auditSchema.safeParse({ ...entry, actor: "" }).success, false);
  assert.equal(auditSchema.safeParse({ ...entry, occurredAt: "invalid" }).success, false);
  assert.equal(auditSchema.parse(entry).actor, "Ricardo Ferreira");
});
test("processos, documentos e permissões são auditáveis", () => {
  for (const entityType of ["process", "document", "permission", "calendar"]) assert.equal(auditSchema.safeParse({ ...entry, entityType }).success, true);
});
test("detalhes preservam valores anteriores e novos", () => {
  const result = auditSchema.parse(entry);
  assert.equal(result.before?.['status'], "active"); assert.equal(result.after?.['status'], "closed");
});
test("filtros combinam usuário, período e recurso", () => {
  assert.equal(filterAudit([entry], { entityType: "process", search: "Ricardo", from: "2026-11-13", to: "2026-11-13" }).length, 1);
  assert.equal(filterAudit([entry], { entityType: "document", search: "", from: "", to: "" }).length, 0);
  assert.equal(filterAudit([entry], { entityType: "", search: "", from: "2026-11-14", to: "" }).length, 0);
});
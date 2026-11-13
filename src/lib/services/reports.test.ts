import { test } from "node:test";
import assert from "node:assert/strict";
import { filterReportRows, reportFiltersSchema, type ReportRow, type ReportFilters } from "./reports";
const rows: ReportRow[] = [
 { id: "p-1", section: "process", title: "Processo", clientId: "c-1", client: "Maria", date: "2026-11-13T10:00:00", responsible: "Ricardo", kind: "Guarda", details: "" },
 { id: "a-1", section: "activity", title: "Audiência", clientId: "c-2", client: "Ana", date: "2026-11-14T18:00:00", responsible: "Helena", kind: "Audiência", details: "" },
];
const filters: ReportFilters = { clientId: "", responsible: "", from: "", to: "", type: "all" };
test("filtro por cliente exclui outros clientes", () => assert.deepEqual(filterReportRows(rows, { ...filters, clientId: "c-1" }).map((row) => row.id), ["p-1"]));
test("período inclui os dois limites", () => assert.equal(filterReportRows(rows, { ...filters, from: "2026-11-13", to: "2026-11-14" }).length, 2));
test("período exclui registros posteriores", () => assert.equal(filterReportRows(rows, { ...filters, to: "2026-11-13" }).length, 1));
test("filtro de responsável não inclui outro usuário", () => assert.deepEqual(filterReportRows(rows, { ...filters, responsible: "Ricardo" }).map((row) => row.id), ["p-1"]));
test("tipo atividades exclui processos", () => assert.deepEqual(filterReportRows(rows, { ...filters, type: "activity" }).map((row) => row.id), ["a-1"]));
test("período invertido é rejeitado", () => assert.equal(reportFiltersSchema.safeParse({ ...filters, from: "2026-11-15", to: "2026-11-13" }).success, false));
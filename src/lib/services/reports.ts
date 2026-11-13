import { format } from "date-fns";
import { z } from "zod";
import { aiRepository, clientRepository, processRepository, taskRepository } from "@/lib/repositories";
import { calendarRepository } from "@/lib/repositories/calendar";
import { eventKinds } from "./calendar";

export type ReportRow = { id: string; section: "process" | "activity"; title: string; clientId: string; client: string; date: string; responsible: string; kind: string; details: string };
export const reportFiltersSchema = z.object({
  clientId: z.string(), responsible: z.string(), from: z.string(), to: z.string(),
  type: z.enum(["all", "process", "activity"]),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: "A data final deve ser igual ou posterior à inicial." });
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
const clientName = (id: string) => clientRepository.byId(id)?.name ?? "Escritório";
export function getReportRows(): ReportRow[] {
  return [
    ...processRepository.list().map((item): ReportRow => ({ id: item.id, section: "process", title: item.cnj, clientId: item.clientId, client: clientName(item.clientId), date: item.lastMovementAt, responsible: "Não atribuído", kind: item.className, details: `${item.court}\n${item.subject}\nÚltima movimentação: ${item.lastMovement}` })),
    ...calendarRepository.list().map((item): ReportRow => ({ id: `calendar-${item.id}`, section: "activity", title: item.title, clientId: item.clientId, client: clientName(item.clientId), date: item.startsAt, responsible: item.responsible, kind: eventKinds[item.kind], details: [item.location, item.notes].filter(Boolean).join("\n") })),
    ...taskRepository.list().map((item): ReportRow => ({ id: item.id, section: "activity", title: item.title, clientId: item.clientId ?? "", client: clientName(item.clientId ?? ""), date: item.dueAt, responsible: "Não atribuído", kind: "Tarefa", details: item.done ? "Concluída" : "Pendente" })),
    ...aiRepository.actions().map((item): ReportRow => ({ id: item.id, section: "activity", title: item.title, clientId: item.clientId ?? "", client: clientName(item.clientId ?? ""), date: item.createdAt, responsible: "Assistente IA", kind: "Atividade de IA", details: item.summary })),
  ];
}
export function filterReportRows(rows: ReportRow[], filters: ReportFilters) {
  reportFiltersSchema.parse(filters);
  return rows.filter((row) => {
    const day = format(new Date(row.date), "yyyy-MM-dd");
    return (!filters.clientId || row.clientId === filters.clientId)
      && (!filters.responsible || row.responsible === filters.responsible)
      && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)
      && (filters.type === "all" || row.section === filters.type);
  }).sort((a, b) => b.date.localeCompare(a.date));
}
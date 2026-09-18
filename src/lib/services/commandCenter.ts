import {
  appointmentRepository,
  caseRepository,
  clientRepository,
  documentRepository,
  processRepository,
  taskRepository,
} from "../repositories";
import type { AttentionLevel } from "../domain/types";

export type AttentionItem = {
  id: string;
  level: AttentionLevel;
  title: string;
  detail: string;
  context: string;
  href?: { to: string; params?: Record<string, string> };
};

const isSameDay = (iso: string, ref = new Date()) => {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
};

/** Regras de negócio do Command Center: "o que precisa da minha atenção?". */
export function getAttentionItems(): AttentionItem[] {
  const now = new Date();
  const items: AttentionItem[] = [];

  for (const p of processRepository.list()) {
    if (p.attention === "critical" || p.attention === "important") {
      const client = clientRepository.byId(p.clientId);
      items.push({
        id: `process-${p.id}`,
        level: p.attention,
        title: p.lastMovement,
        detail: `${p.className} · ${p.cnj}`,
        context: client?.name ?? "Cliente",
        href: { to: "/advogado/processos/$id", params: { id: p.id } },
      });
    }
  }

  for (const t of taskRepository.list()) {
    if (!t.done && new Date(t.dueAt) < now) {
      items.push({
        id: `task-${t.id}`,
        level: "critical",
        title: `Tarefa atrasada: ${t.title}`,
        detail: "Prazo vencido",
        context: t.clientId ? (clientRepository.byId(t.clientId)?.name ?? "") : "Escritório",
      });
    }
  }

  for (const d of documentRepository.list()) {
    if (d.analysisStatus === "pending") {
      items.push({
        id: `doc-${d.id}`,
        level: "followup",
        title: `Documento pendente de análise: ${d.name}`,
        detail: "Aguardando processamento",
        context: clientRepository.byId(d.clientId)?.name ?? "",
      });
    }
  }

  for (const c of clientRepository.list()) {
    if (c.status === "waiting") {
      items.push({
        id: `client-${c.id}`,
        level: "important",
        title: `${c.name} aguarda retorno`,
        detail: c.nextActivity,
        context: "Atendimento",
        href: { to: "/advogado/clientes/$id", params: { id: c.id } },
      });
    }
  }

  for (const a of appointmentRepository.list()) {
    if (isSameDay(a.startsAt)) {
      items.push({
        id: `appt-${a.id}`,
        level: "info",
        title: `Compromisso hoje: ${a.title}`,
        detail: a.location,
        context: clientRepository.byId(a.clientId)?.name ?? "",
      });
    }
  }

  const order: AttentionLevel[] = ["critical", "important", "followup", "info"];
  return items.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
}

export function getTodayAgenda() {
  return appointmentRepository.list().filter((a) => isSameDay(a.startsAt));
}

export function getUpcomingAgenda() {
  return appointmentRepository.list().filter((a) => !isSameDay(a.startsAt) && new Date(a.startsAt) > new Date());
}

export function getClientSummary() {
  const list = clientRepository.list();
  return {
    total: list.length,
    novos: list.filter((c) => c.status === "new").length,
    ativos: list.filter((c) => c.status === "active").length,
    aguardando: list.filter((c) => c.status === "waiting").length,
    pendencias: list.filter((c) => c.status === "pending").length,
  };
}

export function getCaseSummary() {
  const list = caseRepository.list();
  return {
    total: list.length,
    criticos: list.filter((c) => c.priority === "critical").length,
  };
}

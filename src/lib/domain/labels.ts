import type {
  AttentionLevel,
  CaseStatus,
  ClientStatus,
  DocumentCategory,
  AnalysisStatus,
  DraftStatus,
} from "./types";

export const attentionLabel: Record<AttentionLevel, string> = {
  critical: "Crítico",
  important: "Importante",
  followup: "Acompanhamento",
  info: "Informativo",
};

export const attentionClass: Record<AttentionLevel, string> = {
  critical: "bg-critical/15 text-critical border-critical/30",
  important: "bg-important/15 text-important border-important/30",
  followup: "bg-followup/15 text-followup border-followup/30",
  info: "bg-muted text-muted-foreground border-border",
};

export const attentionDot: Record<AttentionLevel, string> = {
  critical: "bg-critical",
  important: "bg-important",
  followup: "bg-followup",
  info: "bg-muted-foreground",
};

export const clientStatusLabel: Record<ClientStatus, string> = {
  new: "Novo",
  active: "Ativo",
  waiting: "Aguardando resposta",
  pending: "Com pendência",
};

export const caseStatusLabel: Record<CaseStatus, string> = {
  intake: "Em triagem",
  active: "Ativo",
  negotiation: "Negociação",
  judicial: "Judicial",
  closed: "Encerrado",
};

export const documentCategoryLabel: Record<DocumentCategory, string> = {
  peticoes: "Petições",
  decisoes: "Decisões",
  contratos: "Contratos",
  pessoais: "Documentos pessoais",
  comprovantes: "Comprovantes",
  outros: "Outros",
};

export const analysisStatusLabel: Record<AnalysisStatus, string> = {
  pending: "Aguardando análise",
  processing: "Em análise",
  analyzed: "Analisado",
  review: "Revisão do advogado",
};

export const draftStatusLabel: Record<DraftStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  reviewed: "Revisada",
  final: "Finalizada",
};

export const AI_DISCLAIMER = "Análise assistida por IA — revisão profissional necessária.";
export const CLIENT_DISCLAIMER =
  "Informações fornecidas pelo assistente estão sujeitas à revisão do advogado responsável.";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string) {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

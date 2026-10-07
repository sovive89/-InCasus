/**
 * Regras de status — a "máquina de estados" do envelope.
 *
 * Conceito: webhooks podem chegar fora de ordem ou repetidos. Em vez de aceitar tudo,
 * só permitimos transições que fazem sentido (ex.: um envelope ASSINADO nunca volta a
 * "VISUALIZADO"). Eventos que contradizem o estado atual são registrados, mas não aplicados.
 */
import type { EnvelopeStatus, SignatureEventType, SignerStatus } from "./types";

const TRANSITIONS: Record<EnvelopeStatus, EnvelopeStatus[]> = {
  DRAFT: ["PREPARING", "CANCELLED", "ERROR"],
  PREPARING: ["PENDING", "SENT", "ERROR", "CANCELLED"],
  PENDING: [
    "SENT",
    "VIEWED",
    "PARTIALLY_SIGNED",
    "SIGNED",
    "DECLINED",
    "EXPIRED",
    "CANCELLED",
    "ERROR",
  ],
  SENT: ["VIEWED", "PARTIALLY_SIGNED", "SIGNED", "DECLINED", "EXPIRED", "CANCELLED", "ERROR"],
  VIEWED: ["PARTIALLY_SIGNED", "SIGNED", "DECLINED", "EXPIRED", "CANCELLED", "ERROR"],
  PARTIALLY_SIGNED: ["SIGNED", "DECLINED", "EXPIRED", "CANCELLED", "ERROR"],
  ERROR: ["PREPARING", "CANCELLED"],
  SIGNED: [],
  DECLINED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export const TERMINAL_STATUSES: EnvelopeStatus[] = ["SIGNED", "DECLINED", "EXPIRED", "CANCELLED"];

export function canTransition(from: EnvelopeStatus, to: EnvelopeStatus): boolean {
  return from === to ? false : TRANSITIONS[from].includes(to);
}

export function isTerminal(status: EnvelopeStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canCancel(status: EnvelopeStatus): boolean {
  return !isTerminal(status);
}

export function canRemind(status: EnvelopeStatus): boolean {
  return status === "SENT" || status === "VIEWED" || status === "PARTIALLY_SIGNED";
}

/** Estado do envelope deduzido do estado de cada signatário. */
export function deriveEnvelopeStatus(
  current: EnvelopeStatus,
  signers: { status: SignerStatus }[],
): EnvelopeStatus {
  if (signers.length === 0) return current;
  const has = (s: SignerStatus) => signers.some((x) => x.status === s);
  if (has("DECLINED")) return "DECLINED";
  if (signers.every((x) => x.status === "SIGNED")) return "SIGNED";
  if (has("EXPIRED")) return "EXPIRED";
  if (has("SIGNED")) return "PARTIALLY_SIGNED";
  if (has("VIEWED")) return "VIEWED";
  if (has("SENT")) return "SENT";
  return current;
}

/** Qual status do signatário resulta de cada evento. */
export function signerStatusForEvent(type: SignatureEventType): SignerStatus | null {
  switch (type) {
    case "SIGNATURE_REQUESTED":
      return "SENT";
    case "DOCUMENT_VIEWED":
      return "VIEWED";
    case "SIGNER_SIGNED":
      return "SIGNED";
    case "SIGNATURE_DECLINED":
      return "DECLINED";
    case "SIGNATURE_EXPIRED":
      return "EXPIRED";
    default:
      return null;
  }
}

/** Ordem de "progresso" do signatário: impede regressão (ex.: SIGNED → VIEWED). */
const SIGNER_RANK: Record<SignerStatus, number> = {
  PENDING: 0,
  SENT: 1,
  VIEWED: 2,
  SIGNED: 3,
  DECLINED: 3,
  EXPIRED: 3,
};
export function signerCanAdvance(from: SignerStatus, to: SignerStatus): boolean {
  return SIGNER_RANK[to] > SIGNER_RANK[from];
}

export const STATUS_LABEL: Record<EnvelopeStatus, string> = {
  DRAFT: "Rascunho",
  PREPARING: "Preparando",
  PENDING: "Pendente",
  SENT: "Aguardando assinatura",
  VIEWED: "Visualizado",
  PARTIALLY_SIGNED: "Parcialmente assinado",
  SIGNED: "Documento assinado",
  DECLINED: "Recusado",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  ERROR: "Erro",
};

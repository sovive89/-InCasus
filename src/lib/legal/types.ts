/**
 * Modelo interno de dados jurídicos — independente de fornecedor.
 *
 * Conceito: cada fornecedor (DataJud, Escavador, Jusbrasil...) devolve os dados
 * num formato próprio. Os "providers" traduzem para estes tipos, e o resto do
 * app só conhece estes tipos. Assim dá para trocar ou combinar fornecedores
 * sem mexer nas telas.
 */

export type ProviderId = "datajud" | "escavador" | "jusbrasil";

/** 'economy' = só cache + fontes gratuitas; 'full' = pagos entram como fallback. */
export type IntegrationMode = "economy" | "full";

export type LegalOperation =
  | "PROCESS_DETAILS"
  | "MOVEMENTS"
  | "DOCUMENTS"
  | "FIND_BY_LAWYER"
  | "MONITORING";

export type LegalErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "NOT_SUPPORTED"
  | "RATE_LIMITED"
  | "AUTHENTICATION_ERROR"
  | "NOT_FOUND"
  | "PAYMENT_REQUIRED"
  | "INVALID_INPUT"
  | "SECRECY_RESTRICTED";

export class LegalDataError extends Error {
  constructor(
    readonly code: LegalErrorCode,
    message: string,
    readonly provider?: ProviderId,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "LegalDataError";
  }
}

export type NormalizedParty = {
  name: string;
  document: string | null;
  type: string | null;
  role: string | null;
};

export type NormalizedMovement = {
  externalId: string | null;
  code: string | null;
  title: string;
  description: string;
  date: string; // ISO 8601
};

export type NormalizedProcess = {
  cnj: string; // NNNNNNN-DD.AAAA.J.TR.OOOO
  tribunal: string;
  court: string;
  degree: string | null;
  className: string;
  classCode: number | null;
  subject: string;
  jurisdiction: string | null;
  judge: string | null;
  status: string | null;
  distributionDate: string | null;
  secrecyLevel: number;
  lastMovementAt: string | null;
  parties: NormalizedParty[];
};

/** Resultado de um provider para um processo: dados + movimentações + procedência. */
export type ProviderProcessResult = {
  provider: ProviderId;
  externalId: string | null;
  rawHash: string;
  process: NormalizedProcess;
  movements: NormalizedMovement[];
};

/**
 * Contrato de todo fornecedor. Cada um implementa só o que suporta;
 * o resto lança LegalDataError("NOT_SUPPORTED") e o roteador tenta o próximo.
 */
export interface LegalDataProvider {
  readonly id: ProviderId;
  /** Fornecedores pagos só entram no modo 'full'. */
  readonly paid: boolean;
  /** true quando as credenciais necessárias existem no servidor. */
  isConfigured(): boolean;
  supports(operation: LegalOperation): boolean;
  getProcess(cnj: string): Promise<ProviderProcessResult>;
}

/** O que a tela recebe. */
export type LegalProcessView = {
  process: NormalizedProcess & { lastSyncAt: string | null };
  movements: (NormalizedMovement & { provider: ProviderId })[];
  source: "cache" | ProviderId;
  /** true quando o cache venceu e nenhuma fonte respondeu (dado antigo, mas melhor que nada). */
  stale: boolean;
};

export type LegalLookupResponse =
  | { ok: true; data: LegalProcessView }
  | { ok: false; code: LegalErrorCode; message: string };

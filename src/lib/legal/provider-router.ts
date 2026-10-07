/**
 * Roteador de provedores.
 *
 * Conceito: para cada operação existe uma ordem de preferência (gratuitos antes
 * de pagos). O roteador percorre a lista, pula quem não está ligado/configurado/
 * não suporta a operação, e só passa ao próximo quando o anterior falha por
 * motivo "contornável" (indisponível, limite, não achou, não suportado).
 * Modo econômico = provedores pagos nunca são chamados.
 */
import {
  LegalDataError,
  type IntegrationMode,
  type LegalDataProvider,
  type LegalOperation,
  type ProviderId,
  type ProviderProcessResult,
} from "./types";

/** Ordem padrão por operação (a prioridade do painel pode reordenar). */
export const DEFAULT_PRIORITY: Record<LegalOperation, ProviderId[]> = {
  PROCESS_DETAILS: ["datajud", "escavador", "jusbrasil"],
  MOVEMENTS: ["datajud", "escavador", "jusbrasil"],
  DOCUMENTS: ["escavador", "jusbrasil"],
  FIND_BY_LAWYER: ["datajud", "escavador", "jusbrasil"],
  MONITORING: ["escavador", "jusbrasil"],
};

const FALLBACK_ON = new Set([
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
  "NOT_FOUND",
  "NOT_SUPPORTED",
  "AUTHENTICATION_ERROR",
  "PAYMENT_REQUIRED",
]);

export type RouterSettings = {
  mode: IntegrationMode;
  /** provider → habilitado e prioridade (menor = primeiro) */
  providers: Partial<Record<ProviderId, { enabled: boolean; priority: number }>>;
};

export type AttemptLog = {
  provider: ProviderId;
  operation: LegalOperation;
  success: boolean;
  errorCode?: string;
  statusCode?: number;
  durationMs: number;
  estimatedCost: number;
};

export class ProviderRouter {
  constructor(
    private readonly providers: LegalDataProvider[],
    private readonly settings: RouterSettings,
    private readonly onAttempt: (log: AttemptLog) => void = () => {},
  ) {}

  candidates(operation: LegalOperation): LegalDataProvider[] {
    const base = DEFAULT_PRIORITY[operation];
    return this.providers
      .filter((p) => base.includes(p.id))
      .filter((p) => this.settings.providers[p.id]?.enabled ?? !p.paid)
      .filter((p) => this.settings.mode === "full" || !p.paid)
      .filter((p) => p.supports(operation) && p.isConfigured())
      .sort((a, b) => {
        const pa = this.settings.providers[a.id]?.priority ?? base.indexOf(a.id) * 10;
        const pb = this.settings.providers[b.id]?.priority ?? base.indexOf(b.id) * 10;
        return pa - pb;
      });
  }

  async getProcess(cnj: string, operation: LegalOperation = "PROCESS_DETAILS"): Promise<ProviderProcessResult> {
    const list = this.candidates(operation);
    if (list.length === 0) {
      throw new LegalDataError(
        "PROVIDER_UNAVAILABLE",
        this.settings.mode === "economy"
          ? "Nenhuma fonte gratuita disponível. Configure o DataJud ou ative o modo completo."
          : "Nenhuma fonte de dados jurídicos configurada.",
      );
    }
    let last: LegalDataError | undefined;
    for (const provider of list) {
      const started = Date.now();
      try {
        const result = await provider.getProcess(cnj);
        this.onAttempt({
          provider: provider.id,
          operation,
          success: true,
          durationMs: Date.now() - started,
          estimatedCost: provider.paid ? 1 : 0, // custo real por provedor entra na fase 4
        });
        return result;
      } catch (err) {
        const e =
          err instanceof LegalDataError
            ? err
            : new LegalDataError("PROVIDER_UNAVAILABLE", "Falha inesperada no provedor.", provider.id);
        this.onAttempt({
          provider: provider.id,
          operation,
          success: false,
          errorCode: e.code,
          ...(e.statusCode !== undefined ? { statusCode: e.statusCode } : {}),
          durationMs: Date.now() - started,
          estimatedCost: 0,
        });
        last = e;
        if (!FALLBACK_ON.has(e.code)) throw e;
      }
    }
    throw last!;
  }
}

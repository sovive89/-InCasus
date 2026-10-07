/**
 * LegalDataService — ÚNICA porta de entrada das telas para dados jurídicos.
 *
 * Fluxo de uma consulta por CNJ:
 *   valida CNJ → cache fresco? devolve (custo zero)
 *             → senão ProviderRouter (DataJud primeiro; pagos só no modo completo)
 *             → processo sigiloso? recusa e NÃO grava
 *             → grava normalizado + deduplicado + procedência → concede acesso ao advogado
 * Se nenhuma fonte responder mas existir cache antigo, devolve o antigo marcado como "stale".
 */
import { normalizeCnj } from "./cnj";
import { dedupeMovements } from "./dedup";
import { ProviderRouter, type AttemptLog, type RouterSettings } from "./provider-router";
import {
  LegalDataError,
  type LegalDataProvider,
  type LegalProcessView,
  type ProviderProcessResult,
} from "./types";

export const CACHE_TTL_MS = {
  PROCESS_DETAILS: 6 * 60 * 60 * 1000, // 6 h
} as const;

export type CachedProcess = Omit<LegalProcessView, "source" | "stale">;

export interface LegalStore {
  loadSettings(): Promise<RouterSettings>;
  findCached(cnj: string): Promise<CachedProcess | null>;
  /** Grava processo + movimentações novas (ignora duplicatas) + procedência. */
  save(result: ProviderProcessResult): Promise<{ lastSyncAt: string }>;
  grantAccess(cnj: string, userId: string): Promise<void>;
  logRequest(entry: {
    userId: string;
    cnj: string | null;
    provider: string;
    operation: string;
    success: boolean;
    cached: boolean;
    errorCode?: string;
    statusCode?: number;
    durationMs: number;
    estimatedCost: number;
  }): Promise<void>;
  recordProviderStatus(provider: string, error: string | null): Promise<void>;
}

export class LegalDataService {
  constructor(
    private readonly store: LegalStore,
    private readonly providers: LegalDataProvider[],
    private readonly now: () => number = Date.now,
  ) {}

  async getProcessByCnj(cnjInput: string, userId: string): Promise<LegalProcessView> {
    const cnj = normalizeCnj(cnjInput);
    const cached = await this.store.findCached(cnj);
    const isFresh =
      cached?.process.lastSyncAt != null &&
      this.now() - new Date(cached.process.lastSyncAt).getTime() < CACHE_TTL_MS.PROCESS_DETAILS;

    if (cached && isFresh) {
      await this.store.grantAccess(cnj, userId);
      await this.store.logRequest({
        userId, cnj, provider: "cache", operation: "PROCESS_DETAILS",
        success: true, cached: true, durationMs: 0, estimatedCost: 0,
      });
      return { ...cached, source: "cache", stale: false };
    }

    const settings = await this.store.loadSettings();
    const attempts: AttemptLog[] = [];
    const router = new ProviderRouter(this.providers, settings, (a) => attempts.push(a));

    try {
      const result = await router.getProcess(cnj);
      if (result.process.secrecyLevel > 0) {
        throw new LegalDataError(
          "SECRECY_RESTRICTED",
          "Processo em segredo de justiça: não é tratado como público e não foi armazenado.",
          result.provider,
        );
      }
      result.movements = await dedupeMovements(result.movements);
      const { lastSyncAt } = await this.store.save(result);
      await this.store.grantAccess(cnj, userId);
      await this.store.recordProviderStatus(result.provider, null);
      return {
        process: { ...result.process, lastSyncAt },
        movements: result.movements.map((m) => ({ ...m, provider: result.provider })),
        source: result.provider,
        stale: false,
      };
    } catch (err) {
      const e = err instanceof LegalDataError ? err : new LegalDataError("PROVIDER_UNAVAILABLE", "Falha ao consultar fontes jurídicas.");
      const last = attempts[attempts.length - 1];
      if (last && !last.success) await this.store.recordProviderStatus(last.provider, e.message);
      if (cached && ["PROVIDER_UNAVAILABLE", "RATE_LIMITED", "AUTHENTICATION_ERROR", "NOT_SUPPORTED"].includes(e.code)) {
        await this.store.grantAccess(cnj, userId);
        return { ...cached, source: "cache", stale: true };
      }
      throw e;
    } finally {
      for (const a of attempts) {
        await this.store.logRequest({
          userId, cnj, provider: a.provider, operation: a.operation, success: a.success, cached: false,
          ...(a.errorCode ? { errorCode: a.errorCode } : {}),
          ...(a.statusCode !== undefined ? { statusCode: a.statusCode } : {}),
          durationMs: a.durationMs, estimatedCost: a.estimatedCost,
        }).catch(() => {}); // auditoria nunca derruba a consulta
      }
    }
  }
}

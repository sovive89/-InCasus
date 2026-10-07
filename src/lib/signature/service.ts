/**
 * SignatureService — única porta de entrada para tudo que é assinatura.
 *
 * Fluxo: InCasus → SignatureService → SignatureProviderRouter → SignatureProvider.
 * Nenhuma tela chama API de fornecedor; nenhuma regra de negócio conhece endpoints.
 * O serviço NÃO cuida de documentos/Storage dos casos (DocumentService), nem de
 * processos (LegalDataService), nem de entregar notificações (NotificationService).
 */
import { sha256 } from "../legal/dedup";
import { descriptorFor } from "./catalog";
import type { ProviderRegistry } from "./catalog";
import { SignatureProviderRouter } from "./router";
import {
  canCancel,
  canRemind,
  canTransition,
  deriveEnvelopeStatus,
  isTerminal,
  signerCanAdvance,
  signerStatusForEvent,
} from "./status";
import type { EnvelopeRecord, SignatureNotifier, SignatureStore, SignerRecord } from "./store";
import {
  SignatureError,
  type Environment,
  type NormalizedWebhookEvent,
  type ProviderContext,
  type ProviderDocumentInput,
  type ProviderSettingsView,
  type SignatureEventType,
  type SignatureLevel,
  type SignatureProviderId,
  type SignerInput,
  type WebhookRequest,
} from "./types";

/** SHA-256 dos bytes do arquivo — integridade e auditoria. */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type CreateEnvelopeInput = {
  officeId: string;
  userId: string;
  title: string;
  message?: string | undefined;
  level: SignatureLevel;
  sequential?: boolean | undefined;
  expiresAt?: string | null | undefined;
  clientId?: string | null | undefined;
  caseId?: string | null | undefined;
  processId?: string | null | undefined;
  /** Provedor escolhido explicitamente; senão usa o padrão do escritório. */
  provider?: SignatureProviderId | undefined;
  signers: SignerInput[];
};

export type ProviderSettingsPatch = {
  enabled?: boolean | undefined;
  environment?: Environment | undefined;
  makeDefault?: boolean | undefined;
  /** Valores digitados pelo administrador. Campos omitidos/vazios mantêm o que já existe. */
  secrets?: Record<string, string> | undefined;
  config?: Record<string, unknown> | undefined;
};

const NOTIFY: Partial<
  Record<
    SignatureEventType,
    { title: string; level: "critical" | "important" | "followup" | "info" }
  >
> = {
  DOCUMENT_VIEWED: { title: "Documento visualizado", level: "info" },
  SIGNER_SIGNED: { title: "Signatário assinou", level: "followup" },
  SIGNATURE_COMPLETED: { title: "Documento assinado", level: "important" },
  SIGNATURE_DECLINED: { title: "Assinatura recusada", level: "critical" },
  SIGNATURE_EXPIRED: { title: "Assinatura expirada", level: "important" },
  SIGNATURE_CANCELLED: { title: "Assinatura cancelada", level: "info" },
  SIGNATURE_ERROR: { title: "Erro na assinatura", level: "critical" },
};

export class SignatureService {
  readonly router: SignatureProviderRouter;

  constructor(
    private readonly store: SignatureStore,
    private readonly registry: ProviderRegistry,
    private readonly notifier: SignatureNotifier,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.router = new SignatureProviderRouter(registry, (officeId) => store.listSettings(officeId));
  }

  // ---------------------------------------------------------------- Configuração

  listProviders(officeId: string): Promise<ProviderSettingsView[]> {
    return this.router.listProviders(officeId);
  }

  async saveProviderSettings(
    officeId: string,
    userId: string,
    provider: SignatureProviderId,
    patch: ProviderSettingsPatch,
  ): Promise<void> {
    const descriptor = descriptorFor(provider, this.registry);
    if (!descriptor) throw new SignatureError("NOT_FOUND", "Provedor desconhecido.");
    if (!descriptor.implemented) {
      throw new SignatureError(
        "PROVIDER_NOT_IMPLEMENTED",
        `${descriptor.name} ainda não está disponível.`,
        provider,
      );
    }
    if (patch.environment === "sandbox" && !descriptor.capabilities.sandbox) {
      throw new SignatureError(
        "NOT_SUPPORTED",
        `${descriptor.name} não oferece sandbox.`,
        provider,
      );
    }
    const allowed = new Set(descriptor.fields.filter((f) => f.secret).map((f) => f.key));
    const secrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(patch.secrets ?? {})) {
      if (!allowed.has(key))
        throw new SignatureError("INVALID_INPUT", `Campo desconhecido: ${key}.`, provider);
      if (value.trim()) secrets[key] = value.trim();
    }
    if (Object.keys(secrets).length > 0)
      await this.store.saveCredentials(officeId, provider, secrets, userId);

    const base: { enabled?: boolean; environment?: Environment; config?: Record<string, unknown> } =
      {};
    if (patch.enabled !== undefined) base.enabled = patch.enabled;
    if (patch.environment !== undefined) base.environment = patch.environment;
    if (patch.config !== undefined) base.config = patch.config;
    if (Object.keys(base).length > 0)
      await this.store.patchSetting(officeId, provider, base, userId);

    if (patch.makeDefault) {
      const current = (await this.store.listSettings(officeId)).find(
        (s) => s.provider === provider,
      );
      const willBeEnabled = patch.enabled ?? current?.enabled ?? false;
      if (!willBeEnabled)
        throw new SignatureError(
          "PROVIDER_DISABLED",
          "Ative o provedor antes de torná-lo padrão.",
          provider,
        );
      await this.store.setDefault(officeId, provider, userId);
    }
    if (patch.enabled === false) await this.store.clearDefault(officeId, provider);
  }

  async testConnection(
    officeId: string,
    provider: SignatureProviderId,
  ): Promise<{ ok: boolean; message: string }> {
    const impl = this.registry.get(provider);
    if (!impl || !impl.descriptor.implemented) {
      return {
        ok: false,
        message: impl?.descriptor.availabilityNote ?? "Provedor ainda não disponível.",
      };
    }
    const settings = (await this.store.listSettings(officeId)).find((s) => s.provider === provider);
    const credentials = await this.store.getCredentials(officeId, provider);
    if (!credentials) return { ok: false, message: "Informe as credenciais antes de testar." };
    const ctx: ProviderContext = {
      environment: settings?.environment ?? "sandbox",
      credentials,
      config: {},
    };
    const started = Date.now();
    try {
      const result = await impl.testConnection(ctx);
      await this.store.recordConnection(officeId, provider, {
        ok: result.ok,
        error: result.ok ? null : result.message,
      });
      await this.store.addUsage({
        officeId,
        envelopeId: null,
        userId: null,
        provider,
        operation: "testConnection",
        success: result.ok,
        durationMs: Date.now() - started,
        estimatedCost: 0,
      });
      return result.ok ? { ok: true, message: "Conexão estabelecida." } : result;
    } catch (err) {
      const message = this.safeMessage(err);
      await this.store.recordConnection(officeId, provider, { ok: false, error: message });
      return { ok: false, message };
    }
  }

  // ---------------------------------------------------------------- Envelopes

  /** Cria o rascunho: valida regras, escolhe o provedor e grava com auditoria. Nada sai do InCasus ainda. */
  async createDraft(
    input: CreateEnvelopeInput,
  ): Promise<{ envelope: EnvelopeRecord; signers: SignerRecord[] }> {
    if (!input.title.trim()) throw new SignatureError("INVALID_INPUT", "Informe um título.");
    const requirements = {
      level: input.level,
      sequential: input.sequential ?? false,
    };
    const resolved = await this.router.resolveForNew(input.officeId, requirements, input.provider);
    this.validateSigners(
      input.signers,
      input.level,
      resolved.provider.descriptor.requiresDocumentNumberFor,
      resolved.provider.descriptor.id,
    );

    const envelope = await this.store.insertEnvelope({
      officeId: input.officeId,
      createdBy: input.userId,
      clientId: input.clientId ?? null,
      caseId: input.caseId ?? null,
      processId: input.processId ?? null,
      provider: resolved.provider.descriptor.id,
      environment: resolved.environment,
      title: input.title.trim(),
      message: input.message?.trim() ?? "",
      level: input.level,
      sequential: input.sequential ?? false,
      expiresAt: input.expiresAt ?? null,
    });
    const signers = await this.store.insertSigners(
      envelope.id,
      input.officeId,
      input.signers.map((s) => ({
        clientId: s.clientId ?? null,
        profileId: s.profileId ?? null,
        name: s.name.trim(),
        email: s.email?.trim() || null,
        phone: s.phone?.trim() || null,
        role: s.role,
        documentNumber: s.documentNumber?.trim() || null,
        order: s.order,
        envelopeId: envelope.id,
      })),
    );
    await this.audit(envelope, "ENVELOPE_CREATED", "USER", input.userId, {
      provider: envelope.provider,
    });
    for (const s of signers)
      await this.audit(envelope, "SIGNER_ADDED", "USER", input.userId, { role: s.role }, s.id);
    return { envelope, signers };
  }

  /**
   * Envia ao provedor. O documento original chega por `loadDocument` (DocumentService) —
   * este serviço nunca mexe no arquivo do caso, só guarda uma cópia imutável com hash.
   */
  async send(
    officeId: string,
    userId: string,
    envelopeId: string,
    loadDocument: () => Promise<ProviderDocumentInput>,
  ): Promise<EnvelopeRecord> {
    const found = await this.mustGet(officeId, envelopeId);
    if (found.envelope.status !== "DRAFT" && found.envelope.status !== "ERROR") {
      throw new SignatureError(
        "INVALID_TRANSITION",
        "Só rascunhos (ou envelopes com erro) podem ser enviados.",
      );
    }
    const { provider } = await this.router.resolveForExisting(officeId, found.envelope.provider);
    const ctx = await this.context(officeId, found.envelope.provider, found.envelope.environment);
    await this.store.updateEnvelope(envelopeId, { status: "PREPARING", errorMessage: null });
    try {
      const document = await loadDocument();
      await this.store.saveArtifact(
        officeId,
        envelopeId,
        "ORIGINAL",
        { name: document.name, mimeType: document.mimeType, content: document.content },
        { sha256: document.sha256 },
      );
      await this.audit(found.envelope, "DOCUMENT_PREPARED", "SYSTEM", userId, {
        sha256: document.sha256,
      });

      const created = await this.timed(found.envelope, userId, "createEnvelope", () =>
        provider.createEnvelope(ctx, {
          title: found.envelope.title,
          message: found.envelope.message,
          level: found.envelope.level,
          sequential: found.envelope.sequential,
          expiresAt: found.envelope.expiresAt,
          document,
          signers: found.signers.map((s) => ({
            name: s.name,
            email: s.email ?? undefined,
            phone: s.phone ?? undefined,
            role: s.role,
            documentNumber: s.documentNumber ?? undefined,
            order: s.order,
          })),
        }),
      );
      await this.store.updateEnvelope(envelopeId, { externalId: created.externalId });
      const sent = await this.timed(found.envelope, userId, "sendEnvelope", () =>
        provider.sendEnvelope(ctx, created.externalId),
      );
      await this.applyProviderState(found.envelope, found.signers, sent);
      await this.store.updateEnvelope(envelopeId, { sentAt: this.now().toISOString() });
      await this.audit(found.envelope, "SIGNATURE_REQUESTED", "SYSTEM", userId, {});
      await this.store.touchCommunication(officeId, found.envelope.provider);
    } catch (err) {
      const message = this.safeMessage(err);
      await this.store.updateEnvelope(envelopeId, { status: "ERROR", errorMessage: message });
      await this.audit(found.envelope, "SIGNATURE_ERROR", "SYSTEM", userId, { message });
      await this.notify(found.envelope, "SIGNATURE_ERROR", message);
      throw err instanceof SignatureError
        ? err
        : new SignatureError("PROVIDER_UNAVAILABLE", message, found.envelope.provider);
    }
    return (await this.mustGet(officeId, envelopeId)).envelope;
  }

  async cancel(officeId: string, userId: string, envelopeId: string): Promise<void> {
    const { envelope } = await this.mustGet(officeId, envelopeId);
    if (!canCancel(envelope.status))
      throw new SignatureError("INVALID_TRANSITION", "Este envelope não pode mais ser cancelado.");
    if (envelope.externalId) {
      const { provider } = await this.router.resolveForExisting(officeId, envelope.provider);
      const ctx = await this.context(officeId, envelope.provider, envelope.environment);
      await this.timed(envelope, userId, "cancelEnvelope", () =>
        provider.cancelEnvelope(ctx, envelope.externalId as string),
      );
    }
    await this.store.updateEnvelope(envelope.id, {
      status: "CANCELLED",
      cancelledAt: this.now().toISOString(),
    });
    await this.audit(envelope, "SIGNATURE_CANCELLED", "USER", userId, {});
  }

  async remind(
    officeId: string,
    userId: string,
    envelopeId: string,
    signerId?: string,
  ): Promise<void> {
    const { envelope, signers } = await this.mustGet(officeId, envelopeId);
    if (!canRemind(envelope.status) || !envelope.externalId) {
      throw new SignatureError(
        "INVALID_TRANSITION",
        "Lembretes só podem ser enviados a envelopes aguardando assinatura.",
      );
    }
    const target = signerId ? signers.find((s) => s.id === signerId) : undefined;
    const { provider } = await this.router.resolveForExisting(officeId, envelope.provider);
    if (!provider.descriptor.capabilities.reminders) {
      throw new SignatureError(
        "NOT_SUPPORTED",
        `${provider.descriptor.name} não oferece lembretes.`,
        envelope.provider,
      );
    }
    const ctx = await this.context(officeId, envelope.provider, envelope.environment);
    await this.timed(envelope, userId, "sendReminder", () =>
      provider.sendReminder(ctx, envelope.externalId as string, target?.externalId ?? null),
    );
    await this.audit(envelope, "REMINDER_SENT", "USER", userId, {}, target?.id);
  }

  async refresh(officeId: string, userId: string, envelopeId: string): Promise<EnvelopeRecord> {
    const found = await this.mustGet(officeId, envelopeId);
    if (!found.envelope.externalId || isTerminal(found.envelope.status)) return found.envelope;
    const { provider } = await this.router.resolveForExisting(officeId, found.envelope.provider);
    const ctx = await this.context(officeId, found.envelope.provider, found.envelope.environment);
    const state = await this.timed(found.envelope, userId, "getStatus", () =>
      provider.getStatus(ctx, found.envelope.externalId as string),
    );
    await this.applyProviderState(found.envelope, found.signers, state);
    return (await this.mustGet(officeId, envelopeId)).envelope;
  }

  // ---------------------------------------------------------------- Webhooks

  /**
   * provider → webhook → autenticidade → idempotência → normalização → atualização → auditoria → notificação.
   * Nunca confiamos no payload: quem valida é o próprio provider.parseWebhook.
   */
  async handleWebhook(
    officeId: string,
    providerId: SignatureProviderId,
    request: WebhookRequest,
  ): Promise<{ processed: number; duplicates: number; ignored: number }> {
    const impl = this.registry.get(providerId);
    if (!impl || !impl.descriptor.implemented) {
      throw new SignatureError(
        "PROVIDER_NOT_IMPLEMENTED",
        "Provedor sem integração de webhook.",
        providerId,
      );
    }
    const setting = (await this.store.listSettings(officeId)).find(
      (s) => s.provider === providerId,
    );
    if (!setting)
      throw new SignatureError("PROVIDER_NOT_CONFIGURED", "Provedor não configurado.", providerId);
    const ctx = await this.context(officeId, providerId, setting.environment);
    const events = await impl.parseWebhook(ctx, request); // lança INVALID_WEBHOOK se não for autêntico

    const result = { processed: 0, duplicates: 0, ignored: 0 };
    const payloadHash = await sha256(request.rawBody);
    for (const event of events) {
      const claim = await this.store.claimWebhookEvent(
        officeId,
        providerId,
        event.eventId,
        payloadHash,
      );
      if (claim === "duplicate") {
        result.duplicates++;
        continue;
      }
      const outcome = await this.applyWebhookEvent(officeId, providerId, event);
      await this.store.finishWebhookEvent(officeId, providerId, event.eventId, outcome);
      if (outcome === "applied") result.processed++;
      else result.ignored++;
    }
    await this.store.touchCommunication(officeId, providerId);
    return result;
  }

  private async applyWebhookEvent(
    officeId: string,
    providerId: SignatureProviderId,
    event: NormalizedWebhookEvent,
  ): Promise<"applied" | "unknown_envelope" | "stale"> {
    const found = await this.store.findEnvelopeByExternal(
      officeId,
      providerId,
      event.envelopeExternalId,
    );
    if (!found) return "unknown_envelope";
    const { envelope, signers } = found;

    const signer = signers.find(
      (s) =>
        (event.signerExternalId && s.externalId === event.signerExternalId) ||
        (event.signerEmail && s.email?.toLowerCase() === event.signerEmail.toLowerCase()),
    );
    const target = signerStatusForEvent(event.type);
    let changed = false;
    if (signer && target && signerCanAdvance(signer.status, target)) {
      signer.status = target;
      await this.store.updateSigner(signer.id, {
        status: target,
        ...(target === "SIGNED" ? { signedAt: event.occurredAt } : {}),
      });
      changed = true;
    }

    // Eventos de nível de envelope (cancelamento/erro/expiração) valem mesmo sem signatário.
    let next = deriveEnvelopeStatus(envelope.status, signers);
    if (event.type === "SIGNATURE_CANCELLED") next = "CANCELLED";
    if (event.type === "SIGNATURE_EXPIRED" && !signer) next = "EXPIRED";
    if (event.type === "SIGNATURE_ERROR") next = "ERROR";
    if (event.type === "SIGNATURE_COMPLETED") next = "SIGNED";

    if (canTransition(envelope.status, next)) {
      await this.store.updateEnvelope(envelope.id, {
        status: next,
        ...(next === "SIGNED" ? { completedAt: event.occurredAt } : {}),
        ...(next === "CANCELLED" ? { cancelledAt: event.occurredAt } : {}),
      });
      changed = true;
    }
    if (!changed) return "stale"; // repetido por outro caminho ou fora de ordem: sem nova auditoria/notificação

    await this.audit(
      envelope,
      event.type,
      "PROVIDER",
      null,
      { eventId: event.eventId, status: next },
      signer?.id,
    );
    const completed = event.type === "SIGNATURE_COMPLETED" || next === "SIGNED";
    if (completed) {
      await this.collectFinalArtifacts(officeId, envelope);
      await this.notify(envelope, "SIGNATURE_COMPLETED");
    } else {
      await this.notify(envelope, event.type);
    }
    return "applied";
  }

  /** Documento final + evidências → Storage, relacionados ao envelope (e, por ele, a documento/processo/cliente). */
  private async collectFinalArtifacts(officeId: string, envelope: EnvelopeRecord): Promise<void> {
    if (!envelope.externalId) return;
    const { provider } = await this.router.resolveForExisting(officeId, envelope.provider);
    const ctx = await this.context(officeId, envelope.provider, envelope.environment);
    const caps = provider.descriptor.capabilities;
    if (caps.signedDocumentDownload) {
      const file = await provider.downloadSigned(ctx, envelope.externalId);
      await this.store.saveArtifact(officeId, envelope.id, "SIGNED", file, {
        sha256: await hashBytes(file.content),
      });
      await this.audit(envelope, "SIGNED_DOCUMENT_RECEIVED", "SYSTEM", null, {});
    }
    if (caps.evidence) {
      const evidence = await provider.getEvidence(ctx, envelope.externalId);
      if (evidence) {
        await this.store.saveArtifact(officeId, envelope.id, "EVIDENCE", evidence, {
          sha256: await hashBytes(evidence.content),
        });
        await this.audit(envelope, "EVIDENCE_RECEIVED", "SYSTEM", null, {});
      }
    }
  }

  // ---------------------------------------------------------------- Auxiliares

  private validateSigners(
    signers: SignerInput[],
    level: SignatureLevel,
    requiresDocumentFor: SignatureLevel[],
    provider: SignatureProviderId,
  ): void {
    if (signers.length === 0)
      throw new SignatureError("INVALID_INPUT", "Inclua ao menos um signatário.");
    for (const s of signers) {
      if (!s.name.trim())
        throw new SignatureError("INVALID_INPUT", "Todo signatário precisa de nome.");
      if (!s.email?.trim() && !s.phone?.trim()) {
        throw new SignatureError("INVALID_INPUT", `Informe e-mail ou telefone de ${s.name}.`);
      }
      // CPF só quando o nível/provedor exigir — nunca de forma indiscriminada.
      if (requiresDocumentFor.includes(level) && !s.documentNumber?.trim()) {
        throw new SignatureError(
          "INVALID_INPUT",
          `Este nível de assinatura exige o documento de ${s.name}.`,
          provider,
        );
      }
    }
  }

  private async applyProviderState(
    envelope: EnvelopeRecord,
    signers: SignerRecord[],
    state: {
      externalId: string;
      status: EnvelopeRecord["status"];
      signers: {
        externalId: string | null;
        email: string | null;
        status: SignerRecord["status"];
        signedAt: string | null;
        signingUrl: string | null;
      }[];
    },
  ): Promise<void> {
    for (const ps of state.signers) {
      const local = signers.find(
        (s) =>
          (ps.externalId && s.externalId === ps.externalId) ||
          (ps.email && s.email?.toLowerCase() === ps.email.toLowerCase()),
      );
      if (!local) continue;
      await this.store.updateSigner(local.id, {
        status: ps.status,
        externalId: ps.externalId,
        signedAt: ps.signedAt,
      });
      local.status = ps.status;
      if (ps.signingUrl)
        await this.store.saveSignerLink(local.id, envelope.officeId, ps.signingUrl);
    }
    const next =
      canTransition(envelope.status, state.status) || envelope.status === "PREPARING"
        ? state.status
        : envelope.status;
    await this.store.updateEnvelope(envelope.id, {
      externalId: state.externalId,
      status: next === "DRAFT" ? "SENT" : next,
    });
  }

  private async mustGet(officeId: string, envelopeId: string) {
    const found = await this.store.getEnvelope(officeId, envelopeId);
    if (!found) throw new SignatureError("NOT_FOUND", "Envelope não encontrado.");
    return found;
  }

  private async context(
    officeId: string,
    provider: SignatureProviderId,
    environment: Environment,
  ): Promise<ProviderContext> {
    const credentials = await this.store.getCredentials(officeId, provider);
    if (!credentials)
      throw new SignatureError(
        "PROVIDER_NOT_CONFIGURED",
        "Credenciais do provedor ausentes.",
        provider,
      );
    return { environment, credentials, config: {} };
  }

  private async timed<T>(
    envelope: EnvelopeRecord,
    userId: string | null,
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now();
    const cost =
      operation === "createEnvelope"
        ? (descriptorFor(envelope.provider, this.registry)?.estimatedCostPerEnvelope ?? 0)
        : 0;
    try {
      const out = await fn();
      await this.store.addUsage({
        officeId: envelope.officeId,
        envelopeId: envelope.id,
        userId,
        provider: envelope.provider,
        operation,
        success: true,
        durationMs: Date.now() - started,
        estimatedCost: cost,
      });
      return out;
    } catch (err) {
      await this.store.addUsage({
        officeId: envelope.officeId,
        envelopeId: envelope.id,
        userId,
        provider: envelope.provider,
        operation,
        success: false,
        durationMs: Date.now() - started,
        estimatedCost: 0,
      });
      throw err;
    }
  }

  private audit(
    envelope: EnvelopeRecord,
    type: SignatureEventType,
    source: "SYSTEM" | "USER" | "PROVIDER",
    actorId: string | null,
    data: Record<string, unknown>,
    signerId?: string,
  ) {
    return this.store.addEvent({
      officeId: envelope.officeId,
      envelopeId: envelope.id,
      signerId: signerId ?? null,
      type,
      source,
      actorId,
      provider: envelope.provider,
      data,
    });
  }

  private async notify(
    envelope: EnvelopeRecord,
    type: SignatureEventType,
    detail?: string,
  ): Promise<void> {
    const rule = NOTIFY[type];
    if (!rule || !envelope.createdBy) return;
    await this.notifier.notify({
      recipientId: envelope.createdBy,
      title: rule.title,
      description: detail ? `${envelope.title} — ${detail}` : envelope.title,
      level: rule.level,
    });
  }

  /** Mensagem segura para guardar/exibir: sem chaves, tokens ou stack traces. */
  private safeMessage(err: unknown): string {
    if (err instanceof SignatureError) return err.message;
    return "Falha ao comunicar com o provedor.";
  }
}

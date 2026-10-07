/**
 * Contrato de persistência do módulo de assinatura.
 * O SignatureService só conversa com esta interface (testável com um "banco de mentira");
 * a implementação real (Supabase, service role) fica em supabase-store.server.ts.
 */
import type { StoredProviderSetting } from "./router";
import type {
  Environment,
  EnvelopeStatus,
  ProviderFile,
  SignatureEventType,
  SignatureLevel,
  SignatureProviderId,
  SignerRole,
  SignerStatus,
} from "./types";

export type EnvelopeRecord = {
  id: string;
  officeId: string;
  createdBy: string | null;
  clientId: string | null;
  caseId: string | null;
  processId: string | null;
  provider: SignatureProviderId;
  environment: Environment;
  externalId: string | null;
  title: string;
  message: string;
  status: EnvelopeStatus;
  level: SignatureLevel;
  sequential: boolean;
  expiresAt: string | null;
  sentAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

export type SignerRecord = {
  id: string;
  envelopeId: string;
  clientId: string | null;
  profileId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: SignerRole;
  documentNumber: string | null;
  order: number;
  status: SignerStatus;
  externalId: string | null;
  signedAt: string | null;
};

export type NewEnvelope = Omit<
  EnvelopeRecord,
  "id" | "externalId" | "sentAt" | "completedAt" | "cancelledAt" | "status"
>;
export type NewSigner = Omit<SignerRecord, "id" | "externalId" | "signedAt" | "status">;

export type AuditEntry = {
  officeId: string;
  envelopeId: string | null;
  signerId?: string | null;
  type: SignatureEventType;
  source: "SYSTEM" | "USER" | "PROVIDER";
  actorId?: string | null;
  provider?: SignatureProviderId | null;
  data?: Record<string, unknown>;
};

export type UsageEntry = {
  officeId: string;
  envelopeId: string | null;
  userId: string | null;
  provider: SignatureProviderId;
  operation: string;
  success: boolean;
  durationMs: number;
  estimatedCost: number;
};

export type WebhookClaim = "new" | "retry" | "duplicate";

export interface SignatureStore {
  // --- Configuração dos provedores ---
  listSettings(officeId: string): Promise<StoredProviderSetting[]>;
  patchSetting(
    officeId: string,
    provider: SignatureProviderId,
    patch: { enabled?: boolean; environment?: Environment; config?: Record<string, unknown> },
    userId: string,
  ): Promise<void>;
  setDefault(officeId: string, provider: SignatureProviderId, userId: string): Promise<void>;
  clearDefault(officeId: string, provider: SignatureProviderId): Promise<void>;
  /** Credenciais já decifradas (só servidor). null = nada salvo. */
  getCredentials(
    officeId: string,
    provider: SignatureProviderId,
  ): Promise<Record<string, string> | null>;
  /** Mescla (não apaga campos omitidos), cifra e salva. Atualiza o status para 'configured' se completo. */
  saveCredentials(
    officeId: string,
    provider: SignatureProviderId,
    values: Record<string, string>,
    userId: string,
  ): Promise<void>;
  recordConnection(
    officeId: string,
    provider: SignatureProviderId,
    result: { ok: boolean; error: string | null },
  ): Promise<void>;
  touchCommunication(officeId: string, provider: SignatureProviderId): Promise<void>;

  // --- Envelopes ---
  insertEnvelope(env: NewEnvelope): Promise<EnvelopeRecord>;
  insertSigners(
    envelopeId: string,
    officeId: string,
    signers: NewSigner[],
  ): Promise<SignerRecord[]>;
  getEnvelope(
    officeId: string,
    envelopeId: string,
  ): Promise<{ envelope: EnvelopeRecord; signers: SignerRecord[] } | null>;
  findEnvelopeByExternal(
    officeId: string,
    provider: SignatureProviderId,
    externalId: string,
  ): Promise<{ envelope: EnvelopeRecord; signers: SignerRecord[] } | null>;
  updateEnvelope(
    envelopeId: string,
    patch: Partial<
      Pick<EnvelopeRecord, "status" | "externalId" | "sentAt" | "completedAt" | "cancelledAt">
    > & {
      errorMessage?: string | null;
    },
  ): Promise<void>;
  updateSigner(
    signerId: string,
    patch: Partial<Pick<SignerRecord, "status" | "externalId" | "signedAt">>,
  ): Promise<void>;
  saveSignerLink(signerId: string, officeId: string, url: string): Promise<void>;

  // --- Auditoria, webhooks, custos, arquivos ---
  addEvent(entry: AuditEntry): Promise<void>;
  claimWebhookEvent(
    officeId: string,
    provider: SignatureProviderId,
    eventId: string,
    payloadHash: string,
  ): Promise<WebhookClaim>;
  finishWebhookEvent(
    officeId: string,
    provider: SignatureProviderId,
    eventId: string,
    outcome: string,
  ): Promise<void>;
  addUsage(entry: UsageEntry): Promise<void>;
  /** Grava no Storage privado e registra em signature_documents. Nunca sobrescreve o original. */
  saveArtifact(
    officeId: string,
    envelopeId: string,
    kind: "ORIGINAL" | "SIGNED" | "EVIDENCE",
    file: ProviderFile,
    meta: { sha256: string; documentId?: string | null },
  ): Promise<void>;
}

/** Serviço de notificações (separado). O módulo de assinatura só pede; não sabe como entregar. */
export interface SignatureNotifier {
  notify(input: {
    recipientId: string;
    title: string;
    description: string;
    level: "critical" | "important" | "followup" | "info";
  }): Promise<void>;
}

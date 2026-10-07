/**
 * Modelo interno de assinatura eletrônica — independente de fornecedor.
 *
 * Conceito: cada fornecedor (Clicksign, D4Sign, ZapSign, GOV.BR...) fala um "idioma"
 * próprio. Os providers traduzem esse idioma para os tipos abaixo, e o resto do
 * InCasus só conhece estes tipos. O InCasus é dono da experiência; o provedor é infraestrutura.
 */

export type SignatureProviderId = "govbr" | "clicksign" | "d4sign" | "zapsign" | "autentique";

/** Simples = e-mail/código; Avançada = vínculo forte ao signatário; Qualificada = certificado ICP-Brasil. */
export type SignatureLevel = "SIMPLE" | "ADVANCED" | "QUALIFIED";

export type Environment = "sandbox" | "production";

export type EnvelopeStatus =
  | "DRAFT"
  | "PREPARING"
  | "PENDING"
  | "SENT"
  | "VIEWED"
  | "PARTIALLY_SIGNED"
  | "SIGNED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED"
  | "ERROR";

export type SignerStatus = "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "DECLINED" | "EXPIRED";

export type SignerRole = "CLIENT" | "LAWYER" | "WITNESS" | "REPRESENTATIVE" | "OTHER";

/** Eventos internos que alimentam notificações e a auditoria. */
export type SignatureEventType =
  | "ENVELOPE_CREATED"
  | "DOCUMENT_PREPARED"
  | "SIGNER_ADDED"
  | "SIGNATURE_REQUESTED"
  | "DOCUMENT_VIEWED"
  | "SIGNER_SIGNED"
  | "SIGNATURE_COMPLETED"
  | "SIGNATURE_DECLINED"
  | "SIGNATURE_EXPIRED"
  | "SIGNATURE_CANCELLED"
  | "SIGNATURE_ERROR"
  | "REMINDER_SENT"
  | "SIGNED_DOCUMENT_RECEIVED"
  | "EVIDENCE_RECEIVED";

export type SignatureErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_DISABLED"
  | "PROVIDER_NOT_IMPLEMENTED"
  | "NOT_SUPPORTED"
  | "AUTHENTICATION_ERROR"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_INPUT"
  | "INVALID_WEBHOOK"
  | "INVALID_TRANSITION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "SECRETS_KEY_MISSING";

export class SignatureError extends Error {
  constructor(
    readonly code: SignatureErrorCode,
    message: string,
    readonly provider?: SignatureProviderId,
  ) {
    super(message);
    this.name = "SignatureError";
  }
}

/** O que um provedor sabe fazer. Nem todos fazem tudo — o Router consulta isto. */
export type ProviderCapabilities = {
  levels: SignatureLevel[];
  sequentialOrder: boolean;
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  webhooks: boolean;
  evidence: boolean;
  signedDocumentDownload: boolean;
  reminders: boolean;
  cancellation: boolean;
  sandbox: boolean;
};

/** Requisitos de uma assinatura; o Router só escolhe provedores que os atendem. */
export type SignatureRequirements = {
  level: SignatureLevel;
  sequential?: boolean;
  needsEvidence?: boolean;
};

/** Campo de configuração que a tela de integrações desenha. */
export type ConfigField = {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  help?: string;
};

export type ProviderDescriptor = {
  id: SignatureProviderId;
  name: string;
  description: string;
  /** false = só catálogo ("em breve"); não há código de integração ainda. */
  implemented: boolean;
  /** Mensagem exibida quando depende de condições externas (ex.: elegibilidade GOV.BR). */
  availabilityNote?: string;
  capabilities: ProviderCapabilities;
  fields: ConfigField[];
  /** Custo estimado por assinatura (BRL) para telemetria; 0 enquanto não conhecido. */
  estimatedCostPerEnvelope: number;
  /** Níveis em que o provedor exige CPF/CNPJ do signatário. Fora disso, o documento não é pedido. */
  requiresDocumentNumberFor: SignatureLevel[];
};

/** Credenciais já decifradas — existem apenas em memória do servidor. */
export type ProviderContext = {
  environment: Environment;
  credentials: Record<string, string>;
  config: Record<string, unknown>;
};

export type SignerInput = {
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  role: SignerRole;
  /** CPF/CNPJ: só enviado quando o nível/provedor realmente exigir. */
  documentNumber?: string | undefined;
  order: number;
  clientId?: string | undefined;
  profileId?: string | undefined;
};

export type ProviderDocumentInput = {
  name: string;
  /** Bytes do arquivo original (nunca alterado). */
  content: Uint8Array;
  mimeType: string;
  sha256: string;
};

export type ProviderEnvelopeInput = {
  title: string;
  message: string;
  level: SignatureLevel;
  sequential: boolean;
  expiresAt: string | null;
  document: ProviderDocumentInput;
  signers: SignerInput[];
};

export type ProviderSignerState = {
  /** Índice na lista enviada (order) ou id externo, o que o provedor devolver. */
  externalId: string | null;
  email: string | null;
  status: SignerStatus;
  signedAt: string | null;
  /** URL segura do provedor onde a pessoa assina. */
  signingUrl: string | null;
};

export type ProviderEnvelopeState = {
  externalId: string;
  status: EnvelopeStatus;
  signers: ProviderSignerState[];
};

export type ProviderFile = { name: string; mimeType: string; content: Uint8Array };

/** Evento já traduzido para o nosso vocabulário. */
export type NormalizedWebhookEvent = {
  /** Identificador único do evento no provedor — base da idempotência. */
  eventId: string;
  envelopeExternalId: string;
  type: SignatureEventType;
  signerExternalId: string | null;
  signerEmail: string | null;
  occurredAt: string;
};

export type WebhookRequest = {
  rawBody: string;
  headers: Record<string, string>;
};

export type ConnectionTestResult = { ok: true } | { ok: false; message: string };

/**
 * Contrato de todo provedor. Operações não suportadas lançam SignatureError("NOT_SUPPORTED").
 * Nenhuma tela chama isto diretamente: tudo passa pelo SignatureService.
 */
export interface SignatureProvider {
  readonly descriptor: ProviderDescriptor;
  testConnection(ctx: ProviderContext): Promise<ConnectionTestResult>;
  /** Cria o envelope (com documento e signatários) no provedor, ainda sem disparar. */
  createEnvelope(
    ctx: ProviderContext,
    input: ProviderEnvelopeInput,
  ): Promise<ProviderEnvelopeState>;
  /** Dispara o envio aos signatários. */
  sendEnvelope(ctx: ProviderContext, externalId: string): Promise<ProviderEnvelopeState>;
  getStatus(ctx: ProviderContext, externalId: string): Promise<ProviderEnvelopeState>;
  cancelEnvelope(ctx: ProviderContext, externalId: string): Promise<void>;
  sendReminder(
    ctx: ProviderContext,
    externalId: string,
    signerExternalId: string | null,
  ): Promise<void>;
  downloadSigned(ctx: ProviderContext, externalId: string): Promise<ProviderFile>;
  getEvidence(ctx: ProviderContext, externalId: string): Promise<ProviderFile | null>;
  /**
   * Valida a autenticidade conforme a documentação do próprio provedor (HMAC, token etc.)
   * e traduz o payload. Deve lançar SignatureError("INVALID_WEBHOOK") se não for autêntico.
   */
  parseWebhook(ctx: ProviderContext, request: WebhookRequest): Promise<NormalizedWebhookEvent[]>;
}

/** Visão segura (sem segredos) de um provedor para a tela. */
export type ProviderSettingsView = {
  provider: SignatureProviderId;
  name: string;
  description: string;
  implemented: boolean;
  availabilityNote: string | null;
  capabilities: ProviderCapabilities;
  fields: (ConfigField & { configured: boolean; masked: string | null })[];
  enabled: boolean;
  environment: Environment;
  isDefault: boolean;
  connectionStatus: "not_configured" | "configured" | "connected" | "error";
  lastCheckedAt: string | null;
  lastCommunicationAt: string | null;
  lastError: string | null;
};

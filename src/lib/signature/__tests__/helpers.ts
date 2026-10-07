import type { StoredProviderSetting } from "../router";
import type {
  AuditEntry,
  EnvelopeRecord,
  NewEnvelope,
  NewSigner,
  SignatureNotifier,
  SignatureStore,
  SignerRecord,
  UsageEntry,
  WebhookClaim,
} from "../store";
import {
  SignatureError,
  type ProviderDescriptor,
  type ProviderEnvelopeState,
  type SignatureProvider,
  type SignatureProviderId,
} from "../types";

export const FULL: ProviderDescriptor = {
  id: "clicksign",
  name: "Fake",
  description: "",
  implemented: true,
  capabilities: {
    levels: ["SIMPLE", "ADVANCED"],
    sequentialOrder: true,
    emailNotifications: true,
    whatsappNotifications: false,
    webhooks: true,
    evidence: true,
    signedDocumentDownload: true,
    reminders: true,
    cancellation: true,
    sandbox: true,
  },
  fields: [{ key: "apiKey", label: "API key", secret: true, required: true }],
  estimatedCostPerEnvelope: 2.5,
  requiresDocumentNumberFor: ["ADVANCED"],
};

/** Provedor de mentira: simula a API e valida o webhook por um segredo compartilhado. */
export class FakeProvider implements SignatureProvider {
  readonly descriptor = FULL;
  calls: string[] = [];
  async testConnection() {
    return { ok: true as const };
  }
  async createEnvelope(
    _c: unknown,
    input: { signers: { email?: string | undefined }[] },
  ): Promise<ProviderEnvelopeState> {
    this.calls.push("create");
    return {
      externalId: "ext-1",
      status: "PENDING",
      signers: input.signers.map((s, i) => ({
        externalId: `s-${i}`,
        email: s.email ?? null,
        status: "PENDING",
        signedAt: null,
        signingUrl: null,
      })),
    };
  }
  async sendEnvelope(): Promise<ProviderEnvelopeState> {
    this.calls.push("send");
    return {
      externalId: "ext-1",
      status: "SENT",
      signers: [
        {
          externalId: "s-0",
          email: "ana@x.com",
          status: "SENT",
          signedAt: null,
          signingUrl: "https://sign.example/abc",
        },
      ],
    };
  }
  async getStatus(): Promise<ProviderEnvelopeState> {
    return { externalId: "ext-1", status: "SENT", signers: [] };
  }
  async cancelEnvelope() {
    this.calls.push("cancel");
  }
  async sendReminder() {
    this.calls.push("remind");
  }
  async downloadSigned() {
    return { name: "signed.pdf", mimeType: "application/pdf", content: new Uint8Array([1, 2, 3]) };
  }
  async getEvidence() {
    return { name: "evidence.pdf", mimeType: "application/pdf", content: new Uint8Array([4, 5]) };
  }
  async parseWebhook(
    ctx: { credentials: Record<string, string> },
    req: { rawBody: string; headers: Record<string, string> },
  ) {
    if (req.headers["x-secret"] !== ctx.credentials["apiKey"])
      throw new SignatureError("INVALID_WEBHOOK", "assinatura inválida");
    return JSON.parse(req.rawBody) as never;
  }
}

export class MemoryStore implements SignatureStore {
  settings: StoredProviderSetting[] = [];
  creds = new Map<string, Record<string, string>>();
  envelopes: EnvelopeRecord[] = [];
  signers: SignerRecord[] = [];
  events: AuditEntry[] = [];
  usage: UsageEntry[] = [];
  links = new Map<string, string>();
  artifacts: string[] = [];
  webhooks = new Map<string, { processed: boolean }>();
  private n = 0;
  private id() {
    return `id-${++this.n}`;
  }

  async listSettings() {
    return this.settings;
  }
  private ensure(provider: SignatureProviderId): StoredProviderSetting {
    let s = this.settings.find((x) => x.provider === provider);
    if (!s) {
      s = {
        provider,
        enabled: false,
        environment: "sandbox",
        isDefault: false,
        connectionStatus: "not_configured",
        lastCheckedAt: null,
        lastCommunicationAt: null,
        lastError: null,
        secretHints: {},
        configKeys: [],
      };
      this.settings.push(s);
    }
    return s;
  }
  async patchSetting(
    _o: string,
    p: SignatureProviderId,
    patch: { enabled?: boolean; environment?: "sandbox" | "production" },
  ) {
    Object.assign(this.ensure(p), patch);
  }
  async setDefault(_o: string, p: SignatureProviderId) {
    this.settings.forEach((s) => (s.isDefault = s.provider === p));
    this.ensure(p).isDefault = true;
  }
  async clearDefault(_o: string, p: SignatureProviderId) {
    this.ensure(p).isDefault = false;
  }
  async getCredentials(_o: string, p: SignatureProviderId) {
    return this.creds.get(p) ?? null;
  }
  async saveCredentials(_o: string, p: SignatureProviderId, values: Record<string, string>) {
    this.creds.set(p, { ...(this.creds.get(p) ?? {}), ...values });
    const s = this.ensure(p);
    for (const [k, v] of Object.entries(values)) s.secretHints[k] = v.slice(-4);
    s.connectionStatus = "configured";
  }
  async recordConnection(
    _o: string,
    p: SignatureProviderId,
    r: { ok: boolean; error: string | null },
  ) {
    const s = this.ensure(p);
    s.connectionStatus = r.ok ? "connected" : "error";
    s.lastError = r.error;
  }
  async touchCommunication(_o: string, p: SignatureProviderId) {
    this.ensure(p).lastCommunicationAt = "now";
  }

  async insertEnvelope(e: NewEnvelope) {
    const rec: EnvelopeRecord = {
      ...e,
      id: this.id(),
      externalId: null,
      status: "DRAFT",
      sentAt: null,
      completedAt: null,
      cancelledAt: null,
    };
    this.envelopes.push(rec);
    return rec;
  }
  async insertSigners(envelopeId: string, _o: string, list: NewSigner[]) {
    const out = list.map((s) => ({
      ...s,
      envelopeId,
      id: this.id(),
      externalId: null,
      signedAt: null,
      status: "PENDING" as const,
    }));
    this.signers.push(...out);
    return out;
  }
  async getEnvelope(_o: string, id: string) {
    const envelope = this.envelopes.find((e) => e.id === id);
    return envelope ? { envelope, signers: this.signers.filter((s) => s.envelopeId === id) } : null;
  }
  async findEnvelopeByExternal(_o: string, provider: SignatureProviderId, ext: string) {
    const envelope = this.envelopes.find((e) => e.provider === provider && e.externalId === ext);
    return envelope
      ? { envelope, signers: this.signers.filter((s) => s.envelopeId === envelope.id) }
      : null;
  }
  async updateEnvelope(id: string, patch: Record<string, unknown>) {
    const e = this.envelopes.find((x) => x.id === id);
    if (e) Object.assign(e, patch);
  }
  async updateSigner(id: string, patch: Record<string, unknown>) {
    const s = this.signers.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
  }
  async saveSignerLink(id: string, _o: string, url: string) {
    this.links.set(id, url);
  }
  async addEvent(e: AuditEntry) {
    this.events.push(e);
  }
  async claimWebhookEvent(
    _o: string,
    p: SignatureProviderId,
    eventId: string,
  ): Promise<WebhookClaim> {
    const key = `${p}:${eventId}`;
    const cur = this.webhooks.get(key);
    if (!cur) {
      this.webhooks.set(key, { processed: false });
      return "new";
    }
    return cur.processed ? "duplicate" : "retry";
  }
  async finishWebhookEvent(_o: string, p: SignatureProviderId, eventId: string) {
    this.webhooks.set(`${p}:${eventId}`, { processed: true });
  }
  async addUsage(u: UsageEntry) {
    this.usage.push(u);
  }
  async saveArtifact(_o: string, _e: string, kind: string) {
    this.artifacts.push(kind);
  }
}

export class MemoryNotifier implements SignatureNotifier {
  sent: { title: string; recipientId: string }[] = [];
  async notify(i: { recipientId: string; title: string }) {
    this.sent.push(i);
  }
}

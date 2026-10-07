/**
 * Persistência do módulo de assinatura (SOMENTE servidor, service role).
 * As tabelas signature_* só aceitam escrita por aqui; o navegador lê via RLS.
 * Segredos são cifrados (AES-GCM) antes de tocar o banco.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createDefaultRegistry, descriptorFor } from "./catalog";
import { decryptSecrets, encryptSecrets, hintOf } from "./crypto";
import type { StoredProviderSetting } from "./router";
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
} from "./store";
import type { Environment, ProviderFile, SignatureProviderId } from "./types";

// Cliente sem tipos gerados: as tabelas novas ainda não estão em types.ts (arquivo gerado).
// Todo dado que sai daqui passa pelos mapeadores tipados abaixo.
const db = () => supabaseAdmin as unknown as SupabaseClient;
const registry = createDefaultRegistry();
const BUCKET = "signatures";

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);

function toEnvelope(r: Row): EnvelopeRecord {
  return {
    id: r["id"] as string,
    officeId: r["office_id"] as string,
    createdBy: str(r["created_by"]),
    clientId: str(r["client_id"]),
    caseId: str(r["case_id"]),
    processId: str(r["process_id"]),
    provider: r["provider"] as SignatureProviderId,
    environment: r["provider_environment"] as Environment,
    externalId: str(r["external_id"]),
    title: r["title"] as string,
    message: (r["message"] as string) ?? "",
    status: r["status"] as EnvelopeRecord["status"],
    level: r["signature_level"] as EnvelopeRecord["level"],
    sequential: Boolean(r["sequential"]),
    expiresAt: str(r["expires_at"]),
    sentAt: str(r["sent_at"]),
    completedAt: str(r["completed_at"]),
    cancelledAt: str(r["cancelled_at"]),
  };
}
function toSigner(r: Row): SignerRecord {
  return {
    id: r["id"] as string,
    envelopeId: r["envelope_id"] as string,
    clientId: str(r["client_id"]),
    profileId: str(r["profile_id"]),
    name: r["name"] as string,
    email: str(r["email"]),
    phone: str(r["phone"]),
    role: r["role"] as SignerRecord["role"],
    documentNumber: str(r["document_number"]),
    order: r["sign_order"] as number,
    status: r["status"] as SignerRecord["status"],
    externalId: str(r["external_id"]),
    signedAt: str(r["signed_at"]),
  };
}
function fail(what: string, error: { message?: string } | null): never {
  console.error(`[signature] ${what}`, error?.message);
  throw new Error(`Falha de persistência: ${what}`);
}
function requiredSecretKeys(provider: SignatureProviderId): string[] {
  return (descriptorFor(provider, registry)?.fields ?? [])
    .filter((f) => f.secret && f.required)
    .map((f) => f.key);
}

async function readHints(
  officeId: string,
  provider: SignatureProviderId,
): Promise<Record<string, string>> {
  const { data } = await db()
    .from("signature_provider_credentials")
    .select("hint")
    .eq("office_id", officeId)
    .eq("provider", provider)
    .maybeSingle();
  try {
    return data ? (JSON.parse(String(data["hint"])) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export const supabaseSignatureStore: SignatureStore = {
  async listSettings(officeId): Promise<StoredProviderSetting[]> {
    const [{ data: rows }, { data: creds }] = await Promise.all([
      db().from("signature_provider_settings").select("*").eq("office_id", officeId),
      db()
        .from("signature_provider_credentials")
        .select("provider, hint")
        .eq("office_id", officeId),
    ]);
    return (rows ?? []).map((r: Row) => {
      const provider = r["provider"] as SignatureProviderId;
      const credRow = (creds ?? []).find((c: Row) => c["provider"] === provider);
      let hints: Record<string, string> = {};
      try {
        hints = credRow ? (JSON.parse(String(credRow["hint"])) as Record<string, string>) : {};
      } catch {
        hints = {};
      }
      const config = (r["config"] as Record<string, unknown> | null) ?? {};
      return {
        provider,
        enabled: Boolean(r["enabled"]),
        environment: r["environment"] as Environment,
        isDefault: Boolean(r["is_default"]),
        connectionStatus: r["connection_status"] as StoredProviderSetting["connectionStatus"],
        lastCheckedAt: str(r["last_checked_at"]),
        lastCommunicationAt: str(r["last_communication_at"]),
        lastError: str(r["last_error"]),
        secretHints: hints,
        configKeys: Object.keys(config),
      };
    });
  },

  async patchSetting(officeId, provider, patch, userId) {
    const row: Row = {
      office_id: officeId,
      provider,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    if (patch.enabled !== undefined) row["enabled"] = patch.enabled;
    if (patch.environment !== undefined) row["environment"] = patch.environment;
    if (patch.config !== undefined) row["config"] = patch.config;
    const { error } = await db()
      .from("signature_provider_settings")
      .upsert(row, { onConflict: "office_id,provider" });
    if (error) fail("configuração do provedor", error);
  },

  async setDefault(officeId, provider, userId) {
    // O índice único permite um padrão por escritório: limpa o anterior antes.
    await db()
      .from("signature_provider_settings")
      .update({ is_default: false })
      .eq("office_id", officeId)
      .eq("is_default", true);
    const { error } = await db().from("signature_provider_settings").upsert(
      {
        office_id: officeId,
        provider,
        is_default: true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "office_id,provider" },
    );
    if (error) fail("provedor padrão", error);
  },

  async clearDefault(officeId, provider) {
    await db()
      .from("signature_provider_settings")
      .update({ is_default: false })
      .eq("office_id", officeId)
      .eq("provider", provider);
  },

  async getCredentials(officeId, provider) {
    const { data } = await db()
      .from("signature_provider_credentials")
      .select("ciphertext, iv")
      .eq("office_id", officeId)
      .eq("provider", provider)
      .maybeSingle();
    if (!data) return null;
    return decryptSecrets(
      { ciphertext: String(data["ciphertext"]), iv: String(data["iv"]) },
      process.env["SIGNATURE_CREDENTIALS_KEY"],
    );
  },

  async saveCredentials(officeId, provider, values, userId) {
    const existing = (await this.getCredentials(officeId, provider)) ?? {};
    const merged = { ...existing, ...values };
    const hints = { ...(await readHints(officeId, provider)) };
    for (const [k, v] of Object.entries(values)) hints[k] = hintOf(v);
    const enc = await encryptSecrets(merged, process.env["SIGNATURE_CREDENTIALS_KEY"]);
    const { error } = await db()
      .from("signature_provider_credentials")
      .upsert(
        {
          office_id: officeId,
          provider,
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          hint: JSON.stringify(hints),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "office_id,provider" },
      );
    if (error) fail("credenciais", error);
    const complete = requiredSecretKeys(provider).every((k) => Boolean(merged[k]));
    // Novas credenciais invalidam um "conectado" anterior: precisa testar de novo.
    await db()
      .from("signature_provider_settings")
      .upsert(
        {
          office_id: officeId,
          provider,
          connection_status: complete ? "configured" : "not_configured",
          last_error: null,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "office_id,provider" },
      );
  },

  async recordConnection(officeId, provider, result) {
    await db()
      .from("signature_provider_settings")
      .upsert(
        {
          office_id: officeId,
          provider,
          connection_status: result.ok ? "connected" : "error",
          last_error: result.error,
          last_checked_at: new Date().toISOString(),
          ...(result.ok ? { last_communication_at: new Date().toISOString() } : {}),
        },
        { onConflict: "office_id,provider" },
      );
  },

  async touchCommunication(officeId, provider) {
    await db()
      .from("signature_provider_settings")
      .update({ last_communication_at: new Date().toISOString() })
      .eq("office_id", officeId)
      .eq("provider", provider);
  },

  async insertEnvelope(e: NewEnvelope) {
    const { data, error } = await db()
      .from("signature_envelopes")
      .insert({
        office_id: e.officeId,
        created_by: e.createdBy,
        client_id: e.clientId,
        case_id: e.caseId,
        process_id: e.processId,
        provider: e.provider,
        provider_environment: e.environment,
        title: e.title,
        message: e.message,
        signature_level: e.level,
        sequential: e.sequential,
        expires_at: e.expiresAt,
      })
      .select("*")
      .single();
    if (error || !data) fail("criar envelope", error);
    return toEnvelope(data as Row);
  },

  async insertSigners(envelopeId, officeId, list: NewSigner[]) {
    const { data, error } = await db()
      .from("signature_signers")
      .insert(
        list.map((s) => ({
          envelope_id: envelopeId,
          office_id: officeId,
          client_id: s.clientId,
          profile_id: s.profileId,
          name: s.name,
          email: s.email,
          phone: s.phone,
          role: s.role,
          document_number: s.documentNumber,
          sign_order: s.order,
        })),
      )
      .select("*");
    if (error || !data) fail("criar signatários", error);
    return (data as Row[]).map(toSigner);
  },

  async getEnvelope(officeId, envelopeId) {
    const { data: e } = await db()
      .from("signature_envelopes")
      .select("*")
      .eq("office_id", officeId)
      .eq("id", envelopeId)
      .maybeSingle();
    if (!e) return null;
    const { data: s } = await db()
      .from("signature_signers")
      .select("*")
      .eq("envelope_id", envelopeId)
      .order("sign_order");
    return { envelope: toEnvelope(e as Row), signers: ((s ?? []) as Row[]).map(toSigner) };
  },

  async findEnvelopeByExternal(officeId, provider, externalId) {
    const { data: e } = await db()
      .from("signature_envelopes")
      .select("*")
      .eq("office_id", officeId)
      .eq("provider", provider)
      .eq("external_id", externalId)
      .maybeSingle();
    if (!e) return null;
    const { data: s } = await db()
      .from("signature_signers")
      .select("*")
      .eq("envelope_id", (e as Row)["id"] as string)
      .order("sign_order");
    return { envelope: toEnvelope(e as Row), signers: ((s ?? []) as Row[]).map(toSigner) };
  },

  async updateEnvelope(envelopeId, patch) {
    const now = new Date().toISOString();
    const row: Row = { updated_at: now, last_activity_at: now };
    if (patch.status !== undefined) row["status"] = patch.status;
    if (patch.externalId !== undefined) row["external_id"] = patch.externalId;
    if (patch.sentAt !== undefined) row["sent_at"] = patch.sentAt;
    if (patch.completedAt !== undefined) row["completed_at"] = patch.completedAt;
    if (patch.cancelledAt !== undefined) row["cancelled_at"] = patch.cancelledAt;
    if (patch.errorMessage !== undefined) row["error_message"] = patch.errorMessage;
    const { error } = await db().from("signature_envelopes").update(row).eq("id", envelopeId);
    if (error) fail("atualizar envelope", error);
  },

  async updateSigner(signerId, patch) {
    const row: Row = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) row["status"] = patch.status;
    if (patch.externalId !== undefined) row["external_id"] = patch.externalId;
    if (patch.signedAt !== undefined) row["signed_at"] = patch.signedAt;
    const { error } = await db().from("signature_signers").update(row).eq("id", signerId);
    if (error) fail("atualizar signatário", error);
  },

  async saveSignerLink(signerId, officeId, url) {
    await db()
      .from("signature_signer_links")
      .upsert(
        { signer_id: signerId, office_id: officeId, signing_url: url },
        { onConflict: "signer_id" },
      );
  },

  async addEvent(e: AuditEntry) {
    const { error } = await db()
      .from("signature_events")
      .insert({
        office_id: e.officeId,
        envelope_id: e.envelopeId,
        signer_id: e.signerId ?? null,
        type: e.type,
        source: e.source,
        actor_id: e.actorId ?? null,
        provider: e.provider ?? null,
        data: e.data ?? {},
      });
    if (error) fail("auditoria", error);
  },

  async claimWebhookEvent(officeId, provider, eventId, payloadHash): Promise<WebhookClaim> {
    const { error } = await db().from("signature_webhook_events").insert({
      office_id: officeId,
      provider,
      external_event_id: eventId,
      payload_hash: payloadHash,
    });
    if (!error) return "new";
    if ((error as { code?: string }).code !== "23505") fail("registrar webhook", error);
    const { data } = await db()
      .from("signature_webhook_events")
      .select("processed_at")
      .eq("office_id", officeId)
      .eq("provider", provider)
      .eq("external_event_id", eventId)
      .maybeSingle();
    return data && (data as Row)["processed_at"] ? "duplicate" : "retry";
  },

  async finishWebhookEvent(officeId, provider, eventId, outcome) {
    await db()
      .from("signature_webhook_events")
      .update({ processed_at: new Date().toISOString(), outcome })
      .eq("office_id", officeId)
      .eq("provider", provider)
      .eq("external_event_id", eventId);
  },

  async addUsage(u: UsageEntry) {
    await db().from("signature_usage").insert({
      office_id: u.officeId,
      envelope_id: u.envelopeId,
      user_id: u.userId,
      provider: u.provider,
      operation: u.operation,
      success: u.success,
      duration_ms: u.durationMs,
      estimated_cost: u.estimatedCost,
    });
  },

  async saveArtifact(officeId, envelopeId, kind, file: ProviderFile, meta) {
    const safe = file.name.replace(/[^\w.-]+/g, "_").slice(0, 80);
    const path = `${officeId}/${envelopeId}/${kind.toLowerCase()}-${Date.now()}-${safe}`;
    // upsert:false → o original nunca é sobrescrito.
    const { error: upErr } = await db()
      .storage.from(BUCKET)
      .upload(path, file.content, { contentType: file.mimeType, upsert: false });
    if (upErr) fail("upload no Storage", upErr);
    const { error } = await db()
      .from("signature_documents")
      .insert({
        envelope_id: envelopeId,
        office_id: officeId,
        document_id: meta.documentId ?? null,
        kind,
        name: file.name,
        storage_path: path,
        sha256: meta.sha256,
        size_bytes: file.content.length,
      });
    if (error) fail("registrar arquivo", error);
  },
};

/** NotificationService (parte do módulo): reaproveita a tabela `notifications` existente. */
export const supabaseSignatureNotifier: SignatureNotifier = {
  async notify({ recipientId, title, description, level }) {
    const { error } = await db()
      .from("notifications")
      .insert({ recipient_id: recipientId, title, description, level });
    if (error) console.error("[signature] notificação", error.message);
  },
};

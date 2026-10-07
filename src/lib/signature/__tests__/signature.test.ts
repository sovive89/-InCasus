import { describe, expect, test } from "bun:test";
import { createDefaultRegistry } from "../catalog";
import { decryptSecrets, encryptSecrets, maskSecret } from "../crypto";
import { SignatureService } from "../service";
import { canCancel, canTransition, deriveEnvelopeStatus, signerCanAdvance } from "../status";
import { SignatureError, type NormalizedWebhookEvent } from "../types";
import { FakeProvider, MemoryNotifier, MemoryStore } from "./helpers";

const OFFICE = "office-1";
const USER = "user-1";
const KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

function setup() {
  const store = new MemoryStore();
  const notifier = new MemoryNotifier();
  const provider = new FakeProvider();
  const registry = createDefaultRegistry();
  registry.set("clicksign", provider);
  const service = new SignatureService(store, registry, notifier);
  return { store, notifier, provider, service };
}

async function configure(s: ReturnType<typeof setup>) {
  await s.service.saveProviderSettings(OFFICE, USER, "clicksign", {
    secrets: { apiKey: "key-abc123" },
    enabled: true,
    makeDefault: true,
  });
}
const signer = (extra = {}) => ({
  name: "Ana",
  email: "ana@x.com",
  role: "CLIENT" as const,
  order: 1,
  ...extra,
});
const doc = {
  name: "contrato.pdf",
  content: new Uint8Array([9, 9]),
  mimeType: "application/pdf",
  sha256: "abc",
};

function hook(events: Partial<NormalizedWebhookEvent>[], secret = "key-abc123") {
  return {
    rawBody: JSON.stringify(
      events.map((e, i) => ({
        eventId: `e${i}`,
        envelopeExternalId: "ext-1",
        type: "SIGNER_SIGNED",
        signerExternalId: "s-0",
        signerEmail: null,
        occurredAt: "2026-10-07T10:00:00Z",
        ...e,
      })),
    ),
    headers: { "x-secret": secret },
  };
}

describe("status", () => {
  test("não regride e respeita estados terminais", () => {
    expect(canTransition("SENT", "VIEWED")).toBe(true);
    expect(canTransition("SIGNED", "VIEWED")).toBe(false);
    expect(canTransition("CANCELLED", "SENT")).toBe(false);
    expect(canCancel("SIGNED")).toBe(false);
    expect(signerCanAdvance("SIGNED", "VIEWED")).toBe(false);
  });
  test("deduz status do envelope pelos signatários", () => {
    expect(deriveEnvelopeStatus("SENT", [{ status: "SIGNED" }, { status: "SENT" }])).toBe(
      "PARTIALLY_SIGNED",
    );
    expect(deriveEnvelopeStatus("SENT", [{ status: "SIGNED" }, { status: "SIGNED" }])).toBe(
      "SIGNED",
    );
    expect(deriveEnvelopeStatus("SENT", [{ status: "SIGNED" }, { status: "DECLINED" }])).toBe(
      "DECLINED",
    );
  });
});

describe("cofre de segredos", () => {
  test("cifra e decifra; chave errada falha; máscara mostra só 4 caracteres", async () => {
    const enc = await encryptSecrets({ apiKey: "segredo-a82f" }, KEY);
    expect(enc.ciphertext).not.toContain("segredo");
    expect(await decryptSecrets(enc, KEY)).toEqual({ apiKey: "segredo-a82f" });
    const other = btoa(String.fromCharCode(...new Uint8Array(32).fill(1)));
    await expect(decryptSecrets(enc, other)).rejects.toBeInstanceOf(SignatureError);
    await expect(encryptSecrets({ a: "b" }, undefined)).rejects.toBeInstanceOf(SignatureError);
    expect(maskSecret("segredo-a82f")).toBe("••••a82f");
  });
});

describe("router / configuração", () => {
  test("GOV.BR aparece como indisponível e não pode ser ativado", async () => {
    const s = setup();
    const list = await s.service.listProviders(OFFICE);
    const gov = list.find((p) => p.provider === "govbr");
    expect(gov?.implemented).toBe(false);
    await expect(
      s.service.saveProviderSettings(OFFICE, USER, "govbr", { enabled: true }),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_IMPLEMENTED" });
  });
  test("lista nunca expõe o segredo, só máscara", async () => {
    const s = setup();
    await configure(s);
    const p = (await s.service.listProviders(OFFICE)).find((x) => x.provider === "clicksign");
    expect(JSON.stringify(p)).not.toContain("key-abc123");
    expect(p?.fields[0]?.masked).toBe("••••c123");
    expect(p?.isDefault).toBe(true);
  });
  test("sem padrão, desativado ou sem capacidade → erro claro", async () => {
    const s = setup();
    await expect(s.service.router.resolveForNew(OFFICE, { level: "SIMPLE" })).rejects.toMatchObject(
      { code: "PROVIDER_NOT_CONFIGURED" },
    );
    await configure(s);
    await expect(
      s.service.router.resolveForNew(OFFICE, { level: "QUALIFIED" }),
    ).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
    await s.service.saveProviderSettings(OFFICE, USER, "clicksign", { enabled: false });
    await expect(
      s.service.router.resolveForNew(OFFICE, { level: "SIMPLE" }, "clicksign"),
    ).rejects.toMatchObject({ code: "PROVIDER_DISABLED" });
  });
  test("segredo desconhecido é recusado", async () => {
    const s = setup();
    await expect(
      s.service.saveProviderSettings(OFFICE, USER, "clicksign", { secrets: { hack: "x" } }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("envelopes", () => {
  test("CPF só é exigido quando o nível pede", async () => {
    const s = setup();
    await configure(s);
    await expect(
      s.service.createDraft({
        officeId: OFFICE,
        userId: USER,
        title: "Contrato",
        level: "ADVANCED",
        signers: [signer()],
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const ok = await s.service.createDraft({
      officeId: OFFICE,
      userId: USER,
      title: "Contrato",
      level: "SIMPLE",
      signers: [signer()],
    });
    expect(ok.envelope.status).toBe("DRAFT");
    expect(ok.signers[0]?.documentNumber).toBeNull();
    expect(s.store.events.map((e) => e.type)).toEqual(["ENVELOPE_CREATED", "SIGNER_ADDED"]);
  });
  test("envio: guarda original, envia ao provedor, guarda link, registra custo e auditoria", async () => {
    const s = setup();
    await configure(s);
    const { envelope } = await s.service.createDraft({
      officeId: OFFICE,
      userId: USER,
      title: "Contrato",
      level: "SIMPLE",
      signers: [signer()],
    });
    const sent = await s.service.send(OFFICE, USER, envelope.id, async () => doc);
    expect(sent.status).toBe("SENT");
    expect(sent.externalId).toBe("ext-1");
    expect(s.store.artifacts).toEqual(["ORIGINAL"]);
    expect([...s.store.links.values()]).toEqual(["https://sign.example/abc"]);
    expect(s.store.usage.find((u) => u.operation === "createEnvelope")?.estimatedCost).toBe(2.5);
    expect(s.store.events.some((e) => e.type === "SIGNATURE_REQUESTED")).toBe(true);
    await expect(s.service.send(OFFICE, USER, envelope.id, async () => doc)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });
  test("falha no provedor marca ERROR, audita e notifica", async () => {
    const s = setup();
    await configure(s);
    const { envelope } = await s.service.createDraft({
      officeId: OFFICE,
      userId: USER,
      title: "C",
      level: "SIMPLE",
      signers: [signer()],
    });
    s.provider.createEnvelope = async () => {
      throw new Error("boom com token=SEGREDO");
    };
    await expect(s.service.send(OFFICE, USER, envelope.id, async () => doc)).rejects.toBeInstanceOf(
      SignatureError,
    );
    expect(s.store.envelopes[0]?.status).toBe("ERROR");
    expect((s.store.envelopes[0] as { errorMessage?: string } | undefined)?.errorMessage).toBe(
      "Falha ao comunicar com o provedor.",
    );
    expect(JSON.stringify(s.store.events)).not.toContain("SEGREDO");
    expect(s.notifier.sent[0]?.title).toBe("Erro na assinatura");
  });
  test("envelope fica vinculado ao provedor mesmo se ele for desativado depois", async () => {
    const s = setup();
    await configure(s);
    const { envelope } = await s.service.createDraft({
      officeId: OFFICE,
      userId: USER,
      title: "C",
      level: "SIMPLE",
      signers: [signer()],
    });
    await s.service.send(OFFICE, USER, envelope.id, async () => doc);
    await s.service.saveProviderSettings(OFFICE, USER, "clicksign", { enabled: false });
    await s.service.cancel(OFFICE, USER, envelope.id);
    expect(s.provider.calls).toContain("cancel");
    expect(s.store.envelopes[0]?.status).toBe("CANCELLED");
    await expect(s.service.cancel(OFFICE, USER, envelope.id)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });
});

describe("webhooks", () => {
  async function sentEnvelope() {
    const s = setup();
    await configure(s);
    const { envelope } = await s.service.createDraft({
      officeId: OFFICE,
      userId: USER,
      title: "Contrato",
      level: "SIMPLE",
      signers: [signer()],
    });
    await s.service.send(OFFICE, USER, envelope.id, async () => doc);
    s.notifier.sent.length = 0;
    return { s, envelope };
  }
  test("autenticidade inválida é rejeitada sem alterar nada", async () => {
    const { s } = await sentEnvelope();
    await expect(
      s.service.handleWebhook(OFFICE, "clicksign", hook([{}], "errado")),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK" });
    expect(s.store.envelopes[0]?.status).toBe("SENT");
  });
  test("mesmo evento duas vezes: uma atualização, uma notificação", async () => {
    const { s } = await sentEnvelope();
    const req = hook([{ eventId: "evt-9", type: "SIGNATURE_COMPLETED" }]);
    const first = await s.service.handleWebhook(OFFICE, "clicksign", req);
    const second = await s.service.handleWebhook(OFFICE, "clicksign", req);
    expect(first).toEqual({ processed: 1, duplicates: 0, ignored: 0 });
    expect(second).toEqual({ processed: 0, duplicates: 1, ignored: 0 });
    expect(s.notifier.sent.map((n) => n.title)).toEqual(["Documento assinado"]);
    expect(s.store.envelopes[0]?.status).toBe("SIGNED");
    expect(s.store.artifacts).toEqual(["ORIGINAL", "SIGNED", "EVIDENCE"]);
    expect(s.store.events.filter((e) => e.type === "SIGNATURE_COMPLETED")).toHaveLength(1);
  });
  test("evento fora de ordem (visualizou depois de assinar) não regride o estado", async () => {
    const { s } = await sentEnvelope();
    await s.service.handleWebhook(
      OFFICE,
      "clicksign",
      hook([{ eventId: "a", type: "SIGNER_SIGNED" }]),
    );
    expect(s.store.envelopes[0]?.status).toBe("SIGNED");
    const late = await s.service.handleWebhook(
      OFFICE,
      "clicksign",
      hook([{ eventId: "b", type: "DOCUMENT_VIEWED" }]),
    );
    expect(late.ignored).toBe(1);
    expect(s.store.envelopes[0]?.status).toBe("SIGNED");
    expect(s.notifier.sent).toHaveLength(1);
  });
  test("envelope desconhecido é registrado como ignorado", async () => {
    const { s } = await sentEnvelope();
    const r = await s.service.handleWebhook(
      OFFICE,
      "clicksign",
      hook([{ envelopeExternalId: "nao-existe" }]),
    );
    expect(r.ignored).toBe(1);
  });
});

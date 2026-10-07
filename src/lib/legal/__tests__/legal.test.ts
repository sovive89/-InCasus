import { describe, expect, test } from "bun:test";
import { datajudAliasFor, formatCnj, isValidCnj, normalizeCnj } from "../cnj";
import { dedupeMovements, movementDedupKey } from "../dedup";
import { DataJudProvider, normalizeDatajudHits, parseDatajudDate } from "../providers/datajud";
import { ProviderRouter } from "../provider-router";
import { LegalDataService, type LegalStore, type CachedProcess } from "../legal-data-service";
import { LegalDataError, type LegalDataProvider, type ProviderProcessResult } from "../types";

// CNJ de exemplo com dígito verificador calculado (mod 97)
function makeCnj(seq: string, year: string, j: string, tr: string, origin: string) {
  const base = BigInt(`${seq}${year}${j}${tr}${origin}00`);
  const dd = String(98n - (base % 97n)).padStart(2, "0");
  return `${seq}-${dd}.${year}.${j}.${tr}.${origin}`;
}
const CNJ = makeCnj("0000832", "2018", "4", "01", "3202");
const CNJ_TJDFT = makeCnj("0701234", "2024", "8", "07", "0001");

describe("CNJ", () => {
  test("valida e normaliza", () => {
    expect(isValidCnj(CNJ)).toBe(true);
    expect(formatCnj(CNJ.replace(/\D/g, ""))).toBe(CNJ);
    expect(normalizeCnj(` ${CNJ} `)).toBe(CNJ);
  });
  test("rejeita dígito verificador errado e tamanho errado", () => {
    expect(isValidCnj("1234")).toBe(false);
    expect(() => normalizeCnj("0000832-99.2018.4.01.3202")).toThrow();
  });
  test("alias do DataJud", () => {
    expect(datajudAliasFor(CNJ)).toBe("trf1");
    expect(datajudAliasFor(CNJ_TJDFT)).toBe("tjdft");
    expect(datajudAliasFor(makeCnj("0001000", "2023", "8", "26", "0100"))).toBe("tjsp");
    expect(datajudAliasFor(makeCnj("0001000", "2023", "5", "02", "0100"))).toBe("trt2");
    expect(datajudAliasFor(makeCnj("0001000", "2023", "2", "00", "0100"))).toBeNull();
  });
});

describe("deduplicação", () => {
  const a = { externalId: null, code: "123", title: "Juntada de Petição", description: "x", date: "2024-03-01T10:00:20.000Z" };
  test("mesma movimentação de fontes diferentes gera a mesma chave", async () => {
    const b = { ...a, title: "JUNTADA DE PETICAO", description: "texto diferente", date: "2024-03-01T10:00:50.000Z" };
    expect(await movementDedupKey(a)).toBe(await movementDedupKey(b));
  });
  test("remove duplicatas do lote", async () => {
    expect((await dedupeMovements([a, { ...a }, { ...a, code: "999" }])).length).toBe(2);
  });
});

describe("DataJud", () => {
  test("datas nos dois formatos", () => {
    expect(parseDatajudDate("20240115103000")).toBe("2024-01-15T10:30:00.000Z");
    expect(parseDatajudDate("2024-01-15T10:30:00.000Z")).toBe("2024-01-15T10:30:00.000Z");
    expect(parseDatajudDate(undefined)).toBeNull();
  });
  test("normaliza hits e ordena movimentações da mais nova para a mais antiga", () => {
    const { process, movements } = normalizeDatajudHits(CNJ, [
      { _id: "x", _source: {
        tribunal: "TRF1", grau: "G1", classe: { codigo: 7, nome: "Procedimento Comum" },
        orgaoJulgador: { nome: "1ª Vara" }, assuntos: [{ nome: "Aposentadoria" }], nivelSigilo: 0,
        dataAjuizamento: "20180508000000", dataHoraUltimaAtualizacao: "2024-02-01T00:00:00.000Z",
        movimentos: [
          { codigo: 1, nome: "Distribuição", dataHora: "2018-05-08T10:00:00.000Z" },
          { codigo: 2, nome: "Sentença", dataHora: "2024-01-10T10:00:00.000Z", complementosTabelados: [{ descricao: "procedente" }] },
        ] } },
    ]);
    expect(process.className).toBe("Procedimento Comum");
    expect(process.subject).toBe("Aposentadoria");
    expect(movements[0]!.title).toBe("Sentença");
    expect(movements[0]!.description).toBe("procedente");
    expect(process.lastMovementAt).toBe("2024-01-10T10:00:00.000Z");
  });
  test("sem resultados → NOT_FOUND", () => {
    expect(() => normalizeDatajudHits(CNJ, [])).toThrow(LegalDataError);
  });
  test("provider chama o índice correto e usa a chave só no header", async () => {
    let url = "", auth = "", body = "";
    const fakeFetch = (async (u: string, init: RequestInit) => {
      url = u; auth = (init.headers as Record<string, string>)["Authorization"]!; body = String(init.body);
      return new Response(JSON.stringify({ hits: { hits: [{ _id: "1", _source: { tribunal: "TRF1", movimentos: [{ codigo: 1, nome: "Distribuição", dataHora: "2018-05-08T10:00:00.000Z" }] } }] } }));
    }) as unknown as typeof fetch;
    const p = new DataJudProvider({ DATAJUD_API_KEY: "k" }, fakeFetch);
    const r = await p.getProcess(CNJ);
    expect(url).toContain("api_publica_trf1/_search");
    expect(auth).toBe("APIKey k");
    expect(body).toContain(CNJ.replace(/\D/g, ""));
    expect(r.provider).toBe("datajud");
    expect(JSON.stringify(r)).not.toContain('"k"');
  });
  test("401 → AUTHENTICATION_ERROR; 429 → RATE_LIMITED; sem chave → AUTHENTICATION_ERROR", async () => {
    const mk = (status: number) => new DataJudProvider({ DATAJUD_API_KEY: "k" }, (async () => new Response("", { status })) as unknown as typeof fetch);
    await expect(mk(401).getProcess(CNJ)).rejects.toMatchObject({ code: "AUTHENTICATION_ERROR" });
    await expect(mk(429).getProcess(CNJ)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(new DataJudProvider({}).getProcess(CNJ)).rejects.toMatchObject({ code: "AUTHENTICATION_ERROR" });
  });
});

function fakeProvider(id: "datajud" | "escavador", paid: boolean, impl: () => Promise<ProviderProcessResult>): LegalDataProvider & { calls: number } {
  const p = { id, paid, calls: 0, isConfigured: () => true, supports: () => true, getProcess: async () => { p.calls++; return impl(); } };
  return p;
}
const okResult = (provider: "datajud" | "escavador", secrecy = 0): ProviderProcessResult => ({
  provider, externalId: "e", rawHash: "h",
  process: { cnj: CNJ, tribunal: "TRF1", court: "Vara", degree: "G1", className: "C", classCode: 1, subject: "S", jurisdiction: null, judge: null, status: null, distributionDate: null, secrecyLevel: secrecy, lastMovementAt: null, parties: [] },
  movements: [{ externalId: null, code: "1", title: "T", description: "", date: "2024-01-01T00:00:00.000Z" }],
});

describe("roteador", () => {
  const settingsEconomy = { mode: "economy" as const, providers: { datajud: { enabled: true, priority: 10 }, escavador: { enabled: true, priority: 20 } } };
  test("modo econômico nunca chama provedor pago", async () => {
    const dj = fakeProvider("datajud", false, async () => { throw new LegalDataError("NOT_FOUND", "x", "datajud"); });
    const esc = fakeProvider("escavador", true, async () => okResult("escavador"));
    await expect(new ProviderRouter([dj, esc], settingsEconomy).getProcess(CNJ)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(esc.calls).toBe(0);
  });
  test("modo completo usa o pago como fallback", async () => {
    const dj = fakeProvider("datajud", false, async () => { throw new LegalDataError("PROVIDER_UNAVAILABLE", "x", "datajud"); });
    const esc = fakeProvider("escavador", true, async () => okResult("escavador"));
    const logs: string[] = [];
    const r = await new ProviderRouter([dj, esc], { ...settingsEconomy, mode: "full" }, (l) => logs.push(`${l.provider}:${l.success}`)).getProcess(CNJ);
    expect(r.provider).toBe("escavador");
    expect(logs).toEqual(["datajud:false", "escavador:true"]);
  });
  test("provedor desligado é ignorado", async () => {
    const dj = fakeProvider("datajud", false, async () => okResult("datajud"));
    const router = new ProviderRouter([dj], { mode: "economy", providers: { datajud: { enabled: false, priority: 1 } } });
    await expect(router.getProcess(CNJ)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(dj.calls).toBe(0);
  });
});

describe("serviço (cache, sigilo, acesso)", () => {
  function memoryStore(initial: CachedProcess | null) {
    const state = { cached: initial, saved: 0, grants: [] as string[], logs: [] as string[] };
    const store: LegalStore = {
      loadSettings: async () => ({ mode: "economy", providers: { datajud: { enabled: true, priority: 1 } } }),
      findCached: async () => state.cached,
      save: async () => { state.saved++; return { lastSyncAt: new Date().toISOString() }; },
      grantAccess: async (_c, u) => { state.grants.push(u); },
      logRequest: async (e) => { state.logs.push(`${e.provider}:${e.cached}`); },
      recordProviderStatus: async () => {},
    };
    return { store, state };
  }
  const cachedAt = (iso: string): CachedProcess => ({ process: { ...okResult("datajud").process, lastSyncAt: iso }, movements: [] });

  test("cache fresco não chama provedor", async () => {
    const now = Date.now();
    const { store, state } = memoryStore(cachedAt(new Date(now - 60_000).toISOString()));
    const dj = fakeProvider("datajud", false, async () => okResult("datajud"));
    const view = await new LegalDataService(store, [dj], () => now).getProcessByCnj(CNJ, "u1");
    expect(view.source).toBe("cache");
    expect(dj.calls).toBe(0);
    expect(state.grants).toEqual(["u1"]);
    expect(state.logs).toEqual(["cache:true"]);
  });
  test("cache vencido consulta o provedor e grava", async () => {
    const now = Date.now();
    const { store, state } = memoryStore(cachedAt(new Date(now - 7 * 3600_000).toISOString()));
    const dj = fakeProvider("datajud", false, async () => okResult("datajud"));
    const view = await new LegalDataService(store, [dj], () => now).getProcessByCnj(CNJ, "u1");
    expect(view.source).toBe("datajud");
    expect(state.saved).toBe(1);
  });
  test("provedor fora do ar + cache antigo → devolve antigo como stale", async () => {
    const now = Date.now();
    const { store } = memoryStore(cachedAt(new Date(now - 48 * 3600_000).toISOString()));
    const dj = fakeProvider("datajud", false, async () => { throw new LegalDataError("PROVIDER_UNAVAILABLE", "x", "datajud"); });
    const view = await new LegalDataService(store, [dj], () => now).getProcessByCnj(CNJ, "u1");
    expect(view.stale).toBe(true);
  });
  test("processo sigiloso é recusado e não é gravado", async () => {
    const { store, state } = memoryStore(null);
    const dj = fakeProvider("datajud", false, async () => okResult("datajud", 5));
    await expect(new LegalDataService(store, [dj]).getProcessByCnj(CNJ, "u1")).rejects.toMatchObject({ code: "SECRECY_RESTRICTED" });
    expect(state.saved).toBe(0);
    expect(state.grants).toEqual([]);
  });
  test("CNJ inválido não gasta consulta", async () => {
    const { store } = memoryStore(null);
    const dj = fakeProvider("datajud", false, async () => okResult("datajud"));
    await expect(new LegalDataService(store, [dj]).getProcessByCnj("123", "u1")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(dj.calls).toBe(0);
  });
});

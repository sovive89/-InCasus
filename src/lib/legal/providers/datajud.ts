/**
 * DataJud (CNJ) — API pública, gratuita. Fonte primária do modo econômico.
 * Credencial: variável de ambiente DATAJUD_API_KEY (chave pública divulgada pelo
 * CNJ). Fica só no servidor; nunca vai ao navegador.
 *
 * Limitação conhecida: a API pública não expõe partes nem documentos —
 * por isso `parties` vem vazio e `DOCUMENTS` não é suportado.
 */
import { datajudAliasFor, cnjDigits, formatCnj } from "../cnj";
import { movementPayloadHash, sha256 } from "../dedup";
import {
  LegalDataError,
  type LegalDataProvider,
  type LegalOperation,
  type NormalizedMovement,
  type NormalizedProcess,
  type ProviderProcessResult,
} from "../types";

const BASE_URL = "https://api-publica.datajud.cnj.jus.br";

type DatajudSource = {
  numeroProcesso?: string;
  classe?: { codigo?: number; nome?: string };
  tribunal?: string;
  grau?: string;
  dataAjuizamento?: string;
  dataHoraUltimaAtualizacao?: string;
  nivelSigilo?: number;
  orgaoJulgador?: { nome?: string; codigoMunicipioIBGE?: number };
  assuntos?: ({ nome?: string } | { nome?: string }[])[];
  movimentos?: {
    codigo?: number;
    nome?: string;
    dataHora?: string;
    complementosTabelados?: { nome?: string; descricao?: string }[];
  }[];
};

type DatajudResponse = { hits?: { hits?: { _id?: string; _source?: DatajudSource }[] } };

/** DataJud mistura "20240115103000" e ISO 8601. */
export function parseDatajudDate(value: string | undefined): string | null {
  if (!value) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/.exec(value);
  if (compact) {
    const [, y, mo, d, h = "00", mi = "00", s = "00"] = compact;
    return new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi, +s)).toISOString();
  }
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

function flattenSubjects(assuntos: DatajudSource["assuntos"]): string {
  const names: string[] = [];
  for (const a of assuntos ?? []) {
    for (const item of Array.isArray(a) ? a : [a]) if (item.nome) names.push(item.nome);
  }
  return [...new Set(names)].join(" · ");
}

export function normalizeDatajudHits(
  cnj: string,
  hits: { _id?: string; _source?: DatajudSource }[],
): { process: NormalizedProcess; movements: NormalizedMovement[]; externalId: string | null } {
  const sources = hits.flatMap((h) => (h._source ? [{ id: h._id ?? null, s: h._source }] : []));
  if (sources.length === 0) throw new LegalDataError("NOT_FOUND", "Processo não encontrado no DataJud.", "datajud");

  // Mesmo CNJ pode existir em mais de um grau (G1, G2). Usamos o mais recentemente atualizado como principal.
  const ordered = [...sources].sort((a, b) =>
    (b.s.dataHoraUltimaAtualizacao ?? "").localeCompare(a.s.dataHoraUltimaAtualizacao ?? ""),
  );
  const main = ordered[0]!;

  const movements: NormalizedMovement[] = [];
  for (const { s } of sources) {
    for (const m of s.movimentos ?? []) {
      const date = parseDatajudDate(m.dataHora);
      if (!date || !m.nome) continue;
      const complement = (m.complementosTabelados ?? [])
        .map((c) => c.descricao ?? c.nome)
        .filter(Boolean)
        .join("; ");
      movements.push({
        externalId: null,
        code: m.codigo != null ? String(m.codigo) : null,
        title: m.nome,
        description: complement,
        date,
      });
    }
  }
  movements.sort((a, b) => b.date.localeCompare(a.date));

  const secrecy = Math.max(...sources.map(({ s }) => s.nivelSigilo ?? 0));

  return {
    externalId: main.id,
    movements,
    process: {
      cnj,
      tribunal: main.s.tribunal ?? "",
      court: main.s.orgaoJulgador?.nome ?? main.s.tribunal ?? "",
      degree: main.s.grau ?? null,
      className: main.s.classe?.nome ?? "",
      classCode: main.s.classe?.codigo ?? null,
      subject: flattenSubjects(main.s.assuntos),
      jurisdiction: null,
      judge: null,
      status: null,
      distributionDate: parseDatajudDate(main.s.dataAjuizamento),
      secrecyLevel: secrecy,
      lastMovementAt: movements[0]?.date ?? null,
      parties: [],
    },
  };
}

export class DataJudProvider implements LegalDataProvider {
  readonly id = "datajud" as const;
  readonly paid = false;

  constructor(
    private readonly env: { DATAJUD_API_KEY?: string | undefined } = process.env,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured() {
    return Boolean(this.env.DATAJUD_API_KEY);
  }

  supports(operation: LegalOperation) {
    return operation === "PROCESS_DETAILS" || operation === "MOVEMENTS";
  }

  async getProcess(cnjInput: string): Promise<ProviderProcessResult> {
    const key = this.env.DATAJUD_API_KEY;
    if (!key) throw new LegalDataError("AUTHENTICATION_ERROR", "DataJud não configurado no servidor.", "datajud");

    const alias = datajudAliasFor(cnjInput);
    if (!alias) throw new LegalDataError("NOT_SUPPORTED", "Tribunal não atendido pelo DataJud.", "datajud");

    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE_URL}/api_publica_${alias}/_search`, {
        method: "POST",
        headers: { Authorization: `APIKey ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: { match: { numeroProcesso: cnjDigits(cnjInput) } }, size: 5 }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new LegalDataError("PROVIDER_UNAVAILABLE", "DataJud indisponível no momento.", "datajud");
    }

    if (res.status === 401 || res.status === 403)
      throw new LegalDataError("AUTHENTICATION_ERROR", "Credencial do DataJud recusada.", "datajud", res.status);
    if (res.status === 429)
      throw new LegalDataError("RATE_LIMITED", "Limite de consultas do DataJud atingido.", "datajud", 429);
    if (!res.ok)
      throw new LegalDataError("PROVIDER_UNAVAILABLE", `DataJud respondeu ${res.status}.`, "datajud", res.status);

    const body = (await res.json()) as DatajudResponse;
    const hits = body.hits?.hits ?? [];
    const cnj = formatCnj(cnjInput);
    const { process, movements, externalId } = normalizeDatajudHits(cnj, hits);
    const rawHash = await sha256(
      (await Promise.all(movements.map((m) => movementPayloadHash(m)))).join(",") + process.className,
    );
    return { provider: "datajud", externalId, rawHash, process, movements };
  }
}

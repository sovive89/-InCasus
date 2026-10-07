/**
 * Motor de variáveis dos modelos.
 *
 * Conceito: o modelo é um texto com "buracos" no formato {{cliente.nome}}. Renderizar é
 * trocar cada buraco pelo valor informado. Se faltar valor, o buraco vira [[cliente.nome]]
 * — bem visível — para o advogado completar; nada é inventado. Não há execução de código:
 * é só troca de texto.
 */

const VAR = /\{\{\s*([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)*)\s*\}\}/gi;

export function extractVariables(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(VAR)) seen.add((m[1] as string).toLowerCase());
  return [...seen];
}

export type RenderResult = { text: string; missing: string[] };

export function renderTemplate(body: string, values: Record<string, string>): RenderResult {
  const missing = new Set<string>();
  const text = body.replace(VAR, (_all, raw: string) => {
    const key = raw.toLowerCase();
    const value = values[key]?.trim();
    if (value) return value;
    missing.add(key);
    return `[[${key}]]`;
  });
  return { text, missing: [...missing] };
}

const LABELS: Record<string, string> = {
  "cliente.nome": "Nome do cliente",
  "cliente.nacionalidade": "Nacionalidade",
  "cliente.estado_civil": "Estado civil",
  "cliente.profissao": "Profissão",
  "cliente.cpf": "CPF",
  "cliente.rg": "RG",
  "cliente.endereco": "Endereço",
  "cliente.email": "E-mail",
  "advogado.nome": "Nome do(a) advogado(a)",
  "advogado.oab": "Nº da OAB",
  "advogado.oab_uf": "UF da OAB",
  "escritorio.endereco": "Endereço do escritório",
  "processo.cnj": "Número do processo (CNJ)",
  "data.hoje": "Data (curta)",
  "data.extenso": "Data por extenso",
  "honorarios.valor": "Valor dos honorários",
  "honorarios.forma": "Forma de pagamento",
  "honorarios.exito": "Honorários de êxito",
  "reu.nome": "Nome do réu",
  "reu.qualificacao": "Qualificação do réu",
  "autor.nome": "Nome do autor",
  "notificado.nome": "Nome do notificado",
  "notificado.endereco": "Endereço do notificado",
  valor_causa: "Valor da causa",
};

const GROUPS: Record<string, string> = {
  cliente: "Cliente",
  advogado: "Advogado(a)",
  escritorio: "Escritório",
  processo: "Processo",
  data: "Data",
  honorarios: "Honorários",
  reu: "Parte contrária",
  autor: "Parte contrária",
  notificado: "Notificado",
};

export function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const last = key.split(".").pop() ?? key;
  const text = last.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function groupFor(key: string): string {
  return key.includes(".") ? (GROUPS[key.split(".")[0] as string] ?? "Outros") : "Dados do caso";
}

/** Campos longos (fatos, fundamentos...) pedem área de texto. */
export function isLongField(key: string): boolean {
  return [
    "fatos",
    "fundamentos",
    "tutela",
    "pedidos",
    "provas",
    "sintese",
    "preliminares",
    "merito",
    "razoes",
    "pedido_recursal",
    "tempestividade",
    "honorarios.exito",
    "objeto",
  ].includes(key);
}

const TZ = "America/Sao_Paulo";

/** Valores que o sistema sabe sozinho (data de hoje). */
export function systemValues(now: Date): Record<string, string> {
  return {
    "data.hoje": new Intl.DateTimeFormat("pt-BR", { timeZone: TZ }).format(now),
    "data.extenso": new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: TZ,
    }).format(now),
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

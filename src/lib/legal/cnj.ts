/**
 * Número CNJ (Resolução CNJ 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO
 *   N = sequencial · D = dígito verificador · A = ano · J = segmento da Justiça
 *   TR = tribunal · O = unidade de origem
 * O dígito verificador usa módulo 97 (mesma ideia do IBAN): é ele que nos deixa
 * rejeitar um número digitado errado antes de gastar uma consulta.
 */
import { LegalDataError } from "./types";

export type CnjParts = {
  sequential: string;
  checkDigits: string;
  year: string;
  segment: string;
  court: string;
  origin: string;
};

export function cnjDigits(input: string): string {
  return input.replace(/\D/g, "");
}

export function parseCnj(input: string): CnjParts {
  const d = cnjDigits(input);
  if (d.length !== 20) {
    throw new LegalDataError("INVALID_INPUT", "O número CNJ deve ter 20 dígitos.");
  }
  return {
    sequential: d.slice(0, 7),
    checkDigits: d.slice(7, 9),
    year: d.slice(9, 13),
    segment: d.slice(13, 14),
    court: d.slice(14, 16),
    origin: d.slice(16, 20),
  };
}

export function isValidCnj(input: string): boolean {
  try {
    const p = parseCnj(input);
    const base = BigInt(`${p.sequential}${p.year}${p.segment}${p.court}${p.origin}00`);
    const expected = 98n - (base % 97n);
    return expected === BigInt(p.checkDigits);
  } catch {
    return false;
  }
}

/** Formato canônico usado como identificador no banco. */
export function formatCnj(input: string): string {
  const p = parseCnj(input);
  return `${p.sequential}-${p.checkDigits}.${p.year}.${p.segment}.${p.court}.${p.origin}`;
}

/** Valida e devolve o formato canônico, ou lança INVALID_INPUT. */
export function normalizeCnj(input: string): string {
  if (!isValidCnj(input)) {
    throw new LegalDataError("INVALID_INPUT", "Número CNJ inválido (dígito verificador não confere).");
  }
  return formatCnj(input);
}

const STATES = [
  "ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg", "pa",
  "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "se", "sp", "to",
] as const;

/**
 * Descobre o "alias" do índice DataJud (ex.: tjdft, trf1, trt2, tre-sp) a partir
 * dos dígitos J.TR. Devolve null quando o tribunal não é atendido pelo DataJud.
 */
export function datajudAliasFor(input: string): string | null {
  const { segment, court } = parseCnj(input);
  const tr = Number(court);
  switch (segment) {
    case "3": // STJ
      return "stj";
    case "4": // Justiça Federal
      return tr >= 1 && tr <= 6 ? `trf${tr}` : null;
    case "5": // Justiça do Trabalho (TR 00 = TST)
      if (tr === 0) return "tst";
      return tr >= 1 && tr <= 24 ? `trt${tr}` : null;
    case "6": { // Justiça Eleitoral (TR 00 = TSE)
      if (tr === 0) return "tse";
      const uf = STATES[tr - 1];
      return uf ? `tre-${uf}` : null;
    }
    case "7": // Justiça Militar da União
      return "stm";
    case "8": { // Justiça Estadual
      const uf = STATES[tr - 1];
      if (!uf) return null;
      return uf === "df" ? "tjdft" : `tj${uf}`;
    }
    case "9": { // Justiça Militar Estadual
      const map: Record<number, string> = { 13: "tjmmg", 21: "tjmrs", 26: "tjmsp" };
      return map[tr] ?? null;
    }
    default:
      return null;
  }
}

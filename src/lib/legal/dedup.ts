/**
 * Deduplicação de movimentações.
 *
 * Conceito: duas fontes podem relatar o mesmo andamento com textos levemente
 * diferentes. A "chave de deduplicação" usa só o que é estável entre fontes —
 * data/hora (ao minuto) + código da movimentação (ou o título normalizado) —
 * para que DataJud e Escavador gerem a MESMA chave e o banco
 * (unique process_id + dedup_key) recuse a segunda cópia.
 * O hash do conteúdo completo fica guardado à parte, para auditoria.
 */
import type { NormalizedMovement } from "./types";

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function minuteOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 16);
}

export function movementDedupKey(m: NormalizedMovement): Promise<string> {
  const what = m.code ? `code:${m.code}` : `title:${normalizeText(m.title)}`;
  return sha256(`${minuteOf(m.date)}|${what}`);
}

export function movementPayloadHash(m: NormalizedMovement): Promise<string> {
  return sha256(
    [minuteOf(m.date), m.code ?? "", normalizeText(m.title), normalizeText(m.description)].join("|"),
  );
}

/** Remove duplicatas dentro de um mesmo lote (antes de ir ao banco). */
export async function dedupeMovements<T extends NormalizedMovement>(list: T[]): Promise<T[]> {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const m of list) {
    const key = await movementDedupKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

import { getSession } from "@/lib/auth/session";
import { confirmedReviewItems, reviewedDocumentSchema, type ReviewItem } from "@/lib/services/document-review";
import { recordDemoDocumentAction } from "./audit";
const KEY = "incasus.reviewed-documents.demo.v1";
export function readReviewedDocuments(processId: string) {
  try { return reviewedDocumentSchema.array().parse(JSON.parse(localStorage.getItem(KEY) ?? "[]")).filter((item) => item.processId === processId); }
  catch { return []; }
}
export function saveReviewedDocument(id: string, processId: string, fileName: string, items: ReviewItem[]) {
  const confirmed = confirmedReviewItems(items);
  if (!confirmed.length) throw new Error("Nenhum item confirmado para salvar.");
  const raw = localStorage.getItem(KEY);
  const previous = raw ? reviewedDocumentSchema.array().parse(JSON.parse(raw)) : [];
  const document = reviewedDocumentSchema.parse({ id, processId, fileName, reviewer: getSession()?.profile.name ?? "Advogado demonstrativo", reviewedAt: new Date().toISOString(), items: confirmed });
  localStorage.setItem(KEY, JSON.stringify([...previous.filter((item) => item.id !== id), document]));
  try { recordDemoDocumentAction(id, "Revisão confirmada e salva", { processo: processId, arquivo: fileName, pontos: confirmed.filter((item) => item.kind === "point").length, prazos: confirmed.filter((item) => item.kind === "deadline").length }); } catch { /* Reviewed content remains saved even if local audit storage is unavailable. */ }
}
import { z } from "zod";
export const reviewItemSchema = z.object({ id: z.string(), kind: z.enum(["point", "deadline"]), text: z.string().trim().min(1), date: z.string().nullable(), source: z.string(), status: z.enum(["pending", "confirmed", "discarded"]) });
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export function confirmedReviewItems(items: ReviewItem[]) {
  if (items.some((item) => item.status === "pending")) throw new Error("Revise todos os pontos e prazos antes de salvar.");
  return items.filter((item) => item.status === "confirmed").map((item) => reviewItemSchema.parse(item));
}
export const reviewedDocumentSchema = z.object({ id: z.string(), processId: z.string(), fileName: z.string(), reviewer: z.string(), reviewedAt: z.string(), items: reviewItemSchema.array() });
export type ReviewedDocument = z.infer<typeof reviewedDocumentSchema>;
import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmedReviewItems, type ReviewItem } from "./document-review";
const item: ReviewItem = { id: "1", kind: "point", text: "Texto original", date: null, source: "", status: "pending" };
test("itens pendentes impedem salvamento", () => assert.throws(() => confirmedReviewItems([item])));
test("somente itens confirmados são salvos", () => assert.equal(confirmedReviewItems([{ ...item, status: "confirmed" }, { ...item, id: "2", status: "discarded" }]).length, 1));
test("edições de pontos e datas são preservadas", () => { const saved = confirmedReviewItems([{ ...item, kind: "deadline", text: "Prazo revisado", date: "2026-11-20", status: "confirmed" }]); assert.equal(saved[0]?.text, "Prazo revisado"); assert.equal(saved[0]?.date, "2026-11-20"); });
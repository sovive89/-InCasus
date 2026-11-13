import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Send, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentAnalysisResult } from "@/lib/ai/document-analysis.functions";
import { askDocumentQuestion, type DocumentAnswer } from "@/lib/ai/document-question.functions";
import type { ReviewItem } from "@/lib/services/document-review";
import { saveReviewedDocument } from "@/lib/repositories/document-review";
import { saveCloudReview } from '@/lib/real/records.functions';
import { useQueryClient } from '@tanstack/react-query';
export function DocumentReviewWorkspace({ result, text, fileName, processId }: { result: DocumentAnalysisResult; text: string; fileName: string; processId: string }) {
  const ask = useServerFn(askDocumentQuestion);
  const saveCloud = useServerFn(saveCloudReview); const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>(() => [...result.keyPoints.map((point, i) => ({ id: `point-${i}`, kind: "point" as const, text: point, date: null, source: "", status: "pending" as const })), ...result.deadlines.map((deadline, i) => ({ id: `deadline-${i}`, kind: "deadline" as const, text: deadline.description, date: deadline.date, source: deadline.sourceExcerpt, status: "pending" as const }))]);
  const [savedId, setSavedId] = useState("");
  const [saved, setSaved] = useState(false);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ question: string; result: DocumentAnswer }[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [questionError, setQuestionError] = useState("");
  function update(id: string, changes: Partial<ReviewItem>) { setSaved(false); setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item)); }
  async function submitQuestion() {
    if (asking || question.trim().length < 3) return;
    setAsking(true); setQuestionError("");
    try { const response = await ask({ data: { question, documents: [{ name: fileName, text }] } }); if (!response.ok) throw new Error(response.error); setAnswers((current) => [...current, { question, result: response.result }]); setQuestion(""); }
    catch (cause) { setQuestionError(cause instanceof Error ? cause.message : "Não foi possível responder."); }
    finally { setAsking(false); }
  }
  async function save() {
    setError("");
    setSaving(true);
    try { const id = savedId || crypto.randomUUID(); await saveCloud({data:{id,processId,fileName,items}}); await qc.invalidateQueries({queryKey:['legal-workspace']}); setSavedId(id); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  return <div className="space-y-7">
    <section><h3 className="mb-3 text-sm font-semibold">Revisão de pontos principais e prazos</h3><div className="divide-y divide-border">{items.map((item, index) => <div key={item.id} className="space-y-3 py-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-primary">{item.kind === "point" ? "Ponto principal" : "Prazo"} {index + 1}</span><span className="text-xs text-muted-foreground">{item.status === "confirmed" ? "Confirmado" : item.status === "discarded" ? "Descartado" : "Pendente de revisão"}</span></div><Textarea aria-label={`Texto do item ${index + 1}`} value={item.text} disabled={item.status === "discarded"} onChange={(event) => update(item.id, { text: event.target.value, status: "pending" })} />{item.kind === "deadline" && <div><label className="mb-1 block text-xs" htmlFor={item.id}>Data do prazo</label><Input id={item.id} aria-label={`Data do item ${index + 1}`} type="date" value={item.date ?? ""} disabled={item.status === "discarded"} onChange={(event) => update(item.id, { date: event.target.value || null, status: "pending" })}/>{item.source && <p className="mt-2 break-words text-xs text-muted-foreground">Trecho: “{item.source}”</p>}</div>}<div className="flex flex-wrap gap-2"><Button size="sm" variant="quiet" disabled={!item.text.trim() || item.status === "confirmed"} onClick={() => update(item.id, { status: "confirmed" })}><Check/>Confirmar</Button><Button size="sm" variant="quiet" disabled={item.status === "discarded"} onClick={() => update(item.id, { status: "discarded" })}><Trash2/>Descartar</Button></div></div>)}</div><p className="my-3 text-xs text-important">Salvamento demonstrativo neste navegador; o documento completo não será armazenado.</p>{error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}<Button variant="command" disabled={saved || !items.length || items.some((item) => item.status === "pending") || !items.some((item) => item.status === "confirmed")} onClick={save}><Save/>{saved ? "Salvo no processo" : "Salvar itens confirmados no processo"}</Button>{saved && <p role="status" className="mt-2 text-sm text-primary">Itens revisados salvos no processo demonstrativo.</p>}</section>
    <section className="border-t border-border pt-5"><h3 className="mb-3 text-sm font-semibold">Perguntar sobre este documento</h3><p className="mb-3 break-words text-xs text-muted-foreground">{fileName} · Conteúdo disponível enquanto esta análise estiver aberta.</p><div className="space-y-5">{answers.map((entry, index) => <div key={index} className="border-l-2 border-primary pl-4"><p className="text-sm font-semibold">{entry.question}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{entry.result.answer}</p>{entry.result.citations.map((citation, i) => <blockquote key={i} className="mt-3 break-words text-xs leading-5 text-muted-foreground">{citation.document}: “{citation.excerpt}”</blockquote>)}</div>)}</div><Textarea className="mt-4" aria-label="Pergunta sobre o documento" placeholder="Qual é o prazo mencionado neste documento?" value={question} maxLength={2000} disabled={asking} onChange={(event) => setQuestion(event.target.value)}/>{questionError && <p role="alert" className="mt-2 text-sm text-destructive">{questionError}</p>}<div className="mt-3 flex justify-end"><Button variant="command" disabled={asking || question.trim().length < 3} onClick={() => void submitQuestion()}>{asking ? <Loader2 className="animate-spin"/> : <Send/>}{asking ? "Consultando documento…" : "Perguntar"}</Button></div></section>
  </div>;
}
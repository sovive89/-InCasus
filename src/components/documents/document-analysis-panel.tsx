import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { analyzeLegalDocument, type DocumentAnalysisResult } from "@/lib/ai/document-analysis.functions";
import { AI_DISCLAIMER } from "@/lib/domain/labels";
import { processRepository } from "@/lib/repositories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DocumentAnalysisPanel() {
  const analyze = useServerFn(analyzeLegalDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const processes = processRepository.list();
  const [open, setOpen] = useState(false);
  const [processId, setProcessId] = useState(processes[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "extracting" | "analyzing">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<DocumentAnalysisResult | null>(null);

  async function submit() {
    const process = processes.find((item) => item.id === processId);
    if (!file || !process || phase !== "idle") return;
    setError("");
    setResult(null);
    try {
      setPhase("extracting");
      const { extractDocumentText } = await import("@/lib/document-text");
      const text = await extractDocumentText(file);
      setPhase("analyzing");
      const response = await analyze({
        data: { fileName: file.name, processLabel: `${process.cnj} — ${process.subject}`, text },
      });
      if (!response.ok) throw new Error(response.error);
      setResult(response.analysis);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível analisar o documento.");
    } finally {
      setPhase("idle");
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
    <DialogTrigger asChild><Button variant="command"><Upload />Enviar e analisar</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle className="font-display">Analisar documento do processo</DialogTitle><DialogDescription>Envie PDF, DOCX ou TXT. O conteúdo será usado para gerar o resumo e não será salvo nesta etapa.</DialogDescription></DialogHeader>
      {!result ? <div className="space-y-5">
        <div><label className="mb-2 block text-xs font-medium">Processo</label><Select value={processId} onValueChange={setProcessId} disabled={phase !== "idle"}><SelectTrigger className="h-11 bg-surface"><SelectValue /></SelectTrigger><SelectContent>{processes.map((process) => <SelectItem key={process.id} value={process.id}>{process.cnj} · {process.subject}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="mb-2 block text-xs font-medium">Documento</label><input ref={inputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); }} /><button type="button" onClick={() => inputRef.current?.click()} disabled={phase !== "idle"} className="flex min-h-32 w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-5 text-center transition hover:border-primary/50 disabled:opacity-50"><FileText className="mb-3 size-6 text-primary"/><span className="text-sm font-medium">{file?.name ?? "Selecionar arquivo"}</span><span className="mt-1 text-xs text-muted-foreground">PDF, DOCX ou TXT · até 10 MB</span></button></div>
        {error && <div role="alert" className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0"/>{error}</div>}
        <div className="flex justify-end"><Button variant="command" disabled={!file || !processId || phase !== "idle"} onClick={() => void submit()}>{phase !== "idle" ? <Loader2 className="animate-spin"/> : <Sparkles/>}{phase === "extracting" ? "Lendo documento…" : phase === "analyzing" ? "Analisando com IA…" : "Gerar resumo"}</Button></div>
      </div> : <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary"/><div><p className="text-xs font-semibold uppercase text-primary">{result.documentType}</p><p className="mt-2 text-sm leading-6 text-foreground">{result.summary}</p></div></div>
        <ResultList title="Pontos principais" items={result.keyPoints}/>
        <section><h3 className="mb-3 font-display text-sm font-semibold">Prazos e datas</h3>{result.deadlines.length ? <div className="divide-y divide-border rounded-lg border border-border">{result.deadlines.map((deadline, index) => <div key={`${deadline.description}-${index}`} className="flex gap-3 p-4"><CalendarClock className="mt-0.5 size-4 shrink-0 text-important"/><div><p className="text-sm font-medium">{deadline.date ?? "Data a confirmar"} · {deadline.description}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Trecho: “{deadline.sourceExcerpt}”</p><span className="mt-2 inline-block text-[10px] uppercase text-muted-foreground">{deadline.certainty === "explicit" ? "Data explícita" : "Prazo possível — confirmar"}</span></div></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum prazo foi identificado no conteúdo.</p>}</section>
        <ResultList title="Pontos de atenção" items={result.attentionPoints}/>
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">{AI_DISCLAIMER}</p>
        <div className="flex justify-end"><Button variant="quiet" onClick={reset}>Analisar outro documento</Button></div>
      </div>}
    </DialogContent>
  </Dialog>;
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return <section><h3 className="mb-3 font-display text-sm font-semibold">{title}</h3>{items.length ? <ul className="space-y-2">{items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"/>{item}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhum item identificado.</p>}</section>;
}
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/domain/page-header";
import { clientRepository } from "@/lib/repositories";
import { filterReportRows, getReportRows, reportFiltersSchema, type ReportFilters, type ReportRow } from "@/lib/services/reports";
import { createReportPdf } from "@/lib/services/report-pdf";
import { deliverFile } from "@/lib/download";

export const Route = createFileRoute("/advogado/relatorios")({
  head: () => ({ meta: [
    { title: "Relatórios em PDF — InCasus" },
    { name: "description", content: "Relatórios de processos e atividades por cliente, período e responsável." },
    { property: "og:title", content: "Relatórios em PDF — InCasus" },
    { property: "og:description", content: "Exporte processos e atividades com filtros personalizados." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Page,
});
const defaults: ReportFilters = { clientId: "", responsible: "", from: "", to: "", type: "all" };
const selectClass = "h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground";
function Page() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [filters, setFilters] = useState(defaults);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setRows(getReportRows()); }, []);
  const valid = reportFiltersSchema.safeParse(filters);
  const filtered = useMemo(() => reportFiltersSchema.safeParse(filters).success ? filterReportRows(rows, filters) : [], [rows, filters]);
  const responsibleNames = [...new Set(rows.map((row) => row.responsible))].sort();
  function change(key: keyof ReportFilters, value: string) { setFilters((current) => ({ ...current, [key]: value })); setPdf(null); setError(""); }
  async function generate() {
    setLoading(true); setError(""); setPdf(null);
    try { setPdf(await createReportPdf(filtered, filters, filters.clientId ? clientRepository.byId(filters.clientId)?.name ?? "Cliente" : "Todos os clientes")); }
    catch { setError("Não foi possível gerar o PDF. Tente novamente."); }
    finally { setLoading(false); }
  }
  return <>
    <PageHeader eyebrow="Documentação" title="Relatórios" action={pdf ? <Button onClick={() => { void deliverFile(pdf, "incasus-relatorio.pdf").catch(() => setError("Não foi possível baixar o PDF.")); }}><Download />Baixar PDF</Button> : <Button disabled={loading || !valid.success || !filtered.length} onClick={() => void generate()}>{loading ? <Loader2 className="animate-spin" /> : <FileText />}{loading ? "Gerando PDF…" : "Gerar PDF"}</Button>} />
    <p className="mb-6 border-l-2 border-important pl-3 text-xs leading-5 text-muted-foreground">Dados demonstrativos e agenda local. Processos e tarefas sem responsável cadastrado aparecem como “Não atribuído”.</p>
    <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <div className="min-w-0 space-y-2"><Label htmlFor="report-client">Cliente</Label><select id="report-client" className={selectClass} value={filters.clientId} disabled={loading} onChange={(event) => change("clientId", event.target.value)}><option value="">Todos os clientes</option>{clientRepository.list().map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="report-from">Data inicial</Label><Input id="report-from" type="date" disabled={loading} value={filters.from} onChange={(event) => change("from", event.target.value)} /></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="report-to">Data final</Label><Input id="report-to" type="date" disabled={loading} value={filters.to} onChange={(event) => change("to", event.target.value)} /></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="report-responsible">Responsável</Label><select id="report-responsible" className={selectClass} disabled={loading} value={filters.responsible} onChange={(event) => change("responsible", event.target.value)}><option value="">Todos os responsáveis</option>{responsibleNames.map((name) => <option key={name}>{name}</option>)}</select></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="report-type">Conteúdo</Label><select id="report-type" className={selectClass} disabled={loading} value={filters.type} onChange={(event) => change("type", event.target.value)}><option value="all">Processos e atividades</option><option value="process">Processos</option><option value="activity">Atividades</option></select></div>
    </div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs leading-5 text-muted-foreground">Período pela última movimentação do processo e pela data da atividade.</p><Button variant="ghost" size="sm" disabled={loading} onClick={() => { setFilters(defaults); setRows(getReportRows()); setPdf(null); setError(""); }}><RefreshCw />Limpar filtros</Button></div>
    {!valid.success && <p role="alert" className="mb-4 text-sm text-destructive">{valid.error.issues[0]?.message}</p>}
    {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
    {pdf && <p role="status" className="mb-5 text-sm text-primary">PDF pronto para download.</p>}
    <div className="mb-5 flex flex-wrap gap-6 border-y border-border py-4 text-sm"><p><span className="font-semibold">{filtered.filter((row) => row.section === "process").length}</span> processos</p><p><span className="font-semibold">{filtered.filter((row) => row.section === "activity").length}</span> atividades</p></div>
    <div className="divide-y divide-border">{filtered.map((row) => <article key={row.id} className="grid gap-3 py-5 md:grid-cols-[140px_1fr_180px]"><div><p className="text-xs text-primary">{row.section === "process" ? "Processo" : row.kind}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(row.date).toLocaleDateString("pt-BR")}</p></div><div className="min-w-0"><h2 className="break-words text-sm font-semibold">{row.title}</h2><p className="mt-1 text-xs text-muted-foreground">{row.client}</p><p className="mt-2 whitespace-pre-line break-words text-xs leading-5 text-muted-foreground">{row.details}</p></div><p className="break-words text-xs text-muted-foreground">{row.responsible}</p></article>)}</div>
    {!filtered.length && valid.success && <p className="py-12 text-center text-sm text-muted-foreground">Nenhum registro encontrado para estes filtros.</p>}
  </>;
}
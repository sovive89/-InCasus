import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/domain/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { readDemoAudit } from "@/lib/repositories/audit";
import { auditSchema, filterAudit, type AuditEntry } from "@/lib/services/audit";
import { listAuditLogs } from "@/lib/services/audit.functions";

export const Route = createFileRoute("/_authenticated/advogado/auditoria")({
  head: () => ({ meta: [
    { title: "Trilha de auditoria — InCasus" },
    { name: "description", content: "Histórico de alterações em processos, documentos e permissões com usuário, data e detalhes." },
    { property: "og:title", content: "Trilha de auditoria — InCasus" },
    { property: "og:description", content: "Consulte ações e alterações nos registros jurídicos." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Page,
});
const labels = { process: "Processo", document: "Documento", permission: "Permissão", calendar: "Agenda" };
const actions: Record<string, string> = { create: "Criação", update: "Alteração", delete: "Exclusão" };
const selectClass = "h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground";
function Page() {
  const fetchOfficial = useServerFn(listAuditLogs);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [source, setSource] = useState<"demo" | "cloud">("demo");
  const [filters, setFilters] = useState({ entityType: "", search: "", from: "", to: "" });
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setEntries(readDemoAudit()); }, []);
  async function refresh(next = source) {
    setSource(next); setError(""); setEntries([]); setLoading(true);
    try { setEntries(next === "demo" ? readDemoAudit() : auditSchema.array().parse(JSON.parse(await fetchOfficial()))); }
    catch { setError("O histórico oficial exige uma conta autenticada na Lovable Cloud; o acesso atual é demonstrativo."); }
    finally { setLoading(false); }
  }
  const visible = filterAudit(entries, filters);
  return <>
    <PageHeader eyebrow="Rastreabilidade" title="Trilha de auditoria" action={<Button variant="outline" disabled={loading} onClick={() => void refresh()}><RefreshCw className={loading ? "animate-spin" : ""} />Atualizar</Button>} />
    <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Origem do histórico"><Button variant={source === "demo" ? "secondary" : "outline"} aria-pressed={source === "demo"} onClick={() => void refresh("demo")}><History />Demonstração</Button><Button variant={source === "cloud" ? "secondary" : "outline"} aria-pressed={source === "cloud"} onClick={() => void refresh("cloud")}><ShieldCheck />Registros oficiais</Button></div>
    <p className="mb-6 border-l-2 border-important pl-3 text-xs leading-5 text-muted-foreground">{source === "demo" ? "Histórico local de ações de documentos. Não substitui a auditoria oficial. Processos e permissões demonstrativos não possuem alterações persistentes." : "Histórico protegido de registros persistentes. Usuário e horário são registrados automaticamente na Lovable Cloud."}</p>
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="audit-search">Usuário ou ação</Label><div className="relative"><Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" /><Input id="audit-search" className="pl-9" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></div></div>
      <div className="space-y-2"><Label htmlFor="audit-resource">Recurso</Label><select id="audit-resource" className={selectClass} value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}><option value="">Todos os recursos</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="audit-from">De (UTC)</Label><Input id="audit-from" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="audit-to">Até (UTC)</Label><Input id="audit-to" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></div>
    </div>
    {error && <p role="alert" className="mb-5 text-sm text-important">{error}</p>}
    <p role="status" className="mb-3 text-xs text-muted-foreground">{loading ? "Consultando histórico…" : `${visible.length} registros${source === "cloud" ? " · até 500 mais recentes" : ""}`}</p>
    <div className="divide-y divide-border border-y border-border">{visible.map((entry) => <article key={entry.id} className="grid gap-3 py-5 sm:grid-cols-[160px_1fr_auto]">
      <div><p className="text-sm font-medium">{new Date(entry.occurredAt).toLocaleDateString("pt-BR")}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleTimeString("pt-BR")}</p></div>
      <div className="min-w-0"><p className="break-words text-sm font-semibold">{actions[entry.action] ?? entry.action} · {labels[entry.entityType]}</p><p className="mt-1 break-words text-xs text-muted-foreground">{entry.actor}</p><p className="mt-2 break-all text-xs text-muted-foreground">{entry.entityId}</p></div>
      <Button variant="outline" size="sm" onClick={() => setSelected(entry)}>Ver detalhes</Button>
    </article>)}</div>
    {!loading && !visible.length && !error && <div className="py-16 text-center"><History className="mx-auto mb-4 size-7 text-muted-foreground" /><p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p></div>}
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Detalhes da ação</DialogTitle><DialogDescription>{selected ? `${labels[selected.entityType]} · ${actions[selected.action] ?? selected.action}` : ""}</DialogDescription></DialogHeader>{selected && <div className="space-y-5"><dl className="space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Usuário</dt><dd className="break-all">{selected.actor}</dd></div><div><dt className="text-xs text-muted-foreground">Data e horário (UTC)</dt><dd>{selected.occurredAt}</dd></div><div><dt className="text-xs text-muted-foreground">Registro</dt><dd className="break-all">{selected.entityId}</dd></div></dl>{[["Detalhes", selected.details], ["Antes", selected.before], ["Depois", selected.after]].map(([title, value]) => value && <section key={String(title)}><h3 className="mb-2 text-sm font-semibold">{String(title)}</h3><pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-surface p-3 text-xs leading-5">{JSON.stringify(value, null, 2)}</pre></section>)}</div>}</DialogContent></Dialog>
  </>;
}

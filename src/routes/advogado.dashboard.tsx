import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, BriefcaseBusiness, CalendarDays, FileSearch, Files, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { aiRepository, appointmentRepository, clientRepository, processRepository } from "@/lib/repositories";
import { getAttentionItems, getCaseSummary, getClientSummary, getTodayAgenda } from "@/lib/services/commandCenter";
import { formatDate, formatTime } from "@/lib/domain/labels";

export const Route = createFileRoute("/advogado/dashboard")({
  head: () => ({ meta: [
    { title: "Command Center — Juris Agent" },
    { name: "description", content: "Visão central de processos, clientes, agenda e análises jurídicas." },
    { property: "og:title", content: "Command Center — Juris Agent" },
    { property: "og:description", content: "Visão central de processos, clientes, agenda e análises jurídicas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const attention = getAttentionItems(); const today = getTodayAgenda(); const cs = getClientSummary(); const ks = getCaseSummary(); const actions = aiRepository.actions();
  const stats = [
    { label: "Processos monitorados", value: processRepository.list().length, icon: FileSearch },
    { label: "Clientes ativos", value: cs.ativos + cs.pendencias + cs.aguardando, icon: Users },
    { label: "Casos em curso", value: ks.total, icon: BriefcaseBusiness },
    { label: "Ações da IA", value: actions.length, icon: Sparkles },
  ];
  return <>
    <PageHeader eyebrow="Visão de hoje" title="Command Center" description="O que precisa da sua atenção, sem ruído." action={<Button asChild variant="command"><Link to="/advogado/assistente"><Bot /> Perguntar ao assistente</Link></Button>} />
    <section className="mb-8 grid grid-cols-2 border-y border-border lg:grid-cols-4">{stats.map((s,i) => <div key={s.label} className={`px-4 py-5 sm:px-6 ${i>0 ? "border-l border-border" : ""}`}><div className="mb-3 flex items-center justify-between"><span className="text-xs text-muted-foreground">{s.label}</span><s.icon className="size-4 text-primary" /></div><div className="font-display text-3xl font-semibold">{s.value.toString().padStart(2,"0")}</div></div>)}</section>
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <section><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Prioridades</p><h2 className="mt-1 font-display text-lg font-semibold">Atenção</h2></div><span className="text-xs text-muted-foreground">{attention.length} itens</span></div><div className="overflow-hidden rounded-lg border border-border bg-surface">{attention.slice(0,7).map((item,i) => <div key={item.id} className={`group flex gap-3 px-4 py-4 sm:px-5 ${i ? "border-t border-border" : ""}`}><div className="pt-0.5"><StatusBadge level={item.level} /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium leading-5">{item.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.context} · {item.detail}</p></div>{item.href?.to === "/advogado/processos/$id" && item.href.params?.id ? <Link to="/advogado/processos/$id" params={{ id: item.href.params.id }} className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"><ArrowRight className="size-4" /></Link> : item.href?.to === "/advogado/clientes/$id" && item.href.params?.id ? <Link to="/advogado/clientes/$id" params={{ id: item.href.params.id }} className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"><ArrowRight className="size-4" /></Link> : null}</div>)}</div></section>
      <section><div className="mb-4"><p className="eyebrow">Agenda</p><h2 className="mt-1 font-display text-lg font-semibold">Hoje</h2></div><div className="rounded-lg border border-border bg-surface"><div className="divide-y divide-border">{today.map((a) => { const client=clientRepository.byId(a.clientId); return <div key={a.id} className="flex gap-4 p-4"><div className="w-12 shrink-0 font-display text-sm font-semibold text-primary">{formatTime(a.startsAt)}</div><div><p className="text-sm font-medium">{a.title}</p><p className="mt-1 text-xs text-muted-foreground">{client?.name} · {a.location}</p></div></div>})}</div><Button asChild variant="ghost" className="m-2 w-[calc(100%-1rem)] justify-between"><Link to="/advogado/agenda"><span>Ver agenda completa</span><ArrowRight /></Link></Button></div>
        <div className="mt-8 mb-4"><p className="eyebrow">Atividade da IA</p><h2 className="mt-1 font-display text-lg font-semibold">Últimas análises</h2></div><div className="space-y-1">{actions.slice(0,3).map((a) => <div key={a.id} className="flex gap-3 rounded-md px-3 py-3 hover:bg-surface"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-sm font-medium">{a.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{a.summary}</p><p className="mt-1 text-[10px] text-muted-foreground">{formatDate(a.createdAt)}</p></div></div>)}</div>
      </section>
    </div>
  </>;
}

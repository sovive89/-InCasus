import { useEffect, useState, type FormEvent } from "react";
import { addMonths, addWeeks, format, isSameDay, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/domain/page-header";
import { calendarRepository } from "@/lib/repositories/calendar";
import { clientRepository, processRepository } from "@/lib/repositories";
import { calendarDays, calendarEventSchema, clientCalendarEvents, eventKinds, eventsOnDay, type CalendarEvent, type CalendarView } from "@/lib/services/calendar";
import { cn } from "@/lib/utils";
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useAccount, useLegalWorkspace } from '@/lib/real/workspace';
import { saveCalendarRecord, removeCalendarRecord } from '@/lib/real/records.functions';

const kindClasses: Record<CalendarEvent["kind"], string> = {
  deadline: "border-critical/40 bg-critical/10 text-critical",
  hearing: "border-primary/40 bg-primary/10 text-primary",
  meeting: "border-followup/40 bg-followup/10 text-followup",
  call: "border-border bg-muted text-muted-foreground",
};
const selectClass = "h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function SharedCalendar({ clientId }: { clientId?: string }) {
  const workspace = useLegalWorkspace(); const account = useAccount(); const qc = useQueryClient();
  const saveCloud = useServerFn(saveCalendarRecord); const removeCloud = useServerFn(removeCalendarRecord);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [date, setDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [kindFilter, setKindFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const readOnly = account.role !== 'lawyer';
  useEffect(() => {
    setEvents(workspace.calendar.map((row) => calendarEventSchema.parse({ id:row.id, title:row.title, kind:row.kind, startsAt:row.starts_at, responsible:row.responsible, clientId:row.client_id ?? '', processId:row.process_id ?? '', location:row.location, notes:row.notes })));
  }, [workspace]);
  const visible = events;
  const filtered = visible.filter((event) => (!kindFilter || event.kind === kindFilter) && (!responsibleFilter || event.responsible === responsibleFilter));
  const days = calendarDays(date, view);
  const selectedEvents = eventsOnDay(filtered, selectedDate);
  const responsibleNames = [...new Set(visible.map((event) => event.responsible))].sort();

  function newEvent(day = selectedDate) {
    setError("");
    setEditing({ id: crypto.randomUUID(), title: "", kind: "deadline", startsAt: `${format(day, "yyyy-MM-dd")}T09:00`, responsible: account.name, clientId: "", processId: "", location: "", notes: "" });
  }
  function move(direction: number) {
    const next = view === "month" ? addMonths(date, direction) : addWeeks(date, direction);
    setDate(next); setSelectedDate(next);
  }
  function update(field: keyof CalendarEvent, value: string) {
    setEditing((current) => current ? { ...current, [field]: value } : null);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const result = calendarEventSchema.safeParse(editing);
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Revise os campos."); return; }
    setBusy(true);
    try {
      await saveCloud({ data: result.data });
      await qc.invalidateQueries({ queryKey:['legal-workspace'] });
      const target = new Date(result.data.startsAt);
      setDate(target); setSelectedDate(target); setEditing(null); setNotice("Compromisso salvo.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!editing || !window.confirm("Excluir este compromisso?")) return;
    setBusy(true);
    try { await removeCloud({data:editing.id}); await qc.invalidateQueries({queryKey:['legal-workspace']}); setEditing(null); setNotice("Compromisso excluído."); }
    catch { setError("Não foi possível excluir. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeader eyebrow="Planejamento" title={readOnly ? "Minha agenda" : "Calendário compartilhado"} action={!readOnly ? <Button onClick={() => newEvent()}><Plus />Novo compromisso</Button> : undefined} />
    {error && !editing && <p role="alert" className="mb-5 text-sm text-destructive">{error}</p>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Período anterior" title="Período anterior" onClick={() => move(-1)}><ChevronLeft /></Button>
        <Button variant="outline" size="icon" aria-label="Próximo período" title="Próximo período" onClick={() => move(1)}><ChevronRight /></Button>
        <Button variant="outline" size="sm" onClick={() => { setDate(new Date()); setSelectedDate(new Date()); }}>Hoje</Button>
      </div>
      <h2 className="order-last w-full font-display text-lg font-semibold capitalize sm:order-none sm:w-auto">{view === "month" ? format(date, "MMMM yyyy", { locale: ptBR }) : `${format(days[0] ?? date, "dd MMM", { locale: ptBR })} — ${format(days[6] ?? date, "dd MMM yyyy", { locale: ptBR })}`}</h2>
      <div className="flex gap-1 rounded-md border border-border p-1" role="group" aria-label="Visualização do calendário">
        <Button size="sm" variant={view === "month" ? "secondary" : "ghost"} aria-pressed={view === "month"} onClick={() => setView("month")}>Mensal</Button>
        <Button size="sm" variant={view === "week" ? "secondary" : "ghost"} aria-pressed={view === "week"} onClick={() => setView("week")}>Semanal</Button>
      </div>
    </div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
      <select aria-label="Filtrar por tipo" className={selectClass} value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="">Todos os tipos</option>{Object.entries(eventKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="Filtrar por responsável" className={selectClass} value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)}><option value="">Todos os responsáveis</option>{responsibleNames.map((name) => <option key={name}>{name}</option>)}</select>
    </div>
    {notice && <p role="status" className="mb-3 text-sm text-primary">{notice}</p>}
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className={cn("grid grid-cols-7", view === "week" && "min-w-[770px]")}>
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <div key={day} className="border-b border-border bg-surface px-1 py-3 text-center text-xs font-medium text-muted-foreground">{day}</div>)}
        {days.map((day) => {
          const dayEvents = eventsOnDay(filtered, day);
          return <div key={day.toISOString()} className={cn("min-w-0 border-b border-r border-border p-1 sm:p-2", view === "month" ? "min-h-24 sm:min-h-36" : "min-h-80", !isSameMonth(day, date) && view === "month" && "bg-muted/20", isSameDay(day, selectedDate) && "bg-primary/5")}>
            <Button variant="ghost" size="sm" aria-label={format(day, "dd 'de' MMMM yyyy", { locale: ptBR })} aria-pressed={isSameDay(day, selectedDate)} className={cn("mb-1 size-7 p-0 text-xs", isSameDay(day, new Date()) && "bg-primary text-primary-foreground", !isSameMonth(day, date) && "text-muted-foreground")} onClick={() => setSelectedDate(day)}>{format(day, "d")}</Button>
            <div className="space-y-1">{dayEvents.map((item) => <Button key={item.id} variant="ghost" title={`${item.title} · ${item.responsible}`} className={cn("h-auto w-full flex-col items-start gap-0.5 whitespace-normal rounded-sm border p-1 text-left text-[10px] sm:p-1.5 sm:text-xs", kindClasses[item.kind])} onClick={() => { setSelectedDate(day); setError(""); setEditing(item); }}>
              <span className="hidden text-[10px] sm:block">{format(new Date(item.startsAt), "HH:mm")}</span><span className="line-clamp-2 w-full break-words font-medium">{item.title}</span>{view === "week" && <span className="mt-1 w-full break-words text-[10px] opacity-80">{item.responsible}</span>}
            </Button>)}</div>
          </div>;
        })}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">{Object.entries(eventKinds).map(([key, label]) => <span key={key} className="flex items-center gap-2"><span className={cn("size-2 rounded-full border", kindClasses[key as CalendarEvent["kind"]])} />{label}</span>)}</div>
    <section className="mt-8 border-t border-border pt-5">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold capitalize">{format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</h2>{!readOnly && <Button variant="ghost" size="icon" title="Adicionar nesta data" aria-label="Adicionar nesta data" onClick={() => newEvent()}><Plus /></Button>}</div>
      {!selectedEvents.length ? <p className="py-6 text-sm text-muted-foreground">Nenhum compromisso nesta data.</p> : <div className="divide-y divide-border">{selectedEvents.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="text-xs text-muted-foreground">{eventKinds[item.kind]} · {format(new Date(item.startsAt), "HH:mm")}</p><h3 className="mt-1 break-words text-sm font-semibold">{item.title}</h3><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><UserRound className="size-3" />{item.responsible}</p>{item.location && <p className="mt-1 break-words text-xs text-muted-foreground">{item.location}</p>}</div><Button variant="outline" size="sm" onClick={() => { setError(""); setEditing(item); }}>{readOnly ? "Ver detalhes" : "Editar"}</Button></div>)}</div>}
    </section>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!busy && !open) setEditing(null); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{readOnly ? "Detalhes do compromisso" : events.some((event) => event.id === editing?.id) ? "Editar compromisso" : "Novo compromisso"}</DialogTitle><DialogDescription>{readOnly ? "Compromisso relacionado ao seu caso." : "Prazos, audiências e atribuições do escritório."}</DialogDescription></DialogHeader>
        {editing && (readOnly ? <div className="space-y-4"><h3 className="text-lg font-semibold">{editing.title}</h3><p className="text-sm text-primary">{eventKinds[editing.kind]}</p><p className="flex items-center gap-2 text-sm"><Clock className="size-4" />{format(new Date(editing.startsAt), "dd/MM/yyyy 'às' HH:mm")}</p><p className="flex items-center gap-2 text-sm"><UserRound className="size-4" />{editing.responsible}</p>{editing.location && <p className="flex items-center gap-2 text-sm"><MapPin className="size-4" />{editing.location}</p>}{editing.notes && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{editing.notes}</p>}</div> : <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="event-title">Título</Label><Input id="event-title" required maxLength={180} value={editing.title} onChange={(event) => update("title", event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="event-kind">Tipo</Label><select id="event-kind" className={selectClass} value={editing.kind} onChange={(event) => update("kind", event.target.value)}>{Object.entries(eventKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="min-w-0 space-y-2"><Label htmlFor="event-date">Data e horário</Label><Input className="min-w-0" id="event-date" type="datetime-local" required value={format(new Date(editing.startsAt), "yyyy-MM-dd'T'HH:mm")} onChange={(event) => { if (event.target.value) update("startsAt", event.target.value); }} /></div></div>
          <div className="space-y-2"><Label htmlFor="event-responsible">Responsável</Label><Input id="event-responsible" required maxLength={100} value={editing.responsible} onChange={(event) => update("responsible", event.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="event-process">Processo</Label><select id="event-process" className={selectClass} value={editing.processId} onChange={(event) => setEditing({...editing,processId:event.target.value,clientId:''})}><option value="">Sem vínculo</option>{workspace.processes.map((p)=><option key={p.id} value={p.id}>{p.cnj}</option>)}</select></div><div className="space-y-2"><Label htmlFor="event-client">Cliente com acesso</Label><select id="event-client" className={selectClass} value={editing.clientId} onChange={(event)=>update('clientId',event.target.value)}><option value="">Escritório</option>{workspace.permissions.filter((p)=>p.resource_type==='process' && p.resource_id===editing.processId).map((p)=><option key={p.id} value={p.grantee_id}>{p.grantee_id}</option>)}</select></div></div>
          <div className="space-y-2"><Label htmlFor="event-location">Local</Label><Input id="event-location" maxLength={240} value={editing.location} onChange={(event) => update("location", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="event-notes">Observações</Label><Textarea id="event-notes" maxLength={2000} value={editing.notes} onChange={(event) => update("notes", event.target.value)} /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">{events.some((event) => event.id === editing.id) ? <Button disabled={busy} type="button" variant="ghost" className="text-destructive" onClick={()=>void remove()}><Trash2 />Excluir</Button> : <span />}<Button disabled={busy} type="submit"><CalendarDays />{busy ? 'Salvando…' : 'Salvar compromisso'}</Button></div>
        </form>)}
      </DialogContent>
    </Dialog>
  </>;
}
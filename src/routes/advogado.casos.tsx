import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BriefcaseBusiness, Plus } from "lucide-react";
import { CaseFormDialog } from "@/components/clients/case-form-dialog";
import { EmptyState } from "@/components/domain/empty-state";
import { LoadingState } from "@/components/domain/loading-state";
import { PageHeader } from "@/components/domain/page-header";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { listCases, listClients } from "@/lib/data/records";
import { useAsync } from "@/lib/data/use-async";
import { caseStatusLabel } from "@/lib/domain/labels";
import { useOffice } from "@/lib/office/use-office";

export const Route = createFileRoute("/advogado/casos")({
  head: () => ({
    meta: [
      { title: "Casos — InCasus" },
      { name: "description", content: "Assuntos, prioridades e contexto reunidos por cliente." },
    ],
  }),
  component: Page,
});

function Counter({ value, label, bordered }: { value: number; label: string; bordered?: boolean }) {
  return (
    <div className={bordered ? "border-x border-border" : ""}>
      <p className="font-display text-lg font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Page() {
  const officeId = useOffice();
  const { state, reload } = useAsync(async () => ({
    cases: await listCases(),
    clients: await listClients(),
  }));
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Portfólio jurídico"
        title="Casos"
        description="Assuntos, prioridades e contexto reunidos por cliente."
        action={
          <Button
            variant="command"
            disabled={!officeId || state.status !== "ready" || state.data.clients.length === 0}
            onClick={() => setCreating(true)}
          >
            <Plus />
            Novo caso
          </Button>
        }
      />
      {state.status === "loading" && <LoadingState />}
      {state.status === "error" && (
        <EmptyState
          icon={BriefcaseBusiness}
          title="Casos indisponíveis"
          description={state.message}
        />
      )}
      {state.status === "ready" && state.data.cases.length === 0 && (
        <EmptyState
          icon={BriefcaseBusiness}
          title="Nenhum caso aberto"
          description={
            state.data.clients.length === 0
              ? "Cadastre um cliente em Clientes para abrir o primeiro caso."
              : "Use “Novo caso” para começar."
          }
        />
      )}
      {state.status === "ready" && state.data.cases.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {state.data.cases.map((c) => (
            <article key={c.id} className="rounded-lg border border-border bg-surface p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-primary">{c.area}</p>
                  <h2 className="mt-1 font-display text-lg font-semibold">{c.subject}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{c.clientName}</p>
                </div>
                <StatusBadge level={c.priority} />
              </div>
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                {c.description}
              </p>
              <div className="mt-5 grid grid-cols-3 border-t border-border pt-4 text-center">
                <Counter value={c.processCount} label="Processos" />
                <Counter value={c.documentCount} label="Documentos" bordered />
                <Counter value={c.taskCount} label="Tarefas" />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Status: <span className="text-foreground">{caseStatusLabel[c.status]}</span>
              </p>
            </article>
          ))}
        </div>
      )}
      {creating && officeId && state.status === "ready" && (
        <CaseFormDialog
          officeId={officeId}
          clients={state.data.clients}
          onClose={() => setCreating(false)}
          onSaved={reload}
        />
      )}
    </>
  );
}

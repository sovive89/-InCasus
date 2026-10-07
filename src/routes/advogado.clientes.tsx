import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Plus, Search, Users } from "lucide-react";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { EmptyState } from "@/components/domain/empty-state";
import { LoadingState } from "@/components/domain/loading-state";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listClients } from "@/lib/data/records";
import { useAsync } from "@/lib/data/use-async";
import { clientStatusLabel, formatDate } from "@/lib/domain/labels";
import { useOffice } from "@/lib/office/use-office";

export const Route = createFileRoute("/advogado/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — InCasus" },
      { name: "description", content: "Clientes, casos e próximos atendimentos." },
    ],
  }),
  component: Page,
});

const FILTERS: [string, string][] = [
  ["all", "Todos"],
  ["new", "Novos"],
  ["active", "Ativos"],
  ["waiting", "Aguardando"],
  ["pending", "Pendências"],
];

function Page() {
  const officeId = useOffice();
  const { state, reload } = useAsync(listClients);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);

  const rows =
    state.status === "ready"
      ? state.data.filter(
          (c) =>
            (filter === "all" || c.status === filter) &&
            c.name.toLowerCase().includes(q.toLowerCase()),
        )
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Relacionamentos"
        title="Clientes"
        description="Visão unificada dos atendimentos e próximos passos."
        action={
          <Button variant="command" disabled={!officeId} onClick={() => setCreating(true)}>
            <Plus />
            Novo cliente
          </Button>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`shrink-0 rounded-md px-3 py-2 text-xs ${filter === k ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente"
            className="pl-9"
            aria-label="Buscar cliente"
          />
        </div>
      </div>

      {state.status === "loading" && <LoadingState />}
      {state.status === "error" && (
        <EmptyState icon={Users} title="Clientes indisponíveis" description={state.message} />
      )}
      {state.status === "ready" && rows.length === 0 && (
        <EmptyState
          icon={Users}
          title={
            state.data.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum cliente encontrado"
          }
          description={
            state.data.length === 0
              ? "Cadastre o primeiro cliente para abrir casos e gerar documentos."
              : "Ajuste a busca ou o filtro."
          }
        />
      )}
      {state.status === "ready" && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr className="text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Casos</th>
                <th className="px-4 py-3 font-medium">Último contato</th>
                <th className="px-4 py-3 font-medium">Próxima atividade</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="bg-background hover:bg-surface">
                  <td className="px-4 py-4">
                    <p className="font-medium">{c.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.phone || c.email || "Sem contato"}
                    </p>
                  </td>
                  <td className="px-4">
                    <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
                      {clientStatusLabel[c.status]}
                    </span>
                  </td>
                  <td className="px-4 text-muted-foreground">{c.caseCount}</td>
                  <td className="px-4 text-muted-foreground">{formatDate(c.lastContactAt)}</td>
                  <td className="max-w-56 px-4 text-muted-foreground">{c.nextActivity || "—"}</td>
                  <td className="px-4">
                    <Link
                      to="/advogado/clientes/$id"
                      params={{ id: c.id }}
                      aria-label={`Abrir ${c.name}`}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && officeId && (
        <ClientFormDialog officeId={officeId} onClose={() => setCreating(false)} onSaved={reload} />
      )}
    </>
  );
}

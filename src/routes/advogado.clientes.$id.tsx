import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileSearch, Mail, Pencil, Phone, Plus, UserX } from "lucide-react";
import { CaseFormDialog } from "@/components/clients/case-form-dialog";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { EmptyState } from "@/components/domain/empty-state";
import { LoadingState } from "@/components/domain/loading-state";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { getClient, listCases } from "@/lib/data/records";
import { useAsync } from "@/lib/data/use-async";
import { caseStatusLabel, clientStatusLabel, formatFullDate } from "@/lib/domain/labels";
import { useOffice } from "@/lib/office/use-office";

export const Route = createFileRoute("/advogado/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Cliente — InCasus" },
      { name: "description", content: "Perfil, casos e atividades do cliente." },
    ],
  }),
  component: Page,
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

function Page() {
  const { id } = Route.useParams();
  const officeId = useOffice();
  const { state, reload } = useAsync(
    async () => ({ client: await getClient(id), cases: await listCases(id) }),
    [id],
  );
  const [editing, setEditing] = useState(false);
  const [newCase, setNewCase] = useState(false);

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error")
    return <EmptyState icon={UserX} title="Cliente indisponível" description={state.message} />;
  const { client: c, cases } = state.data;
  if (!c)
    return (
      <EmptyState
        icon={UserX}
        title="Cliente não encontrado"
        description="Ele pode ter sido removido ou pertencer a outro escritório."
      />
    );

  return (
    <>
      <PageHeader
        eyebrow={`Perfil do cliente · ${clientStatusLabel[c.status]}`}
        title={c.name}
        description={`Cliente desde ${formatFullDate(c.createdAt)}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" disabled={!officeId} onClick={() => setEditing(true)}>
              <Pencil />
              Editar
            </Button>
            <Button variant="command" disabled={!officeId} onClick={() => setNewCase(true)}>
              <Plus />
              Novo caso
            </Button>
          </div>
        }
      />
      <div className="mb-8 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-display text-sm font-semibold">Contato</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Phone className="size-4 text-primary" />
              {c.phone || "—"}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              {c.email || "—"}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="font-display text-sm font-semibold">Ficha cadastral</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <Field label="CPF / CNPJ" value={c.documentNumber} />
            <Field label="RG" value={c.rg} />
            <Field label="Nacionalidade" value={c.nationality} />
            <Field label="Estado civil" value={c.maritalStatus} />
            <Field label="Profissão" value={c.profession} />
            <Field label="Endereço" value={c.address} />
          </dl>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <FileSearch className="size-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">Casos</h2>
        </div>
        {cases.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="Nenhum caso"
            description="Abra o primeiro caso deste cliente."
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {cases.map((k) => (
              <div key={k.id} className="p-4">
                <p className="text-sm font-medium">{k.subject}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {k.area} · {caseStatusLabel[k.status]}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-[10px] text-muted-foreground">
          Processos, documentos, agenda e conversas deste cliente serão ligados ao banco nas
          próximas etapas.{" "}
          <Link to="/advogado/modelos" className="text-primary underline-offset-2 hover:underline">
            Gerar documento a partir de um modelo
          </Link>
        </p>
      </section>

      {editing && officeId && (
        <ClientFormDialog
          officeId={officeId}
          clientId={c.id}
          initial={c}
          onClose={() => setEditing(false)}
          onSaved={reload}
        />
      )}
      {newCase && officeId && (
        <CaseFormDialog
          officeId={officeId}
          clients={[c]}
          clientId={c.id}
          onClose={() => setNewCase(false)}
          onSaved={reload}
        />
      )}
    </>
  );
}

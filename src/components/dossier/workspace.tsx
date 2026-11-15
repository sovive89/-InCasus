import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { FolderOpen, Plus, Search, UserRound } from "lucide-react";
import { useAccount } from "@/lib/real/workspace";
import {
  getDossier,
  startDossierOffice,
  createDossierClient,
  createDossierCase,
} from "@/lib/dossier/records.functions";
import { phaseLabels, type CasePhase } from "@/lib/dossier/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/domain/page-header";

export function DossierWorkspace({
  clientId,
  casesOnly = false,
}: {
  clientId?: string;
  casesOnly?: boolean;
}) {
  const account = useAccount();
  const queryClient = useQueryClient();
  const load = useServerFn(getDossier);
  const start = useServerFn(startDossierOffice);
  const createClient = useServerFn(createDossierClient);
  const createCase = useServerFn(createDossierCase);
  const queryKey = ["dossier", account.id];
  const query = useQuery({ queryKey, queryFn: () => load() });
  const [search, setSearch] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [dialog, setDialog] = useState<"client" | "case" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedClient, setSelectedClient] = useState(clientId ?? "");
  const [title, setTitle] = useState("");
  const [matter, setMatter] = useState("");
  const [phase, setPhase] = useState<CasePhase>("intake");
  const data = query.data;
  const client = data?.clients.find((c) => c.id === clientId);
  const activeOffice = client?.office_id || officeId || data?.offices[0]?.id || "";
  const clients = data?.clients.filter((c) => c.office_id === activeOffice) ?? [];
  const cases =
    data?.cases.filter(
      (c) => c.office_id === activeOffice && (!clientId || c.client_id === clientId),
    ) ?? [];
  const matching = clients.filter((c) =>
    `${c.name} ${c.email} ${c.phone}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }
  function open(type: "client" | "case") {
    setError("");
    setName("");
    setEmail("");
    setPhone("");
    setTitle("");
    setMatter("");
    setPhase("intake");
    setSelectedClient(clientId || clients[0]?.id || "");
    setDialog(type);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void action(async () => {
      if (dialog === "client")
        await createClient({
          data: { id: crypto.randomUUID(), officeId: activeOffice, name, email, phone },
        });
      else
        await createCase({
          data: {
            id: crypto.randomUUID(),
            officeId: activeOffice,
            clientId: selectedClient,
            title,
            matter,
            phase,
          },
        });
      setDialog(null);
    });
  }
  const heading = clientId
    ? client?.name || "Prontuário do cliente"
    : casesOnly
      ? "Casos e inquéritos"
      : "Clientes";
  return (
    <>
      <PageHeader
        eyebrow="Prontuário jurídico"
        title={heading}
        description={
          clientId
            ? "Histórico organizado por caso e matéria jurídica."
            : "Cadastros do escritório, separados por cliente e caso."
        }
        action={
          data?.state === "ready" && data.offices.length > 0 && (!clientId || client) ? (
            <Button
              disabled={busy || ((!!clientId || casesOnly) && clients.length === 0)}
              onClick={() => open(clientId || casesOnly ? "case" : "client")}
            >
              <Plus />
              {clientId || casesOnly ? "Novo caso" : "Novo cliente"}
            </Button>
          ) : undefined
        }
      />
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {query.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando prontuário…
        </p>
      ) : query.isError ? (
        <div role="alert">
          <p>Não foi possível carregar o prontuário.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : data?.state === "setup_required" ? (
        <section className="rounded-xl border border-border bg-surface p-6">
          <FolderOpen className="mb-4 size-6 text-primary" />
          <h2 className="font-display text-lg">Prontuário aguardando configuração</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            A estrutura de clientes e casos ainda precisa ser instalada no banco deste ambiente.
            Nenhum cadastro foi criado.
          </p>
        </section>
      ) : data && data.offices.length === 0 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(() => start({ data: { name: officeName } }));
          }}
          className="max-w-lg space-y-4 rounded-xl border border-border bg-surface p-6"
        >
          <h2 className="font-display text-lg">Ativar prontuário do escritório</h2>
          <p className="text-sm text-muted-foreground">
            Crie o espaço de trabalho da sua conta profissional.
          </p>
          <Label htmlFor="office-name">Nome do escritório</Label>
          <Input
            id="office-name"
            required
            maxLength={180}
            value={officeName}
            onChange={(e) => setOfficeName(e.target.value)}
          />
          <Button disabled={busy}>Ativar prontuário</Button>
        </form>
      ) : clientId && !client ? (
        <p role="status">
          Cliente não encontrado ou sem acesso.{" "}
          <Link to="/advogado/clientes" className="text-primary underline">
            Voltar para clientes
          </Link>
        </p>
      ) : (
        <>
          {!clientId && data && data.offices.length > 1 && (
            <div className="mb-4 max-w-md">
              <Label htmlFor="office">Escritório</Label>
              <select
                id="office"
                className="mt-2 w-full rounded-md border border-input bg-surface p-3"
                value={activeOffice}
                onChange={(e) => setOfficeId(e.target.value)}
              >
                {data.offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {client ? (
            <>
              <Button asChild variant="link" className="mb-3 px-0">
                <Link to="/advogado/clientes">← Todos os clientes</Link>
              </Button>
              <div className="mb-8 grid gap-4 sm:grid-cols-3">
                <Metric label="Casos registrados" value={String(cases.length)} />
                <Metric label="E-mail" value={client.email || "Não informado"} />
                <Metric label="Telefone" value={client.phone || "Não informado"} />
              </div>
              <h2 className="mb-4 font-display text-lg">Casos, matérias e etapas</h2>
            </>
          ) : (
            !casesOnly && (
              <>
                <div className="relative mb-5 max-w-md">
                  <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    aria-label="Buscar cliente"
                    placeholder="Nome, e-mail ou telefone"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {matching.map((c) => (
                    <Link
                      key={c.id}
                      to="/advogado/clientes/$id"
                      params={{ id: c.id }}
                      className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary"
                    >
                      <UserRound className="mb-4 size-5 text-primary" />
                      <h2 className="break-words font-semibold">{c.name}</h2>
                      <p className="mt-2 break-words text-sm text-muted-foreground">
                        {c.email || c.phone || "Contato não informado"}
                      </p>
                      <p className="mt-4 text-xs text-primary">
                        {data?.cases.filter((x) => x.client_id === c.id).length || 0} caso(s) ·
                        Abrir prontuário →
                      </p>
                    </Link>
                  ))}
                </div>
                {!matching.length && (
                  <p className="py-10 text-sm text-muted-foreground">
                    {clients.length
                      ? "Nenhum cliente corresponde à busca."
                      : "Cadastre o primeiro cliente para começar o prontuário."}
                  </p>
                )}
              </>
            )
          )}
          {(clientId || casesOnly) && (
            <div className="space-y-4">
              {cases.map((c) => (
                <article key={c.id} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="break-words font-semibold">{c.title}</h2>
                      <p className="mt-1 break-words text-sm text-muted-foreground">{c.matter}</p>
                      {!clientId && (
                        <Link
                          to="/advogado/clientes/$id"
                          params={{ id: c.client_id }}
                          className="mt-2 inline-block text-sm text-primary"
                        >
                          {clients.find((x) => x.id === c.client_id)?.name || "Ver cliente"}
                        </Link>
                      )}
                    </div>
                    <span className="rounded-md border border-border px-3 py-1 text-xs">
                      {phaseLabels[c.phase]}
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Cadastrado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </article>
              ))}
              {!cases.length && (
                <p className="py-8 text-sm text-muted-foreground">
                  Nenhum caso cadastrado. Inquéritos e atendimentos extrajudiciais também podem ser
                  registrados, sem número de processo.
                </p>
              )}
            </div>
          )}
        </>
      )}
      <Dialog
        open={dialog !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "client" ? "Novo cliente" : "Novo caso"}</DialogTitle>
            <DialogDescription>
              {dialog === "client"
                ? "Cadastre o contato para organizar o prontuário. Isso não cria uma conta nem concede acesso ao cliente."
                : "Registre a matéria e a etapa. O número de processo não é obrigatório."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {dialog === "client" ? (
              <>
                <Field
                  id="client-name"
                  label="Nome"
                  value={name}
                  setValue={setName}
                  required
                  maxLength={180}
                />
                <Field
                  id="client-email"
                  label="E-mail (opcional)"
                  value={email}
                  setValue={setEmail}
                  type="email"
                  maxLength={254}
                />
                <Field
                  id="client-phone"
                  label="Telefone (opcional)"
                  value={phone}
                  setValue={setPhone}
                  type="tel"
                  maxLength={40}
                />
              </>
            ) : (
              <>
                <Label htmlFor="case-client">Cliente</Label>
                <select
                  id="case-client"
                  required
                  disabled={!!clientId}
                  className="w-full rounded-md border border-input bg-surface p-3"
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Field
                  id="case-title"
                  label="Título do caso"
                  value={title}
                  setValue={setTitle}
                  required
                  maxLength={240}
                />
                <Field
                  id="case-matter"
                  label="Matéria jurídica"
                  value={matter}
                  setValue={setMatter}
                  required
                  maxLength={180}
                />
                <Label htmlFor="case-phase">Etapa</Label>
                <select
                  id="case-phase"
                  className="w-full rounded-md border border-input bg-surface p-3"
                  value={phase}
                  onChange={(e) => setPhase(e.target.value as CasePhase)}
                >
                  {Object.entries(phaseLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-medium">{value}</p>
    </div>
  );
}
function Field({
  id,
  label,
  value,
  setValue,
  type = "text",
  required = false,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  setValue: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}

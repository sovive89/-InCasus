import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Copy, FileStack, Loader2, Plus, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/domain/empty-state";
import { LoadingState } from "@/components/domain/loading-state";
import { getSession } from "@/lib/auth/session";
import { supabase } from "@/integrations/supabase/client";
import { getMyOffice } from "@/lib/office/office.functions";
import {
  escapeHtml,
  extractVariables,
  groupFor,
  isLongField,
  labelFor,
  renderTemplate,
  systemValues,
} from "@/lib/templates/render";

const sb = supabase as unknown as SupabaseClient;

const CATEGORY_LABEL: Record<string, string> = {
  peticao: "Petições",
  contestacao: "Contestações",
  recurso: "Recursos",
  procuracao: "Procurações",
  contrato: "Contratos",
  declaracao: "Declarações",
  notificacao: "Notificações",
  outros: "Outros",
};

type Template = {
  id: string;
  office_id: string | null;
  name: string;
  category: string;
  description: string;
  body: string;
  is_system: boolean;
  version: number;
};

const COLUMNS = "id, office_id, name, category, description, body, is_system, version";

function UseTemplateDialog({ template, onClose }: { template: Template; onClose: () => void }) {
  const variables = useMemo(() => extractVariables(template.body), [template.body]);
  const [values, setValues] = useState<Record<string, string>>(() => systemValues(new Date()));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSession().then((s) => {
      if (s?.profile.name) setValues((v) => ({ "advogado.nome": s.profile.name, ...v }));
    });
  }, []);

  const result = useMemo(() => renderTemplate(template.body, values), [template.body, values]);
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const key of variables) {
      if (key.startsWith("data.")) continue; // preenchido pelo sistema
      const g = groupFor(key);
      map.set(g, [...(map.get(g) ?? []), key]);
    }
    return [...map.entries()];
  }, [variables]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem permissão */
    }
  }
  function print() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<!doctype html><title>${escapeHtml(template.name)}</title><pre style="font:12pt/1.6 Georgia,serif;white-space:pre-wrap;margin:2.5cm">${escapeHtml(result.text)}</pre>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
        <div className="grid max-h-[92vh] lg:grid-cols-[360px_1fr]">
          <div className="overflow-y-auto border-b border-border p-5 lg:border-b-0 lg:border-r">
            <DialogHeader>
              <DialogTitle>{template.name}</DialogTitle>
              <DialogDescription>
                Preencha os campos. O que faltar aparece como [[campo]] no texto.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-5">
              {groups.map(([group, keys]) => (
                <fieldset key={group} className="space-y-3">
                  <legend className="eyebrow mb-1">{group}</legend>
                  {keys.map((key) => (
                    <div key={key}>
                      <Label htmlFor={`v-${key}`} className="text-xs">
                        {labelFor(key)}
                      </Label>
                      {isLongField(key) ? (
                        <Textarea
                          id={`v-${key}`}
                          className="mt-1 min-h-20 text-sm"
                          value={values[key] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          id={`v-${key}`}
                          className="mt-1"
                          value={values[key] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </fieldset>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 flex-col p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {result.missing.length === 0
                  ? "Todos os campos preenchidos."
                  : `${result.missing.length} campo(s) em aberto.`}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copy}>
                  <Copy />
                  {copied ? "Copiado" : "Copiar"}
                </Button>
                <Button size="sm" variant="outline" onClick={print}>
                  <Printer />
                  Imprimir / PDF
                </Button>
              </div>
            </div>
            <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface p-5 font-mono text-xs leading-6">
              {result.text}
            </pre>
            <p className="mt-3 rounded-md border border-important/30 bg-important/10 p-3 text-[10px] leading-5 text-important">
              Modelo-base genérico. Revise e adapte ao caso concreto antes de usar: a
              responsabilidade técnica é do(a) advogado(a).
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Draft = {
  id: string | null;
  name: string;
  category: string;
  description: string;
  body: string;
};

function EditTemplateDialog({
  draft,
  officeId,
  onClose,
  onSaved,
}: {
  draft: Draft;
  officeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vars = useMemo(() => extractVariables(form.body), [form.body]);

  async function save() {
    if (!form.name.trim() || !form.body.trim()) {
      setError("Informe nome e texto do modelo.");
      return;
    }
    setBusy(true);
    setError(null);
    const row = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      body: form.body,
      variables: vars,
    };
    const { error: err } = form.id
      ? await sb.from("document_templates").update(row).eq("id", form.id)
      : await sb
          .from("document_templates")
          .insert({ ...row, office_id: officeId, is_system: false });
    setBusy(false);
    if (err) {
      setError("Não foi possível salvar agora.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          <DialogDescription>
            Use {"{{cliente.nome}}"}, {"{{processo.cnj}}"} etc. para criar campos preenchíveis. Cada
            edição guarda a versão anterior.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="t-name" className="text-xs">
              Nome
            </Label>
            <Input
              id="t-name"
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="t-cat" className="text-xs">
              Categoria
            </Label>
            <select
              id="t-cat"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="t-desc" className="text-xs">
            Descrição
          </Label>
          <Input
            id="t-desc"
            className="mt-1"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="t-body" className="text-xs">
            Texto do modelo
          </Label>
          <Textarea
            id="t-body"
            className="mt-1 min-h-72 font-mono text-xs leading-6"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {vars.length} campo(s): {vars.join(", ") || "nenhum"}
        </p>
        {error && (
          <p role="alert" className="text-xs text-critical">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}Salvar modelo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Biblioteca de modelos: buscar, usar (preencher variáveis), criar, duplicar, editar e excluir os do escritório. */
export function TemplateLibrary() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; items: Template[] }
  >({ status: "loading" });
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [using, setUsing] = useState<Template | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await sb
      .from("document_templates")
      .select(COLUMNS)
      .eq("archived", false)
      .order("is_system", { ascending: false })
      .order("name");
    setState(
      error
        ? { status: "error", message: "Não foi possível carregar os modelos." }
        : { status: "ready", items: (data ?? []) as Template[] },
    );
  }, []);
  useEffect(() => {
    load();
    getMyOffice()
      .then((r) => r.ok && setOfficeId(r.officeId))
      .catch(() => undefined);
  }, [load]);

  const items = state.status === "ready" ? state.items : [];
  const filtered = items.filter(
    (t) =>
      (category === "all" || t.category === category) &&
      `${t.name} ${t.description}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function remove(id: string) {
    await sb.from("document_templates").delete().eq("id", id);
    setConfirmDelete(null);
    load();
  }

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error")
    return (
      <EmptyState icon={FileStack} title="Modelos indisponíveis" description={state.message} />
    );

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label="Buscar modelos"
            placeholder="Buscar modelo…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          variant="command"
          disabled={!officeId}
          onClick={() =>
            officeId &&
            setEditing({ id: null, name: "", category: "outros", description: "", body: "" })
          }
        >
          <Plus />
          Novo modelo
        </Button>
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {[["all", "Todos"], ...Object.entries(CATEGORY_LABEL)].map(([k, v]) => (
          <button
            key={k}
            onClick={() => setCategory(k as string)}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-xs ${category === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground"}`}
          >
            {v}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Nenhum modelo encontrado"
          description="Ajuste a busca ou crie um modelo do escritório."
        />
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{t.name}</p>
                  <span className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {CATEGORY_LABEL[t.category] ?? t.category}
                  </span>
                  {t.is_system ? (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                      Modelo-base
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">v{t.version}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" onClick={() => setUsing(t)}>
                  Usar
                </Button>
                {officeId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        id: null,
                        name: `${t.name} (cópia)`,
                        category: t.category,
                        description: t.description,
                        body: t.body,
                      })
                    }
                  >
                    Duplicar
                  </Button>
                )}
                {!t.is_system && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      officeId &&
                      setEditing({
                        id: t.id,
                        name: t.name,
                        category: t.category,
                        description: t.description,
                        body: t.body,
                      })
                    }
                  >
                    Editar
                  </Button>
                )}
                {!t.is_system &&
                  (confirmDelete === t.id ? (
                    <Button size="sm" variant="destructive" onClick={() => remove(t.id)}>
                      Confirmar exclusão
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(t.id)}>
                      Excluir
                    </Button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {using && <UseTemplateDialog template={using} onClose={() => setUsing(null)} />}
      {editing && officeId && (
        <EditTemplateDialog
          draft={editing}
          officeId={officeId}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

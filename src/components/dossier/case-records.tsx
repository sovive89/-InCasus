import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  Download,
  FileText,
  History,
  Paperclip,
  Pencil,
  Plus,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/lib/real/workspace";
import {
  getCaseEntries,
  getNoteHistory,
  saveCaseNote,
  prepareCaseUpload,
  completeCaseUpload,
  prepareOriginalDownload,
} from "@/lib/dossier/documents.functions";
import { acceptedFiles, browserSha256, validateFileMetadata } from "@/lib/dossier/files";
import type { CaseEntry, DossierCase } from "@/lib/dossier/schema";

export function CaseRecords({ record }: { record: DossierCase }) {
  const account = useAccount();
  const qc = useQueryClient();
  const load = useServerFn(getCaseEntries),
    save = useServerFn(saveCaseNote),
    reserve = useServerFn(prepareCaseUpload),
    complete = useServerFn(completeCaseUpload);
  const [expanded, setExpanded] = useState(false),
    [modal, setModal] = useState<"note" | "file" | null>(null);
  const [editing, setEditing] = useState<CaseEntry | null>(null),
    [title, setTitle] = useState(""),
    [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [source, setSource] = useState(""),
    [kind, setKind] = useState<"file" | "evidence">("file");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [notice, setNotice] = useState("");
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  const key = ["case-entries", account.id, record.id];
  const entries = useQuery({
    queryKey: key,
    queryFn: () => load({ data: record.id }),
    enabled: expanded,
  });
  const [historyId, setHistoryId] = useState<string | null>(null);
  function openNote(entry?: CaseEntry) {
    setTitle(entry?.title || "");
    setBody(entry?.body || "");
    setEditing(entry || null);
    setError("");
    setNotice("");
    setModal("note");
  }
  function openFile() {
    setTitle("");
    setFile(null);
    setSource("");
    setKind("file");
    setPendingUpload(null);
    setError("");
    setNotice("");
    setModal("file");
  }
  async function saved(message: string) {
    await qc.invalidateQueries({ queryKey: key });
    setModal(null);
    setPendingUpload(null);
    setNotice(message);
  }
  async function finishUpload(id: string) {
    await complete({ data: id });
    await saved("Original conferido e registrado no caso.");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (modal === "note") {
        await save({
          data: {
            id: editing?.id || crypto.randomUUID(),
            officeId: record.office_id,
            clientId: record.client_id,
            caseId: record.id,
            title,
            body,
            expectedVersion: editing?.version || 0,
          },
        });
        await saved(editing ? "Nova versão da nota salva." : "Nota interna salva.");
      } else {
        if (pendingUpload) {
          setStatus("Conferindo o arquivo recebido…");
          await finishUpload(pendingUpload);
          return;
        }
        if (!file) throw new Error("Selecione um arquivo.");
        const validation = validateFileMetadata(file);
        if (validation) throw new Error(validation);
        setStatus("Calculando a identificação do original…");
        const sha256 = await browserSha256(file);
        setStatus("Preparando o armazenamento privado…");
        const prepared = await reserve({
          data: {
            id: crypto.randomUUID(),
            officeId: record.office_id,
            clientId: record.client_id,
            caseId: record.id,
            title,
            kind,
            originalName: file.name,
            sizeBytes: file.size,
            sha256,
            source,
          },
        });
        setStatus("Enviando o arquivo…");
        const upload = await supabase.storage
          .from("dossier-originals")
          .upload(prepared.storage_path, file, {
            contentType: prepared.mime,
            upsert: false,
            cacheControl: "0",
          });
        if (upload.error)
          throw new Error(
            "Não foi possível confirmar o envio. Tente concluir novamente ou selecione o arquivo de novo.",
          );
        setPendingUpload(prepared.upload_id);
        setStatus("Conferindo o original no servidor…");
        await finishUpload(prepared.upload_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }
  return (
    <section className="mt-5 border-t border-border pt-4">
      <Button
        variant="ghost"
        size="sm"
        className="px-0"
        aria-expanded={expanded}
        aria-controls={`records-${record.id}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronDown className={expanded ? "rotate-180" : ""} />
        Documentos e notas do caso
      </Button>
      {expanded && (
        <div id={`records-${record.id}`} className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openNote()}>
              <Plus />
              Nova nota
            </Button>
            <Button variant="outline" size="sm" onClick={openFile}>
              <Paperclip />
              Anexar original
            </Button>
          </div>
          {notice && (
            <p role="status" className="text-sm text-primary">
              {notice}
            </p>
          )}
          {entries.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando registros…
            </p>
          ) : entries.isError ? (
            <div role="alert" className="text-sm">
              <p>Não foi possível carregar os registros.</p>
              <Button variant="link" onClick={() => void entries.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              {!entries.data?.length && (
                <p className="py-4 text-sm text-muted-foreground">
                  Nenhum documento ou nota neste caso.
                </p>
              )}
              {entries.data?.map((entry) => (
                <article
                  aria-label={entry.title}
                  key={entry.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs text-primary">
                        {entry.kind === "note" ? (
                          <StickyNote className="size-4" />
                        ) : (
                          <FileText className="size-4" />
                        )}
                        {entry.kind === "note"
                          ? "Nota interna"
                          : entry.kind === "evidence"
                            ? "Prova · original"
                            : "Documento · original"}
                        {entry.kind === "note" && ` · Versão ${entry.version}`}
                      </p>
                      <h3 className="mt-2 break-words text-sm font-semibold">{entry.title}</h3>
                    </div>
                    {entry.kind === "note" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Editar nota ${entry.title}`}
                          onClick={() => openNote(entry)}
                        >
                          <Pencil />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Histórico da nota ${entry.title}`}
                          onClick={() => setHistoryId(entry.id)}
                        >
                          <History />
                          Histórico
                        </Button>
                      </div>
                    )}
                  </div>
                  {entry.kind === "note" ? (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {entry.body}
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <p className="break-words">
                        {entry.original_name} · {Math.ceil((entry.size_bytes || 0) / 1024)} KB
                      </p>
                      <p className="break-words">Origem: {entry.source}</p>
                      <details>
                        <summary className="cursor-pointer text-primary">
                          Identificação do original
                        </summary>
                        <p className="mt-2">SHA-256 conferido no recebimento:</p>
                        <p className="mt-1 select-all break-all font-mono">{entry.sha256}</p>
                      </details>
                      <OriginalDownload id={entry.id} />
                    </div>
                  )}
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {new Date(entry.version_created_at).toLocaleString("pt-BR")}
                  </p>
                </article>
              ))}
              {(entries.data?.length || 0) >= 100 && (
                <p className="text-xs text-muted-foreground">
                  Mostrando os 100 registros mais recentes deste caso.
                </p>
              )}
            </>
          )}
        </div>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setModal(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modal === "note"
                ? editing
                  ? "Editar nota interna"
                  : "Nova nota interna"
                : "Anexar original ao caso"}
            </DialogTitle>
            <DialogDescription>
              {modal === "note"
                ? "Visível apenas à equipe do escritório. Cada alteração cria uma versão e preserva o texto anterior."
                : "O arquivo original fica preservado com origem, data e identificação SHA-256. Não é compartilhado automaticamente com o cliente."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
            <div className="space-y-2">
              <Label htmlFor={`entry-title-${record.id}`}>Título (obrigatório)</Label>
              <Input
                name="title"
                id={`entry-title-${record.id}`}
                maxLength={240}
                required
                value={title}
                disabled={busy || !!pendingUpload}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            {modal === "note" ? (
              <div className="space-y-2">
                <Label htmlFor={`entry-body-${record.id}`}>Nota (obrigatória)</Label>
                <Textarea
                  name="body"
                  id={`entry-body-${record.id}`}
                  rows={8}
                  required
                  maxLength={20000}
                  value={body}
                  disabled={busy}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`entry-file-${record.id}`}>Arquivo (até 10 MB)</Label>
                  <Input
                    type="file"
                    name="file"
                    id={`entry-file-${record.id}`}
                    accept={acceptedFiles}
                    required={!pendingUpload}
                    disabled={busy}
                    aria-describedby={`file-help-${record.id}`}
                    onChange={(e) => {
                      const selected = e.target.files?.[0] || null;
                      setFile(selected);
                      setPendingUpload(null);
                      setError(selected ? validateFileMetadata(selected) || "" : "");
                      if (selected && !title) setTitle(selected.name);
                    }}
                  />
                  <p id={`file-help-${record.id}`} className="text-xs text-muted-foreground">
                    PDF, JPG, PNG, WEBP, TXT, DOCX, MP3, WAV ou M4A.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`entry-kind-${record.id}`}>Classificação</Label>
                  <select
                    name="kind"
                    id={`entry-kind-${record.id}`}
                    className="w-full rounded-md border border-input bg-surface p-3 text-sm"
                    disabled={busy || !!pendingUpload}
                    value={kind}
                    onChange={(e) => setKind(e.target.value === "evidence" ? "evidence" : "file")}
                  >
                    <option value="file">Documento</option>
                    <option value="evidence">Prova material / evidência</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`entry-source-${record.id}`}>Origem (obrigatória)</Label>
                  <Input
                    name="source"
                    id={`entry-source-${record.id}`}
                    required
                    maxLength={500}
                    value={source}
                    disabled={busy || !!pendingUpload}
                    onChange={(e) => setSource(e.target.value)}
                    aria-describedby={`source-help-${record.id}`}
                  />
                  <p id={`source-help-${record.id}`} className="text-xs text-muted-foreground">
                    Ex.: entregue pelo cliente, recebido por e-mail ou obtido nos autos.
                  </p>
                </div>
              </>
            )}
            {busy && (
              <div role="status" className="space-y-2">
                <p className="text-sm text-muted-foreground">{status || "Salvando…"}</p>
                <progress
                  aria-label="Operação em andamento"
                  className="h-2 w-full accent-primary"
                />
              </div>
            )}
            {error && (
              <div role="alert">
                <p className="text-sm text-destructive">{error}</p>
                {modal === "note" && editing && (
                  <Button type="button" variant="link" onClick={() => void entries.refetch()}>
                    Atualizar lista sem descartar meu texto
                  </Button>
                )}
              </div>
            )}
            <Button type="submit" disabled={busy}>
              {modal === "note"
                ? "Salvar nota"
                : pendingUpload
                  ? "Tentar concluir envio"
                  : "Enviar e conferir original"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <NoteHistory id={historyId} close={() => setHistoryId(null)} />
    </section>
  );
}
function OriginalDownload({ id }: { id: string }) {
  const prepare = useServerFn(prepareOriginalDownload);
  const [link, setLink] = useState<{ url: string; name: string; expiresAt: number } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!link) return;
    const timer = setTimeout(() => setLink(null), Math.max(0, link.expiresAt - Date.now() - 5000));
    return () => clearTimeout(timer);
  }, [link]);
  async function request() {
    setBusy(true);
    setError("");
    try {
      setLink(await prepare({ data: id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download indisponível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {link ? (
        <Button variant="outline" size="sm" asChild>
          <a href={link.url} download={link.name}>
            <Download />
            Baixar original agora
          </a>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void request()}>
          <Download />
          {busy ? "Preparando…" : "Preparar download"}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
function NoteHistory({ id, close }: { id: string | null; close: () => void }) {
  const account = useAccount(),
    load = useServerFn(getNoteHistory);
  const query = useQuery({
    queryKey: ["note-history", account.id, id],
    queryFn: () => load({ data: id! }),
    enabled: !!id,
    staleTime: 0,
  });
  return (
    <Dialog
      open={!!id}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico da nota</DialogTitle>
          <DialogDescription>Versões preservadas, da mais recente à mais antiga.</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p role="status">Carregando histórico…</p>
        ) : query.isError ? (
          <p role="alert">Histórico indisponível.</p>
        ) : (
          <div className="space-y-4">
            {query.data?.map((v) => (
              <article key={v.version} className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold">
                  Versão {v.version} · {new Date(v.created_at).toLocaleString("pt-BR")}
                </h3>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {v.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

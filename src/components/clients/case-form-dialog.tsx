import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { attentionLabel, caseStatusLabel } from "@/lib/domain/labels";
import { createCase, type CaseInput, type ClientRecord } from "@/lib/data/records";

/** Novo caso. Se `clientId` vier fixo (tela do cliente), não pergunta o cliente. */
export function CaseFormDialog({
  officeId,
  clients,
  clientId,
  onClose,
  onSaved,
}: {
  officeId: string;
  clients: Pick<ClientRecord, "id" | "name">[];
  clientId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CaseInput>({
    clientId: clientId ?? clients[0]?.id ?? "",
    area: "",
    subject: "",
    description: "",
    status: "intake",
    priority: "info",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId || !form.subject.trim() || !form.area.trim()) {
      setError("Informe cliente, área e assunto.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createCase(officeId, form);
      onSaved();
      onClose();
    } catch {
      setError("Não foi possível salvar agora.");
    } finally {
      setBusy(false);
    }
  }

  const select = "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo caso</DialogTitle>
          <DialogDescription>
            Um caso agrupa processos, documentos e tarefas de um mesmo assunto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {!clientId && (
            <div className="sm:col-span-2">
              <Label htmlFor="k-client" className="text-xs">
                Cliente *
              </Label>
              <select
                id="k-client"
                className={select}
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="k-area" className="text-xs">
              Área do direito *
            </Label>
            <Input
              id="k-area"
              className="mt-1"
              placeholder="Ex.: Família"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="k-subject" className="text-xs">
              Assunto *
            </Label>
            <Input
              id="k-subject"
              className="mt-1"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="k-status" className="text-xs">
              Situação
            </Label>
            <select
              id="k-status"
              className={select}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as CaseInput["status"] })}
            >
              {Object.entries(caseStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="k-priority" className="text-xs">
              Prioridade
            </Label>
            <select
              id="k-priority"
              className={select}
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value as CaseInput["priority"] })
              }
            >
              {Object.entries(attentionLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="k-desc" className="text-xs">
              Descrição
            </Label>
            <Textarea
              id="k-desc"
              className="mt-1 min-h-24"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-critical sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}Criar caso
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

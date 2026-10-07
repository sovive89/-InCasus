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
import { clientStatusLabel } from "@/lib/domain/labels";
import { saveClient, type ClientInput } from "@/lib/data/records";

const EMPTY: ClientInput = {
  name: "",
  email: "",
  phone: "",
  status: "new",
  documentNumber: "",
  rg: "",
  nationality: "",
  maritalStatus: "",
  profession: "",
  address: "",
};

const FIELDS: { key: keyof ClientInput; label: string; wide?: boolean; type?: string }[] = [
  { key: "name", label: "Nome completo *", wide: true },
  { key: "email", label: "E-mail", type: "email" },
  { key: "phone", label: "Telefone" },
  { key: "documentNumber", label: "CPF / CNPJ" },
  { key: "rg", label: "RG" },
  { key: "nationality", label: "Nacionalidade" },
  { key: "maritalStatus", label: "Estado civil" },
  { key: "profession", label: "Profissão" },
  { key: "address", label: "Endereço completo", wide: true },
];

/** Cadastro/edição de cliente. A ficha alimenta os modelos (procuração, contrato...). */
export function ClientFormDialog({
  officeId,
  initial,
  clientId,
  onClose,
  onSaved,
}: {
  officeId: string;
  initial?: ClientInput;
  clientId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ClientInput>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveClient(officeId, form, clientId);
      onSaved();
      onClose();
    } catch {
      setError("Não foi possível salvar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clientId ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Dados pessoais ficam visíveis apenas para advogados do seu escritório.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
              <Label htmlFor={`c-${f.key}`} className="text-xs">
                {f.label}
              </Label>
              <Input
                id={`c-${f.key}`}
                type={f.type ?? "text"}
                className="mt-1"
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <Label htmlFor="c-status" className="text-xs">
              Situação
            </Label>
            <select
              id="c-status"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ClientInput["status"] })
              }
            >
              {Object.entries(clientStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
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
              {busy && <Loader2 className="animate-spin" />}Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

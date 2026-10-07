import { useEffect, useState } from "react";
import { AlertTriangle, CircleCheck, Loader2, Scale } from "lucide-react";
import { lookupProcessByCnj } from "@/lib/legal/legal-data.functions";
import type { LegalLookupResponse, LegalProcessView } from "@/lib/legal/types";
import { formatDateTime } from "@/lib/domain/labels";

const SOURCE_LABEL: Record<string, string> = { cache: "Cache do InCasus", datajud: "DataJud (CNJ)", escavador: "Escavador", jusbrasil: "Jusbrasil" };

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LegalProcessView };

/** Linha do tempo oficial de um processo, vinda do LegalDataService (nunca direto do provedor). */
export function OfficialMovements({ cnj }: { cnj: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    lookupProcessByCnj({ data: { cnj } })
      .then((res: LegalLookupResponse) => {
        if (!active) return;
        setState(res.ok ? { status: "ready", data: res.data } : { status: "error", message: res.message });
      })
      .catch(() => active && setState({ status: "error", message: "Não foi possível consultar agora." }));
    return () => { active = false; };
  }, [cnj]);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2"><Scale className="size-4 text-primary" /><h2 className="font-display text-sm font-semibold">Movimentações oficiais</h2></div>
      {state.status === "loading" && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Consultando fontes oficiais…</p>}
      {state.status === "error" && <p role="status" className="rounded-md border border-border bg-surface p-3 text-xs leading-5 text-muted-foreground">{state.message}</p>}
      {state.status === "ready" && (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CircleCheck className="size-3 text-primary" />Fonte: {SOURCE_LABEL[state.data.source] ?? state.data.source}</span>
            {state.data.process.lastSyncAt && <span>Atualizado em {formatDateTime(state.data.process.lastSyncAt)}</span>}
            {state.data.stale && <span className="inline-flex items-center gap-1 text-important"><AlertTriangle className="size-3" />Fontes indisponíveis — exibindo dado anterior</span>}
          </p>
          {state.data.movements.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma movimentação registrada.</p>
          ) : (
            <div className="border-l border-border pl-5">
              {state.data.movements.slice(0, 30).map((m) => (
                <div key={`${m.date}-${m.code ?? m.title}`} className="relative pb-5 last:pb-0">
                  <span className="absolute -left-[23px] top-1 size-[5px] rounded-full bg-primary" />
                  <p className="text-sm font-medium">{m.title}</p>
                  {m.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{m.description}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(m.date)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

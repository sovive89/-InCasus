import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CircleCheck, KeyRound, Loader2, PlugZap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/domain/empty-state";
import { LoadingState } from "@/components/domain/loading-state";
import { formatDateTime } from "@/lib/domain/labels";
import {
  getSignatureOverview,
  saveSignatureProvider,
  testSignatureProvider,
  type SignatureOverview,
} from "@/lib/signature/signature.functions";
import type { ProviderCapabilities, ProviderSettingsView } from "@/lib/signature/types";

const CAPABILITY_LABELS: [keyof ProviderCapabilities, string][] = [
  ["sequentialOrder", "Ordem sequencial"],
  ["emailNotifications", "Aviso por e-mail"],
  ["whatsappNotifications", "Aviso por WhatsApp"],
  ["webhooks", "Webhooks"],
  ["evidence", "Evidências"],
  ["signedDocumentDownload", "Download do assinado"],
  ["reminders", "Lembretes"],
  ["cancellation", "Cancelamento"],
  ["sandbox", "Sandbox"],
];
const LEVEL_LABEL = {
  SIMPLE: "Simples",
  ADVANCED: "Avançada",
  QUALIFIED: "Qualificada (ICP-Brasil)",
} as const;
const STATUS_LABEL: Record<ProviderSettingsView["connectionStatus"], string> = {
  not_configured: "Não configurado",
  configured: "Configurado (não testado)",
  connected: "Conectado",
  error: "Erro de conexão",
};

function ProviderCard({
  p,
  officeId,
  isAdmin,
  keyReady,
  onChanged,
}: {
  p: ProviderSettingsView;
  officeId: string;
  isAdmin: boolean;
  keyReady: boolean;
  onChanged: () => void;
}) {
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [environment, setEnvironment] = useState(p.environment);
  const [busy, setBusy] = useState<null | "save" | "test">(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const disabled = !isAdmin || !p.implemented || busy !== null;
  const webhookUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/api/public/signature-webhook/${p.provider}/${officeId}`;

  async function run(kind: "save" | "test", fn: () => Promise<{ ok: boolean; message: string }>) {
    setBusy(kind);
    setFeedback(null);
    try {
      const r = await fn();
      setFeedback({ ok: r.ok, text: r.message });
      if (kind === "save" && r.ok) setSecrets({});
      onChanged();
    } catch {
      setFeedback({ ok: false, text: "Não foi possível concluir agora." });
    } finally {
      setBusy(null);
    }
  }
  const save = (extra: { enabled?: boolean; makeDefault?: boolean } = {}) =>
    run("save", () =>
      saveSignatureProvider({ data: { provider: p.provider, environment, secrets, ...extra } }),
    );

  const tone =
    p.connectionStatus === "connected"
      ? "text-primary"
      : p.connectionStatus === "error"
        ? "text-critical"
        : "text-muted-foreground";

  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold">{p.name}</h3>
            {p.isDefault && (
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Padrão
              </span>
            )}
            {!p.implemented && (
              <span className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                Em breve
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
          {p.availabilityNote && (
            <p className="mt-2 text-xs text-muted-foreground">{p.availabilityNote}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 text-xs ${tone}`}>
            {p.connectionStatus === "connected" ? (
              <CircleCheck className="size-3.5" />
            ) : p.connectionStatus === "error" ? (
              <AlertTriangle className="size-3.5" />
            ) : (
              <PlugZap className="size-3.5" />
            )}
            {STATUS_LABEL[p.connectionStatus]}
          </span>
          <Switch
            checked={p.enabled}
            disabled={disabled || p.connectionStatus === "not_configured"}
            onCheckedChange={(v) => save({ enabled: v })}
            aria-label={`Ativar ${p.name}`}
          />
        </div>
      </div>

      {p.implemented && (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {p.capabilities.levels.map((l) => (
              <span
                key={l}
                className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
              >
                {LEVEL_LABEL[l]}
              </span>
            ))}
            {CAPABILITY_LABELS.filter(([k]) => p.capabilities[k] === true).map(([k, label]) => (
              <span
                key={k}
                className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`env-${p.provider}`} className="text-xs">
                Ambiente
              </Label>
              <select
                id={`env-${p.provider}`}
                value={environment}
                disabled={disabled}
                onChange={(e) => setEnvironment(e.target.value as typeof environment)}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="sandbox">Sandbox (testes)</option>
                <option value="production">Produção</option>
              </select>
            </div>
            {p.fields.map((f) => (
              <div key={f.key}>
                <Label
                  htmlFor={`${p.provider}-${f.key}`}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <KeyRound className="size-3" />
                  {f.label}
                  {f.required && " *"}
                </Label>
                <Input
                  id={`${p.provider}-${f.key}`}
                  type={f.secret ? "password" : "text"}
                  autoComplete="off"
                  disabled={disabled || !keyReady}
                  placeholder={
                    f.configured && f.masked
                      ? `${f.masked} (salvo — digite para substituir)`
                      : "Cole aqui"
                  }
                  value={secrets[f.key] ?? ""}
                  onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="mt-1.5"
                />
                {f.help && <p className="mt-1 text-[10px] text-muted-foreground">{f.help}</p>}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-border bg-background p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
              <ShieldCheck className="size-3" />
              URL de webhook (cadastre no painel do provedor)
            </p>
            <p className="mt-1 break-all font-mono text-[11px]">{webhookUrl}</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={disabled || !keyReady} onClick={() => save()}>
              {busy === "save" && <Loader2 className="animate-spin" />}Salvar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                run("test", () => testSignatureProvider({ data: { provider: p.provider } }))
              }
            >
              {busy === "test" && <Loader2 className="animate-spin" />}Testar conexão
            </Button>
            {!p.isDefault && (
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || !p.enabled}
                onClick={() => save({ makeDefault: true })}
              >
                Tornar padrão
              </Button>
            )}
          </div>
        </>
      )}

      {feedback && (
        <p
          role="status"
          className={`mt-3 text-xs ${feedback.ok ? "text-primary" : "text-critical"}`}
        >
          {feedback.text}
        </p>
      )}
      {(p.lastCommunicationAt || p.lastError) && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          {p.lastCommunicationAt && (
            <>Última comunicação: {formatDateTime(p.lastCommunicationAt)}. </>
          )}
          {p.lastError && <span className="text-critical">Último erro: {p.lastError}</span>}
        </p>
      )}
    </article>
  );
}

/** Configurações → Integrações → Assinatura Eletrônica. Segredos nunca voltam do servidor. */
export function SignatureSettings() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: Extract<SignatureOverview, { ok: true }> }
  >({ status: "loading" });

  const load = useCallback(() => {
    getSignatureOverview()
      .then((r) =>
        setState(r.ok ? { status: "ready", data: r } : { status: "error", message: r.message }),
      )
      .catch(() =>
        setState({ status: "error", message: "Não foi possível carregar as integrações." }),
      );
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error")
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Integrações indisponíveis"
        description={state.message}
      />
    );
  const { data } = state;
  return (
    <div className="space-y-4">
      {!data.secretsKeyConfigured && (
        <p
          role="alert"
          className="rounded-md border border-important/40 bg-important/10 p-3 text-xs leading-5"
        >
          A chave de criptografia do servidor (<code>SIGNATURE_CREDENTIALS_KEY</code>) ainda não foi
          configurada. Sem ela, não é possível salvar credenciais com segurança.
        </p>
      )}
      {!data.isAdmin && (
        <p className="text-xs text-muted-foreground">
          Você pode visualizar, mas só administradores do escritório alteram integrações.
        </p>
      )}
      {data.providers.map((p) => (
        <ProviderCard
          key={p.provider}
          p={p}
          officeId={data.officeId}
          isAdmin={data.isAdmin}
          keyReady={data.secretsKeyConfigured}
          onChanged={load}
        />
      ))}
    </div>
  );
}

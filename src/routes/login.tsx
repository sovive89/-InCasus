import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoAccounts, homeForRole, requestPasswordReset, signIn } from "@/lib/auth/session";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Acesso — Juris Agent Lab" },
    { name: "description", content: "Acesse o Command Center jurídico ou o ambiente do cliente." },
    { property: "og:title", content: "Acesso — Juris Agent Lab" },
    { property: "og:description", content: "Acesse o Command Center jurídico ou o ambiente do cliente." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(demoAccounts[0]?.email ?? "");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setResetSent(false);
    try {
      const session = await signIn(email, password);
      await navigate({ to: homeForRole(session.profile.role) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally { setLoading(false); }
  }

  async function reset() {
    setLoading(true); setError("");
    try { await requestPasswordReset(email); setResetSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível enviar."); }
    finally { setLoading(false); }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-x-0 top-0 h-72 bg-[image:var(--gradient-depth)]" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[1fr_480px]">
        <section className="hidden flex-col justify-between border-r border-border px-12 py-12 lg:flex">
          <BrandMark />
          <div className="max-w-xl pb-16">
            <p className="eyebrow mb-5">AI Legal Command Center</p>
            <h1 className="font-display text-5xl font-semibold leading-[1.1] text-foreground">Inteligência aplicada à prática jurídica.</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">Clientes, processos e análises reunidos em um ambiente preciso, seguro e preparado para revisão profissional.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" /> Ambiente de demonstração · dados fictícios</div>
        </section>

        <section className="flex items-center px-5 py-10 sm:px-10 lg:px-12">
          <div className="mx-auto w-full max-w-sm">
            <BrandMark className="mb-12 lg:hidden" />
            <div className="mb-8">
              <p className="eyebrow mb-3">Acesso seguro</p>
              <h2 className="font-display text-3xl font-semibold">Bem-vindo</h2>
              <p className="mt-2 text-sm text-muted-foreground">Entre para acessar seu ambiente.</p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-2" aria-label="Contas de demonstração">
              {demoAccounts.map((account) => (
                <Button key={account.email} type="button" variant={email === account.email ? "secondary" : "outline"} className="h-auto justify-start px-3 py-3" onClick={() => { setEmail(account.email); setPassword("demo1234"); }}>
                  <span className="text-left"><span className="block text-xs font-semibold">{account.label}</span><span className="block text-[10px] font-normal text-muted-foreground">Conta demonstrativa</span></span>
                </Button>
              ))}
            </div>

            <form className="space-y-5" onSubmit={submit}>
              <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label htmlFor="password">Senha</Label><button type="button" className="text-xs text-primary hover:underline" onClick={reset}>Esqueci minha senha</button></div>
                <div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" /><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
              </div>
              {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
              {resetSent && <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">Instruções enviadas em modo demonstração.</p>}
              <Button type="submit" variant="command" className="h-11 w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <><KeyRound /> Entrar <ArrowRight className="ml-auto" /></>}</Button>
            </form>
            <p className="mt-6 text-center text-[11px] leading-5 text-muted-foreground">Use uma das contas demonstrativas. A autenticação real será conectada na próxima etapa.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homeForRole, requestPasswordReset, signIn } from "@/lib/auth/session";
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { getAccount } from '@/lib/auth/account.functions';

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Acesso — InCasus" },
    { name: "description", content: "Acesse o Central de comando jurídica ou o ambiente do cliente." },
    { property: "og:title", content: "Acesso — InCasus" },
    { property: "og:description", content: "Acesse o Central de comando jurídica ou o ambiente do cliente." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: LoginPage,
});

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [signup, setSignup] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  useEffect(() => { void supabase.auth.getUser().then(async ({ data }) => { if (data.user) { const account = await getAccount(); await navigate({ to: homeForRole(account.role) }); } }).catch(() => {}); }, [navigate]);

  async function social(provider: 'google' | 'lovable') {
    setLoading(true); setError('');
    try { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (result.error) throw result.error; if (!result.redirected) { const account = await getAccount(); await navigate({ to: homeForRole(account.role) }); } }
    catch { setError('Não foi possível entrar com esse serviço.'); }
    finally { setLoading(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setResetSent(false);
    try {
      if (signup) {
        const { error: signupError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim() } } });
        if (signupError) throw new Error('Não foi possível criar a conta. Verifique os dados ou tente recuperar sua senha.');
        setConfirmation(true); return;
      }
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
            <p className="eyebrow mb-5">Central jurídica com IA</p>
            <h1 className="font-display text-5xl font-semibold leading-[1.1] text-foreground">Inteligência aplicada à prática jurídica.</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">Clientes, processos e análises reunidos em um ambiente preciso, seguro e preparado para revisão profissional.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" /> Acesso pessoal protegido</div>
        </section>

        <section className="flex items-center px-5 py-10 sm:px-10 lg:px-12">
          <div className="mx-auto w-full max-w-sm">
            <BrandMark className="mb-12 lg:hidden" />
            <div className="mb-8">
              <p className="eyebrow mb-3">Acesso seguro</p>
              <h2 className="font-display text-3xl font-semibold">{signup ? 'Criar conta' : 'Bem-vindo'}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Entre para acessar seu ambiente.</p>
            </div>

            <div className="mb-6 grid gap-2">
              <Button className="google-login" variant="outline" disabled={loading} onClick={() => void social('google')}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>Continuar com Google</Button>
              <Button variant="outline" disabled={loading} onClick={() => void social('lovable')}>Continuar com Lovable</Button>
            </div>

            <form className="space-y-5" onSubmit={submit}>
              {signup && <div className="space-y-2"><Label htmlFor="name">Nome</Label><Input id="name" value={name} required maxLength={100} onChange={(e) => setName(e.target.value)}/></div>}
              <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label htmlFor="password">Senha</Label><Button variant="link" type="button" size="sm" disabled={loading || !email} onClick={reset}>Esqueci minha senha</Button></div>
                <div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" /><Button type="button" variant="ghost" size="icon" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-0 top-1/2 -translate-y-1/2" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div>
              </div>
              {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
              {resetSent && <p role="status" className="text-xs text-primary">Se houver uma conta para este e-mail, você receberá as instruções.</p>}
              {confirmation && <p role="status" className="text-sm text-primary">Confira seu e-mail para confirmar a conta antes de entrar.</p>}
              <Button type="submit" variant="command" className="h-11 w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <><KeyRound /> {signup ? 'Criar conta' : 'Entrar'} <ArrowRight className="ml-auto" /></>}</Button>
            </form>
            <Button variant="link" className="mt-5 w-full" disabled={loading} onClick={() => { setSignup(!signup); setError(''); setConfirmation(false); }}>{signup ? 'Já tenho conta' : 'Criar minha conta'}</Button>
          </div>
        </section>
      </div>
    </main>
  );
}

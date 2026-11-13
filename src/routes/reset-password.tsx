import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export const Route = createFileRoute('/reset-password')({ head: () => ({ meta: [{ title: 'Nova senha — InCasus' }, { name: 'description', content: 'Recupere com segurança o acesso à sua conta.' }, { property: 'og:title', content: 'Nova senha — InCasus' }, { property: 'og:description', content: 'Recupere com segurança o acesso à sua conta.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Page });
function Page() {
  const [valid, setValid] = useState(false); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { const recovery = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'; void supabase.auth.getUser().then(({ data }) => setValid(recovery && Boolean(data.user))); }, []);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); const { error } = await supabase.auth.updateUser({ password }); if (error) setError('Não foi possível atualizar a senha. Solicite um novo link.'); else { setSaved(true); await supabase.auth.signOut(); } setBusy(false); }
  return <main className="mx-auto max-w-sm px-5 py-20"><h1 className="mb-6 font-display text-2xl">Nova senha</h1>{saved ? <p role="status">Senha atualizada.</p> : valid ? <form onSubmit={submit} className="space-y-4"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}/><Button disabled={busy} type="submit">Salvar senha</Button></form> : <p>Use o link de recuperação enviado ao seu e-mail.</p>}{error && <p role="alert">{error}</p>}<Button asChild variant="link" className="mt-4"><Link to="/login">Voltar ao acesso</Link></Button></main>;
}
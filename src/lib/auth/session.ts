/**
 * Sessão de demonstração.
 *
 * Mantém a mesma interface prevista para o Supabase Auth (signIn / signOut /
 * getSession), permitindo trocar a implementação sem alterar as telas.
 */
import { supabase } from '@/integrations/supabase/client';
import { getAccount } from './account.functions';
import type { Profile, Role } from "../domain/types";

let current: Session | null = null;

export type Session = { profile: Profile };

export function setAccountSession(account: Awaited<ReturnType<typeof getAccount>> | null) { current = account ? { profile: account } : null; }

export function getSession(): Session | null {
  return current;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error('Não foi possível entrar. Confira o e-mail, a senha e a confirmação do e-mail.');
  const account = await getAccount();
  setAccountSession(account);
  return { profile: account };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
  if (error) throw new Error('Não foi possível enviar a recuperação de senha.');
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error('Não foi possível sair.');
  current = null;
}

export function homeForRole(role: Role) {
  return role === "lawyer" ? "/advogado/dashboard" : "/cliente";
}

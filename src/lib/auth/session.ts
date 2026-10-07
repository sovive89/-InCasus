/**
 * Autenticação real com Supabase Auth.
 *
 * Conceito: o Supabase guarda quem está logado (o "token") no navegador e o
 * envia em cada consulta. O banco usa esse token para decidir, via RLS, o que
 * cada pessoa pode ver — por isso a segurança de verdade mora no banco; as
 * telas só usam esta camada para redirecionar e mostrar o nome do usuário.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Role } from "../domain/types";

export type Session = { profile: Profile };

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, phone, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    createdAt: data.created_at,
    ...(data.phone ? { phone: data.phone } : {}),
  };
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const profile = await loadProfile(user.id);
  return profile ? { profile } : null;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.user) throw new Error("E-mail ou senha inválidos.");
  const profile = await loadProfile(data.user.id);
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error("Perfil não encontrado. Fale com o escritório.");
  }
  return { profile };
}

/** Link mágico: o Supabase envia um e-mail; ao clicar, a pessoa volta logada para /login. */
export async function signInWithEmailLink(email: string): Promise<void> {
  if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/login`, shouldCreateUser: true },
  });
  if (error) throw new Error("Não foi possível enviar o link agora. Tente novamente em instantes.");
}

/** Cria conta nova. Toda conta nasce como cliente; promover a advogado é feito pelo escritório. */
export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<{ session: Session | null }> {
  if (password.length < 8) throw new Error("A senha deve ter ao menos 8 caracteres.");
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${window.location.origin}/login`, data: { name: name.trim() } },
  });
  if (error) throw new Error("Não foi possível criar a conta. Verifique os dados.");
  if (!data.session || !data.user) return { session: null }; // aguardando confirmação por e-mail
  const profile = await loadProfile(data.user.id);
  return { session: profile ? { profile } : null };
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/login`,
  });
  if (error) throw new Error("Não foi possível enviar as instruções agora.");
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function homeForRole(role: Role) {
  return role === "lawyer" ? "/advogado/dashboard" : "/cliente";
}

/**
 * Guarda de rota (UX): redireciona quem não está logado — ou está na área
 * errada — e devolve o perfil quando tudo estiver certo.
 */
export function useRequireRole(role: Role): Profile | null {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    getSession().then((session) => {
      if (!active) return;
      if (!session) {
        navigate({ to: "/login" });
      } else if (session.profile.role !== role) {
        navigate({ to: homeForRole(session.profile.role) });
      } else {
        setProfile(session.profile);
      }
    });
    return () => {
      active = false;
    };
  }, [navigate, role]);

  return profile;
}

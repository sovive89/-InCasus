/**
 * Sessão de demonstração.
 *
 * Mantém a mesma interface prevista para o Supabase Auth (signIn / signOut /
 * getSession), permitindo trocar a implementação sem alterar as telas.
 */
import { profiles } from "../mock/data";
import type { Profile, Role } from "../domain/types";

const STORAGE_KEY = "agente-juridico.session";

export type Session = { profile: Profile };

const DEMO_PASSWORD = "demo1234";

export const demoAccounts = [
  { email: "helena@duarteadvocacia.com.br", role: "lawyer" as Role, label: "Advogada" },
  { email: "maria.antunes@email.com", role: "client" as Role, label: "Cliente" },
];

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<Session> {
  await new Promise((r) => setTimeout(r, 650));
  const profile = profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
  if (!profile || password !== DEMO_PASSWORD) {
    throw new Error("E-mail ou senha inválidos.");
  }
  const session: Session = { profile };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 650));
  if (!email.includes("@")) throw new Error("Informe um e-mail válido.");
}

export function signOut() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function homeForRole(role: Role) {
  return role === "lawyer" ? "/advogado/dashboard" : "/cliente";
}

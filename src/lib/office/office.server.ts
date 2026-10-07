/**
 * Escritório (tenant) do usuário logado. Só servidor.
 * Advogado sem escritório ganha o seu no primeiro acesso e vira administrador.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type OfficeContext = { officeId: string; isAdmin: boolean };

export async function resolveOffice(ctx: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<OfficeContext | null> {
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("role, name")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (profile?.role !== "lawyer") return null;
  const { data: member } = await ctx.supabase
    .from("office_members")
    .select("office_id, role")
    .eq("user_id", ctx.userId)
    .limit(1)
    .maybeSingle();
  if (member) return { officeId: member.office_id as string, isAdmin: member.role === "admin" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SupabaseClient;
  const { data: office, error } = await admin
    .from("offices")
    .insert({ name: profile.name ? `Escritório ${profile.name}` : "Meu escritório" })
    .select("id")
    .single();
  if (error || !office) return null;
  await admin
    .from("office_members")
    .insert({ office_id: office.id, user_id: ctx.userId, role: "admin" });
  return { officeId: office.id as string, isAdmin: true };
}

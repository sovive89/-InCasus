import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientInput, caseInput, type DossierDatabase } from "./schema";

export const getDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient<DossierDatabase>;
    const offices = await db.from("dossier_offices").select("*").order("created_at");
    if (offices.error) {
      if (["PGRST205", "42P01", "42703", "PGRST204"].includes(offices.error.code))
        return { state: "setup_required" as const, offices: [], clients: [], cases: [] };
      throw new Error("Não foi possível carregar o prontuário. Tente novamente.");
    }
    const [clients, cases] = await Promise.all([
      db
        .from("dossier_clients")
        .select("id,office_id,name,email,phone,created_at")
        .order("created_at", { ascending: false }),
      db.from("dossier_cases").select("*").order("created_at", { ascending: false }),
    ]);
    if (clients.error || cases.error) {
      const error = clients.error || cases.error;
      if (error && ["PGRST205", "42P01", "42703", "PGRST204"].includes(error.code))
        return { state: "setup_required" as const, offices: [], clients: [], cases: [] };
      throw new Error("Não foi possível carregar clientes e casos. Tente novamente.");
    }
    return {
      state: "ready" as const,
      offices: offices.data,
      clients: clients.data ?? [],
      cases: cases.data ?? [],
    };
  });
export const startDossierOffice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(180) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient<DossierDatabase>;
    const result = await db.rpc("dossier_start_office", { office_name: data.name });
    if (result.error)
      throw new Error(
        "Não foi possível ativar o prontuário. Verifique o acesso profissional e a configuração do banco.",
      );
    return result.data;
  });
export const createDossierClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => clientInput.parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient<DossierDatabase>;
    const result = await db
      .from("dossier_clients")
      .insert({
        id: data.id,
        office_id: data.officeId,
        name: data.name,
        email: data.email,
        phone: data.phone,
      })
      .select("id")
      .single();
    if (result.error)
      throw new Error(
        "Não foi possível cadastrar o cliente. Confira os dados e seu acesso ao escritório.",
      );
    return result.data;
  });
export const createDossierCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => caseInput.parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient<DossierDatabase>;
    const result = await db
      .from("dossier_cases")
      .insert({
        id: data.id,
        office_id: data.officeId,
        client_id: data.clientId,
        title: data.title,
        matter: data.matter,
        phase: data.phase,
      })
      .select("id")
      .single();
    if (result.error)
      throw new Error(
        "Não foi possível cadastrar o caso. Confira os dados e o vínculo com o cliente.",
      );
    return result.data;
  });

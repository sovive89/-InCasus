import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyOffice =
  { ok: true; officeId: string; isAdmin: boolean } | { ok: false; message: string };

/** Devolve (criando no primeiro acesso) o escritório do advogado logado. */
export const getMyOffice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyOffice> => {
    const { resolveOffice } = await import("./office.server");
    const office = await resolveOffice(context as { supabase: SupabaseClient; userId: string });
    return office
      ? { ok: true, ...office }
      : { ok: false, message: "Acesso restrito a advogados." };
  });

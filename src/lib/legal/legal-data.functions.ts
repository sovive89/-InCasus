/**
 * Server function chamada pelas telas. Roda só no servidor; exige usuário logado
 * E perfil de advogado. As credenciais dos provedores nunca saem daqui.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LegalDataError, type LegalLookupResponse } from "./types";

const input = z.object({ cnj: z.string().min(1).max(40) });

export const lookupProcessByCnj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }): Promise<LegalLookupResponse> => {
    const { supabase, userId } = context;
    // Só advogados consultam fontes jurídicas (a RLS também protege o resto).
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profile?.role !== "lawyer") {
      return { ok: false, code: "AUTHENTICATION_ERROR", message: "Acesso restrito a advogados." };
    }
    try {
      const { LegalDataService } = await import("./legal-data-service");
      const { supabaseLegalStore } = await import("./supabase-store.server");
      const { DataJudProvider } = await import("./providers/datajud");
      const service = new LegalDataService(supabaseLegalStore, [new DataJudProvider()]);
      return { ok: true, data: await service.getProcessByCnj(data.cnj, userId) };
    } catch (err) {
      if (err instanceof LegalDataError) return { ok: false, code: err.code, message: err.message };
      console.error("[legal] erro inesperado", err);
      return { ok: false, code: "PROVIDER_UNAVAILABLE", message: "Não foi possível consultar agora." };
    }
  });

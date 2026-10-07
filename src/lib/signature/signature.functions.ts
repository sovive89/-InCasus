/**
 * Server functions do módulo de assinatura (chamadas pelas telas).
 * Rodam só no servidor. Segredos nunca voltam ao navegador: a resposta traz apenas
 * `configured` e a versão mascarada (••••a82f).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SignatureError, type ProviderSettingsView } from "./types";

const providerEnum = z.enum(["govbr", "clicksign", "d4sign", "zapsign", "autentique"]);

export type SignatureOverview =
  | {
      ok: true;
      officeId: string;
      isAdmin: boolean;
      secretsKeyConfigured: boolean;
      providers: ProviderSettingsView[];
    }
  | { ok: false; message: string };

export type SignatureActionResult = { ok: true; message: string } | { ok: false; message: string };

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

async function resolveOffice(ctx: Ctx) {
  const { resolveOffice: resolve } = await import("@/lib/office/office.server");
  return resolve(ctx);
}

export const getSignatureOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignatureOverview> => {
    const office = await resolveOffice(context as Ctx);
    if (!office) return { ok: false, message: "Acesso restrito a advogados." };
    const { createSignatureService } = await import("./runtime.server");
    return {
      ok: true,
      officeId: office.officeId,
      isAdmin: office.isAdmin,
      secretsKeyConfigured: Boolean(process.env["SIGNATURE_CREDENTIALS_KEY"]),
      providers: await createSignatureService().listProviders(office.officeId),
    };
  });

const saveInput = z.object({
  provider: providerEnum,
  enabled: z.boolean().optional(),
  environment: z.enum(["sandbox", "production"]).optional(),
  makeDefault: z.boolean().optional(),
  secrets: z.record(z.string().max(200), z.string().max(4000)).optional(),
});

export const saveSignatureProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveInput.parse(data))
  .handler(async ({ data, context }): Promise<SignatureActionResult> => {
    const office = await resolveOffice(context as Ctx);
    if (!office?.isAdmin)
      return { ok: false, message: "Apenas administradores do escritório alteram integrações." };
    try {
      const { createSignatureService } = await import("./runtime.server");
      await createSignatureService().saveProviderSettings(
        office.officeId,
        (context as Ctx).userId,
        data.provider,
        data,
      );
      return { ok: true, message: "Configuração salva." };
    } catch (err) {
      if (err instanceof SignatureError) return { ok: false, message: err.message };
      console.error("[signature] salvar provedor", err instanceof Error ? err.message : "erro");
      return { ok: false, message: "Não foi possível salvar agora." };
    }
  });

export const testSignatureProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ provider: providerEnum }).parse(data))
  .handler(async ({ data, context }): Promise<SignatureActionResult> => {
    const office = await resolveOffice(context as Ctx);
    if (!office?.isAdmin)
      return { ok: false, message: "Apenas administradores do escritório testam integrações." };
    try {
      const { createSignatureService } = await import("./runtime.server");
      const r = await createSignatureService().testConnection(office.officeId, data.provider);
      return { ok: r.ok, message: r.message };
    } catch (err) {
      if (err instanceof SignatureError) return { ok: false, message: err.message };
      return { ok: false, message: "Não foi possível testar agora." };
    }
  });

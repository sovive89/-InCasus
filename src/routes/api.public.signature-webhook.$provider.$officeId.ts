/**
 * Endpoint público que recebe webhooks dos provedores de assinatura.
 *
 * Público porque o provedor não tem login no InCasus — a segurança vem de:
 *  1) o provider validar a autenticidade (assinatura/HMAC/token) conforme a documentação dele;
 *  2) idempotência (evento repetido não gera nova atualização nem notificação);
 *  3) nunca devolver detalhes internos nas respostas.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const params = z.object({
  provider: z.enum(["govbr", "clicksign", "d4sign", "zapsign", "autentique"]),
  officeId: z.string().uuid(),
});
const MAX_BODY = 1_000_000;

export const Route = createFileRoute("/api/public/signature-webhook/$provider/$officeId")({
  server: {
    handlers: {
      POST: async ({ request, params: raw }) => {
        const parsed = params.safeParse(raw);
        if (!parsed.success) return Response.json({ ok: false }, { status: 404 });
        const rawBody = await request.text();
        if (rawBody.length > MAX_BODY) return Response.json({ ok: false }, { status: 413 });
        const headers: Record<string, string> = {};
        request.headers.forEach((v, k) => {
          headers[k.toLowerCase()] = v;
        });
        try {
          const { createSignatureService } = await import("@/lib/signature/runtime.server");
          const { SignatureError } = await import("@/lib/signature/types");
          try {
            const result = await createSignatureService().handleWebhook(
              parsed.data.officeId,
              parsed.data.provider,
              { rawBody, headers },
            );
            return Response.json({ ok: true, ...result });
          } catch (err) {
            if (err instanceof SignatureError) {
              const status =
                err.code === "INVALID_WEBHOOK"
                  ? 401
                  : err.code === "PROVIDER_NOT_IMPLEMENTED"
                    ? 501
                    : 422;
              return Response.json({ ok: false }, { status });
            }
            throw err;
          }
        } catch (err) {
          console.error("[signature-webhook]", err instanceof Error ? err.message : "erro");
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});

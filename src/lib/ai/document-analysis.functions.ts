import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  fileName: z.string().min(1).max(180),
  processLabel: z.string().min(1).max(240),
  text: z.string().min(40).max(120_000),
});

export type DocumentDeadline = {
  date: string | null;
  description: string;
  sourceExcerpt: string;
  certainty: "explicit" | "inferred";
};

export type DocumentAnalysisResult = {
  summary: string;
  keyPoints: string[];
  deadlines: DocumentDeadline[];
  attentionPoints: string[];
  documentType: string;
};

export type AnalyzeDocumentResponse =
  | { ok: true; analysis: DocumentAnalysisResult }
  | { ok: false; error: string };

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    keyPoints: { type: "array", items: { type: "string" } },
    deadlines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: ["string", "null"] },
          description: { type: "string" },
          sourceExcerpt: { type: "string" },
          certainty: { type: "string", enum: ["explicit", "inferred"] },
        },
        required: ["date", "description", "sourceExcerpt", "certainty"],
      },
    },
    attentionPoints: { type: "array", items: { type: "string" } },
    documentType: { type: "string" },
  },
  required: ["summary", "keyPoints", "deadlines", "attentionPoints", "documentType"],
} as const;

function safeGatewayMessage(status: number, body: string) {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: { message?: string } };
    return parsed.message ?? parsed.error?.message ?? `A análise não pôde ser concluída (${status}).`;
  } catch {
    return `A análise não pôde ser concluída (${status}).`;
  }
}

function extractSseText(streamBody: string) {
  let result = "";
  for (const line of streamBody.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const event = JSON.parse(payload) as {
        type?: string;
        delta?: string;
        response?: { output_text?: string };
      };
      if (event.type === "response.output_text.delta" && event.delta) result += event.delta;
      if (!result && event.type === "response.completed" && event.response?.output_text) {
        result = event.response.output_text;
      }
    } catch {
      // Ignore non-JSON keepalive lines.
    }
  }
  return result;
}

export const analyzeLegalDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<AnalyzeDocumentResponse> => {
    const lovableApiKey = process.env["LOVABLE_API_KEY"];
    if (!lovableApiKey) {
      return { ok: false, error: "A análise por IA ainda não está configurada neste ambiente." };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": lovableApiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "medium", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: {
          format: {
            type: "json_schema",
            name: "legal_document_analysis",
            strict: true,
            schema: responseSchema,
          },
        },
        instructions:
          "Você auxilia um advogado brasileiro. Analise somente o conteúdo fornecido. Não invente fatos, datas, prazos, leis ou jurisprudência. Para cada prazo, copie um trecho curto que o sustente. Marque como inferred somente quando o documento mencionar um evento sem data final calculável. Responda em português do Brasil, de forma objetiva. Isto é apoio profissional, não parecer jurídico final.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Processo: ${data.processLabel}\nArquivo: ${data.fileName}\n\nConteúdo extraído:\n${data.text}`,
              },
            ],
          },
        ],
      }),
    });

    const body = await response.text();
    if (!response.ok) return { ok: false, error: safeGatewayMessage(response.status, body) };

    const output = extractSseText(body);
    if (!output) return { ok: false, error: "A IA concluiu a leitura, mas não produziu um resumo." };

    try {
      return { ok: true, analysis: JSON.parse(output) as DocumentAnalysisResult };
    } catch {
      return { ok: false, error: "O resumo retornou em um formato inesperado. Tente novamente." };
    }
  });
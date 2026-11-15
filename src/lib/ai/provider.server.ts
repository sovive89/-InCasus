// Server-only provider adapter. Documents and credentials never go through an editor gateway.
export class AIProviderError extends Error {
  constructor(public readonly status: number) {
    super("Serviço de IA indisponível.");
  }
}
type Request = {
  instructions: string;
  input: Array<{ role: string; content: Array<{ type: string; text: string }> }>;
  text: { format: { type: string; name: string; strict: boolean; schema: object } };
};
export async function requestStructuredResponse(request: Request): Promise<string> {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new AIProviderError(503);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      model: process.env["OPENAI_MODEL"] || "gpt-4.1-mini",
      store: false,
      max_output_tokens: 4500,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new AIProviderError(response.status);
  const data = (await response.json()) as {
    status?: string;
    output?: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>;
  };
  if (data.status !== "completed") throw new AIProviderError(502);
  const text = (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("");
  if (!text) throw new AIProviderError(502);
  return text;
}

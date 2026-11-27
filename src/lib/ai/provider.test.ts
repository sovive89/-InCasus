import { test } from "node:test";
import assert from "node:assert/strict";
import { requestStructuredResponse, AIProviderError } from "./provider.server";
const input = {
  instructions: "Teste",
  input: [{ role: "user", content: [{ type: "input_text", text: "Documento fictício" }] }],
  text: { format: { type: "json_schema", name: "test", strict: true, schema: { type: "object" } } },
};
test("adaptador direto usa resposta estruturada sem armazenar documentos", async (t) => {
  const old = process.env["OPENAI_API_KEY"];
  process.env["OPENAI_API_KEY"] = "placeholder-de-teste";
  const mock = t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, init?: RequestInit) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      assert.equal(body.text.format.type, "json_schema");
      return Response.json({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "output_text", text: '{"answer":"Teste"}' }] },
        ],
      });
    },
  );
  try {
    assert.equal(await requestStructuredResponse(input), '{"answer":"Teste"}');
    assert.equal(mock.mock.calls.length, 1);
  } finally {
    mock.mock.restore();
    if (old === undefined) delete process.env["OPENAI_API_KEY"];
    else process.env["OPENAI_API_KEY"] = old;
  }
});
test("sem configuração não há chamada externa", async (t) => {
  const old = process.env["OPENAI_API_KEY"];
  delete process.env["OPENAI_API_KEY"];
  const mock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Não deve chamar");
  });
  try {
    await assert.rejects(requestStructuredResponse(input), AIProviderError);
    assert.equal(mock.mock.calls.length, 0);
  } finally {
    mock.mock.restore();
    if (old !== undefined) process.env["OPENAI_API_KEY"] = old;
  }
});

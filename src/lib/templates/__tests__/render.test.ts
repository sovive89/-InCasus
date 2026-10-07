import { describe, expect, test } from "bun:test";
import {
  escapeHtml,
  extractVariables,
  groupFor,
  labelFor,
  renderTemplate,
  systemValues,
} from "../render";

describe("variáveis dos modelos", () => {
  test("extrai variáveis únicas, tolerando espaços e maiúsculas", () => {
    expect(
      extractVariables("Olá {{ cliente.nome }}, {{Cliente.Nome}} e {{local}}. {{ 123 }} {{a b}}"),
    ).toEqual(["cliente.nome", "local"]);
  });
  test("troca valores e marca o que falta de forma visível", () => {
    const r = renderTemplate("{{cliente.nome}} mora em {{cliente.endereco}}. {{cliente.nome}}.", {
      "cliente.nome": "Ana",
    });
    expect(r.text).toBe("Ana mora em [[cliente.endereco]]. Ana.");
    expect(r.missing).toEqual(["cliente.endereco"]);
  });
  test("valor vazio conta como faltante e '$&' é tratado como texto puro", () => {
    expect(renderTemplate("{{a}}", { a: "   " }).missing).toEqual(["a"]);
    expect(renderTemplate("{{a}}", { a: "R$& 100" }).text).toBe("R$& 100");
  });
  test("data por extenso em português, no fuso de São Paulo", () => {
    const v = systemValues(new Date("2026-10-07T12:00:00Z"));
    expect(v["data.extenso"]).toBe("7 de outubro de 2026");
    expect(v["data.hoje"]).toBe("07/10/2026");
  });
  test("rótulos, grupos e escape de HTML", () => {
    expect(labelFor("cliente.cpf")).toBe("CPF");
    expect(labelFor("pedido_recursal")).toBe("Pedido recursal");
    expect(groupFor("cliente.cpf")).toBe("Cliente");
    expect(groupFor("fatos")).toBe("Dados do caso");
    expect(escapeHtml('<b>"x"</b> & y')).toBe("&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; y");
  });
});

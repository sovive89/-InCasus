import { test } from "node:test";
import assert from "node:assert/strict";
import { caseInput, clientInput } from "./schema";
const id = "10000000-0000-4000-8000-000000000001";
test("inquérito pode ser registrado sem CNJ", () => {
  const result = caseInput.parse({
    id,
    officeId: id,
    clientId: id,
    title: "  Investigação  ",
    matter: "Criminal",
    phase: "investigation",
  });
  assert.equal(result.title, "Investigação");
  assert.equal(result.phase, "investigation");
});
test("cadastro não aceita campos vazios nem etapa desconhecida", () => {
  assert.equal(
    caseInput.safeParse({
      id,
      officeId: id,
      clientId: id,
      title: " ",
      matter: "Criminal",
      phase: "investigation",
    }).success,
    false,
  );
  assert.equal(
    caseInput.safeParse({
      id,
      officeId: id,
      clientId: id,
      title: "Caso",
      matter: " ",
      phase: "judicial",
    }).success,
    false,
  );
  assert.equal(
    caseInput.safeParse({
      id,
      officeId: id,
      clientId: id,
      title: "Caso",
      matter: "Civil",
      phase: "automatic",
    }).success,
    false,
  );
});
test("contato é opcional, com validação de e-mail e limites", () => {
  assert.equal(
    clientInput.safeParse({ id, officeId: id, name: "Cliente", email: "", phone: "" }).success,
    true,
  );
  assert.equal(
    clientInput.safeParse({ id, officeId: id, name: "Cliente", email: "invalido", phone: "" })
      .success,
    false,
  );
  assert.equal(
    clientInput.safeParse({ id, officeId: id, name: "Cliente", email: "", phone: "9".repeat(41) })
      .success,
    false,
  );
});
test("campos de vínculo de conta não entram na entrada de cadastro", () => {
  const result = clientInput.parse({
    id,
    officeId: id,
    name: "Cliente",
    email: "",
    phone: "",
    account_id: id,
  });
  assert.equal("account_id" in result, false);
});

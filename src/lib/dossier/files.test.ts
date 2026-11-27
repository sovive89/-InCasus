import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fileMime,
  validateFileMetadata,
  fileFormatMatches,
  browserSha256,
  MAX_FILE_BYTES,
} from "./files";
import { noteInput, uploadInput } from "./schema";
const id = "10000000-0000-4000-8000-000000000001";
test("arquivos têm tipo explícito, limite e nome seguro", () => {
  assert.equal(fileMime("Prova.PDF"), "application/pdf");
  assert.equal(fileMime("audio.m4a"), "audio/mp4");
  for (const file of [
    { name: "arquivo.pdf.exe", size: 10 },
    { name: "../prova.pdf", size: 10 },
    { name: "a\r\nb.pdf", size: 10 },
    { name: "prova.pdf", size: 0 },
    { name: "prova.pdf", size: MAX_FILE_BYTES + 1 },
  ])
    assert.ok(validateFileMetadata(file));
  assert.equal(validateFileMetadata({ name: "Inquérito.pdf", size: 42 }), null);
});
test("conferência reconhece assinaturas básicas e rejeita conteúdo incompatível", () => {
  const bytes = (value: string) => new TextEncoder().encode(value);
  assert.equal(fileFormatMatches(bytes("%PDF-1.7\noriginal"), "application/pdf"), true);
  assert.equal(fileFormatMatches(bytes("<script>não é PDF</script>"), "application/pdf"), false);
  assert.equal(fileFormatMatches(bytes("Texto em português."), "text/plain"), true);
  assert.equal(fileFormatMatches(new Uint8Array([255, 0]), "text/plain"), false);
  assert.equal(fileFormatMatches(bytes("RIFF1234WAVE"), "audio/wav"), true);
  assert.equal(fileFormatMatches(bytes("RIFF1234WAVE"), "image/webp"), false);
});
test("identificação do original é o SHA-256 dos bytes", async () => {
  assert.equal(
    await browserSha256(new Blob(["abc"])),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
test("notas têm controle de versão e não permitem texto vazio", () => {
  assert.equal(
    noteInput.safeParse({
      id,
      officeId: id,
      clientId: id,
      caseId: id,
      title: "Nota",
      body: " ",
      expectedVersion: 0,
    }).success,
    false,
  );
  assert.equal(
    noteInput.safeParse({
      id,
      officeId: id,
      clientId: id,
      caseId: id,
      title: "Nota",
      body: "Texto",
      expectedVersion: -1,
    }).success,
    false,
  );
  assert.equal(
    noteInput.safeParse({
      id,
      officeId: id,
      clientId: id,
      caseId: id,
      title: "Nota",
      body: "Texto",
      expectedVersion: 2,
    }).success,
    true,
  );
});
test("reserva de original exige origem, hash e tamanho limitados", () => {
  const valid = {
    id,
    officeId: id,
    clientId: id,
    caseId: id,
    title: "Original",
    kind: "evidence",
    originalName: "prova.pdf",
    sizeBytes: 20,
    sha256: "a".repeat(64),
    source: "Recebido do cliente",
  };
  assert.equal(uploadInput.safeParse(valid).success, true);
  assert.equal(uploadInput.safeParse({ ...valid, source: " " }).success, false);
  assert.equal(uploadInput.safeParse({ ...valid, sha256: "não verificado" }).success, false);
  assert.equal(uploadInput.safeParse({ ...valid, sizeBytes: MAX_FILE_BYTES + 1 }).success, false);
});

// This test creates only fictitious records in the isolated local backend.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash, createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { readLocalConfig } from "../../scripts/backend-env.mjs";
const config = await readLocalConfig();
assert.equal(new URL(config.API_URL).hostname, "127.0.0.1", "Testes limitados ao backend local.");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const salt = randomBytes(6).toString("hex");
function ok(result, step) {
  if (result.error) throw new Error(`${step}: ${result.error.code || result.error.message}`);
  return result.data;
}
async function account(label, lawyer) {
  const email = `${label}-${salt}@incasus.example`,
    password = randomBytes(20).toString("base64url");
  const user = ok(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: `Teste ${label}`, role: "lawyer" },
    }),
    "criar conta fictícia",
  ).user;
  if (lawyer)
    ok(
      await admin.from("user_roles").insert({ user_id: user.id, role: "lawyer" }),
      "papel profissional",
    );
  const client = createClient(config.API_URL, config.ANON_KEY, options);
  ok(await client.auth.signInWithPassword({ email, password }), "login real");
  return { client, user, email, password };
}
const a = await account("advogado-a", true),
  b = await account("advogado-b", true),
  customer = await account("cliente", false);
assert.equal(
  ok(
    await customer.client.rpc("has_legal_role", { who: customer.user.id, wanted: "lawyer" }),
    "papel de cliente",
  ),
  false,
  "metadata não concede acesso profissional",
);
const officeA = ok(
  await a.client.rpc("dossier_start_office", { office_name: "Escritório A — teste" }),
  "ativar A",
);
const officeB = ok(
  await b.client.rpc("dossier_start_office", { office_name: "Escritório B — teste" }),
  "ativar B",
);
assert.notEqual(officeA, officeB);
assert.equal(
  ok(await a.client.rpc("dossier_start_office", { office_name: "Repetido" }), "ativar de novo"),
  officeA,
);
assert.ok((await customer.client.rpc("dossier_start_office", { office_name: "Inválido" })).error);
const clientId = randomUUID(),
  caseId = randomUUID();
ok(
  await a.client
    .from("dossier_clients")
    .insert({
      id: clientId,
      office_id: officeA,
      name: "Cliente fictício de integração",
      email: "",
      phone: "",
    }),
  "cadastrar cliente",
);
ok(
  await a.client
    .from("dossier_cases")
    .insert({
      id: caseId,
      office_id: officeA,
      client_id: clientId,
      title: "Inquérito de teste sem CNJ",
      matter: "Criminal",
      phase: "investigation",
    }),
  "cadastrar inquérito",
);
assert.equal(
  ok(await b.client.from("dossier_cases").select("id").eq("id", caseId), "isolamento de casos")
    .length,
  0,
);
assert.ok(
  (
    await b.client
      .from("dossier_cases")
      .insert({
        id: randomUUID(),
        office_id: officeB,
        client_id: clientId,
        title: "Vínculo inválido",
        matter: "Civil",
        phase: "intake",
      })
  ).error,
);
const noteId = randomUUID();
const note = {
  p_id: noteId,
  p_office: officeA,
  p_client: clientId,
  p_case: caseId,
  p_title: "Nota interna de teste",
  p_body: "Primeira versão preservada.",
  p_expected: 0,
};
assert.equal(ok(await a.client.rpc("dossier_save_note", note), "salvar nota"), 1);
assert.equal(
  ok(
    await a.client.rpc("dossier_save_note", {
      ...note,
      p_body: "Segunda versão preservada.",
      p_expected: 1,
    }),
    "revisar nota",
  ),
  2,
);
assert.equal(
  (await a.client.rpc("dossier_save_note", { ...note, p_expected: 1 })).error?.code,
  "PT409",
  "revisão concorrente não sobrescreve",
);
assert.equal(
  ok(
    await a.client
      .from("dossier_versions")
      .select("body")
      .eq("document_id", noteId)
      .order("version"),
    "histórico",
  ).length,
  2,
);
assert.ok(
  (
    await a.client
      .from("dossier_versions")
      .update({ body: "Alterar histórico" })
      .eq("document_id", noteId)
  ).error,
);
assert.ok(
  (
    await admin
      .from("dossier_versions")
      .update({ body: "Alterar histórico" })
      .eq("document_id", noteId)
  ).error,
  "nem operação privilegiada reescreve versões",
);
assert.equal(
  ok(await b.client.rpc("dossier_case_entries", { p_case: caseId }), "isolamento das notas").length,
  0,
);
assert.ok(
  (
    await a.client.rpc("dossier_commit_upload", {
      p_upload: randomUUID(),
      p_actor: a.user.id,
      p_sha256: "a".repeat(64),
    })
  ).error,
  "browser não pode atestar arquivo",
);
const bytes = Buffer.from("DOCUMENTO FICTÍCIO DE INTEGRAÇÃO.\nOriginal preservado.\n", "utf8");
const sha256 = createHash("sha256").update(bytes).digest("hex"),
  uploadId = randomUUID();
const upload = {
  p_id: uploadId,
  p_office: officeA,
  p_client: clientId,
  p_case: caseId,
  p_title: "Original de teste",
  p_kind: "evidence",
  p_mime: "text/plain",
  p_size: bytes.length,
  p_sha256: sha256,
  p_original_name: "original-teste.txt",
  p_source: "Fixture de teste automatizado",
};
const reservation = ok(
  await a.client.rpc("dossier_prepare_upload", upload),
  "reservar original",
)[0];
ok(
  await a.client.storage
    .from("dossier-originals")
    .upload(reservation.storage_path, bytes, { contentType: "text/plain", upsert: false }),
  "armazenar original",
);
assert.ok(
  (await b.client.storage.from("dossier-originals").download(reservation.storage_path)).error,
  "outro escritório não baixa original",
);
assert.ok(
  (
    await a.client.storage
      .from("dossier-originals")
      .upload(reservation.storage_path, Buffer.from("troca"), {
        contentType: "text/plain",
        upsert: true,
      })
  ).error,
  "original não pode ser sobrescrito",
);
const downloaded = ok(
  await a.client.storage.from("dossier-originals").download(reservation.storage_path),
  "conferir bytes",
);
const receivedHash = createHash("sha256")
  .update(Buffer.from(await downloaded.arrayBuffer()))
  .digest("hex");
assert.equal(receivedHash, sha256);
assert.ok(
  (
    await admin.rpc("dossier_commit_upload", {
      p_upload: uploadId,
      p_actor: a.user.id,
      p_sha256: "0".repeat(64),
    })
  ).error,
  "hash divergente não publica arquivo",
);
assert.equal(
  ok(
    await admin.rpc("dossier_commit_upload", {
      p_upload: uploadId,
      p_actor: a.user.id,
      p_sha256: receivedHash,
    }),
    "registrar original",
  ),
  uploadId,
);
assert.equal(
  ok(
    await admin.rpc("dossier_commit_upload", {
      p_upload: uploadId,
      p_actor: a.user.id,
      p_sha256: receivedHash,
    }),
    "finalização idempotente",
  ),
  uploadId,
);
const entries = ok(
  await a.client.rpc("dossier_case_entries", { p_case: caseId }),
  "registros do caso",
);
assert.equal(entries.length, 2);
assert.equal(entries.find((x) => x.kind === "note").body, "Segunda versão preservada.");
assert.equal(entries.find((x) => x.kind === "evidence").sha256, sha256);
// Administrative fixture binding, attributed to the office owner; not an app sharing feature.
const sign = (payload) => {
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${p}.${createHmac("sha256", config.JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
};
const actorAdmin = createClient(
  config.API_URL,
  sign({ role: "service_role", sub: a.user.id, exp: Math.floor(Date.now() / 1000) + 600 }),
  options,
);
ok(
  await actorAdmin
    .from("dossier_clients")
    .update({ account_id: customer.user.id })
    .eq("id", clientId),
  "vínculo administrativo da fixture",
);
assert.equal(
  ok(
    await customer.client.from("dossier_cases").select("id").eq("id", caseId),
    "cliente vê seu caso",
  ).length,
  1,
);
assert.equal(
  ok(
    await customer.client.rpc("dossier_case_entries", { p_case: caseId }),
    "cliente não vê notas nem originais não compartilhados",
  ).length,
  0,
);
assert.ok(
  (await customer.client.storage.from("dossier-originals").download(reservation.storage_path))
    .error,
);
const before = ok(
  await a.client.from("dossier_audit").select("id").eq("action", "file.received"),
  "auditoria do arquivo",
);
assert.equal(before.length, 1, "repetir finalização não duplica auditoria");
assert.ok(
  (await a.client.from("dossier_audit").delete().eq("office_id", officeA)).error,
  "auditoria não pode ser excluída",
);
// Compatibility of the independent core with the existing process/calendar flow.
const processId = randomUUID();
ok(
  await a.client
    .from("legal_process_records")
    .insert({
      id: processId,
      owner_id: a.user.id,
      cnj: "PROCESSO-FICTICIO",
      subject: "Processo de integração",
      status: "active",
    }),
  "processo no backend independente",
);
ok(
  await a.client
    .from("resource_permissions")
    .insert({
      owner_id: a.user.id,
      grantee_id: customer.user.id,
      resource_type: "process",
      resource_id: processId,
      permission: "read",
    }),
  "leitura autorizada do processo",
);
ok(
  await a.client
    .from("calendar_records")
    .insert({
      owner_id: a.user.id,
      process_id: processId,
      client_id: customer.user.id,
      title: "Consulta fictícia",
      kind: "meeting",
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      responsible: "Advogado de teste",
    }),
  "agenda independente",
);
assert.equal(
  ok(
    await customer.client.from("calendar_records").select("id"),
    "cliente acessa compromisso autorizado",
  ).length,
  1,
);
assert.equal(
  ok(await b.client.from("legal_process_records").select("id"), "processos isolados").length,
  0,
);
const signed = ok(
  await a.client.storage
    .from("dossier-originals")
    .createSignedUrl(reservation.storage_path, 60, { download: "original-teste.txt" }),
  "link temporário",
);
const response = await fetch(signed.signedUrl);
assert.equal(response.status, 200);
assert.equal(
  createHash("sha256")
    .update(Buffer.from(await response.arrayBuffer()))
    .digest("hex"),
  sha256,
);
await writeFile(
  "/tmp/incasus-e2e-fixtures.json",
  JSON.stringify({
    a: { email: a.email, password: a.password },
    b: { email: b.email, password: b.password },
    customer: { email: customer.email, password: customer.password },
    clientId,
    caseId,
  }),
  { mode: 0o600 },
);
console.log(
  "PASS: autenticação HTTP, papéis, prontuário, versões, concorrência, isolamento, armazenamento privado, hash, download e agenda.",
);

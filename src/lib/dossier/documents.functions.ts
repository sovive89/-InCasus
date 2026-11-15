import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { noteInput, uploadInput, type RecordsDatabase } from "./schema";
import { fileMime, validFileName, MAX_FILE_BYTES, fileFormatMatches } from "./files";
const uuid = (input: unknown) => z.string().uuid().parse(input);
export const getCaseEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uuid)
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient<RecordsDatabase>;
    const result = await db.rpc("dossier_case_entries", { p_case: data });
    if (result.error) throw new Error("Não foi possível carregar documentos e notas deste caso.");
    return result.data ?? [];
  });
export const getNoteHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uuid)
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient<RecordsDatabase>;
    const result = await db
      .from("dossier_versions")
      .select("version,body,created_at")
      .eq("document_id", data)
      .eq("stage", "draft")
      .order("version", { ascending: false })
      .limit(100);
    if (result.error) throw new Error("Não foi possível carregar o histórico.");
    return result.data ?? [];
  });
export const saveCaseNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => noteInput.parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient<RecordsDatabase>;
    const result = await db.rpc("dossier_save_note", {
      p_id: data.id,
      p_office: data.officeId,
      p_client: data.clientId,
      p_case: data.caseId,
      p_title: data.title,
      p_body: data.body,
      p_expected: data.expectedVersion,
    });
    if (result.error)
      throw new Error(
        result.error.code === "PT409"
          ? "Esta nota mudou em outra sessão. Recarregue o caso antes de salvar."
          : "Não foi possível salvar a nota. O texto foi preservado para você tentar novamente.",
      );
    return result.data;
  });
export const prepareCaseUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadInput.parse(input))
  .handler(async ({ context, data }) => {
    if (!validFileName(data.originalName)) throw new Error("Nome ou formato do arquivo inválido.");
    const mime = fileMime(data.originalName)!;
    const db = context.supabase as unknown as SupabaseClient<RecordsDatabase>;
    const result = await db.rpc("dossier_prepare_upload", {
      p_id: data.id,
      p_office: data.officeId,
      p_client: data.clientId,
      p_case: data.caseId,
      p_title: data.title,
      p_kind: data.kind,
      p_mime: mime,
      p_size: data.sizeBytes,
      p_sha256: data.sha256,
      p_original_name: data.originalName,
      p_source: data.source,
    });
    if (result.error || !result.data?.[0])
      throw new Error("Não foi possível preparar o envio. Confira o caso e seu acesso.");
    return { ...result.data[0], mime };
  });
export const completeCaseUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uuid)
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient<RecordsDatabase>;
    const { data: upload, error } = await db
      .from("dossier_uploads")
      .select("*")
      .eq("id", data)
      .eq("created_by", context.userId)
      .single();
    if (error || !upload) throw new Error("Envio não encontrado.");
    if (upload.completed) return { id: upload.document_id };
    if (!validFileName(upload.original_name) || fileMime(upload.original_name) !== upload.mime)
      throw new Error("Nome ou formato do original inválido.");
    if (new Date(upload.expires_at).getTime() <= Date.now())
      throw new Error("O prazo deste envio expirou. Selecione o arquivo novamente.");
    const file = await context.supabase.storage.from("dossier-originals").download(upload.path);
    if (file.error || !file.data)
      throw new Error(
        "O arquivo ainda não chegou ao armazenamento. Tente concluir o envio novamente.",
      );
    if (file.data.size !== upload.size_bytes || file.data.size > MAX_FILE_BYTES)
      throw new Error("O tamanho recebido difere do original. Envie novamente.");
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== upload.sha256 || !fileFormatMatches(bytes, upload.mime))
      throw new Error(
        "O arquivo recebido não passou na conferência. Verifique o formato e envie novamente.",
      );
    // Service role is loaded inside the server handler only, after the authenticated
    // caller, reservation ownership and actual file bytes have been verified.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as SupabaseClient<RecordsDatabase>;
    const result = await admin.rpc("dossier_commit_upload", {
      p_upload: data,
      p_actor: context.userId,
      p_sha256: sha256,
    });
    if (result.error)
      throw new Error(
        "O arquivo chegou, mas o registro não foi concluído. Tente concluir novamente.",
      );
    return { id: result.data };
  });
export const prepareOriginalDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uuid)
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient<RecordsDatabase>;
    const version = await db
      .from("dossier_versions")
      .select("storage_path,original_name")
      .eq("document_id", data)
      .eq("version", 1)
      .single();
    if (version.error || !version.data?.storage_path)
      throw new Error("Original não disponível ou sem acesso.");
    const name = version.data.original_name || "documento";
    const result = await context.supabase.storage
      .from("dossier-originals")
      .createSignedUrl(version.data.storage_path, 60, { download: name });
    if (result.error) throw new Error("Não foi possível preparar o download.");
    return { url: result.data.signedUrl, name, expiresAt: Date.now() + 60000 };
  });

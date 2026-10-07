/** Monta o SignatureService com as peças reais (Supabase). Só servidor. */
import { createDefaultRegistry } from "./catalog";
import { SignatureService } from "./service";
import { supabaseSignatureNotifier, supabaseSignatureStore } from "./supabase-store.server";

export function createSignatureService(): SignatureService {
  return new SignatureService(
    supabaseSignatureStore,
    createDefaultRegistry(),
    supabaseSignatureNotifier,
  );
}

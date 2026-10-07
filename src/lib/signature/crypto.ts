/**
 * Cofre de segredos (AES-GCM).
 *
 * Conceito: mesmo que alguém veja a tabela do banco, as chaves de API estão
 * criptografadas; a chave-mestra (SIGNATURE_CREDENTIALS_KEY) vive só nas variáveis de
 * ambiente do servidor. Roda no servidor — nunca importe isto em código de tela.
 */
import { SignatureError } from "./types";

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function importKey(keyB64: string | undefined): Promise<CryptoKey> {
  if (!keyB64)
    throw new SignatureError(
      "SECRETS_KEY_MISSING",
      "SIGNATURE_CREDENTIALS_KEY não está configurada no servidor.",
    );
  const raw = fromBase64(keyB64);
  if (raw.length !== 32)
    throw new SignatureError(
      "SECRETS_KEY_MISSING",
      "SIGNATURE_CREDENTIALS_KEY deve ter 32 bytes (base64).",
    );
  return crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecrets(
  secrets: Record<string, string>,
  keyB64: string | undefined,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(secrets));
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer,
  );
  return { ciphertext: toBase64(new Uint8Array(enc)), iv: toBase64(iv) };
}

export async function decryptSecrets(
  payload: { ciphertext: string; iv: string },
  keyB64: string | undefined,
): Promise<Record<string, string>> {
  const key = await importKey(keyB64);
  const iv = fromBase64(payload.iv);
  const data = fromBase64(payload.ciphertext);
  try {
    const dec = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      key,
      data.buffer as ArrayBuffer,
    );
    return JSON.parse(new TextDecoder().decode(dec)) as Record<string, string>;
  } catch {
    throw new SignatureError(
      "SECRETS_KEY_MISSING",
      "Não foi possível decifrar as credenciais (chave alterada?).",
    );
  }
}

/** "••••a82f" — só os 4 últimos caracteres, nunca o segredo. */
export function maskSecret(value: string): string {
  return `••••${value.slice(-4)}`;
}
export function hintOf(value: string): string {
  return value.slice(-4);
}

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHmac, randomBytes } from "node:crypto";
export const root = new URL("../", import.meta.url);
export const composeFile = new URL("infra/backend/compose.yaml", root).pathname;
export const secretFile = new URL("infra/backend/.env.local", root).pathname;
export async function readLocalConfig() {
  const text = await readFile(secretFile, "utf8");
  return Object.fromEntries(
    text
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
}
export async function initializeLocal() {
  try {
    await readLocalConfig();
    console.log("Configuração local já existe; valores preservados.");
    return;
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const secret = randomBytes(48).toString("hex");
  const jwt = (role) => {
    const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        role,
        iss: "incasus-local",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 315360000,
      }),
    ).toString("base64url");
    const unsigned = `${head}.${body}`;
    return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
  };
  const config = {
    POSTGRES_PASSWORD: randomBytes(32).toString("hex"),
    JWT_SECRET: secret,
    ANON_KEY: jwt("anon"),
    SERVICE_ROLE_KEY: jwt("service_role"),
    APP_URL: "http://localhost:8080",
    API_URL: "http://127.0.0.1:54321",
  };
  await mkdir(new URL("infra/backend/", root), { recursive: true });
  await writeFile(
    secretFile,
    Object.entries(config)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
  console.log("Credenciais locais geradas em arquivo ignorado pelo Git.");
}

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { root, composeFile, secretFile, initializeLocal, readLocalConfig } from "./backend-env.mjs";
const docker = [
  "--host=unix:///var/run/docker.sock",
  "compose",
  "--env-file",
  secretFile,
  "-f",
  composeFile,
];
function run(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [...docker, ...args], {
      cwd: root,
      stdio: [input ? "pipe" : "ignore", "inherit", "inherit"],
    });
    if (input) child.stdin.end(input);
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("O comando do backend falhou.")),
    );
  });
}
export async function migrate() {
  const manifest = JSON.parse(
    await readFile(new URL("infra/backend/migrations.json", root), "utf8"),
  );
  for (const file of manifest) {
    const sql = await readFile(new URL(file, root), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    if (!/^[\w/.-]+$/.test(file)) throw new Error("Caminho inválido no manifesto.");
    const wrapped = `begin; create schema if not exists private; create table if not exists private.incasus_migrations(path text primary key,sha256 text not null,applied_at timestamptz not null default now()); select pg_advisory_xact_lock(15603211);\nselect exists(select from private.incasus_migrations where path='${file}') as applied \\gset\n\\if :applied\ndo $$ begin if not exists(select from private.incasus_migrations where path='${file}' and sha256='${hash}') then raise exception 'Migration alterada após aplicação'; end if; end $$;\n\\else\n${sql}\ninsert into private.incasus_migrations(path,sha256) values('${file}','${hash}');\n\\endif\ncommit; notify pgrst,'reload schema';\n`;
    await run(["exec", "-T", "db", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], wrapped);
    console.log(`Verificada: ${file}`);
  }
}
const action = process.argv[2];
if (action === "init") await initializeLocal();
else if (action === "up") {
  await initializeLocal();
  await run(["up", "-d", "--wait", "db", "mail"]);
  const bootstrap = await readFile(new URL("infra/backend/init/00-roles.sql", root), "utf8");
  await run(
    ["exec", "-T", "db", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    "select exists(select from pg_roles where rolname='authenticator') as ready \\gset\n\\if :ready\n\\else\nbegin;\n" +
      bootstrap +
      "\ncommit;\n\\endif\n",
  );
  await run(["up", "-d", "auth", "rest", "storage"]);
  await run(["create", "api"]);
  await run([
    "cp",
    new URL("infra/backend/gateway.conf", root).pathname,
    "api:/etc/nginx/conf.d/default.conf",
  ]);
  await run(["up", "-d", "api"]);
  const config = await readLocalConfig();
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const responses = await Promise.all([
        fetch(`${config.API_URL}/auth/v1/health`),
        fetch(`${config.API_URL}/storage/v1/status`),
      ]);
      ready = responses.every((r) => r.ok);
    } catch {
      ready = false;
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ready)
    throw new Error("Auth/Storage não ficaram disponíveis. Consulte docker compose logs.");
  await run(
    ["exec", "-T", "db", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    await readFile(new URL("infra/backend/auth-claims.sql", root), "utf8"),
  );
  await migrate();
  // A separate mode avoids reading or replacing any existing project .env file.
  const env = {
    VITE_SUPABASE_URL: config.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
    SUPABASE_URL: config.API_URL,
    SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY,
    VITE_GOOGLE_AUTH_ENABLED: "false",
  };
  await writeFile(
    new URL(".env.standalone.local", root),
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  console.log(
    "Backend local pronto. Execute npm run dev:local. E-mails de teste: http://localhost:54324.",
  );
} else if (action === "migrate") await migrate();
else if (action === "stop") await run(["stop"]);
else if (action === "status") await run(["ps"]);
else throw new Error("Use init, up, migrate, stop ou status.");

import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  // Load server variables only into the server process. Never define a client-side
  // process.env object: it could leak the service-role or AI provider key.
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
  ]) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [
      tsConfigPaths(),
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      react(),
      ...(command === "build" ? nitro({ preset: "node-server" }) : []),
    ],
    server: { host: "0.0.0.0", port: 8080, strictPort: true },
    resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"] },
  };
});

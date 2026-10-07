import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ClientShell } from "@/components/app/client-shell";
import { useRequireRole } from "@/lib/auth/session";

export const Route = createFileRoute("/cliente")({ component: ClientLayout });
function ClientLayout() {
  const profile = useRequireRole("client");
  if (!profile) return null;
  return <ClientShell><Outlet /></ClientShell>;
}

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LawyerShell } from "@/components/app/lawyer-shell";
import { useRequireRole } from "@/lib/auth/session";

export const Route = createFileRoute("/advogado")({ component: LawyerLayout });
function LawyerLayout() {
  const profile = useRequireRole("lawyer");
  if (!profile) return null;
  return <LawyerShell userName={profile.name}><Outlet /></LawyerShell>;
}

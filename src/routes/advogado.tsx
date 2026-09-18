import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LawyerShell } from "@/components/app/lawyer-shell";

export const Route = createFileRoute("/advogado")({ component: LawyerLayout });
function LawyerLayout() { return <LawyerShell><Outlet /></LawyerShell>; }

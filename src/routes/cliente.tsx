import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ClientShell } from "@/components/app/client-shell";

export const Route = createFileRoute("/cliente")({ component: ClientLayout });
function ClientLayout() { return <ClientShell><Outlet /></ClientShell>; }

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { redirect } from '@tanstack/react-router';
import { ClientShell } from "@/components/app/client-shell";

export const Route = createFileRoute("/_authenticated/cliente")({ beforeLoad: ({ context }) => { if (context.account.role !== 'client') throw redirect({ to:'/advogado/dashboard' }); }, component: ClientLayout });
function ClientLayout() { return <ClientShell><Outlet /></ClientShell>; }

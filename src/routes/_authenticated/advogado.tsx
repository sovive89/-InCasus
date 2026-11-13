import { createFileRoute, Outlet } from "@tanstack/react-router";
import { redirect } from '@tanstack/react-router';
import { LawyerShell } from "@/components/app/lawyer-shell";

export const Route = createFileRoute("/_authenticated/advogado")({ beforeLoad: ({ context }) => { if (context.account.role !== 'lawyer') throw redirect({ to:'/cliente' }); }, component: LawyerLayout });
function LawyerLayout() { return <LawyerShell><Outlet /></LawyerShell>; }

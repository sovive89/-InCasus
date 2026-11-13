import { createFileRoute, Outlet } from "@tanstack/react-router";
import { redirect } from '@tanstack/react-router';
import { LawyerShell } from "@/components/app/lawyer-shell";
import { lawyerEntryRedirect } from "@/lib/auth/access";

export const Route = createFileRoute("/_authenticated/advogado")({
  beforeLoad: ({ context, location }) => {
    const destination = lawyerEntryRedirect(context.account.role, location.pathname);
    if (destination) throw redirect({ to: destination });
  },
  component: LawyerLayout,
});
function LawyerLayout() { return <LawyerShell><Outlet /></LawyerShell>; }

import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { getAccount } from '@/lib/auth/account.functions';
import { setAccountSession } from '@/lib/auth/session';
import { AccountContext, legalWorkspaceOptions } from '@/lib/real/workspace';
export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: '/auth' });
    return { account: await getAccount() };
  },
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(legalWorkspaceOptions); },
  component: Protected,
});
function Protected() { const { account } = Route.useRouteContext(); setAccountSession(account); return <AccountContext.Provider value={account}><Outlet /></AccountContext.Provider>; }
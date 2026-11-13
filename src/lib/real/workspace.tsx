import { createContext, useContext } from 'react';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getLegalWorkspace } from './records.functions';
import type { getAccount } from '@/lib/auth/account.functions';
export const legalWorkspaceOptions = queryOptions({ queryKey: ['legal-workspace'], queryFn: () => getLegalWorkspace(), staleTime: 0 });
export type Account = Awaited<ReturnType<typeof getAccount>>;
export const AccountContext = createContext<Account | null>(null);
export function useAccount() { const account = useContext(AccountContext); if (!account) throw new Error('Conta não disponível.'); return account; }
export function useLegalWorkspace() { return useSuspenseQuery(legalWorkspaceOptions).data; }
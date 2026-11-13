export function accountRole(roles: readonly string[]): 'lawyer' | 'client' {
  return roles.includes('lawyer') ? 'lawyer' : 'client';
}
export function canEditLegalRecords(role: string) { return role === 'lawyer'; }

/** Only the server-verified role controls entry; a URL never grants access. */
export function lawyerEntryRedirect(role: string, pathname: string) {
  if (role !== 'lawyer') return '/cliente' as const;
  if (pathname.replace(/\/+$/, '') === '/advogado') return '/advogado/dashboard' as const;
  return null;
}

export function accountRole(roles: readonly string[]): 'lawyer' | 'client' {
  return roles.includes('lawyer') ? 'lawyer' : 'client';
}
export function canEditLegalRecords(role: string) { return role === 'lawyer'; }
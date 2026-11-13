import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const getAccount = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: profile, error } = await context.supabase.from('profiles').select('*').eq('id', context.userId).single();
  if (error) throw new Error('Não foi possível carregar seu perfil.');
  const { data: roles, error: roleError } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
  if (roleError) throw new Error('Não foi possível verificar seu acesso.');
  return { id: context.userId, name: profile.display_name, avatar: profile.avatar_url, oab: profile.oab_number, email: typeof context.claims.email === 'string' ? context.claims.email : '', role: roles?.some((r) => r.role === 'lawyer') ? 'lawyer' as const : 'client' as const, createdAt: profile.created_at };
});
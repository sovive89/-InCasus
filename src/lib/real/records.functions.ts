import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { calendarEventSchema } from '@/lib/services/calendar';
import { confirmedReviewItems, reviewItemSchema } from '@/lib/services/document-review';

export const getLegalWorkspace = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [processes, documents, calendar, permissions] = await Promise.all([
    context.supabase.from('legal_process_records').select('*').order('created_at', { ascending: false }),
    context.supabase.from('legal_document_records').select('*').order('created_at', { ascending: false }),
    context.supabase.from('calendar_records').select('*').order('starts_at'),
    context.supabase.from('resource_permissions').select('*'),
  ]);
  for (const result of [processes, documents, calendar, permissions]) if (result.error) throw new Error('Não foi possível carregar os registros.');
  return { processes: processes.data ?? [], documents: documents.data ?? [], calendar: calendar.data ?? [], permissions: permissions.data ?? [] };
});
export const saveProcess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ id: z.string().uuid(), cnj: z.string().trim().min(1).max(100), subject: z.string().trim().min(1).max(500), status: z.enum(['active', 'closed']) }).parse(input)).handler(async ({ context, data }) => {
  const { data: lawyer } = await context.supabase.rpc('has_legal_role', { who: context.userId, wanted: 'lawyer' });
  if (!lawyer) throw new Error('Acesso profissional necessário.');
  const { error } = await context.supabase.from('legal_process_records').upsert({ ...data, owner_id: context.userId });
  if (error) throw new Error('Não foi possível salvar o processo.');
});
export const removeProcess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.string().uuid().parse(input)).handler(async ({ context, data }) => {
  const { error } = await context.supabase.from('legal_process_records').delete().eq('id', data).eq('owner_id', context.userId);
  if (error) throw new Error('Não foi possível excluir. Remova os compromissos e documentos vinculados primeiro.');
});
export const saveCalendarRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => calendarEventSchema.extend({ id: z.string().uuid(), clientId: z.union([z.literal(''), z.string().uuid()]), processId: z.union([z.literal(''), z.string().uuid()]) }).parse(input)).handler(async ({ context, data }) => {
  const { error } = await context.supabase.from('calendar_records').upsert({ id: data.id, owner_id: context.userId, client_id: data.clientId || null, process_id: data.processId || null, title: data.title, kind: data.kind, starts_at: new Date(data.startsAt).toISOString(), responsible: data.responsible, location: data.location, notes: data.notes });
  if (error) throw new Error('Não foi possível salvar o compromisso. Verifique os vínculos e seu acesso.');
});
export const removeCalendarRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.string().uuid().parse(input)).handler(async ({ context, data }) => {
  const { error } = await context.supabase.from('calendar_records').delete().eq('id', data).eq('owner_id', context.userId);
  if (error) throw new Error('Não foi possível excluir o compromisso.');
});
export const shareLegalRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ resourceId: z.string().uuid(), type: z.enum(['process', 'document']), clientId: z.string().uuid() }).parse(input)).handler(async ({ context, data }) => {
  const { error } = await context.supabase.from('resource_permissions').upsert({ owner_id: context.userId, grantee_id: data.clientId, resource_type: data.type, resource_id: data.resourceId, permission: 'read' }, { onConflict: 'resource_type,resource_id,grantee_id' });
  if (error) throw new Error('Não foi possível conceder acesso.');
});
export const revokeLegalAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.string().uuid().parse(input)).handler(async ({ context, data }) => {
  // Calendar recipient access is removed together with the process grant.
  const { data: grant } = await context.supabase.from('resource_permissions').select('*').eq('id', data).eq('owner_id', context.userId).single();
  if (!grant) throw new Error('Permissão não encontrada.');
  if (grant.resource_type === 'process') {
    const { error } = await context.supabase.from('calendar_records').update({ client_id: null }).eq('process_id', grant.resource_id).eq('client_id', grant.grantee_id).eq('owner_id', context.userId);
    if (error) throw new Error('Não foi possível retirar o vínculo da agenda.');
  }
  const { error } = await context.supabase.from('resource_permissions').delete().eq('id', data).eq('owner_id', context.userId);
  if (error) throw new Error('Não foi possível revogar o acesso.');
});
export const saveCloudReview = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ id: z.string().uuid(), processId: z.string().uuid(), fileName: z.string().trim().min(1).max(180), items: reviewItemSchema.array() }).parse(input)).handler(async ({ context, data }) => {
  const items = confirmedReviewItems(data.items);
  if (!items.length) throw new Error('Nenhum item confirmado.');
  const { error } = await context.supabase.from('legal_document_records').upsert({ id: data.id, owner_id: context.userId, process_id: data.processId, name: data.fileName, category: 'outros', analysis_status: 'review', reviewed_items: items, reviewer_id: context.userId, reviewed_at: new Date().toISOString() });
  if (error) throw new Error('Não foi possível salvar a revisão no processo.');
});
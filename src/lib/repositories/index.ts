/**
 * Camada de repositórios.
 *
 * Hoje lê de `src/lib/mock/data.ts`. Para conectar ao Supabase, basta trocar o
 * corpo de cada função por uma consulta equivalente — as assinaturas e os tipos
 * permanecem os mesmos para a camada de services e para a UI.
 */
import * as db from "../mock/data";
import type {
  AIAction,
  AIAnalysis,
  Appointment,
  Case,
  CaseFact,
  Client,
  Conversation,
  Draft,
  LegalDocument,
  LegalProcess,
  LegalResearch,
  Message,
  AppNotification,
  ProcessEvent,
  Role,
  Task,
} from "../domain/types";

export const clientRepository = {
  list: (): Client[] => db.clients,
  byId: (id: string): Client | undefined => db.clients.find((c) => c.id === id),
};

export const caseRepository = {
  list: (): Case[] => db.cases,
  byId: (id: string): Case | undefined => db.cases.find((c) => c.id === id),
  byClient: (clientId: string): Case[] => db.cases.filter((c) => c.clientId === clientId),
};

export const processRepository = {
  list: (): LegalProcess[] => db.processes,
  byId: (id: string): LegalProcess | undefined => db.processes.find((p) => p.id === id),
  byClient: (clientId: string): LegalProcess[] =>
    db.processes.filter((p) => p.clientId === clientId),
  events: (processId: string): ProcessEvent[] =>
    db.processEvents
      .filter((e) => e.processId === processId)
      .sort((a, b) => b.date.localeCompare(a.date)),
};

export const documentRepository = {
  list: (): LegalDocument[] => db.documents,
  byClient: (clientId: string): LegalDocument[] =>
    db.documents.filter((d) => d.clientId === clientId),
  byCase: (caseId: string): LegalDocument[] => db.documents.filter((d) => d.caseId === caseId),
};

export const appointmentRepository = {
  list: (): Appointment[] =>
    [...db.appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  byClient: (clientId: string): Appointment[] =>
    db.appointments.filter((a) => a.clientId === clientId),
};

export const taskRepository = {
  list: (): Task[] => db.tasks,
  byClient: (clientId: string): Task[] => db.tasks.filter((t) => t.clientId === clientId),
};

export const notificationRepository = {
  byAudience: (audience: Role): AppNotification[] =>
    db.notifications
      .filter((n) => n.audience === audience)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
};

export const conversationRepository = {
  list: (): Conversation[] => db.conversations,
  byClient: (clientId: string): Conversation[] =>
    db.conversations.filter((c) => c.clientId === clientId),
  messages: (conversationId: string): Message[] =>
    db.messages.filter((m) => m.conversationId === conversationId),
};

export const caseFactRepository = {
  byCase: (caseId: string): CaseFact[] => db.caseFacts.filter((f) => f.caseId === caseId),
};

export const aiRepository = {
  actions: (): AIAction[] =>
    [...db.aiActions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  actionsByClient: (clientId: string): AIAction[] =>
    db.aiActions.filter((a) => a.clientId === clientId),
  analyses: (): AIAnalysis[] => db.analyses,
  research: (): LegalResearch[] => db.research,
};

export const draftRepository = {
  list: (): Draft[] => db.drafts,
  byId: (id: string): Draft | undefined => db.drafts.find((d) => d.id === id),
  byClient: (clientId: string): Draft[] => db.drafts.filter((d) => d.clientId === clientId),
};

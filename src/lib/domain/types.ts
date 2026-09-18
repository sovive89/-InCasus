/**
 * Tipos de domínio do Agente Jurídico.
 * Espelham a estrutura prevista para as tabelas do banco (Supabase),
 * de modo que os repositórios mock possam ser trocados por consultas reais
 * sem alterar a camada de UI.
 */

export type Role = "lawyer" | "client";

export type AttentionLevel = "critical" | "important" | "followup" | "info";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  createdAt: string;
};

export type ClientStatus = "new" | "active" | "waiting" | "pending";

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: ClientStatus;
  caseCount: number;
  lastContactAt: string;
  nextActivity: string;
  createdAt: string;
};

export type CaseStatus = "intake" | "active" | "negotiation" | "judicial" | "closed";

export type Case = {
  id: string;
  clientId: string;
  area: string;
  subject: string;
  description: string;
  status: CaseStatus;
  priority: AttentionLevel;
  createdAt: string;
};

export type LegalProcess = {
  id: string;
  cnj: string;
  clientId: string;
  caseId: string;
  court: string;
  className: string;
  subject: string;
  lastMovement: string;
  lastMovementAt: string;
  lastCheckedAt: string;
  attention: AttentionLevel;
  parties: { role: string; name: string }[];
};

export type ProcessEvent = {
  id: string;
  processId: string;
  date: string;
  title: string;
  description: string;
};

export type DocumentCategory =
  | "peticoes"
  | "decisoes"
  | "contratos"
  | "pessoais"
  | "comprovantes"
  | "outros";

export type AnalysisStatus = "pending" | "processing" | "analyzed" | "review";

export type LegalDocument = {
  id: string;
  name: string;
  category: DocumentCategory;
  clientId: string;
  caseId: string;
  createdAt: string;
  analysisStatus: AnalysisStatus;
  sizeLabel: string;
};

export type Appointment = {
  id: string;
  title: string;
  clientId: string;
  caseId?: string;
  startsAt: string;
  location: string;
  kind: "hearing" | "meeting" | "deadline" | "call";
};

export type Task = {
  id: string;
  title: string;
  clientId?: string;
  caseId?: string;
  dueAt: string;
  done: boolean;
  attention: AttentionLevel;
};

export type NotificationState = "unread" | "read" | "archived";

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  level: AttentionLevel;
  createdAt: string;
  state: NotificationState;
  audience: Role;
};

export type ChatAuthor = "client" | "agent" | "lawyer";

export type Message = {
  id: string;
  conversationId: string;
  author: ChatAuthor;
  content: string;
  createdAt: string;
  channel: "pwa" | "whatsapp";
};

export type Conversation = {
  id: string;
  clientId: string;
  caseId?: string;
  title: string;
  updatedAt: string;
  channel: "pwa" | "whatsapp";
};

export type CaseFact = {
  id: string;
  caseId: string;
  field: string;
  value: string;
  confidence: number;
  sourceMessageId?: string;
  createdAt: string;
};

export type AIActionKind = "analysis" | "document" | "research" | "alert" | "draft";

export type AIAction = {
  id: string;
  kind: AIActionKind;
  title: string;
  summary: string;
  clientId?: string;
  caseId?: string;
  createdAt: string;
};

export type AIAnalysis = {
  id: string;
  title: string;
  summary: string;
  facts: string[];
  legalQuestions: string[];
  relatedDocuments: string[];
  attentionPoints: string[];
  missingInformation: string[];
  reviewSuggestions: string[];
  sources: string[];
  createdAt: string;
};

export type LegalResearch = {
  id: string;
  question: string;
  legislation: string[];
  caselaw: string[];
  understanding: string;
  attentionPoints: string[];
  sources: string[];
  createdAt: string;
  demo: true;
};

export type DraftStatus = "draft" | "in_review" | "reviewed" | "final";

export type Draft = {
  id: string;
  title: string;
  type: string;
  clientId: string;
  caseId: string;
  status: DraftStatus;
  createdAt: string;
  content: string;
  sources: string[];
  documents: string[];
};

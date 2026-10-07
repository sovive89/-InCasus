/**
 * Acesso a Clientes e Casos no Supabase (navegador, protegido por RLS).
 *
 * Conceito: o navegador usa a chave pública + o token de quem está logado; quem decide o
 * que cada pessoa vê é o banco (RLS por escritório), não a tela.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AttentionLevel, CaseStatus, ClientStatus } from "@/lib/domain/types";

// Colunas novas ainda não estão no types.ts gerado; mapeamos tudo abaixo com tipos próprios.
const sb = supabase as unknown as SupabaseClient;
type Row = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v : "");
const count = (v: unknown) => {
  const first = Array.isArray(v) ? (v[0] as { count?: number } | undefined) : undefined;
  return first?.count ?? 0;
};

export type ClientRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: ClientStatus;
  documentNumber: string;
  rg: string;
  nationality: string;
  maritalStatus: string;
  profession: string;
  address: string;
  nextActivity: string;
  createdAt: string;
  lastContactAt: string;
  caseCount: number;
};

export type ClientInput = Omit<
  ClientRecord,
  "id" | "createdAt" | "lastContactAt" | "caseCount" | "nextActivity"
>;

export type CaseRecord = {
  id: string;
  clientId: string;
  clientName: string;
  area: string;
  subject: string;
  description: string;
  status: CaseStatus;
  priority: AttentionLevel;
  createdAt: string;
  processCount: number;
  documentCount: number;
  taskCount: number;
};

export type CaseInput = Pick<
  CaseRecord,
  "clientId" | "area" | "subject" | "description" | "status" | "priority"
>;

function toClient(r: Row): ClientRecord {
  return {
    id: r["id"] as string,
    name: text(r["name"]),
    email: text(r["email"]),
    phone: text(r["phone"]),
    status: r["status"] as ClientStatus,
    documentNumber: text(r["document_number"]),
    rg: text(r["rg"]),
    nationality: text(r["nationality"]),
    maritalStatus: text(r["marital_status"]),
    profession: text(r["profession"]),
    address: text(r["address"]),
    nextActivity: text(r["next_activity"]),
    createdAt: text(r["created_at"]),
    lastContactAt: text(r["last_contact_at"]) || text(r["created_at"]),
    caseCount: count(r["cases"]),
  };
}

function toCase(r: Row): CaseRecord {
  const client = r["clients"] as { name?: string } | null;
  return {
    id: r["id"] as string,
    clientId: r["client_id"] as string,
    clientName: client?.name ?? "",
    area: text(r["area"]),
    subject: text(r["subject"]),
    description: text(r["description"]),
    status: r["status"] as CaseStatus,
    priority: r["priority"] as AttentionLevel,
    createdAt: text(r["created_at"]),
    processCount: count(r["processes"]),
    documentCount: count(r["documents"]),
    taskCount: count(r["tasks"]),
  };
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error || res.data === null) throw new Error(res.error?.message ?? "Sem dados");
  return res.data;
}

const clientColumns = "*, cases(count)";
const caseColumns = "*, clients(name), processes(count), documents(count), tasks(count)";

export async function listClients(): Promise<ClientRecord[]> {
  const rows = check(
    await sb.from("clients").select(clientColumns).order("created_at", { ascending: false }),
  );
  return (rows as Row[]).map(toClient);
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  const { data, error } = await sb.from("clients").select(clientColumns).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toClient(data as Row) : null;
}

export async function saveClient(officeId: string, input: ClientInput, id?: string): Promise<void> {
  const row = {
    name: input.name.trim(),
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    status: input.status,
    document_number: input.documentNumber.trim() || null,
    rg: input.rg.trim() || null,
    nationality: input.nationality.trim() || null,
    marital_status: input.maritalStatus.trim() || null,
    profession: input.profession.trim() || null,
    address: input.address.trim() || null,
  };
  const res = id
    ? await sb.from("clients").update(row).eq("id", id)
    : await sb.from("clients").insert({ ...row, office_id: officeId });
  if (res.error) throw new Error(res.error.message);
}

export async function listCases(clientId?: string): Promise<CaseRecord[]> {
  let q = sb.from("cases").select(caseColumns).order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  return (check(await q) as Row[]).map(toCase);
}

export async function createCase(officeId: string, input: CaseInput): Promise<void> {
  const { error } = await sb.from("cases").insert({
    office_id: officeId,
    client_id: input.clientId,
    area: input.area.trim(),
    subject: input.subject.trim(),
    description: input.description.trim(),
    status: input.status,
    priority: input.priority,
  });
  if (error) throw new Error(error.message);
}

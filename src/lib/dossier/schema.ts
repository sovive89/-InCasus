import { z } from "zod";
export const phaseLabels = {
  intake: "Triagem",
  investigation: "Inquérito policial",
  prelitigation: "Extrajudicial",
  judicial: "Judicial",
  execution: "Execução",
  closed: "Encerrado",
} as const;
export const phaseSchema = z.enum([
  "intake",
  "investigation",
  "prelitigation",
  "judicial",
  "execution",
  "closed",
]);
export const clientInput = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome.").max(180),
  email: z.union([z.literal(""), z.string().trim().email("E-mail inválido.").max(254)]),
  phone: z.string().trim().max(40),
});
export const caseInput = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  matter: z.string().trim().min(1).max(180),
  phase: phaseSchema,
});
export type CasePhase = z.infer<typeof phaseSchema>;
export type DossierClient = {
  id: string;
  office_id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
};
export type DossierCase = {
  id: string;
  office_id: string;
  client_id: string;
  title: string;
  matter: string;
  phase: CasePhase;
  created_at: string;
};
export type DossierOffice = { id: string; name: string; created_at: string };
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
// Kept separate until hosted schema types can be regenerated after deployment.
export type DossierDatabase = {
  public: {
    Tables: {
      dossier_offices: Table<DossierOffice>;
      dossier_clients: Table<DossierClient>;
      dossier_cases: Table<DossierCase>;
    };
    Views: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
    Functions: { dossier_start_office: { Args: { office_name: string }; Returns: string } };
  };
};

export const noteInput = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  caseId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(20000),
  expectedVersion: z.number().int().min(0),
});
export const uploadInput = z.object({
  id: z.string().uuid(),
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  caseId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  kind: z.enum(["file", "evidence"]),
  originalName: z.string().min(1).max(180),
  sizeBytes: z.number().int().min(1).max(10485760),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  source: z.string().trim().min(1).max(500),
});
export type CaseEntry = {
  id: string;
  title: string;
  kind: string;
  version: number;
  body: string;
  original_name: string | null;
  mime: string | null;
  size_bytes: number | null;
  sha256: string | null;
  source: string;
  created_at: string;
  version_created_at: string;
};
export type DossierVersion = {
  id: string;
  document_id: string;
  version: number;
  body: string;
  stage: string;
  storage_path: string | null;
  mime: string | null;
  size_bytes: number | null;
  sha256: string | null;
  source: string;
  original_name: string | null;
  created_by: string;
  created_at: string;
};
export type DossierUpload = {
  id: string;
  document_id: string;
  office_id: string;
  client_id: string;
  case_id: string;
  title: string;
  kind: string;
  path: string;
  mime: string;
  size_bytes: number;
  sha256: string;
  source: string;
  original_name: string;
  created_by: string;
  expires_at: string;
  completed: boolean;
};
export type RecordsDatabase = {
  public: {
    Tables: {
      dossier_versions: Table<DossierVersion>;
      dossier_uploads: Table<DossierUpload>;
    };
    Views: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
    Functions: {
      dossier_save_note: {
        Args: {
          p_id: string;
          p_office: string;
          p_client: string;
          p_case: string;
          p_title: string;
          p_body: string;
          p_expected: number;
        };
        Returns: number;
      };
      dossier_prepare_upload: {
        Args: {
          p_id: string;
          p_office: string;
          p_client: string;
          p_case: string;
          p_title: string;
          p_kind: string;
          p_mime: string;
          p_size: number;
          p_sha256: string;
          p_original_name: string;
          p_source: string;
        };
        Returns: { upload_id: string; storage_path: string }[];
      };
      dossier_commit_upload: {
        Args: { p_upload: string; p_actor: string; p_sha256: string };
        Returns: string;
      };
      dossier_case_entries: { Args: { p_case: string }; Returns: CaseEntry[] };
    };
  };
};

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

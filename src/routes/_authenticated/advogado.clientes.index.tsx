import { createFileRoute } from "@tanstack/react-router";
import { DossierWorkspace } from "@/components/dossier/workspace";
export const Route = createFileRoute("/_authenticated/advogado/clientes/")({
  component: () => <DossierWorkspace />,
});

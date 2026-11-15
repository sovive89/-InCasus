import { createFileRoute } from "@tanstack/react-router";
import { DossierWorkspace } from "@/components/dossier/workspace";
export const Route = createFileRoute("/_authenticated/advogado/clientes/$id")({
  head: () => ({ meta: [{ title: "Prontuário do cliente — InCasus" }] }),
  component: ClientDossier,
});
function ClientDossier() {
  const { id } = Route.useParams();
  return <DossierWorkspace clientId={id} />;
}

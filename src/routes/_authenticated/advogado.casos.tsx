import { createFileRoute } from "@tanstack/react-router";
import { DossierWorkspace } from "@/components/dossier/workspace";
export const Route = createFileRoute("/_authenticated/advogado/casos")({
  head: () => ({ meta: [{ title: "Casos e inquéritos — InCasus" }] }),
  component: () => <DossierWorkspace casesOnly />,
});

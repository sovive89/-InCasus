import { createFileRoute } from "@tanstack/react-router";
import { DossierWorkspace } from "@/components/dossier/workspace";
export const Route = createFileRoute("/_authenticated/advogado/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — InCasus" },
      { name: "description", content: "Prontuários e casos dos clientes do escritório." },
    ],
  }),
  component: () => <DossierWorkspace />,
});

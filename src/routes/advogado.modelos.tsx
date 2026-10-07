import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/domain/page-header";
import { TemplateLibrary } from "@/components/templates/template-library";

export const Route = createFileRoute("/advogado/modelos")({
  head: () => ({
    meta: [
      { title: "Modelos — InCasus" },
      {
        name: "description",
        content: "Biblioteca de modelos de petições, procurações, contratos e declarações.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Produção jurídica"
        title="Modelos de peças"
        description="Petições, procurações, contratos e declarações com campos preenchíveis. Use um modelo-base ou crie os do seu escritório."
      />
      <TemplateLibrary />
    </>
  );
}

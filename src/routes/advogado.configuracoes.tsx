import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/domain/page-header";
import { SignatureSettings } from "@/components/signature/signature-settings";

export const Route = createFileRoute("/advogado/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — InCasus" },
      {
        name: "description",
        content: "Integrações do escritório: assinatura eletrônica e outros serviços.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Configurações · Integrações"
        title="Assinatura Eletrônica"
        description="Conecte provedores de assinatura, escolha o padrão do escritório e acompanhe o estado de cada conexão. As chaves ficam guardadas no servidor, criptografadas — o navegador nunca as recebe de volta."
      />
      <SignatureSettings />
    </>
  );
}

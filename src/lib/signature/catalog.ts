/**
 * Catálogo de provedores conhecidos + registro dos que têm código de integração.
 *
 * Conceito: "catálogo" = o que aparece na tela (nome, descrição, campos);
 * "registro" = quem de fato sabe falar com a API. Provedores apenas catalogados
 * aparecem como "em breve" e não afirmamos nada sobre suas capacidades até
 * consultarmos a documentação oficial de cada um (Fase 2).
 */
import { GOVBR_DESCRIPTOR, GovBrProvider } from "./providers/govbr";
import type { ProviderDescriptor, SignatureProvider, SignatureProviderId } from "./types";

const EMPTY_CAPABILITIES: ProviderDescriptor["capabilities"] = {
  levels: [],
  sequentialOrder: false,
  emailNotifications: false,
  whatsappNotifications: false,
  webhooks: false,
  evidence: false,
  signedDocumentDownload: false,
  reminders: false,
  cancellation: false,
  sandbox: false,
};

function planned(id: SignatureProviderId, name: string): ProviderDescriptor {
  return {
    id,
    name,
    description: "Provedor privado de assinatura eletrônica.",
    implemented: false,
    availabilityNote: "Em breve. A integração será feita após ler a documentação oficial vigente.",
    capabilities: EMPTY_CAPABILITIES,
    fields: [],
    estimatedCostPerEnvelope: 0,
    requiresDocumentNumberFor: [],
  };
}

export const PROVIDER_CATALOG: ProviderDescriptor[] = [
  planned("clicksign", "Clicksign"),
  planned("d4sign", "D4Sign"),
  planned("zapsign", "ZapSign"),
  planned("autentique", "Autentique"),
  GOVBR_DESCRIPTOR,
];

export type ProviderRegistry = Map<SignatureProviderId, SignatureProvider>;

/** Só entram aqui provedores com código real (hoje: apenas a abstração GOV.BR). */
export function createDefaultRegistry(): ProviderRegistry {
  return new Map<SignatureProviderId, SignatureProvider>([["govbr", new GovBrProvider()]]);
}

export function descriptorFor(
  id: SignatureProviderId,
  registry: ProviderRegistry,
): ProviderDescriptor | undefined {
  return registry.get(id)?.descriptor ?? PROVIDER_CATALOG.find((d) => d.id === id);
}

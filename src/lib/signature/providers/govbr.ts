/**
 * GovBrProvider — apenas ABSTRAÇÃO.
 *
 * A assinatura eletrônica do GOV.BR tem requisitos próprios de elegibilidade e
 * autorização para integração. Este arquivo existe para reservar o lugar na
 * arquitetura. Não faz scraping, não automatiza login, não contorna CAPTCHA e
 * nunca solicita ou guarda a senha GOV.BR de ninguém. Quando houver autorização
 * oficial, a implementação entra aqui seguindo a documentação oficial vigente.
 */
import { SignatureError, type ProviderDescriptor, type SignatureProvider } from "../types";

const NOT_AVAILABLE =
  "Integração GOV.BR indisponível: depende de elegibilidade e autorização oficial.";

export const GOVBR_DESCRIPTOR: ProviderDescriptor = {
  id: "govbr",
  name: "GOV.BR",
  description: "Assinatura eletrônica oficial do governo federal.",
  implemented: false,
  availabilityNote: "Disponível futuramente, mediante elegibilidade e integração autorizada.",
  // Nada é afirmado sobre o que o GOV.BR oferece até haver integração oficial documentada.
  capabilities: {
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
  },
  fields: [],
  estimatedCostPerEnvelope: 0,
  requiresDocumentNumberFor: [],
};

function unavailable(): never {
  throw new SignatureError("PROVIDER_NOT_IMPLEMENTED", NOT_AVAILABLE, "govbr");
}

export class GovBrProvider implements SignatureProvider {
  readonly descriptor = GOVBR_DESCRIPTOR;
  testConnection = async () => ({ ok: false as const, message: NOT_AVAILABLE });
  createEnvelope = async () => unavailable();
  sendEnvelope = async () => unavailable();
  getStatus = async () => unavailable();
  cancelEnvelope = async () => unavailable();
  sendReminder = async () => unavailable();
  downloadSigned = async () => unavailable();
  getEvidence = async () => unavailable();
  parseWebhook = async () => unavailable();
}

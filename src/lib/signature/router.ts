/**
 * SignatureProviderRouter — decide QUAL provedor atende cada pedido.
 *
 * Conceito: o Router conhece, por escritório, quais provedores estão ativos,
 * configurados, qual é o padrão, o que cada um sabe fazer (capabilities) e se
 * opera em sandbox ou produção. Regra de ouro: um envelope já criado fica
 * VINCULADO ao provedor de origem até concluir/cancelar — nunca migramos sozinhos.
 */
import { PROVIDER_CATALOG, descriptorFor, type ProviderRegistry } from "./catalog";
import {
  SignatureError,
  type Environment,
  type ProviderCapabilities,
  type ProviderDescriptor,
  type ProviderSettingsView,
  type SignatureProvider,
  type SignatureProviderId,
  type SignatureRequirements,
} from "./types";

/** Configuração salva por escritório (sem segredos). */
export type StoredProviderSetting = {
  provider: SignatureProviderId;
  enabled: boolean;
  environment: Environment;
  isDefault: boolean;
  connectionStatus: ProviderSettingsView["connectionStatus"];
  lastCheckedAt: string | null;
  lastCommunicationAt: string | null;
  lastError: string | null;
  /** Campos secretos já salvos e suas dicas (4 últimos caracteres). */
  secretHints: Record<string, string>;
  /** Campos não secretos já preenchidos (chaves). */
  configKeys: string[];
};

export type ResolvedProvider = {
  provider: SignatureProvider;
  environment: Environment;
};

export function satisfies(caps: ProviderCapabilities, req: SignatureRequirements): string | null {
  if (!caps.levels.includes(req.level)) return "nível de assinatura não suportado";
  if (req.sequential && !caps.sequentialOrder) return "ordem sequencial não suportada";
  if (req.needsEvidence && !caps.evidence) return "evidências não suportadas";
  return null;
}

function missingRequired(
  descriptor: ProviderDescriptor,
  setting: StoredProviderSetting | undefined,
): string[] {
  return descriptor.fields
    .filter((f) => f.required)
    .filter((f) => (f.secret ? !setting?.secretHints[f.key] : !setting?.configKeys.includes(f.key)))
    .map((f) => f.key);
}

export class SignatureProviderRouter {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly loadSettings: (officeId: string) => Promise<StoredProviderSetting[]>,
  ) {}

  /** Visão completa para a tela de configurações (sem segredos). */
  async listProviders(officeId: string): Promise<ProviderSettingsView[]> {
    const settings = await this.loadSettings(officeId);
    return PROVIDER_CATALOG.map((d) => {
      const descriptor = descriptorFor(d.id, this.registry) ?? d;
      const s = settings.find((x) => x.provider === d.id);
      return {
        provider: d.id,
        name: descriptor.name,
        description: descriptor.description,
        implemented: descriptor.implemented,
        availabilityNote: descriptor.availabilityNote ?? null,
        capabilities: descriptor.capabilities,
        fields: descriptor.fields.map((f) => {
          const hint = f.secret ? s?.secretHints[f.key] : undefined;
          return {
            ...f,
            configured: f.secret ? Boolean(hint) : Boolean(s?.configKeys.includes(f.key)),
            masked: hint ? `••••${hint}` : null,
          };
        }),
        enabled: s?.enabled ?? false,
        environment: s?.environment ?? "sandbox",
        isDefault: s?.isDefault ?? false,
        connectionStatus: s?.connectionStatus ?? "not_configured",
        lastCheckedAt: s?.lastCheckedAt ?? null,
        lastCommunicationAt: s?.lastCommunicationAt ?? null,
        lastError: s?.lastError ?? null,
      };
    });
  }

  /**
   * Provedor para um envelope NOVO: o padrão do escritório (ou um escolhido
   * explicitamente), desde que ativo, configurado e capaz de atender os requisitos.
   */
  async resolveForNew(
    officeId: string,
    requirements: SignatureRequirements,
    explicit?: SignatureProviderId,
  ): Promise<ResolvedProvider> {
    const settings = await this.loadSettings(officeId);
    const target = explicit ?? settings.find((s) => s.isDefault)?.provider;
    if (!target) {
      throw new SignatureError(
        "PROVIDER_NOT_CONFIGURED",
        "Nenhum provedor de assinatura padrão foi definido.",
      );
    }
    const impl = this.registry.get(target);
    if (!impl || !impl.descriptor.implemented) {
      throw new SignatureError(
        "PROVIDER_NOT_IMPLEMENTED",
        `${descriptorFor(target, this.registry)?.name ?? target} ainda não está disponível.`,
        target,
      );
    }
    const setting = settings.find((s) => s.provider === target);
    if (!setting?.enabled)
      throw new SignatureError(
        "PROVIDER_DISABLED",
        `${impl.descriptor.name} está desativado.`,
        target,
      );
    if (
      missingRequired(impl.descriptor, setting).length > 0 ||
      setting.connectionStatus === "not_configured"
    ) {
      throw new SignatureError(
        "PROVIDER_NOT_CONFIGURED",
        `${impl.descriptor.name} não está configurado.`,
        target,
      );
    }
    const gap = satisfies(impl.descriptor.capabilities, requirements);
    if (gap) throw new SignatureError("NOT_SUPPORTED", `${impl.descriptor.name}: ${gap}.`, target);
    return { provider: impl, environment: setting.environment };
  }

  /**
   * Provedor de um envelope EXISTENTE: sempre o de origem, mesmo que tenha sido
   * desativado para novos envelopes (precisamos consultar/cancelar o que está em andamento).
   */
  async resolveForExisting(
    officeId: string,
    provider: SignatureProviderId,
  ): Promise<ResolvedProvider> {
    const impl = this.registry.get(provider);
    if (!impl)
      throw new SignatureError(
        "PROVIDER_NOT_IMPLEMENTED",
        "Provedor do envelope indisponível.",
        provider,
      );
    const settings = await this.loadSettings(officeId);
    const setting = settings.find((s) => s.provider === provider);
    if (!setting || setting.connectionStatus === "not_configured") {
      throw new SignatureError(
        "PROVIDER_NOT_CONFIGURED",
        `${impl.descriptor.name} não está configurado.`,
        provider,
      );
    }
    return { provider: impl, environment: setting.environment };
  }
}

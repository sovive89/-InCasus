/**
 * AI Gateway — camada abstrata de acesso a modelos.
 *
 * Nenhuma tela conversa diretamente com um fornecedor de IA. Todos os agentes
 * usam este gateway, de modo que o modelo/provedor possa ser trocado sem
 * alterar o frontend.
 *
 * Hoje opera em modo `mock`. Para conectar a um provedor real, implemente
 * `complete()` chamando uma server function que fale com o provedor escolhido
 * (OpenAI, Anthropic, etc.) usando as chaves guardadas no servidor.
 */

export type AIProvider = "mock" | "openai" | "anthropic";

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export type AICompletionRequest = {
  messages: AIMessage[];
  /** Identificador lógico do agente que originou a chamada. */
  agent: string;
  temperature?: number;
};

export type AICompletionResponse = {
  content: string;
  provider: AIProvider;
  model: string;
  demo: boolean;
};

export type AIGatewayConfig = {
  provider: AIProvider;
  model: string;
};

export const aiGatewayConfig: AIGatewayConfig = {
  provider: "mock",
  model: "demo-legal-agent",
};

export function isDemoMode() {
  return aiGatewayConfig.provider === "mock";
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const aiGateway = {
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (aiGatewayConfig.provider === "mock") {
      await delay(900);
      return {
        content: mockAnswer(request),
        provider: "mock",
        model: aiGatewayConfig.model,
        demo: true,
      };
    }

    // Conexão real: implementar via server function dedicada.
    throw new Error("Provedor de IA ainda não configurado.");
  },
};

function mockAnswer(request: AICompletionRequest): string {
  const last = [...request.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const q = last.toLowerCase();

  if (request.agent === "conversationAgent") {
    if (q.includes("novidade") || q.includes("processo") || q.includes("andamento")) {
      return "Identifiquei uma atualização. O advogado responsável será informado para análise.";
    }
    if (q.includes("documento")) {
      return "Ainda constam documentos pendentes no seu caso. Assim que forem enviados, o advogado responsável será avisado.";
    }
    if (q.includes("audiência") || q.includes("agenda")) {
      return "Há um compromisso registrado na sua agenda. Você pode conferir os detalhes na aba Agenda.";
    }
    return "Vou verificar as informações disponíveis no seu caso e registrar sua solicitação para o advogado responsável.";
  }

  if (q.includes("atenção")) {
    return "Três itens exigem atenção hoje: decisão na execução de alimentos de Maria Antunes, tarefa atrasada de manifestação sobre cálculo judicial e Rafael Moreira aguardando retorno há dois dias.";
  }
  if (q.includes("maria")) {
    return "Caso de Maria Antunes: execução de alimentos com inadimplência de quatro meses e pedido de guarda compartilhada em curso. Última decisão determinou intimação do executado sob pena de prisão civil.";
  }
  if (q.includes("documento")) {
    return "Faltam comprovantes de despesas escolares do mês corrente (Maria Antunes) e a validação dos holerites enviados por Juliana Prado.";
  }
  if (q.includes("pesquisa") || q.includes("guarda compartilhada")) {
    return "Preparei um levantamento em modo demonstração sobre guarda compartilhada em cenário de conflito. Abra a área de Pesquisa jurídica para ver o resultado estruturado.";
  }
  if (q.includes("minuta")) {
    return "Posso preparar um rascunho a partir dos dados do caso. O texto gerado é sempre um rascunho e exige revisão profissional antes de qualquer protocolo.";
  }
  return "Registrei sua solicitação. Em modo demonstração, respondo com base apenas nos dados do escritório; nenhuma fonte externa foi consultada.";
}

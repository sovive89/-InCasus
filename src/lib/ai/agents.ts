/**
 * Agentes especializados. Cada agente define seu próprio contexto (system prompt)
 * e delega a execução ao AI Gateway, sem conhecer o fornecedor de IA.
 */
import { aiGateway, type AIMessage } from "./aiGateway";
import { aiRepository } from "../repositories";
import type { AIAnalysis, LegalResearch } from "../domain/types";

const SYSTEM_CLIENT = `Você é o assistente de um escritório de advocacia de Direito de Família.
Nunca se apresente como substituto do advogado. Nunca dê aconselhamento jurídico definitivo.
Toda informação está sujeita à revisão do advogado responsável.`;

const SYSTEM_LAWYER = `Você é o copiloto jurídico de uma advogada de Direito de Família.
Responda de forma objetiva, cite apenas dados existentes no caso e nunca invente jurisprudência.`;

export const conversationAgent = {
  async reply(history: AIMessage[]) {
    const res = await aiGateway.complete({
      agent: "conversationAgent",
      messages: [{ role: "system", content: SYSTEM_CLIENT }, ...history],
    });
    return res.content;
  },
};

export const copilotAgent = {
  async reply(history: AIMessage[]) {
    const res = await aiGateway.complete({
      agent: "copilotAgent",
      messages: [{ role: "system", content: SYSTEM_LAWYER }, ...history],
    });
    return res.content;
  },
};

/** Extrai dados estruturados das conversas (case_facts). Ainda não conectado. */
export const dataExtractionAgent = {
  async extract(_text: string): Promise<{ field: string; value: string; confidence: number }[]> {
    return [];
  },
};

/** Futuro conector processual (tribunais / provedores autorizados). */
export const processAgent = {
  connectorStatus: "not_configured" as const,
  async sync() {
    throw new Error("Conector processual não configurado.");
  },
};

/** Pipeline: upload → armazenamento → extração de texto → análise → vínculo ao caso. */
export const documentAgent = {
  async analyze(_documentId: string): Promise<AIAnalysis> {
    const [analysis] = aiRepository.analyses();
    await new Promise((r) => setTimeout(r, 800));
    return analysis;
  },
};

export const researchAgent = {
  async search(question: string): Promise<LegalResearch> {
    await new Promise((r) => setTimeout(r, 1200));
    const [sample] = aiRepository.research();
    return { ...sample, id: `r-${Date.now()}`, question, createdAt: new Date().toISOString() };
  },
};

export const draftAgent = {
  async generate(title: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 1000));
    return `${title.toUpperCase()}\n\n[Rascunho gerado em modo demonstração a partir dos dados do caso. Este texto não constitui documento final e exige revisão do advogado responsável.]`;
  },
};

/**
 * Preparação para o canal WhatsApp Business.
 *
 * Fluxo previsto:
 *   WhatsApp Business API → webhook → conversation service → AI Gateway → banco
 *
 * O histórico do WhatsApp deve alimentar a MESMA conversa exibida na PWA:
 * a conversa é identificada pelo cliente (clientId), não pelo canal, evitando
 * duplicação de histórico.
 */
import type { Message } from "../domain/types";

export type InboundWhatsAppMessage = {
  from: string;
  body: string;
  receivedAt: string;
  mediaUrl?: string;
};

export const whatsappChannel = {
  status: "not_configured" as const,

  /** Converte a mensagem recebida no webhook para o formato interno de mensagem. */
  toDomainMessage(input: InboundWhatsAppMessage, conversationId: string): Omit<Message, "id"> {
    return {
      conversationId,
      author: "client",
      content: input.body,
      createdAt: input.receivedAt,
      channel: "whatsapp",
    };
  },

  async send(_to: string, _body: string): Promise<void> {
    throw new Error("Canal WhatsApp não configurado.");
  },
};

/**
 * Preparação para voz:
 *   áudio → speech-to-text → agente → text-to-speech → áudio
 * Ainda não implementado.
 */
export const voiceChannel = {
  status: "not_configured" as const,
  async transcribe(_audio: Blob): Promise<string> {
    throw new Error("Transcrição de áudio não configurada.");
  },
  async speak(_text: string): Promise<Blob> {
    throw new Error("Síntese de voz não configurada.");
  },
};

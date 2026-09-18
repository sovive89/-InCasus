import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/domain/page-header";
import { ChatInterface } from "@/components/chat/chat-interface";
import { conversationAgent } from "@/lib/ai/agents";
import { conversationRepository } from "@/lib/repositories";
export const Route=createFileRoute("/cliente/assistente")({head:()=>({meta:[{title:"Assistente — InCasus"},{name:"description",content:"Converse com o assistente do escritório sobre seu caso."},{property:"og:title",content:"Assistente — InCasus"},{property:"og:description",content:"Converse com o assistente do escritório sobre seu caso."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),component:Page});
function Page(){return <><PageHeader eyebrow="Seu atendimento" title="Assistente" description="Tire dúvidas e acompanhe solicitações com segurança."/><ChatInterface initialMessages={conversationRepository.messages("conv-1")} onReply={conversationAgent.reply} mode="client" suggestions={["Houve novidade no meu processo?","Quais documentos ainda faltam?","Quando é minha audiência?"]}/></>}

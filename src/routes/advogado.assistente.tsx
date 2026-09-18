import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/domain/page-header";
import { ChatInterface } from "@/components/chat/chat-interface";
import { copilotAgent } from "@/lib/ai/agents";

export const Route=createFileRoute("/advogado/assistente")({head:()=>({meta:[{title:"Assistente jurídico — Juris Agent"},{name:"description",content:"Copiloto jurídico para consulta dos dados do escritório."},{property:"og:title",content:"Assistente jurídico — Juris Agent"},{property:"og:description",content:"Copiloto jurídico para consulta dos dados do escritório."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),component:Page});
function Page(){return <><PageHeader eyebrow="Inteligência assistida" title="Copiloto jurídico" description="Consulte os dados do laboratório e prepare análises para revisão."/><ChatInterface initialMessages={[]} onReply={copilotAgent.reply} mode="lawyer" suggestions={["Quais processos precisam da minha atenção?","Analise o caso da Maria","Quais documentos ainda faltam?","Prepare uma pesquisa sobre guarda compartilhada"]}/></>}

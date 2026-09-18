import { useRef, useState, type FormEvent } from "react";
import { Bot, Loader2, Mic, Paperclip, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CLIENT_DISCLAIMER, formatTime } from "@/lib/domain/labels";
import type { AIMessage } from "@/lib/ai/aiGateway";
import type { ChatAuthor, Message } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function ChatInterface({ initialMessages, onReply, mode, suggestions = [] }: { initialMessages: Message[]; onReply: (history: AIMessage[]) => Promise<string>; mode: "client" | "lawyer"; suggestions?: string[] }) {
  const [items, setItems] = useState(initialMessages); const [value, setValue] = useState(""); const [processing, setProcessing] = useState(false); const inputRef = useRef<HTMLTextAreaElement>(null);
  async function send(text = value) {
    const clean=text.trim(); if (!clean || processing) return;
    const author: ChatAuthor = mode === "client" ? "client" : "lawyer";
    const now=new Date().toISOString(); const mine: Message={id:`local-${Date.now()}`,conversationId:"local",author,content:clean,createdAt:now,channel:"pwa"};
    const next=[...items,mine]; setItems(next); setValue(""); setProcessing(true);
    try { const answer=await onReply(next.map((m) => ({ role: m.author === "agent" ? "assistant" as const : "user" as const, content:m.content }))); setItems((current) => [...current,{id:`agent-${Date.now()}`,conversationId:"local",author:"agent",content:answer,createdAt:new Date().toISOString(),channel:"pwa"}]); }
    finally { setProcessing(false); inputRef.current?.focus(); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void send(); }
  return <div className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-border bg-surface">
    <div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary"><Bot className="size-4" /></div><div><p className="text-sm font-semibold">{mode === "lawyer" ? "Copiloto jurídico" : "Assistente do escritório"}</p><p className="text-[10px] text-muted-foreground">Modo demonstração · fontes internas</p></div></div><div className="flex items-center gap-1.5 text-[10px] text-primary"><span className="size-1.5 rounded-full bg-primary" /> Disponível</div></div>
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6">{items.length===0 && <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center"><Sparkles className="mb-4 size-6 text-primary" /><h3 className="font-display text-lg font-semibold">Como posso ajudar?</h3><p className="mt-2 text-sm text-muted-foreground">Pergunte sobre os dados disponíveis no escritório.</p></div>}{items.map((m) => { const mine=m.author!=="agent"; return <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}><div className={cn("max-w-[85%] rounded-lg px-4 py-3 sm:max-w-[72%]", mine ? "bg-primary text-primary-foreground" : "border border-border bg-background")}><p className="whitespace-pre-wrap text-sm leading-6">{m.content}</p><p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/65" : "text-muted-foreground")}>{formatTime(m.createdAt)}</p></div></div>})}{processing && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin text-primary" /> Analisando informações disponíveis…</div>}</div>
    {suggestions.length>0 && <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-3">{suggestions.map((s) => <button key={s} className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground" onClick={() => void send(s)}>{s}</button>)}</div>}
    <form className="border-t border-border p-3" onSubmit={submit}><div className="flex items-end gap-2"><Button type="button" variant="ghost" size="icon" disabled title="Anexos serão habilitados futuramente"><Paperclip /></Button><Button type="button" variant="ghost" size="icon" disabled title="Áudio será habilitado futuramente"><Mic /></Button><Textarea ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault(); void send();}}} placeholder="Escreva uma mensagem…" className="min-h-10 max-h-28 resize-none border-0 bg-background shadow-none" /><Button type="submit" variant="command" size="icon" disabled={!value.trim()||processing} aria-label="Enviar mensagem"><Send /></Button></div><p className="mt-2 px-2 text-[10px] leading-4 text-muted-foreground">{mode==="client" ? CLIENT_DISCLAIMER : "Respostas assistidas por IA exigem revisão profissional."}</p></form>
  </div>;
}

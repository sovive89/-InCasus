import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Bell, Bot, CalendarDays, FileSearch, Files, Home, LogOut, Menu, UserRound, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BrandMark } from "./brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth/session";

const nav = [
  { to: "/cliente", label: "Início", icon: Home },
  { to: "/cliente/assistente", label: "Assistente", icon: Bot },
  { to: "/cliente/caso", label: "Meu caso", icon: FileSearch },
  { to: "/cliente/processos", label: "Processos", icon: FileSearch },
  { to: "/cliente/documentos", label: "Documentos", icon: Files },
  { to: "/cliente/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/cliente/notificacoes", label: "Notificações", icon: Bell },
  { to: "/cliente/perfil", label: "Perfil", icon: UserRound },
] as const;

export function ClientShell({ children }: { children: ReactNode }) {
  const location = useLocation(); const navigate = useNavigate(); const [open, setOpen] = useState(false);
  function logout() { signOut(); navigate({ to: "/login" }); }
  const isActive = (to: string) => to === "/cliente" ? location.pathname === to : location.pathname.startsWith(to);
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl md:px-8"><BrandMark /><div className="flex items-center gap-1"><Link to="/cliente/notificacoes" className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"><Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-critical" /></Link><Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={logout}><LogOut /></Button><Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}><Menu /></Button></div></header>
    {open && <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)}><aside className="ml-auto h-full w-[82%] max-w-xs border-l border-border bg-sidebar p-4" onClick={(e) => e.stopPropagation()}><div className="mb-8 flex items-center justify-between"><BrandMark /><Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X /></Button></div><nav className="space-y-1">{nav.map((item) => <Link key={item.to} to={item.to} className={cn("flex h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground", isActive(item.to) && "bg-sidebar-accent text-foreground")} onClick={() => setOpen(false)}><item.icon className="size-[18px]" />{item.label}</Link>)}</nav><Button variant="ghost" className="mt-8 w-full justify-start" onClick={logout}><LogOut /> Sair</Button></aside></div>}
    <div className="mx-auto grid max-w-6xl md:grid-cols-[200px_1fr] md:gap-8 md:px-8"><aside className="hidden border-r border-border py-8 md:block"><nav className="sticky top-24 space-y-1 pr-5">{nav.map((item) => <Link key={item.to} to={item.to} className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground", isActive(item.to) && "bg-accent text-foreground")}><item.icon className={cn("size-[18px]", isActive(item.to) && "text-primary")} />{item.label}</Link>)}</nav></aside><main className="min-w-0 px-4 py-7 md:px-0 md:py-9">{children}</main></div>
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-border bg-background/95 px-1 backdrop-blur-xl md:hidden">{nav.slice(0,5).map((item) => <Link key={item.to} to={item.to} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground", isActive(item.to) && "text-primary")}><item.icon className="size-[19px]" /><span className="max-w-full truncate">{item.label}</span></Link>)}</nav>
  </div>;
}

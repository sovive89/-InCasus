import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Bot, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, FilePenLine, FileSearch, Files, LayoutDashboard, LogOut, Menu, Search, Users, X } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getSession, signOut } from "@/lib/auth/session";

const nav = [
  { to: "/advogado/dashboard", label: "Command Center", icon: LayoutDashboard },
  { to: "/advogado/assistente", label: "Assistente", icon: Bot },
  { to: "/advogado/clientes", label: "Clientes", icon: Users },
  { to: "/advogado/casos", label: "Casos", icon: BriefcaseBusiness },
  { to: "/advogado/processos", label: "Processos", icon: FileSearch },
  { to: "/advogado/documentos", label: "Documentos", icon: Files },
  { to: "/advogado/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/advogado/pesquisa", label: "Pesquisa", icon: Search },
  { to: "/advogado/minutas", label: "Minutas", icon: FilePenLine },
  { to: "/advogado/notificacoes", label: "Notificações", icon: Bell },
] as const;

export function LawyerShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  function logout() { signOut(); navigate({ to: "/login" }); }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-background">
        <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex lg:flex-col", collapsed ? "w-[72px]" : "w-64")}>
          <div className="flex h-20 items-center border-b border-sidebar-border px-4"><BrandMark compact={collapsed} /></div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {nav.map((item) => {
              const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              const link = <Link to={item.to} className={cn("flex h-10 items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", active && "bg-sidebar-accent text-sidebar-accent-foreground", collapsed && "justify-center px-0")}><item.icon className={cn("size-[18px] shrink-0", active && "text-sidebar-primary")} />{!collapsed && <span>{item.label}</span>}</Link>;
              return collapsed ? <Tooltip key={item.to}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip> : <div key={item.to}>{link}</div>;
            })}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            {!collapsed && <div className="mb-3 px-3"><p className="truncate text-xs font-semibold">Dra. Helena Duarte</p><p className="mt-0.5 text-[10px] text-muted-foreground">Direito de Família</p></div>}
            <div className={cn("flex gap-1", collapsed && "flex-col")}><Button variant="ghost" size="icon" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>{collapsed ? <ChevronRight /> : <ChevronLeft />}</Button><Button variant="ghost" size="icon" onClick={logout} aria-label="Sair"><LogOut /></Button></div>
          </div>
        </aside>

        {mobileOpen && <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}><aside className="h-full w-[82%] max-w-xs border-r border-border bg-sidebar p-4" onClick={(e) => e.stopPropagation()}><div className="mb-8 flex items-center justify-between"><BrandMark /><Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}><X /></Button></div><nav className="space-y-1">{nav.map((item) => <Link key={item.to} to={item.to} className={cn("flex h-11 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground", location.pathname.startsWith(item.to) && "bg-sidebar-accent text-foreground")}><item.icon className="size-[18px]" />{item.label}</Link>)}</nav></aside></div>}

        <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu /></Button><div><span className="text-xs font-medium text-muted-foreground">Juris Agent Lab</span><span className="mx-2 text-border">/</span><span className="text-xs font-semibold text-foreground">Advogada</span></div></div><Link to="/advogado/notificacoes" className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-critical" /></Link></header>
          <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

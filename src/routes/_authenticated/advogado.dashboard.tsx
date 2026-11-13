import { RealDashboard } from "@/components/real/workspace-pages";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, BriefcaseBusiness, CalendarDays, FileSearch, Files, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { aiRepository, appointmentRepository, clientRepository, processRepository } from "@/lib/repositories";
import { getAttentionItems, getCaseSummary, getClientSummary, getTodayAgenda } from "@/lib/services/commandCenter";
import { formatDate, formatTime } from "@/lib/domain/labels";

export const Route = createFileRoute("/_authenticated/advogado/dashboard")({
  head: () => ({ meta: [
    { title: "Central de Comando — InCasus" },
    { name: "description", content: "Visão central de processos, clientes, agenda e análises jurídicas." },
    { property: "og:title", content: "Central de Comando — InCasus" },
    { property: "og:description", content: "Visão central de processos, clientes, agenda e análises jurídicas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

function Page() { return <RealDashboard/>; }

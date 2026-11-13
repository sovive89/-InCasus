import { createFileRoute } from "@tanstack/react-router";
import { SharedCalendar } from "@/components/calendar/shared-calendar";

export const Route = createFileRoute("/advogado/agenda")({
  head: () => ({ meta: [
    { title: "Calendário compartilhado — InCasus" },
    { name: "description", content: "Calendário mensal e semanal de prazos processuais, audiências e responsáveis." },
    { property: "og:title", content: "Calendário compartilhado — InCasus" },
    { property: "og:description", content: "Prazos, audiências e responsáveis na agenda jurídica." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});
function Page() { return <SharedCalendar />; }

import { createFileRoute } from "@tanstack/react-router";
import { SharedCalendar } from "@/components/calendar/shared-calendar";
export const Route = createFileRoute("/_authenticated/cliente/agenda")({
  head: () => ({ meta: [
    { title: "Minha agenda — InCasus" },
    { name: "description", content: "Seus prazos e audiências em um calendário mensal e semanal." },
    { property: "og:title", content: "Minha agenda — InCasus" },
    { property: "og:description", content: "Compromissos e responsáveis relacionados ao seu caso." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});
function Page() { return <SharedCalendar  />; }

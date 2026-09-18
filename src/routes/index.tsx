import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Juris Agent Lab — Command Center Jurídico" },
      { name: "description", content: "Laboratório de agente jurídico com inteligência artificial assistida." },
      { property: "og:title", content: "Juris Agent Lab — Command Center Jurídico" },
      { property: "og:description", content: "Laboratório de agente jurídico com inteligência artificial assistida." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Navigate to="/login" />;
}

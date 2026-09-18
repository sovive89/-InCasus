import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InCasus — Central de Comando Jurídica" },
      { name: "description", content: "Central de comando jurídica com inteligência artificial assistida." },
      { property: "og:title", content: "InCasus — Central de Comando Jurídica" },
      { property: "og:description", content: "Central de comando jurídica com inteligência artificial assistida." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Navigate to="/login" />;
}

import { createFileRoute, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/advogado/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — InCasus" },
      { name: "description", content: "Prontuários e casos dos clientes do escritório." },
    ],
  }),
  component: Outlet,
});

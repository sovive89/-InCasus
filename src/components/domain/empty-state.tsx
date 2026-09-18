import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center border-y border-border px-6 text-center">
      <Icon className="mb-4 size-7 text-muted-foreground" aria-hidden="true" />
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

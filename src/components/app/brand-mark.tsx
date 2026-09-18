import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
        <Scale className="size-5" aria-hidden="true" />
      </div>
      {!compact && (
        <div>
          <div className="font-display text-sm font-semibold text-foreground">Juris Agent</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Laboratório jurídico</div>
        </div>
      )}
    </div>
  );
}

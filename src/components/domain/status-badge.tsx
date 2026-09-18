import { cn } from "@/lib/utils";
import { attentionClass, attentionLabel } from "@/lib/domain/labels";
import type { AttentionLevel } from "@/lib/domain/types";

export function StatusBadge({ level, label }: { level: AttentionLevel; label?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold", attentionClass[level])}>
      {label ?? attentionLabel[level]}
    </span>
  );
}

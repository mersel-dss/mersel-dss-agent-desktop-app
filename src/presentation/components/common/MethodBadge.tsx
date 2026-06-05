/**
 * HTTP metodunu sektör konvansiyonuna yakın renkli rozet olarak gösterir.
 */

import { Badge } from "@/presentation/components/ui/badge";
import { cn } from "@/shared/lib/utils";

const TONES: Record<string, string> = {
  GET: "border-primary/30 bg-primary/10 text-primary",
  POST: "border-success/40 bg-success/15 text-success",
  PUT: "border-warning/40 bg-warning/15 text-warning-foreground",
  PATCH: "border-warning/40 bg-warning/15 text-warning-foreground",
  DELETE: "border-destructive/40 bg-destructive/15 text-destructive",
};

export function MethodBadge({ method }: { method?: string }) {
  const m = (method ?? "").toUpperCase();
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[11px]", TONES[m] ?? "bg-muted text-muted-foreground")}
    >
      {m || "—"}
    </Badge>
  );
}

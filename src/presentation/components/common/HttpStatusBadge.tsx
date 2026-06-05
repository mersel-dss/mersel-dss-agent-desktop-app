/**
 * HTTP durum kodunu renkli rozet olarak gösterir.
 */

import { Badge } from "@/presentation/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export function HttpStatusBadge({ status }: { status: number }) {
  const tone =
    status >= 500
      ? "border-destructive/40 bg-destructive/15 text-destructive"
      : status >= 400
        ? "border-warning/40 bg-warning/15 text-warning-foreground"
        : status >= 200 && status < 300
          ? "border-success/40 bg-success/15 text-success"
          : "bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("tnum font-medium", tone)}>
      {status || "—"}
    </Badge>
  );
}

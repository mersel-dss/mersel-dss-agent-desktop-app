/**
 * Servis durumunu renkli rozet olarak gösteren reusable component.
 */

import { Badge } from "@/presentation/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import type { ServiceState } from "@/domain/services/types";

const STATE_LABELS: Record<ServiceState, string> = {
  "not-installed": "Kurulu değil",
  stopped: "Durduruldu",
  starting: "Başlatılıyor",
  running: "Çalışıyor",
  crashed: "Hata",
};

const STATE_STYLES: Record<ServiceState, string> = {
  "not-installed": "bg-muted text-muted-foreground",
  stopped: "bg-muted text-muted-foreground",
  starting: "bg-warning/15 text-warning-foreground border-warning/40",
  running: "bg-success/15 text-success border-success/40",
  crashed: "bg-destructive/15 text-destructive border-destructive/40",
};

const DOT_STYLES: Record<ServiceState, string> = {
  "not-installed": "bg-muted-foreground/50",
  stopped: "bg-muted-foreground/50",
  starting: "bg-warning animate-pulse",
  running: "bg-success",
  crashed: "bg-destructive",
};

export function ServiceStateBadge({ state }: { state: ServiceState }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", STATE_STYLES[state])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_STYLES[state])} />
      {STATE_LABELS[state]}
    </Badge>
  );
}

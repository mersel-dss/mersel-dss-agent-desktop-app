/**
 * Trace recorder durum çubuğu: sayaçlar + aç/kapa + temizle.
 */

import { Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TraceStats } from "@/domain/diagnostics/types";
import { useClearTraces, useSetTracesEnabled } from "@/application/diagnostics/hooks";
import { Button } from "@/presentation/components/ui/button";
import { Badge } from "@/presentation/components/ui/badge";
import { cn } from "@/shared/lib/utils";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tnum text-sm font-semibold">{value}</span>
    </div>
  );
}

export function TraceStatsBar({ stats, visible }: { stats: TraceStats; visible?: number }) {
  const setEnabled = useSetTracesEnabled();
  const clear = useClearTraces();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-6">
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5",
            stats.enabled
              ? "border-success/40 bg-success/15 text-success"
              : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              stats.enabled ? "bg-success" : "bg-muted-foreground/50",
            )}
          />
          {stats.enabled ? "Kayıt açık" : "Kayıt kapalı"}
        </Badge>
        {visible !== undefined ? <Stat label="Görünür" value={visible} /> : null}
        <Stat label="Tampon" value={`${stats.currentSize}/${stats.capacity}`} />
        <Stat label="Toplam" value={stats.totalRecorded} />
        <Stat label="Düşen" value={stats.totalDropped} />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={setEnabled.isPending}
          onClick={() =>
            setEnabled.mutate(!stats.enabled, {
              onError: (e) => toast.error((e as Error).message),
            })
          }
        >
          <Power className="h-4 w-4" />
          {stats.enabled ? "Kaydı durdur" : "Kaydı başlat"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={clear.isPending}
          onClick={() =>
            clear.mutate(undefined, {
              onSuccess: () => toast.success("Trace tamponu temizlendi"),
              onError: (e) => toast.error((e as Error).message),
            })
          }
        >
          <Trash2 className="h-4 w-4" />
          Temizle
        </Button>
      </div>
    </div>
  );
}

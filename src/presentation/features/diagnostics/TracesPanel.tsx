/**
 * Trace kayıtları paneli (Swing tanılama paneli paritesi):
 * durum çubuğu + arama + "yalnız hatalar" + tümünü dışa aktar + tablo + detay.
 */

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import type { TraceRecord } from "@/domain/diagnostics/types";
import { useTraces } from "@/application/diagnostics/hooks";
import { useFiles } from "@/application/platform/hooks";
import { tracesToNdjson } from "@/shared/lib/diagnostics";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { TraceStatsBar } from "./TraceStatsBar";
import { TraceTable } from "./TraceTable";
import { TraceDetailDialog } from "./TraceDetailDialog";

function matches(r: TraceRecord, q: string): boolean {
  const hay = [r.path, r.errorCode, r.traceId, r.method]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function TracesPanel() {
  const [query, setQuery] = useState("");
  const [errorOnly, setErrorOnly] = useState(false);
  const [selected, setSelected] = useState<TraceRecord | null>(null);
  const files = useFiles();

  // Snapshot'ın tamamını çekip arama + filtreyi istemci tarafında uygularız (Swing ile aynı).
  const traces = useTraces({ limit: 200, errorOnly: false, enabled: true });
  const all = traces.data?.records ?? [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (r) => (!errorOnly || r.statusCode >= 400 || !!r.errorCode) && (!q || matches(r, q)),
    );
  }, [all, query, errorOnly]);

  const handleExportAll = async () => {
    if (all.length === 0) {
      toast.info("Buffer boş; dışa aktarılacak kayıt yok.");
      return;
    }
    const path = await files.pickSavePath({
      title: "Tüm trace kayıtlarını dışa aktar",
      defaultPath: `mersel-traces-${Date.now()}.ndjson`,
      filters: [{ name: "NDJSON", extensions: ["ndjson"] }],
    });
    if (!path) return;
    try {
      await files.saveTextFile(path, tracesToNdjson(all));
      toast.success(`${all.length} kayıt dışa aktarıldı`);
    } catch (e) {
      toast.error("Dışa aktarma başarısız", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      {traces.data?.stats ? (
        <TraceStatsBar stats={traces.data.stats} visible={visible.length} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Path / errorCode / traceId / method ara…"
            className="pl-9"
          />
        </div>
        <Button
          variant={errorOnly ? "outline" : "default"}
          size="sm"
          onClick={() => setErrorOnly(false)}
        >
          Tümü
        </Button>
        <Button
          variant={errorOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setErrorOnly(true)}
        >
          Yalnız hatalar
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportAll}>
          <Download className="h-4 w-4" />
          Tümünü dışa aktar (.ndjson)
        </Button>
      </div>

      {traces.isLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <TraceTable
          records={visible}
          selectedId={selected?.traceId}
          onSelect={setSelected}
        />
      )}

      <TraceDetailDialog record={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

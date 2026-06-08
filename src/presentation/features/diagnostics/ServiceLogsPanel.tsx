import { useEffect, useRef, useState } from "react";
import { Check, Copy, RefreshCw, Terminal } from "lucide-react";
import { toast } from "sonner";
import type { ServiceKind } from "@/domain/services/types";
import { SERVICE_META, SERVICE_KINDS } from "@/shared/config/services";
import { useServiceLaunchLogs } from "@/application/services/hooks";
import { copyToClipboard } from "@/shared/lib/diagnostics";
import { Button } from "@/presentation/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/presentation/components/ui/select";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export function ServiceLogsPanel() {
  const [kind, setKind] = useState<ServiceKind>("verifier");
  const logs = useServiceLaunchLogs(kind);
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const meta = SERVICE_META[kind];
  const logText = logs.data ?? "";
  const hasLogs = logText.trim().length > 0;

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [logs.data]);

  // Servis değişince "kopyalandı" geri bildirimini sıfırla.
  useEffect(() => {
    setCopied(false);
  }, [kind]);

  const handleCopy = async () => {
    if (!hasLogs) return;
    const ok = await copyToClipboard(logText);
    if (ok) {
      setCopied(true);
      toast.success(`${meta.shortName} logu kopyalandı`);
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Panoya kopyalanamadı");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={kind}
          onValueChange={(v) => setKind(v as ServiceKind)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {SERVICE_META[k].shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => logs.refetch()}
        >
          <RefreshCw className="h-4 w-4" />
          Yenile
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {meta.displayName} · {meta.defaultPort}
        </span>
      </div>

      {logs.isLoading && !logs.data ? (
        <Skeleton className="h-64 w-full rounded-lg font-mono" />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-[#0c0c0c]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <Terminal className="h-3.5 w-3.5 text-white/50" />
            <span className="text-[11px] font-medium text-white/60">
              launch.log — {kind}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasLogs}
              title="Logu panoya kopyala"
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
          <pre
            ref={preRef}
            className="max-h-[480px] overflow-y-auto p-4 text-[12px] leading-5 text-green-400"
          >
            {logs.data ? (
              logs.data || (
                <span className="text-white/30">
                  Henüz başlatma logu yok. Servis başlatıldığında stdout/stderr
                  çıktısı burada görünecek.
                </span>
              )
            ) : null}
          </pre>
        </div>
      )}
    </div>
  );
}

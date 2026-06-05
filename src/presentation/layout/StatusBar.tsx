/**
 * Alt durum çubuğu (cockpit tarzı). Sol: yönetilen servislerin canlı durum
 * sayaçları. Sağ: Java runtime özeti, bağlantı ve sürüm pill'i.
 */

import { Coffee, Cpu, Dot, Tag } from "lucide-react";
import { useJava, useServices } from "@/application/services/hooks";
import { SERVICE_META } from "@/shared/config/services";
import { cn } from "@/shared/lib/utils";

const APP_VERSION = "v0.1.0";
const REPO_URL = "https://github.com/mersel-dss";

const DOT_TONE: Record<string, string> = {
  running: "bg-status-running",
  starting: "bg-status-starting animate-pulse",
  crashed: "bg-status-error",
  stopped: "bg-fg-dim/60",
  "not-installed": "bg-fg-dim/40",
};

export function StatusBar() {
  const { data } = useServices();
  const java = useJava();

  return (
    <div className="app-chrome flex h-7 shrink-0 items-center gap-3 border-t border-border/70 px-3 text-[10.5px] text-fg-dim">
      {data?.map((s) => (
        <span key={s.kind} className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", DOT_TONE[s.state] ?? "bg-fg-dim/50")} />
          <span className="text-fg-muted">{SERVICE_META[s.kind].shortName}</span>
        </span>
      ))}

      <div className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Coffee className="h-3 w-3" />
          {java.data?.available ? (
            <span className="text-fg-muted">
              Java {java.data.major ?? java.data.version ?? "?"}
            </span>
          ) : (
            <span className="text-status-error">Java yok</span>
          )}
        </span>

        <Dot className="h-3 w-3 text-border-strong" />

        <span className="flex items-center gap-1 tabular-nums">
          <Cpu className="h-3 w-3" />
          {data?.filter((s) => s.state === "running").length ?? 0} aktif süreç
        </span>

        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-hover transition hover:bg-brand/15"
        >
          <Tag className="h-2.5 w-2.5" />
          {APP_VERSION}
        </a>
      </div>
    </div>
  );
}

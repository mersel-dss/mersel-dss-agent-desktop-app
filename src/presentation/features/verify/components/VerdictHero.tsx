/**
 * Doğrulama sonucunun durum çubuğu: ince, düz, hairline çerçeveli; sol tarafta
 * duruma göre renkli küçük madalyon + başlık, sağ tarafta metrik şeridi. Büyük
 * gradient "hero" değil; inspector detayının başlığı gibi davranır.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export type VerdictTone = "success" | "critical" | "warning";

interface ToneStyle {
  bar: string;
  medallion: string;
  rule: string;
}

const TONE: Record<VerdictTone, ToneStyle> = {
  success: {
    bar: "border-success/25 bg-success/[0.06]",
    medallion: "bg-success/12 text-success",
    rule: "bg-success/25",
  },
  critical: {
    bar: "border-destructive/25 bg-destructive/[0.06]",
    medallion: "bg-destructive/12 text-destructive",
    rule: "bg-destructive/25",
  },
  warning: {
    bar: "border-warning/30 bg-warning/[0.07]",
    medallion: "bg-warning/15 text-warning-foreground",
    rule: "bg-warning/30",
  },
};

export interface VerdictMetric {
  label: string;
  value: ReactNode;
}

export function VerdictHero({
  tone,
  icon,
  title,
  subtitle,
  metrics,
}: {
  tone: VerdictTone;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  metrics?: VerdictMetric[];
}) {
  const t = TONE[tone];
  return (
    <section
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border px-4 py-3",
        t.bar,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&_svg]:h-[22px] [&_svg]:w-[22px]",
            t.medallion,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-tight tracking-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {metrics && metrics.length > 0 ? (
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {metrics.map((m, i) => (
            <div key={m.label} className="flex items-center gap-5">
              {i > 0 ? (
                <span aria-hidden className={cn("hidden h-7 w-px sm:block", t.rule)} />
              ) : null}
              <div className="flex flex-col">
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </dt>
                <dd className="mt-0.5 text-[15px] font-semibold leading-tight tnum">
                  {m.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

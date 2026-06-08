/**
 * Doğrulama ekranının iki panelli (girdi solda · sonuç sağda) çalışma
 * yüzeyi için ortak yapı taşları: yerleşim, boş durum, yükleniyor iskeleti
 * ve seviye seçici.
 */

import type { ReactNode } from "react";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

/**
 * Tam yükseklikli master-detail inspector. Solda sabit genişlikte girdi rayı,
 * onu hairline bir dikey ayraç sağdaki sonuç detayından böler. İki pano da
 * BAĞIMSIZ kaydırır (sayfa boyu scroll yok) — masaüstü-yerel hissin özü.
 */
export function WorkspaceLayout({
  input,
  result,
}: {
  input: ReactNode;
  result: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[316px] shrink-0 flex-col border-r border-border/60 bg-surface-muted/30">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{input}</div>
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto p-5">{result}</div>
    </div>
  );
}

/** Sonuç henüz yokken sağ panelde gösterilen davetkâr boş durum. */
export function ResultPlaceholder({
  icon,
  title,
  description,
  highlights,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  highlights?: string[];
}) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-8 py-12 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center text-brand-hover">
        {/* Net kesik çerçeve + iç dolgu: tema genelindeki dashed dile uyum */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-lg border border-dashed border-[rgb(var(--accent))]/30"
        />
        <span className="absolute inset-1.5 rounded-md bg-brand-soft" />
        <span className="relative">{icon}</span>
      </div>
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-muted">{description}</p>
      {highlights && highlights.length > 0 ? (
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {highlights.map((h) => (
            <span
              key={h}
              className="rounded-sm border border-dashed border-border-strong bg-surface-raised px-3 py-1 text-xs font-medium text-fg-muted"
            >
              {h}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Doğrulama sürerken sağ panelde gösterilen iskelet. */
export function ResultLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** İki/üç seçenekli segment kontrolü (örn. doğrulama seviyesi). */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-md border border-border bg-surface-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-surface-raised text-foreground ring-1 ring-border"
                : "text-fg-muted hover:text-foreground",
            )}
            title={opt.hint}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

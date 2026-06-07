/**
 * Editöryel key-value grid: küçük büyük-harf etiket üstte, değer altta; ince
 * alt çizgilerle ayrılır. DescriptionList'in uzun bölünmüş listesine göre daha
 * taranabilir ve modern bir his verir.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export interface InfoItem {
  label: string;
  value: ReactNode;
  /** Tek satırda tüm genişliği kaplasın (uzun değerler için). */
  full?: boolean;
}

export function InfoGrid({
  items,
  className,
}: {
  items: InfoItem[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]",
        className,
      )}
    >
      {items.map((it, i) => (
        <div
          key={`${it.label}-${i}`}
          className={cn(
            "min-w-0 border-b border-border/40 pb-3",
            it.full ? "[grid-column:1/-1]" : undefined,
          )}
        >
          <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-dim">
            {it.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

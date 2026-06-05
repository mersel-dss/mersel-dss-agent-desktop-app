/**
 * Etiket/değer çiftlerini hizalı gösteren reusable liste.
 */

import type { ReactNode } from "react";

export interface DescriptionItem {
  label: string;
  value: ReactNode;
}

export function DescriptionList({ items }: { items: DescriptionItem[] }) {
  return (
    <dl className="divide-y text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex justify-between gap-4 py-2">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="text-right font-medium">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

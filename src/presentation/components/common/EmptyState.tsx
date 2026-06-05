/**
 * Boş durum göstergesi.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border-strong bg-surface-muted/40 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-muted text-fg-muted">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

/**
 * Hata/uyarı madde listesi — sol renk şeridi + noktalı liste. Doğrulama
 * sonuçlarındaki `errors` / `warnings` dizilerini tutarlı biçimde gösterir.
 * `items` boşsa hiçbir şey çizmez (çağıran tarafta koşul gerekmez).
 */

import { cn } from "@/shared/lib/utils";

type AlertTone = "error" | "warning";

const TONE: Record<AlertTone, string> = {
  error: "border-destructive/50 bg-destructive/5 text-destructive",
  warning: "border-warning/60 bg-warning/5 text-muted-foreground",
};

interface AlertListProps {
  items: string[] | undefined;
  tone: AlertTone;
  className?: string;
}

export function AlertList({ items, tone, className }: AlertListProps) {
  if (!items || items.length === 0) return null;

  return (
    <ul
      className={cn(
        "list-inside list-disc border-l-2 py-2 pl-4 pr-3 text-sm",
        TONE[tone],
        className,
      )}
    >
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

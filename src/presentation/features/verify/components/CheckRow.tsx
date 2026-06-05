/**
 * Tek bir doğrulama kontrolünü "Başarılı / Başarısız" ikonu + etiket olarak
 * gösterir (İmzager "Doğrulama Detayları" listesindeki satırlar gibi).
 */

import { CircleCheck, CircleX, CircleHelp, MinusCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export type CheckState = "pass" | "fail" | "warn" | "skip";

const ICONS = {
  pass: { Icon: CircleCheck, cls: "text-success" },
  fail: { Icon: CircleX, cls: "text-destructive" },
  warn: { Icon: CircleHelp, cls: "text-warning-foreground" },
  skip: { Icon: MinusCircle, cls: "text-muted-foreground" },
} as const;

const STATE_TEXT: Record<CheckState, string> = {
  pass: "Başarılı",
  fail: "Başarısız",
  warn: "Belirsiz",
  skip: "Uygulanmadı",
};

export function CheckRow({
  state,
  label,
  detail,
}: {
  state: CheckState;
  label: string;
  detail?: React.ReactNode;
}) {
  const { Icon, cls } = ICONS[state];
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cls)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{label}</span>
          <span className={cn("shrink-0 text-xs font-medium", cls)}>
            {STATE_TEXT[state]}
          </span>
        </div>
        {detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

/** `boolean | undefined` → CheckState. undefined = skip. */
export function boolToState(value?: boolean): CheckState {
  if (value === true) return "pass";
  if (value === false) return "fail";
  return "skip";
}

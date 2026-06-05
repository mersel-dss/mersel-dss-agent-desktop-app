/**
 * Doğrulama tonuna (success/warning/critical/neutral) göre renklendirilen
 * rozet. Tek noktadan ton → sınıf eşlemesi.
 */

import { Badge } from "@/presentation/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import type { Tone } from "../labels";

const TONE_CLASSES: Record<Tone, string> = {
  success: "border-success/40 bg-success/15 text-success",
  warning: "border-warning/50 bg-warning/15 text-warning-foreground",
  critical: "border-destructive/40 bg-destructive/15 text-destructive",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(TONE_CLASSES[tone], className)}>
      {children}
    </Badge>
  );
}

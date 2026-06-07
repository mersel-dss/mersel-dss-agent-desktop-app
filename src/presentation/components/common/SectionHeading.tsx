/**
 * Küçük büyük-harf bölüm başlığı — panellerde ve kartlarda tekrar eden
 * "11px, semibold, uppercase, geniş harf aralığı" desenini tek yerde toplar.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface SectionHeadingProps {
  children: ReactNode;
  className?: string;
}

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h3
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-dim",
        className,
      )}
    >
      {children}
    </h3>
  );
}

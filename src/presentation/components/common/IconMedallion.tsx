/**
 * Marka renkli ikon madalyonu — form başlıklarında ve kart ikonlarında tekrar
 * eden yuvarlatılmış ikon yüzeyini standartlaştırır. `dashed` ile davet edici
 * (girdi paneli) görünümü, `size` ile ölçek seçilir.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

type MedallionSize = "sm" | "md" | "lg";

const SIZE: Record<MedallionSize, string> = {
  sm: "h-8 w-8 rounded-md",
  md: "h-10 w-10 rounded-md",
  lg: "h-10 w-10 rounded-2xl",
};

interface IconMedallionProps {
  children: ReactNode;
  size?: MedallionSize;
  dashed?: boolean;
  className?: string;
}

export function IconMedallion({
  children,
  size = "md",
  dashed = false,
  className,
}: IconMedallionProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-brand-soft text-brand-hover",
        SIZE[size],
        dashed && "border border-dashed border-[rgb(var(--accent))]/25",
        className,
      )}
    >
      {children}
    </span>
  );
}

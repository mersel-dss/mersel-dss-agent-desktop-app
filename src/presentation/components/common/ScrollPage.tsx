/**
 * Standart sayfalar için kaydırılabilir içerik alanı. Toolbar başlığı taşıdığı
 * için sayfalar artık kendi büyük başlığını render etmez; bu sarıcı yalnızca
 * iç dolguyu ve bağımsız dikey kaydırmayı sağlar.
 */

import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function ScrollPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cn("page-enter px-5 py-5", className)}>{children}</div>
    </div>
  );
}

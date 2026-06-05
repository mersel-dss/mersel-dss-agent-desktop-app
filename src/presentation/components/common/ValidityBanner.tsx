/**
 * Doğrulama sonucunun geçerli/geçersiz durumunu vurgulayan banner.
 */

import { CircleCheck, CircleX } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface Props {
  valid?: boolean;
  status?: string;
}

export function ValidityBanner({ valid, status }: Props) {
  const ok = valid === true;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-4",
        ok
          ? "border-success/40 bg-success/10"
          : "border-destructive/40 bg-destructive/10",
      )}
    >
      {ok ? (
        <CircleCheck className="h-6 w-6 text-success" />
      ) : (
        <CircleX className="h-6 w-6 text-destructive" />
      )}
      <div>
        <p className="font-semibold">{ok ? "Geçerli" : "Geçersiz"}</p>
        <p className="text-sm text-muted-foreground">{status ?? (ok ? "Doğrulama başarılı" : "Doğrulama başarısız")}</p>
      </div>
    </div>
  );
}

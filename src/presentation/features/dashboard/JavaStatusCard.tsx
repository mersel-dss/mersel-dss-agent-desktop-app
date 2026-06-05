/**
 * Java runtime tespit durumu kartı.
 */

import { Coffee, CircleCheck, CircleAlert, Package } from "lucide-react";
import { useJava } from "@/application/services/hooks";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/skeleton";

export function JavaStatusCard() {
  const { data, isLoading } = useJava();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-dim">
          <Coffee className="h-3.5 w-3.5" />
          Java Runtime
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-40" />
        ) : data?.available ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-success/12 text-success">
              <CircleCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                Java {data.major ?? "?"} bulundu
                {data.bundled ? (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-brand-soft px-1.5 py-px text-[10px] font-medium text-brand-hover">
                    <Package className="h-2.5 w-2.5" />
                    Paketlenmiş
                  </span>
                ) : null}
              </p>
              <p className="truncate text-xs text-fg-muted">
                {data.version}
                {!data.bundled && data.source === "java-home"
                  ? " · JAVA_HOME"
                  : !data.bundled && data.source === "path"
                    ? " · PATH"
                    : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-destructive/12 text-destructive">
              <CircleAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Java bulunamadı</p>
              <p className="text-xs text-fg-muted">
                Servisleri çalıştırmak için Java 8+ kurun.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

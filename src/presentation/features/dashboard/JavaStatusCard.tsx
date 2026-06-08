/**
 * Java runtime durum kartı. Servisler farklı Java sürümleri gerektirdiğinden
 * (imza/doğrulama → Java 8, önizleme → Java 21) her gerekli sürüm **ayrı satır**
 * olarak gösterilir: bulundu mu, hangi sürüm, kaynağı (paketlenmiş / JAVA_HOME / PATH).
 */

import { Coffee, CircleCheck, CircleAlert, Package } from "lucide-react";
import { useJavaRuntimes } from "@/application/services/hooks";
import type { JavaRuntimeInfo } from "@/domain/services/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Skeleton } from "@/presentation/components/ui/skeleton";

function sourceLabel(rt: JavaRuntimeInfo): string | null {
  if (!rt.available) return null;
  if (rt.bundled) return "Paketlenmiş";
  if (rt.source === "java-home") return "JAVA_HOME";
  if (rt.source === "path") return "PATH";
  return null;
}

function RuntimeRow({ rt }: { rt: JavaRuntimeInfo }) {
  const ok = rt.available;
  const badge = sourceLabel(rt);

  return (
    <div className="flex items-center gap-3">
      <div
        className={
          ok
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-success/12 text-success"
            : "flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-destructive/12 text-destructive"
        }
      >
        {ok ? (
          <CircleCheck className="h-5 w-5" />
        ) : (
          <CircleAlert className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          {ok ? `${rt.label} bulundu` : `${rt.label} gerekli`}
          {badge ? (
            <span className="inline-flex items-center gap-1 rounded-sm bg-brand-soft px-1.5 py-px text-[10px] font-medium text-brand-hover">
              {rt.bundled ? <Package className="h-2.5 w-2.5" /> : null}
              {badge}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-fg-muted">
          {ok ? rt.version ?? `Java ${rt.major}` : "Uygun bir runtime bulunamadı"}
          <span className="text-fg-dim"> · {rt.purpose}</span>
        </p>
      </div>
    </div>
  );
}

export function JavaStatusCard() {
  const { data, isLoading } = useJavaRuntimes();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-dim">
          <Coffee className="h-3.5 w-3.5" />
          Java Çalışma Zamanları
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {data.map((rt) => (
              <RuntimeRow key={rt.requiredMajor} rt={rt} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-destructive/12 text-destructive">
              <CircleAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Java bulunamadı</p>
              <p className="text-xs text-fg-muted">
                Servisleri çalıştırmak için Java kurun.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Yönetilen servisleri responsive bir KART ızgarasında gösterir. Her kart bir
 * servis: durum, port, sürüm ve işlemler. Üstte bölüm başlığı + (macOS/Linux'ta)
 * topluca OS-servisine kur/kaldır eylemi.
 */

import { Boxes, ServerCog } from "lucide-react";
import { toast } from "sonner";
import type { ServiceSnapshot } from "@/domain/services/types";
import type { ProgressMap } from "@/application/services/useDownloadProgress";
import {
  useInstallOsServices,
  useUninstallOsServices,
} from "@/application/services/hooks";
import { errorMessage } from "@/shared/lib/errors";
import { Button } from "@/presentation/components/ui/button";
import { Card } from "@/presentation/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/presentation/components/ui/tooltip";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { ServiceCard } from "@/presentation/features/dashboard/ServiceCard";

interface ServicesPanelProps {
  services: ServiceSnapshot[] | undefined;
  isLoading: boolean;
  progress: ProgressMap;
}

export function ServicesPanel({ services, isLoading, progress }: ServicesPanelProps) {
  const installOs = useInstallOsServices();
  const uninstallOs = useUninstallOsServices();
  const osBusy = installOs.isPending || uninstallOs.isPending;

  const anyOsManaged = (services ?? []).some((s) => s.osManaged);

  // Windows'ta gerçek Windows Service'leri INSTALLER (admin/UAC) kaydeder; uygulama
  // içinden kurulamaz. Bu yüzden global OS düğmesini Windows'ta gizle.
  const isWindows =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
  const showOsToggle = !isWindows;

  const handleInstallOs = () => {
    installOs.mutate(undefined, {
      onSuccess: () =>
        toast.success("Servisler işletim sistemine kuruldu (login'de otomatik kalkar)"),
      onError: (e) => toast.error(`OS-servis kurulumu başarısız: ${errorMessage(e)}`),
    });
  };

  const handleUninstallOs = () => {
    uninstallOs.mutate(undefined, {
      onSuccess: () => toast.success("OS-servis kayıtları kaldırıldı"),
      onError: (e) => toast.error(`Kaldırma başarısız: ${errorMessage(e)}`),
    });
  };

  return (
    <section className="space-y-3">
      {/* Bölüm başlığı. */}
      <div className="flex items-center gap-2">
        <Boxes className="h-3.5 w-3.5 text-fg-dim" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-dim">
          Yönetilen Servisler
        </h2>
        {showOsToggle && services && services.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={anyOsManaged ? handleUninstallOs : handleInstallOs}
                disabled={osBusy}
              >
                <ServerCog />
                {osBusy
                  ? "Uygulanıyor…"
                  : anyOsManaged
                    ? "OS-servisini kaldır"
                    : "İşletim sistemine kur"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {anyOsManaged
                ? "Servisleri OS kaydından çıkar; uygulama yeniden kendi başlatır."
                : "Servisleri login'de otomatik kalkan, sürekli sıcak OS-servislerine dönüştür."}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {/* Kart ızgarası — geniş ekranda 2 sütun. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-[104px] w-full" />
            </Card>
          ))
        ) : services && services.length > 0 ? (
          services.map((service) => (
            <ServiceCard key={service.kind} service={service} progress={progress} />
          ))
        ) : (
          <Card className="p-8 sm:col-span-2">
            <p className="text-center text-sm text-fg-muted">Henüz yönetilen servis yok.</p>
          </Card>
        )}
      </div>
    </section>
  );
}

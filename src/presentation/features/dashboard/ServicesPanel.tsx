/**
 * Yönetilen Java servislerini tek, derli toplu bir grid (tablo) içinde gösterir.
 * Her satır bir servis: durum, port, sürüm ve işlem butonu.
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/presentation/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/presentation/components/ui/tooltip";
import { Skeleton } from "@/presentation/components/ui/skeleton";
import { ServiceRow } from "@/presentation/features/dashboard/ServiceRow";

interface ServicesPanelProps {
  services: ServiceSnapshot[] | undefined;
  isLoading: boolean;
  progress: ProgressMap;
}

const HEAD_CLASS =
  "h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-dim";

export function ServicesPanel({ services, isLoading, progress }: ServicesPanelProps) {
  const installOs = useInstallOsServices();
  const uninstallOs = useUninstallOsServices();
  const osBusy = installOs.isPending || uninstallOs.isPending;

  // Servisler henüz yüklenmediyse butonu gösterme; en az biri OS-servisi ise
  // "kaldır", hiçbiri değilse "işletim sistemine kur" eylemini sun.
  const anyOsManaged = (services ?? []).some((s) => s.osManaged);

  // Windows'ta gerçek Windows Service'leri INSTALLER (admin/UAC) kaydeder; uygulama
  // içinden kurulamaz/kaldırılamaz. Bu yüzden global OS düğmesini Windows'ta gizle
  // (macOS/Linux'ta kullanıcı kapsamı LaunchAgent/systemd uygulamadan yönetilir).
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
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
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

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={HEAD_CLASS}>Servis</TableHead>
            <TableHead className={HEAD_CLASS}>Durum</TableHead>
            <TableHead className={HEAD_CLASS}>Port</TableHead>
            <TableHead className={HEAD_CLASS}>Sürüm</TableHead>
            <TableHead className={`${HEAD_CLASS} text-right`}>İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_td]:px-4">
          {isLoading ? (
            [0, 1, 2, 3].map((i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-4 py-3">
                  <Skeleton className="h-9 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : services && services.length > 0 ? (
            services.map((service) => (
              <ServiceRow key={service.kind} service={service} progress={progress} />
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="px-4 py-8 text-center text-sm text-fg-muted">
                Henüz yönetilen servis yok.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

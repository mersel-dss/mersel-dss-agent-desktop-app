/**
 * Yönetilen servis tablosunda tek bir satır: kur / başlat / durdur / arayüzü aç.
 */

import { useEffect, useRef } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Play,
  ShieldCheck,
  Square,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import type { ServiceSnapshot } from "@/domain/services/types";
import {
  useInstallService,
  useLatestRelease,
  useStartService,
  useStopService,
  useUpdateService,
} from "@/application/services/hooks";
import type { ProgressMap } from "@/application/services/useDownloadProgress";
import { SERVICE_META } from "@/shared/config/services";
import { formatBytes } from "@/shared/lib/format";
import { errorMessage } from "@/shared/lib/errors";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/presentation/components/ui/button";
import { Progress } from "@/presentation/components/ui/progress";
import { TableCell, TableRow } from "@/presentation/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/presentation/components/ui/tooltip";
import { ServiceStateBadge } from "@/presentation/components/common/ServiceStateBadge";

interface ServiceRowProps {
  service: ServiceSnapshot;
  progress: ProgressMap;
}

const SERVICE_ICON: Record<string, LucideIcon> = {
  agent: Stamp,
  verifier: ShieldCheck,
  xslt: FileText,
  "html-to-pdf": FileText,
};

export function ServiceRow({ service, progress }: ServiceRowProps) {
  const meta = SERVICE_META[service.kind];
  const start = useStartService();
  const stop = useStopService();
  const install = useInstallService();
  const update = useUpdateService();
  const release = useLatestRelease(service.kind);

  const dl = progress[service.kind];
  const installing = install.isPending || update.isPending || (dl && !dl.done);
  const percent =
    dl && dl.total ? Math.round((dl.downloaded / dl.total) * 100) : undefined;

  const isInstalled = service.state !== "not-installed";
  const isRunning = service.state === "running" || service.state === "starting";
  const isExternal = service.externallyManaged === true;

  const latestTag = release.data?.tag;
  const updateAvailable =
    !isExternal &&
    isInstalled &&
    !!latestTag &&
    !!service.installedTag &&
    latestTag !== service.installedTag;

  // Yeni bir sürüm tespit edilince güncellemeyi otomatik uygula (indir +
  // çalışıyorsa yeniden başlat). Aynı tag için tek deneme yapılır ki ağ hatası
  // durumunda döngüye girmesin; arka plan güncelleyici sonradan yeniden dener.
  const attemptedTagRef = useRef<string | null>(null);
  useEffect(() => {
    if (!updateAvailable || !latestTag) return;
    if (installing || update.isPending) return;
    if (attemptedTagRef.current === latestTag) return;
    attemptedTagRef.current = latestTag;
    update.mutate(service.kind, {
      onSuccess: (updated) => {
        if (updated) toast.success(`${meta.shortName} güncellendi (${latestTag})`);
      },
      onError: (e) => toast.error(`Güncelleme başarısız: ${errorMessage(e)}`),
    });
  }, [updateAvailable, latestTag, installing, update, service.kind, meta.shortName]);

  const handleInstall = () => {
    install.mutate(service.kind, {
      onSuccess: () => toast.success(`${meta.shortName} kuruldu`),
      onError: (e) => toast.error(`Kurulum başarısız: ${errorMessage(e)}`),
    });
  };

  const handleStart = () => {
    start.mutate(service.kind, {
      onSuccess: () => toast.success(`${meta.shortName} başlatıldı`),
      onError: (e) => toast.error(`Başlatılamadı: ${errorMessage(e)}`),
    });
  };

  const handleStop = () => {
    stop.mutate(service.kind, {
      onError: (e) => toast.error(`Durdurulamadı: ${errorMessage(e)}`),
    });
  };

  const Icon = SERVICE_ICON[service.kind] ?? Stamp;
  const docsUrl = service.baseUrl + (meta.docsPath ?? "");

  const docsButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => void openUrl(docsUrl)}
          disabled={!isExternal && service.state !== "running"}
          aria-label="API dökümantasyonu"
        >
          <ExternalLink />
        </Button>
      </TooltipTrigger>
      <TooltipContent>API dökümantasyonu</TooltipContent>
    </Tooltip>
  );

  return (
    <>
      <TableRow className={cn(installing && "border-b-0")}>
        {/* Servis: ikon + ad + kısa açıklama. */}
        <TableCell className="py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-hover">
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="font-medium leading-tight">{meta.displayName}</p>
              <p className="mt-0.5 line-clamp-1 max-w-[34ch] whitespace-normal text-xs text-fg-muted">
                {meta.description}
              </p>
            </div>
          </div>
        </TableCell>

        {/* Durum. */}
        <TableCell>
          <ServiceStateBadge state={service.state} />
        </TableCell>

        {/* Port. */}
        <TableCell className="tnum text-fg-muted">{service.port}</TableCell>

        {/* Sürüm: kurulu + güncelleme rozeti. */}
        <TableCell>
          <div className="flex items-center gap-1.5">
            <span className="tnum font-medium">{service.installedTag ?? "—"}</span>
            {updateAvailable ? (
              <span className="rounded-sm bg-status-starting/15 px-1.5 py-px text-[10px] font-medium text-[rgb(var(--tone-warning-fg))]">
                {installing ? "güncelleniyor…" : latestTag}
              </span>
            ) : null}
          </div>
        </TableCell>

        {/* İşlemler. */}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            {isExternal ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-fg-dim">Dışarıdan yönetiliyor</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Uygulama dışında başlatıldı; durdurma uygulamadan yönetilemez.
                  </TooltipContent>
                </Tooltip>
                {docsButton}
              </>
            ) : !isInstalled ? (
              <Button size="sm" onClick={handleInstall} disabled={!!installing}>
                <Download />
                {installing ? "İndiriliyor…" : "İndir ve kur"}
              </Button>
            ) : isRunning ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleStop}
                  disabled={stop.isPending}
                >
                  <Square />
                  Durdur
                </Button>
                {docsButton}
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleStart}
                disabled={start.isPending || !!installing}
              >
                <Play />
                {installing ? "Güncelleniyor…" : "Başlat"}
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* İndirme/güncelleme ilerlemesi — satırın altında ince bir şerit. */}
      {installing ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="pt-0 pb-3">
            <div className="flex items-center gap-3">
              <Progress value={percent ?? null} className="h-1.5 flex-1" />
              <span className="shrink-0 text-xs text-fg-muted">
                {dl
                  ? `${formatBytes(dl.downloaded)}${dl.total ? ` / ${formatBytes(dl.total)}` : ""}`
                  : "Hazırlanıyor…"}
              </span>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/**
 * Yönetilen tek bir servisi gösteren KART: ikon + ad + durum, açıklama, port/sürüm
 * meta'sı ve işlem butonları (kur / başlat / durdur / yeniden başlat / arayüzü aç).
 */

import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  ArrowUpCircle,
  Download,
  ExternalLink,
  FileText,
  Play,
  Printer,
  RotateCw,
  ServerCog,
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
  useRestartService,
  useStartService,
  useStopService,
  useUpdateService,
} from "@/application/services/hooks";
import type { ProgressMap } from "@/application/services/useDownloadProgress";
import { SERVICE_META } from "@/shared/config/services";
import { formatBytes } from "@/shared/lib/format";
import { errorMessage } from "@/shared/lib/errors";
import { Button } from "@/presentation/components/ui/button";
import { Card } from "@/presentation/components/ui/card";
import { Progress } from "@/presentation/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/presentation/components/ui/tooltip";
import { ServiceStateBadge } from "@/presentation/components/common/ServiceStateBadge";

interface ServiceCardProps {
  service: ServiceSnapshot;
  progress: ProgressMap;
}

const SERVICE_ICON: Record<string, LucideIcon> = {
  agent: Stamp,
  verifier: ShieldCheck,
  xslt: FileText,
  "html-to-pdf": Printer,
};

export function ServiceCard({ service, progress }: ServiceCardProps) {
  const meta = SERVICE_META[service.kind];
  const start = useStartService();
  const stop = useStopService();
  const restart = useRestartService();
  const install = useInstallService();
  const update = useUpdateService();
  const release = useLatestRelease(service.kind);

  const dl = progress[service.kind];
  const installing = install.isPending || update.isPending || (dl && !dl.done);
  const percent =
    dl && dl.total ? Math.round((dl.downloaded / dl.total) * 100) : undefined;

  const isInstalled = service.state !== "not-installed";
  const isRunning = service.state === "running" || service.state === "starting";
  const isOsManaged = service.osManaged === true;
  const isExternal = service.externallyManaged === true && !isOsManaged;

  const latestTag = release.data?.tag;
  const updateAvailable =
    !isExternal &&
    isInstalled &&
    !!latestTag &&
    !!service.installedTag &&
    latestTag !== service.installedTag;

  // Yeni sürüm görülünce otomatik güncelle (tag başına tek deneme).
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

  const handleRestart = () => {
    restart.mutate(service.kind, {
      onSuccess: () => toast.success(`${meta.shortName} yeniden başlatıldı`),
      onError: (e) => toast.error(`Yeniden başlatılamadı: ${errorMessage(e)}`),
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

  const actions = isExternal ? (
    <>
      <span className="mr-auto text-xs text-fg-dim">Dışarıdan yönetiliyor</span>
      {docsButton}
    </>
  ) : isOsManaged ? (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="mr-auto inline-flex items-center gap-1 rounded-sm bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-hover">
            <ServerCog className="h-3 w-3" />
            OS servisi
          </span>
        </TooltipTrigger>
        <TooltipContent>
          İşletim sistemi servisi — login'de otomatik başlar, sürekli sıcak kalır.
        </TooltipContent>
      </Tooltip>
      {isRunning ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleRestart}
                disabled={restart.isPending}
                aria-label="Yeniden başlat"
              >
                <RotateCw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Yeniden başlat</TooltipContent>
          </Tooltip>
          <Button variant="secondary" size="sm" onClick={handleStop} disabled={stop.isPending}>
            <Square />
            Durdur
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={handleStart} disabled={start.isPending}>
          <Play />
          Başlat
        </Button>
      )}
      {docsButton}
    </>
  ) : !isInstalled ? (
    <Button
      size="sm"
      variant={service.lastError ? "outline" : "default"}
      onClick={handleInstall}
      disabled={!!installing}
      className="ml-auto"
    >
      <Download />
      {installing ? "İndiriliyor…" : service.lastError ? "Tekrar dene" : "İndir ve kur"}
    </Button>
  ) : isRunning ? (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleStop}
        disabled={stop.isPending}
        className="ml-auto"
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
      className="ml-auto"
    >
      <Play />
      {installing ? "Güncelleniyor…" : "Başlat"}
    </Button>
  );

  return (
    <Card className="group flex flex-col gap-0 overflow-hidden p-0 transition-all duration-200 hover:border-border-strong hover:shadow-[0_2px_4px_-2px_rgb(0_0_0/0.06),0_12px_28px_-16px_rgb(0_0_0/0.18)]">
      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Başlık: ikon + ad + durum rozeti. */}
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-hover ring-1 ring-inset ring-brand/10">
            <Icon className="h-[22px] w-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-fg">
                {meta.displayName}
              </h3>
              <ServiceStateBadge state={service.state} />
            </div>
            <p className="mt-0.5 truncate text-xs text-fg-dim">{meta.shortName}</p>
          </div>
        </div>

        {/* Ne için kullanılır — sade, kullanıcı odaklı açıklama. */}
        <p className="text-[13px] leading-relaxed text-fg-muted">{meta.usage}</p>

        {/* Meta çipleri: port + sürüm (+ güncelleme rozeti). */}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-0.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 text-[11px] font-medium">
            <span className="text-fg-dim">Port</span>
            <span className="tnum text-fg">{service.port}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 text-[11px] font-medium">
            <span className="text-fg-dim">Sürüm</span>
            <span className="tnum text-fg">{service.installedTag ?? "—"}</span>
          </span>
          {updateAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-status-starting/12 px-2 py-1 text-[11px] font-medium text-[rgb(var(--tone-warning-fg))]">
              <ArrowUpCircle className="h-3 w-3" />
              {installing ? "güncelleniyor…" : latestTag}
            </span>
          ) : null}
        </div>
      </div>

      {/* İşlemler — kart altında ayrık, hafif tonlu bir bar. */}
      <div className="flex items-center gap-1.5 border-t border-border bg-surface-muted/40 px-5 py-3">
        {actions}
      </div>

      {/* İndirme ilerlemesi / hata. */}
      {installing ? (
        <div className="flex items-center gap-3 border-t border-border px-5 py-3">
          <Progress value={percent ?? null} className="h-1.5 flex-1" />
          <span className="shrink-0 text-xs text-fg-muted">
            {dl
              ? `${formatBytes(dl.downloaded)}${dl.total ? ` / ${formatBytes(dl.total)}` : ""}`
              : "Hazırlanıyor…"}
          </span>
        </div>
      ) : !isInstalled && service.lastError ? (
        <div className="border-t border-border px-5 py-3">
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">Otomatik indirme başarısız: {service.lastError}</span>
          </p>
        </div>
      ) : null}
    </Card>
  );
}

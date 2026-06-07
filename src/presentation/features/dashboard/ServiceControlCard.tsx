/**
 * Tek bir Java servisini yöneten kart: kur / başlat / durdur / arayüzü aç.
 */

import {
  Download,
  ExternalLink,
  Play,
  RefreshCw,
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
} from "@/application/services/hooks";
import type { ProgressMap } from "@/application/services/useDownloadProgress";
import { SERVICE_META } from "@/shared/config/services";
import { basename, formatBytes } from "@/shared/lib/format";
import { errorMessage } from "@/shared/lib/errors";
import { Button } from "@/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui/card";
import { Progress } from "@/presentation/components/ui/progress";
import { ServiceStateBadge } from "@/presentation/components/common/ServiceStateBadge";

interface ServiceControlCardProps {
  service: ServiceSnapshot;
  progress: ProgressMap;
}

const SERVICE_ICON: Record<string, LucideIcon> = {
  agent: Stamp,
  verifier: ShieldCheck,
};

export function ServiceControlCard({ service, progress }: ServiceControlCardProps) {
  const meta = SERVICE_META[service.kind];
  const start = useStartService();
  const stop = useStopService();
  const install = useInstallService();
  const release = useLatestRelease(service.kind);

  const dl = progress[service.kind];
  const installing = install.isPending || (dl && !dl.done);
  const percent =
    dl && dl.total ? Math.round((dl.downloaded / dl.total) * 100) : undefined;

  const isInstalled = service.state !== "not-installed";
  const isRunning = service.state === "running" || service.state === "starting";
  const isExternal = service.externallyManaged === true;

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

  return (
    <Card className="lift flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-hover">
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <CardTitle className="text-base">{meta.displayName}</CardTitle>
          </div>
          <ServiceStateBadge state={service.state} />
        </div>
        <CardDescription className="leading-relaxed">{meta.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 text-sm">
        <dl className="divide-y divide-border border-y border-border">
          <div className="flex justify-between py-2">
            <dt className="text-fg-muted">Port</dt>
            <dd className="tnum font-medium">{service.port}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-fg-muted">Jar</dt>
            <dd className="truncate font-medium" title={service.jarPath ?? ""}>
              {service.jarPath ? basename(service.jarPath) : "—"}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-fg-muted">Kurulu sürüm</dt>
            <dd className="font-medium">{service.installedTag ?? "—"}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-fg-muted">Son sürüm</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              {release.data?.tag ?? "…"}
              {release.data?.tag &&
              service.installedTag &&
              release.data.tag !== service.installedTag ? (
                <span className="rounded-sm bg-status-starting/15 px-1.5 py-px text-[10px] font-medium text-[rgb(var(--tone-warning-fg))]">
                  güncelleme var
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        {installing ? (
          <div className="space-y-1 pt-1">
            <Progress value={percent ?? null} />
            <p className="text-xs text-muted-foreground">
              {dl
                ? `${formatBytes(dl.downloaded)}${dl.total ? ` / ${formatBytes(dl.total)}` : ""} indiriliyor…`
                : "Hazırlanıyor…"}
            </p>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="gap-2">
        {isExternal ? (
          <>
            <div className="flex-1 text-xs text-muted-foreground">
              Uygulama dışında başlatıldı; durdurma uygulamadan yönetilemez.
            </div>
            <Button
              variant="outline"
              onClick={() => void openUrl(service.baseUrl)}
            >
              <ExternalLink className="h-4 w-4" />
              Arayüz
            </Button>
          </>
        ) : !isInstalled ? (
          <Button onClick={handleInstall} disabled={!!installing} className="flex-1">
            <Download className="h-4 w-4" />
            {installing ? "İndiriliyor…" : "İndir ve kur"}
          </Button>
        ) : isRunning ? (
          <>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleStop}
              disabled={stop.isPending}
            >
              <Square className="h-4 w-4" />
              Durdur
            </Button>
            <Button
              variant="outline"
              onClick={() => void openUrl(service.baseUrl)}
              disabled={service.state !== "running"}
            >
              <ExternalLink className="h-4 w-4" />
              Arayüz
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleStart} disabled={start.isPending} className="flex-1">
              <Play className="h-4 w-4" />
              Başlat
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleInstall}
              disabled={!!installing}
              aria-label="Güncelle"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

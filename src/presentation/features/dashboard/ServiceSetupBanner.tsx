/**
 * İlk-kurulum durumu banner'ı. Servisler ilk açılışta arka planda otomatik
 * indirilir; bu banner kullanıcının "neden beklediğini" net görmesini sağlar:
 * kaç/kaç servis hazır, indirme sürüyor mu, yoksa bir servis kurulamadı mı
 * (kurulamadıysa "Tümünü tekrar dene"). Tüm yönetilen servisler kuruluyken
 * banner hiç görünmez.
 */

import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ServiceSnapshot } from "@/domain/services/types";
import type { ProgressMap } from "@/application/services/useDownloadProgress";
import { useInstallService } from "@/application/services/hooks";
import { SERVICE_META } from "@/shared/config/services";
import { errorMessage } from "@/shared/lib/errors";
import { Button } from "@/presentation/components/ui/button";
import { Card } from "@/presentation/components/ui/card";
import { Progress } from "@/presentation/components/ui/progress";

interface ServiceSetupBannerProps {
  services: ServiceSnapshot[] | undefined;
  progress: ProgressMap;
}

export function ServiceSetupBanner({ services, progress }: ServiceSetupBannerProps) {
  const install = useInstallService();

  const managed = (services ?? []).filter((s) => !s.externallyManaged);
  const total = managed.length;
  const installed = managed.filter((s) => s.state !== "not-installed");
  const notInstalled = managed.filter((s) => s.state === "not-installed");

  // Hepsi kuruluysa banner gösterme.
  if (total === 0 || notInstalled.length === 0) return null;

  const errored = notInstalled.filter((s) => s.lastError);
  const downloading = notInstalled.filter((s) => {
    const dl = progress[s.kind];
    return dl && !dl.done;
  });
  // Aktif indirme yok ve hepsi hatalıysa "takıldı" durumundayız.
  const stalled = downloading.length === 0 && errored.length === notInstalled.length;

  // Toplam ilerleme: indirilen baytlar biliniyorsa bayt-bazlı, yoksa sayı-bazlı.
  const bytes = downloading.reduce(
    (acc, s) => {
      const dl = progress[s.kind];
      if (dl?.total) {
        acc.downloaded += dl.downloaded;
        acc.total += dl.total;
      }
      return acc;
    },
    { downloaded: 0, total: 0 },
  );
  const percent = bytes.total
    ? Math.round((bytes.downloaded / bytes.total) * 100)
    : Math.round((installed.length / total) * 100);

  const handleRetryAll = () => {
    const targets = (errored.length > 0 ? errored : notInstalled).map((s) => s.kind);
    targets.forEach((kind) =>
      install.mutate(kind, {
        onError: (e) =>
          toast.error(`${SERVICE_META[kind].shortName}: ${errorMessage(e)}`),
      }),
    );
  };

  return (
    <Card
      className={
        stalled
          ? "gap-3 border-destructive/30 bg-destructive/5 p-4"
          : "gap-3 border-primary/30 bg-primary/5 p-4"
      }
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {stalled ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {stalled ? "Bazı servisler kurulamadı" : "Servisler kuruluyor…"}
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {stalled
              ? "İlk kurulum tamamlanamadı. İnternet bağlantını kontrol edip tekrar dene."
              : "Servisler ilk açılışta otomatik indiriliyor; bu birkaç dakika sürebilir. Lütfen uygulamayı kapatma."}
          </p>

          <div className="mt-2.5 flex items-center gap-3">
            <Progress
              value={stalled ? null : percent}
              className="h-1.5 flex-1"
            />
            <span className="tnum shrink-0 text-xs text-fg-muted">
              {installed.length} / {total} hazır
            </span>
          </div>

          {/* Servis bazında kurulum hatalarının özeti. */}
          {errored.length > 0 ? (
            <ul className="mt-2 space-y-0.5">
              {errored.map((s) => (
                <li
                  key={s.kind}
                  className="line-clamp-1 text-xs text-destructive"
                  title={s.lastError ?? undefined}
                >
                  • {SERVICE_META[s.kind].shortName}: {s.lastError}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {stalled || errored.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetryAll}
            disabled={install.isPending}
            className="shrink-0"
          >
            {install.isPending ? (
              <Loader2 className="animate-spin" />
            ) : null}
            Tümünü tekrar dene
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

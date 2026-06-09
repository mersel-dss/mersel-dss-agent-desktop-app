/**
 * Uygulama güncelleme bildirimi — sağ-alt köşede beliren profesyonel kart.
 *
 * Yeni bir sürüm yayınlandığında (updater `check()` bulduğunda) görünür;
 * kullanıcı "Güncelle" deyince indirme/kurulum ilerlemesi (yüzde + boyut)
 * canlı gösterilir, ardından uygulama yeniden başlatılır. "Daha sonra" ile
 * bu oturum için kapatılır; yeni bir sürüm çıkınca yeniden belirir.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  DownloadCloud,
  Loader2,
  RotateCw,
  Sparkles,
  X,
} from "lucide-react";
import { useAppUpdate } from "@/application/update/hooks";
import { formatBytes } from "@/shared/lib/format";
import { errorMessage } from "@/shared/lib/errors";
import { Button } from "@/presentation/components/ui/button";
import { Progress } from "@/presentation/components/ui/progress";

export function UpdateBanner() {
  const { info, install, progress } = useAppUpdate();
  const [dismissed, setDismissed] = useState(false);

  // Yeni bir sürüm geldiğinde (versiyon değişince) tekrar göster.
  useEffect(() => {
    if (info?.version) setDismissed(false);
  }, [info?.version]);

  if (!info?.available) return null;
  if (dismissed && !install.isPending && !install.isError) return null;

  const installing = install.isPending;
  const failed = install.isError;
  const percent =
    progress && progress.total
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null;

  const handleUpdate = () =>
    install.mutate(undefined, {
      // Başarıda uygulama relaunch olur; ayrıca bir şey yapmaya gerek yok.
    });

  return (
    <div className="fixed right-4 bottom-9 z-50 w-[360px] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/10 ring-1 ring-black/5">
        {/* Üst aksan şeridi */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/70 via-primary to-primary/70" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " +
                (failed
                  ? "bg-destructive/10 text-destructive"
                  : "bg-brand-soft text-brand-hover")
              }
            >
              {installing ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : failed ? (
                <AlertTriangle className="h-[18px] w-[18px]" />
              ) : (
                <Sparkles className="h-[18px] w-[18px]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">
                {installing
                  ? "Güncelleniyor…"
                  : failed
                    ? "Güncelleme başarısız"
                    : "Yeni sürüm hazır"}
              </p>
              <p className="mt-0.5 text-xs text-fg-muted">
                {failed ? (
                  <span className="text-destructive">
                    {errorMessage(install.error)}
                  </span>
                ) : (
                  <>
                    İmzamatik{" "}
                    <span className="font-medium text-fg">v{info.version}</span>
                    {info.currentVersion ? (
                      <span className="text-fg-dim">
                        {" "}
                        · şu an v{info.currentVersion}
                      </span>
                    ) : null}
                  </>
                )}
              </p>
            </div>

            {/* Kapat — yalnız indirme yokken */}
            {!installing ? (
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setDismissed(true)}
                className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-dim transition-colors hover:bg-surface-muted hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* İlerleme — indirme sürerken */}
          {installing ? (
            <div className="mt-3">
              <Progress value={percent} className="h-1.5" />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-fg-muted">
                <span>{percent !== null ? `%${percent}` : "İndiriliyor…"}</span>
                {progress ? (
                  <span className="tnum">
                    {formatBytes(progress.downloaded)}
                    {progress.total ? ` / ${formatBytes(progress.total)}` : ""}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            /* Aksiyonlar */
            <div className="mt-3 flex items-center justify-end gap-2">
              {!failed ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDismissed(true)}
                >
                  Daha sonra
                </Button>
              ) : null}
              <Button size="sm" onClick={handleUpdate}>
                {failed ? (
                  <>
                    <RotateCw />
                    Tekrar dene
                  </>
                ) : (
                  <>
                    <DownloadCloud />
                    Güncelle
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Alt durum/marka çubuğu (status bar). Klasik masaüstü alt şeridi: solda canlı
 * servis durumu, sağda **Mersel İmzamatik** marka atfı — ürünü geliştiren
 * Mersel'in görünür, tek-tık erişilebilir imzası (mersel.io + açık kaynak repo).
 *
 * Marka atfı bilinçli olarak kalıcıdır: ürün açık kaynak olarak Mersel
 * tarafından geliştirilir ve bu şerit o emeğin görünürlüğünü taşır.
 */

import { GitBranch, Heart, Tag } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BRAND } from "@/shared/brand";
import { useServiceHealth } from "@/application/services/hooks";
import { MerselLogotype } from "@/presentation/components/brand/MerselLogo";
import { cn } from "@/shared/lib/utils";

const APP_VERSION = "v0.1.0";

function LiveStatus() {
  const { total, running, allRunning, anyRunning } = useServiceHealth();

  const tone = allRunning
    ? "text-status-running"
    : anyRunning
      ? "text-[rgb(var(--tone-warning-fg))]"
      : "text-fg-dim";
  const dot = allRunning
    ? "bg-status-running"
    : anyRunning
      ? "bg-status-starting"
      : "bg-fg-dim";
  const label =
    total === 0
      ? "Servisler hazırlanıyor"
      : allRunning
        ? "Tüm servisler çalışıyor"
        : anyRunning
          ? `${running}/${total} servis çalışıyor`
          : "Servisler durduruldu";

  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        {running > 0 ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              dot,
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dot)} />
      </span>
      <span className={cn("whitespace-nowrap", tone)}>{label}</span>
    </span>
  );
}

export function StatusBar() {
  return (
    <footer
      data-tauri-drag-region
      className="app-chrome flex h-[26px] shrink-0 items-center justify-between gap-3 border-t border-border px-3 text-[11px] text-fg-dim"
    >
      {/* Sol: canlı servis durumu */}
      <LiveStatus />

      {/* Sağ: Mersel marka atfı — kalıcı, tıklanabilir imza */}
      <div className="flex items-center gap-2.5">
        <span className="hidden items-center gap-1 whitespace-nowrap sm:flex">
          Türkiye'nin e-imza süreçleri için
          <Heart className="h-2.5 w-2.5 fill-brand text-brand" aria-hidden />
          ile
        </span>

        <button
          type="button"
          onClick={() => void openUrl(BRAND.website)}
          title={`${BRAND.product} · ${BRAND.company} tarafından geliştirildi — ${BRAND.domain}`}
          className="group flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium text-fg-muted transition-colors hover:bg-brand-soft hover:text-brand-hover"
        >
          <MerselLogotype className="h-3" />
          <span className="whitespace-nowrap">tarafından geliştirildi</span>
        </button>

        <span aria-hidden className="h-3 w-px bg-border" />

        <button
          type="button"
          onClick={() => void openUrl(BRAND.github)}
          title="Açık kaynak deposu — GitHub'da incele"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium transition-colors hover:bg-surface-muted hover:text-fg-muted"
        >
          <GitBranch className="h-3 w-3" />
          <span className="hidden whitespace-nowrap md:inline">Açık kaynak</span>
        </button>

        <span aria-hidden className="h-3 w-px bg-border" />

        {/* Sürüm — sağ en alt köşe */}
        <span
          title={`${BRAND.product} ${APP_VERSION}`}
          className="flex items-center gap-1 whitespace-nowrap font-mono text-[10.5px] font-medium text-fg-dim"
        >
          <Tag className="h-2.5 w-2.5" />
          {APP_VERSION}
        </span>
      </div>
    </footer>
  );
}

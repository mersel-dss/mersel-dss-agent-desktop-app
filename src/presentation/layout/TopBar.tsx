/**
 * Birleşik üst uygulama çubuğu (single app bar): solda trafik-ışığı boşluğu +
 * marka, ortada yatay gezinme (aktif öğe alt-çizgi göstergesiyle), sağda arama,
 * servis durumu ve sürüm. Tamamı sürüklenebilir pencere taşıma bölgesidir.
 */

import { NavLink } from "react-router-dom";
import {
  Activity,
  DownloadCloud,
  FileSignature,
  LayoutDashboard,
  Loader2,
  Search,
  ShieldCheck,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useServices } from "@/application/services/hooks";
import { useAppUpdate } from "@/application/update/hooks";
import { cn } from "@/shared/lib/utils";

const APP_VERSION = "v0.1.0";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Genel Bakış", icon: LayoutDashboard, end: true },
  { to: "/sign", label: "İmzala", icon: FileSignature },
  { to: "/verify", label: "Doğrula", icon: ShieldCheck },
  { to: "/diagnostics", label: "Tanılama", icon: Activity },
];

function StatusPill() {
  const { data } = useServices();
  const total = data?.length ?? 0;
  const running = data?.filter((s) => s.state === "running").length ?? 0;

  const tone =
    total > 0 && running === total
      ? "text-status-running"
      : running > 0
        ? "text-[rgb(var(--tone-warning-fg))]"
        : "text-fg-dim";
  const dot =
    total > 0 && running === total
      ? "bg-status-running"
      : running > 0
        ? "bg-status-starting"
        : "bg-fg-dim";
  const label =
    total === 0
      ? "Servisler bekleniyor"
      : running === total
        ? "Tüm servisler çalışıyor"
        : running > 0
          ? `${running}/${total} servis`
          : "Servisler durduruldu";

  return (
    <div className="hidden items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2.5 py-1 text-[11.5px] font-medium md:flex">
      <span className="relative flex h-2 w-2">
        {running > 0 ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              dot,
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
      </span>
      <span className={cn("whitespace-nowrap", tone)}>{label}</span>
    </div>
  );
}

/** Yalnızca yeni bir uygulama sürümü mevcutsa görünen güncelle butonu. */
function UpdateButton() {
  const { info, install } = useAppUpdate();
  if (!info?.available) return null;

  const handleUpdate = () => {
    toast.info("Güncelleme indiriliyor…");
    install.mutate(undefined, {
      onError: (e) =>
        toast.error(`Güncelleme başarısız: ${(e as Error).message}`),
    });
  };

  return (
    <button
      type="button"
      onClick={handleUpdate}
      disabled={install.isPending}
      title={`Sürüm ${info.version} hazır — güncellemek için tıkla`}
      className="flex items-center gap-1.5 rounded-md border border-status-running/30 bg-status-running/10 px-2 py-1 text-[11.5px] font-medium text-status-running transition-colors hover:bg-status-running/15 disabled:opacity-70"
    >
      {install.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <DownloadCloud className="h-3.5 w-3.5" />
      )}
      <span className="hidden whitespace-nowrap sm:inline">
        {install.isPending ? "Güncelleniyor…" : `Güncelle ${info.version}`}
      </span>
    </button>
  );
}

export function TopBar() {
  return (
    <header
      data-tauri-drag-region
      className="app-chrome flex h-12 shrink-0 items-stretch gap-1 border-b border-border pr-3 pl-[78px]"
    >
      {/* Marka */}
      <div className="flex shrink-0 items-center gap-2 pr-3">
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-primary text-[11px] font-bold text-primary-foreground">
          M
        </span>
        <span className="hidden whitespace-nowrap text-[13px] font-semibold text-fg lg:inline">
          Mersel DSS
        </span>
      </div>

      <span aria-hidden className="my-2.5 w-px shrink-0 bg-border" />

      {/* Yatay gezinme — aktif öğe alt-çizgi göstergesiyle */}
      <nav className="flex items-stretch gap-0.5 overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-2 whitespace-nowrap px-3 text-[13px] font-medium transition-colors duration-150",
                isActive ? "text-fg" : "text-fg-muted hover:text-fg",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-[15px] w-[15px] shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-fg-dim group-hover:text-fg-muted",
                  )}
                />
                {item.label}
                {isActive ? (
                  <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-primary" />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Sağ: arama · durum · sürüm */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="hidden items-center gap-2 rounded-md border border-border bg-surface-muted py-1 pr-1.5 pl-2.5 text-[12px] text-fg-dim transition-colors hover:border-border-strong hover:text-fg-muted sm:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Ara…</span>
          <kbd className="rounded-sm border border-border bg-surface-raised px-1 py-px font-sans text-[10px] font-medium text-fg-dim">
            ⌘K
          </kbd>
        </button>

        <StatusPill />

        <UpdateButton />

        <span className="flex items-center gap-1 rounded-sm bg-brand-soft px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand-hover">
          <Tag className="h-2.5 w-2.5" />
          {APP_VERSION}
        </span>
      </div>
    </header>
  );
}

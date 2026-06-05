/**
 * Sol kaynak listesi (macOS source-list). Üstte trafik-ışığı bölgesini
 * boşaltan sürüklenebilir marka başlığı, ortada gezinme, altta global servis
 * durumu. Yatay üst-menü yerine bu kullanılır; uygulamaya yerel masaüstü
 * hissini veren ana yapı taşıdır.
 */

import { NavLink } from "react-router-dom";
import {
  Activity,
  FileSignature,
  LayoutDashboard,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useServices } from "@/application/services/hooks";
import { cn } from "@/shared/lib/utils";

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

function SidebarStatus() {
  const { data } = useServices();
  const total = data?.length ?? 0;
  const running = data?.filter((s) => s.state === "running").length ?? 0;

  const tone =
    total > 0 && running === total
      ? { dot: "bg-status-running", text: "text-status-running" }
      : running > 0
        ? { dot: "bg-status-starting", text: "text-[rgb(var(--tone-warning-fg))]" }
        : { dot: "bg-fg-dim", text: "text-fg-dim" };

  const label =
    total === 0
      ? "Servisler bekleniyor"
      : running === total
        ? "Tüm servisler çalışıyor"
        : running > 0
          ? `${running}/${total} servis çalışıyor`
          : "Servisler durduruldu";

  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] font-medium text-fg-muted">
      <span className="relative flex h-2 w-2 shrink-0">
        {running > 0 ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              tone.dot,
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", tone.dot)} />
      </span>
      <span className={cn("truncate", tone.text)}>{label}</span>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="app-chrome flex w-[212px] shrink-0 flex-col border-r border-border/70">
      {/* Trafik-ışığı bölgesini boşaltan sürüklenebilir marka başlığı */}
      <div
        data-tauri-drag-region
        className="flex h-11 shrink-0 items-center gap-2 pr-3 pl-[78px]"
      >
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] bg-gradient-to-br from-[rgb(var(--accent))] to-[rgb(var(--accent-hover))] text-[10px] font-bold text-primary-foreground shadow-brand">
          M
        </span>
        <span className="truncate text-[12.5px] font-semibold text-fg">
          Mersel DSS
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pt-1.5">
        <p className="px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-dim">
          Çalışma alanı
        </p>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-fg-muted hover:bg-surface-muted/80 hover:text-fg",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-[16px] w-[16px] shrink-0 transition-colors",
                    isActive
                      ? "text-primary-foreground"
                      : "text-fg-dim group-hover:text-fg-muted",
                  )}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border/60 px-2.5 py-2">
        <SidebarStatus />
      </div>
    </aside>
  );
}

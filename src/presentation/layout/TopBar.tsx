/**
 * Birleşik üst uygulama çubuğu (single app bar): solda trafik-ışığı boşluğu +
 * marka, ortada yatay gezinme (aktif öğe alt-çizgi göstergesiyle), sağda yalnız
 * (gerekiyorsa) güncelleme butonu. Tamamı sürüklenebilir pencere taşıma bölgesi.
 */

import { NavLink } from "react-router-dom";
import {
  Activity,
  CreditCard,
  DownloadCloud,
  FileSignature,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/shared/lib/errors";
import { useAppUpdate } from "@/application/update/hooks";
import { MerselWordmark } from "@/presentation/components/brand/MerselLogo";
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
];

/** Sağa yaslanan ikincil gezinme öğeleri. */
const SECONDARY_NAV_ITEMS: NavItem[] = [
  { to: "/virtual-cards", label: "Sanal Kartlar", icon: CreditCard },
  { to: "/diagnostics", label: "Tanılama", icon: Activity },
];

function NavLinks({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map((item) => (
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
    </>
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
        toast.error(`Güncelleme başarısız: ${errorMessage(e)}`),
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
      className="app-chrome flex h-11 shrink-0 items-stretch gap-1 border-b border-border pr-3 pl-[78px]"
    >
      {/* Marka — resmî mersel logosu + İmzamatik */}
      <div className="flex shrink-0 items-center pr-3">
        <MerselWordmark height={17} suffixClassName="hidden lg:inline" />
      </div>

      <span aria-hidden className="my-2.5 w-px shrink-0 bg-border" />

      {/* Birincil yatay gezinme — aktif öğe alt-çizgi göstergesiyle */}
      <nav className="flex items-stretch gap-0.5 overflow-x-auto">
        <NavLinks items={NAV_ITEMS} />
      </nav>

      {/* İkincil gezinme — sağa yaslı */}
      <nav className="ml-auto flex items-stretch gap-0.5 overflow-x-auto">
        <NavLinks items={SECONDARY_NAV_ITEMS} />
      </nav>

      {/* Sağ: yalnızca güncelleme mevcutsa görünür */}
      <div className="flex shrink-0 items-center pl-1">
        <UpdateButton />
      </div>
    </header>
  );
}

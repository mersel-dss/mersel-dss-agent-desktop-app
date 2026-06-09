/**
 * Birleşik üst uygulama çubuğu (single app bar): solda trafik-ışığı boşluğu +
 * marka, ortada yatay gezinme (aktif öğe alt-çizgi göstergesiyle), sağda yalnız
 * (gerekiyorsa) güncelleme butonu. Tamamı sürüklenebilir pencere taşıma bölgesi.
 */

import { NavLink } from "react-router-dom";
import {
  Activity,
  Clock,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { MerselWordmark } from "@/presentation/components/brand/MerselLogo";
import { WindowControls } from "@/presentation/layout/WindowControls";
import { IS_WINDOWS } from "@/shared/lib/platform";
import { cn } from "@/shared/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Genel Bakış", icon: LayoutDashboard, end: true },
  { to: "/sign", label: "Döküman İmzala", icon: FileSignature },
  { to: "/timestamp", label: "Zaman Damgası Al", icon: Clock },
];

/** Oluşturma akışlarından ayrılan doğrulama grubu. */
const VERIFY_NAV_ITEMS: NavItem[] = [
  { to: "/verify", label: "Doğrula", icon: ShieldCheck },
];

/** Sağa yaslanan ikincil gezinme öğeleri. */
const SECONDARY_NAV_ITEMS: NavItem[] = [
  { to: "/virtual-cards", label: "Sanal Kartlar", icon: CreditCard },
  { to: "/diagnostics", label: "Tanılama", icon: Activity },
  { to: "/settings", label: "Ayarlar", icon: Settings2 },
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

export function TopBar() {
  return (
    <header
      data-tauri-drag-region
      className={cn(
        "app-chrome flex h-11 shrink-0 items-stretch gap-1 border-b border-border",
        // macOS: solda trafik-ışığı boşluğu. Windows: çerçevesiz pencerede sol
        // boşluk gerekmez; pencere kontrolleri sağda (aşağıda) yer alır.
        IS_WINDOWS ? "pl-3 pr-0" : "pr-3 pl-[78px]",
      )}
    >
      {/* Marka — resmî mersel logosu + İmzamatik */}
      <div className="flex shrink-0 items-center pr-3">
        <MerselWordmark height={17} suffixClassName="hidden lg:inline" />
      </div>

      <span aria-hidden className="my-2.5 w-px shrink-0 bg-border" />

      {/* Birincil yatay gezinme — oluşturma akışları + divider ile ayrılan doğrulama */}
      <nav className="flex items-stretch gap-0.5 overflow-x-auto">
        <NavLinks items={NAV_ITEMS} />
        <span aria-hidden className="my-2.5 mx-1.5 w-px shrink-0 bg-border" />
        <NavLinks items={VERIFY_NAV_ITEMS} />
      </nav>

      {/* İkincil gezinme — sağa yaslı */}
      <nav className="ml-auto flex items-stretch gap-0.5 overflow-x-auto">
        <NavLinks items={SECONDARY_NAV_ITEMS} />
      </nav>

      {/* Windows: çerçevesiz pencere için özel min/maks/kapat kontrolleri. */}
      {IS_WINDOWS ? (
        <div className="ml-1 flex items-stretch">
          <WindowControls />
        </div>
      ) : null}
    </header>
  );
}

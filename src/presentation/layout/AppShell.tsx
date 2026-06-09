/**
 * Ana uygulama kabuğu — birleşik üst çubuk (TopBar) düzeni:
 * üstte marka + yatay menü + arama/durum/sürüm, altında sınırlı yükseklikli
 * içerik alanı. İçerik kendi kaydırmasını yönetir (sayfa boyu scroll yok).
 */

import { Outlet } from "react-router-dom";
import { useServiceUpdates } from "@/application/services/useServiceUpdates";
import { BootSplash } from "./BootSplash";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { UpdateBanner } from "./UpdateBanner";

export function AppShell() {
  // Arka plan jar güncellemelerini dinle (toast + sorgu tazeleme).
  useServiceUpdates();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden text-foreground">
      <TopBar />
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
      <StatusBar />
      <BootSplash />

      {/* Uygulama güncellemesi — sağ-alt köşede profesyonel bildirim + ilerleme */}
      <UpdateBanner />
    </div>
  );
}

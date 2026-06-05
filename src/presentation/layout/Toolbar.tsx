/**
 * Birleşik araç çubuğu (macOS unified toolbar). Aktif rotanın başlığını taşır
 * ve tamamı sürüklenebilir (pencere taşıma bölgesi).
 */

import { useLocation } from "react-router-dom";

interface RouteMeta {
  title: string;
  subtitle: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  "/": { title: "Genel Bakış", subtitle: "Servisler ve çalışma zamanı" },
  "/sign": { title: "İmzala", subtitle: "PDF & XML belge imzalama" },
  "/verify": {
    title: "Doğrula",
    subtitle: "İmza ve zaman damgası geçerliliği",
  },
  "/diagnostics": { title: "Tanılama", subtitle: "İzler, prob ve destek paketi" },
};

export function Toolbar() {
  const { pathname } = useLocation();
  const meta = ROUTE_META[pathname] ?? ROUTE_META["/"];

  return (
    <header
      data-tauri-drag-region
      className="app-chrome flex h-12 shrink-0 items-center gap-2 border-b border-border/70 px-4"
    >
      <h1 className="shrink-0 text-[13.5px] font-semibold leading-none text-fg">
        {meta.title}
      </h1>
      <span className="text-border-strong">·</span>
      <p className="truncate text-[12px] leading-none text-fg-dim">
        {meta.subtitle}
      </p>
    </header>
  );
}

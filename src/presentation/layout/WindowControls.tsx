/**
 * Windows (çerçevesiz pencere) için özel başlık-çubuğu kontrolleri:
 * simge durumuna küçült / büyüt-geri al / kapat. macOS'ta yerel trafik
 * ışıkları kullanıldığından bu bileşen yalnızca Windows'ta render edilir.
 */

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void win.isMaximized().then(setMaximized);
    void win
      .onResized(() => {
        void win.isMaximized().then(setMaximized);
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  const win = getCurrentWindow();

  return (
    // Sürükleme bölgesinden hariç tut (data-tauri-drag-region YOK) ki tıklamalar
    // pencereyi taşımaya değil düğmelere gitsin.
    <div className="flex items-stretch">
      <button
        type="button"
        aria-label="Simge durumuna küçült"
        onClick={() => void win.minimize()}
        className="flex w-11 items-center justify-center text-fg-muted transition-colors hover:bg-surface-muted/70 hover:text-fg"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={maximized ? "Geri al" : "Büyüt"}
        onClick={() => void win.toggleMaximize()}
        className="flex w-11 items-center justify-center text-fg-muted transition-colors hover:bg-surface-muted/70 hover:text-fg"
      >
        <Square className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Kapat"
        onClick={() => void win.close()}
        className="flex w-11 items-center justify-center text-fg-muted transition-colors hover:bg-[rgb(232_17_35)] hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

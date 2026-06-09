/**
 * Uygulama güncelleme use-case hook'ları (react-query).
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { container } from "@/app/container";

export const updateKeys = {
  check: ["app-update"] as const,
};

export interface UpdateProgress {
  downloaded: number;
  /** Toplam boyut (sunucu Content-Length verdiyse); yoksa belirsiz. */
  total: number | null;
}

/**
 * Açılışta ve periyodik olarak (saatte bir) güncelleme kontrolü yapar; ayrıca
 * indirme/kurulum ilerlemesini izler (UI'da görünür ilerleme çubuğu için).
 * Updater yapılandırılmamışsa gateway güvenle `available:false` döndüğü için
 * sorgu hata vermez.
 */
export function useAppUpdate() {
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  const query = useQuery({
    queryKey: updateKeys.check,
    queryFn: () => container.updater.check(),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: false,
  });

  const install = useMutation({
    mutationFn: async () => {
      setProgress({ downloaded: 0, total: null });
      // KRİTİK (Windows): Kurulumdan ÖNCE tüm Java servislerini durdur. Aksi
      // hâlde çalışan süreçler `jre/bin/java.dll`'i kilitli tutar ve NSIS
      // installer "Error opening file for writing" verip dosyanın üzerine
      // yazamaz. Komut, süreçler ölüp dosya kilitleri serbest kalana kadar
      // bekler. Hata olsa bile indirmeyi engellemeyelim (best-effort).
      try {
        await container.services.stopAllServices();
      } catch {
        // yoksay — installer yine de denesin
      }
      await container.updater.downloadAndInstall((downloaded, total) => {
        setProgress({ downloaded, total });
      });
      // İndirme bitti, uygulama yeniden başlatılacak.
      await container.updater.relaunch();
    },
  });

  return { info: query.data, query, install, progress };
}

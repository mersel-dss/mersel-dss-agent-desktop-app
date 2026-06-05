/**
 * Uygulama güncelleme use-case hook'ları (react-query).
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { container } from "@/app/container";

export const updateKeys = {
  check: ["app-update"] as const,
};

/**
 * Açılışta ve periyodik olarak (saatte bir) güncelleme kontrolü yapar.
 * Updater yapılandırılmamışsa gateway güvenle `available:false` döndüğü için
 * sorgu hata vermez.
 */
export function useAppUpdate() {
  const query = useQuery({
    queryKey: updateKeys.check,
    queryFn: () => container.updater.check(),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: false,
  });

  const install = useMutation({
    mutationFn: async () => {
      await container.updater.downloadAndInstall();
      await container.updater.relaunch();
    },
  });

  return { info: query.data, query, install };
}

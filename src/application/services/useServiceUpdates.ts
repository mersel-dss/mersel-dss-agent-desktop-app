/**
 * Arka plan jar güncelleyicisinin `service-updated` olaylarını dinler:
 * kullanıcıyı bilgilendirir ve ilgili sorguları (servis durumu + son sürüm)
 * tazeleyerek UI'ın güncel sürümü yansıtmasını sağlar.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { onServiceUpdated } from "@/infrastructure/events/downloadProgress";
import { serviceKeys } from "@/application/services/hooks";
import { SERVICE_META } from "@/shared/config/services";

export function useServiceUpdates(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const unlistenPromise = onServiceUpdated((event) => {
      const name = SERVICE_META[event.kind]?.shortName ?? event.kind;
      const version = event.tag ? ` (${event.tag})` : "";
      toast.success(
        event.restarted
          ? `${name} güncellendi${version} ve yeniden başlatıldı`
          : `${name} için yeni sürüm indirildi${version}`,
      );
      void qc.invalidateQueries({ queryKey: serviceKeys.list });
      void qc.invalidateQueries({ queryKey: serviceKeys.release(event.kind) });
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [qc]);
}

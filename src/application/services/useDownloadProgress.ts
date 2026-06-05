/**
 * `download-progress` event'lerini servis bazında state'e toplar.
 */

import { useEffect, useState } from "react";
import { onDownloadProgress } from "@/infrastructure/events/downloadProgress";
import type { DownloadProgress, ServiceKind } from "@/domain/services/types";

export type ProgressMap = Partial<Record<ServiceKind, DownloadProgress>>;

export function useDownloadProgress(): ProgressMap {
  const [progress, setProgress] = useState<ProgressMap>({});

  useEffect(() => {
    const unlistenPromise = onDownloadProgress((event) => {
      setProgress((prev) => ({ ...prev, [event.kind]: event }));
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return progress;
}

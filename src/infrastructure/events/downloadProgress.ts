/**
 * Rust'tan yayınlanan `download-progress` event'ine abone olur.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DownloadProgress,
  ServiceUpdatedEvent,
} from "@/domain/services/types";

export function onDownloadProgress(
  handler: (progress: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<DownloadProgress>("download-progress", (event) => {
    handler(event.payload);
  });
}

/** Arka plan güncelleyici bir servis jar'ını güncellediğinde tetiklenir. */
export function onServiceUpdated(
  handler: (event: ServiceUpdatedEvent) => void,
): Promise<UnlistenFn> {
  return listen<ServiceUpdatedEvent>("service-updated", (event) => {
    handler(event.payload);
  });
}

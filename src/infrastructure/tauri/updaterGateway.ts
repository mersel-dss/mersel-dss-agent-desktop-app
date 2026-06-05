/**
 * `UpdaterGateway` portunun Tauri updater/process plugin gerçeklemesi.
 *
 * `check()` bir güncelleme bulursa `Update` nesnesi örnek içinde tutulur; böylece
 * `downloadAndInstall()` tekrar ağ sorgusu yapmadan aynı güncellemeyi kurar.
 * Updater yapılandırılmamışsa (örn. dev modunda) `check()` sessizce
 * `available:false` döner — uygulama akışı bozulmaz.
 */

import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import type { AppUpdateInfo, UpdaterGateway } from "@/domain/update/ports";

export class TauriUpdaterGateway implements UpdaterGateway {
  private pending: Update | null = null;

  async check(): Promise<AppUpdateInfo> {
    const currentVersion = await getVersion().catch(() => "0.0.0");

    let update: Update | null = null;
    try {
      update = await check();
    } catch {
      // Updater endpoint'i/yapılandırması yoksa güncelleme yok say.
      update = null;
    }
    this.pending = update;

    if (!update) {
      return {
        available: false,
        version: null,
        currentVersion,
        notes: null,
        date: null,
      };
    }

    return {
      available: true,
      version: update.version,
      currentVersion,
      notes: update.body ?? null,
      date: update.date ?? null,
    };
  }

  async downloadAndInstall(
    onProgress?: (downloaded: number, total: number | null) => void,
  ): Promise<void> {
    if (!this.pending) {
      this.pending = await check();
    }
    if (!this.pending) {
      throw new Error("Kurulacak bir güncelleme bulunamadı.");
    }

    let total: number | null = null;
    let downloaded = 0;
    await this.pending.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? null;
          onProgress?.(0, total);
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          onProgress?.(downloaded, total);
          break;
        case "Finished":
          onProgress?.(total ?? downloaded, total);
          break;
      }
    });
  }

  async relaunch(): Promise<void> {
    await relaunch();
  }
}

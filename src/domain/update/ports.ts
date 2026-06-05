/**
 * Uygulama güncelleyici (self-update) port arayüzü.
 * Infrastructure katmanı bunu Tauri updater/process plugin'leriyle gerçekler.
 */

export interface AppUpdateInfo {
  /** Yeni bir sürüm mevcut mu? */
  available: boolean;
  /** Sunucudaki yeni sürüm (varsa). */
  version: string | null;
  /** Çalışan uygulamanın mevcut sürümü. */
  currentVersion: string;
  /** Sürüm notları (varsa). */
  notes: string | null;
  /** Yayın tarihi (varsa). */
  date: string | null;
}

export interface UpdaterGateway {
  /** Güncelleme olup olmadığını kontrol eder. Yapılandırma yoksa güvenle `available:false` döner. */
  check(): Promise<AppUpdateInfo>;
  /** Bekleyen güncellemeyi indirip kurar; ilerleme `onProgress` ile bildirilir. */
  downloadAndInstall(
    onProgress?: (downloaded: number, total: number | null) => void,
  ): Promise<void>;
  /** Uygulamayı yeniden başlatır (kurulum sonrası). */
  relaunch(): Promise<void>;
}

/**
 * Servis runtime port arayüzü (hexagonal architecture).
 * Infrastructure katmanı bu sözleşmeyi Tauri komutlarıyla gerçekler.
 */

import type {
  JavaInfo,
  JavaRuntimeInfo,
  ReleaseInfo,
  ServiceKind,
  ServiceSnapshot,
} from "./types";

export interface ServiceGateway {
  /** Makinedeki Java runtime'ı tespit eder. */
  detectJava(): Promise<JavaInfo>;
  /** Servislerin gerektirdiği her Java sürümü için runtime durumunu döner. */
  detectJavaRuntimes(): Promise<JavaRuntimeInfo[]>;
  /** Tüm servislerin anlık durumunu döner. */
  listServices(): Promise<ServiceSnapshot[]>;
  /** Servisi sessiz (headless) modda başlatır, process pid döner. */
  startService(kind: ServiceKind): Promise<number>;
  /** Servisi durdurur. */
  stopService(kind: ServiceKind): Promise<void>;
  /** GitHub'daki en güncel release bilgisini döner. */
  latestRelease(kind: ServiceKind): Promise<ReleaseInfo>;
  /** En güncel jar'ı indirip kurar; kurulan jar yolunu döner. */
  installService(kind: ServiceKind): Promise<string>;
  /**
   * Servisi en güncel sürüme getirir: gerekiyorsa indirir ve çalışıyorsa yeni
   * sürümle yeniden başlatır. Güncelleme uygulandıysa `true` döner.
   */
  updateService(kind: ServiceKind): Promise<boolean>;
  /** Servis başlatma sürecinin stdout/stderr log çıktısını döner. */
  readLaunchLogs(kind: ServiceKind, lines?: number): Promise<string>;
}

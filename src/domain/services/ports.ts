/**
 * Servis runtime port arayüzü (hexagonal architecture).
 * Infrastructure katmanı bu sözleşmeyi Tauri komutlarıyla gerçekler.
 */

import type {
  JavaInfo,
  ReleaseInfo,
  ServiceKind,
  ServiceSnapshot,
} from "./types";

export interface ServiceGateway {
  /** Makinedeki Java runtime'ı tespit eder. */
  detectJava(): Promise<JavaInfo>;
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
}

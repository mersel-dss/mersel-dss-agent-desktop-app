/**
 * Servis runtime domain tipleri. Rust `models.rs` ile birebir eşleşir.
 */

export type ServiceKind = "agent" | "verifier";

export type ServiceState =
  | "not-installed"
  | "stopped"
  | "starting"
  | "running"
  | "crashed";

export interface ServiceSnapshot {
  kind: ServiceKind;
  displayName: string;
  state: ServiceState;
  baseUrl: string;
  port: number;
  jarPath: string | null;
  /** Kurulu jar'ın sürüm etiketi (release tag), biliniyorsa. */
  installedTag: string | null;
  pid: number | null;
  /** Servis pencereli (görünür) modda mı çalışıyor? (Yalnız agent için anlamlı.) */
  uiVisible: boolean;
  /** Uygulama dışında (örn. terminalden) başlatıldı; uygulama durduramaz. */
  externallyManaged: boolean;
  lastError: string | null;
}

/** Java çalıştırılabilirinin nereden çözüldüğü. */
export type JavaSource = "bundled" | "java-home" | "path";

export interface JavaInfo {
  available: boolean;
  executable: string | null;
  version: string | null;
  major: number | null;
  /** Çözümlemenin kaynağı (paketlenmiş JRE / JAVA_HOME / PATH). */
  source: JavaSource | null;
  /** Uygulamayla paketlenmiş gömülü JRE mi kullanılıyor? */
  bundled: boolean;
}

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
}

export interface ReleaseInfo {
  tag: string;
  name: string | null;
  publishedAt: string | null;
  jarAsset: ReleaseAsset | null;
}

export interface DownloadProgress {
  kind: ServiceKind;
  downloaded: number;
  total: number | null;
  done: boolean;
}

/** Arka planda bir servis jar'ı güncellendiğinde yayınlanan olay. */
export interface ServiceUpdatedEvent {
  kind: ServiceKind;
  /** Yeni kurulan sürüm etiketi (varsa). */
  tag: string | null;
  /** Güncelleme uygulanırken servis yeniden başlatıldı mı? */
  restarted: boolean;
}

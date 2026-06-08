/**
 * Servis runtime domain tipleri. Rust `models.rs` ile birebir eşleşir.
 */

export type ServiceKind = "agent" | "verifier" | "xslt" | "html-to-pdf";

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

/**
 * Servislerin gerektirdiği belirli bir Java sürümü için çözülen runtime durumu.
 * Dashboard'da her gerekli sürüm (örn. Java 8, Java 21) ayrı satır gösterir.
 */
export interface JavaRuntimeInfo {
  /** Bu yuvanın gerektirdiği minimum Java major sürümü (örn. 8, 21). */
  requiredMajor: number;
  /** Kısa etiket (örn. "Java 21"). */
  label: string;
  /** Bu runtime'ı kullanan servis(ler). */
  purpose: string;
  /** Gereksinimi karşılayan bir runtime bulundu mu? */
  available: boolean;
  /** Çözülen runtime'ın tam sürümü (varsa). */
  version: string | null;
  /** Çözülen runtime'ın major sürümü (varsa). */
  major: number | null;
  /** Kaynak (paketlenmiş JRE / JAVA_HOME / PATH). */
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
  packageAsset: ReleaseAsset | null;
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

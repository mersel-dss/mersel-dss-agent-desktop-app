/**
 * Sürüm notları (changelog) domain tipleri. Backend `list_app_releases`
 * komutunun döndüğü GitHub release şemasını yansıtır.
 */

export interface ChangelogEntry {
  /** Sürüm etiketi (örn. `v0.2.0`). */
  tag: string;
  /** Release başlığı (varsa). */
  name?: string | null;
  /** Markdown gövdesi (sürüm notları). */
  body?: string | null;
  /** Yayın tarihi (ISO-8601). */
  publishedAt?: string | null;
  /** GitHub'daki release sayfası. */
  htmlUrl?: string | null;
  /** Ön sürüm (pre-release) mi? */
  prerelease: boolean;
  /** Taslak mı? (Backend taslakları eler; alan tamlık için tutulur.) */
  draft: boolean;
}

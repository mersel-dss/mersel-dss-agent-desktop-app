/**
 * Zaman damgası (RFC 3161) domain tipleri. İmza ajanının `/timestamp/*` ve
 * `/tubitak/*` uçlarının kontratını yansıtır. Kimlik bilgileri her istekte
 * parametre olarak gönderilir; ajan hiçbir kimlik saklamaz.
 */

/** Agent'ın desteklediği özet (hash) algoritmaları. */
export type TimestampHashAlgorithm =
  | "SHA1"
  | "SHA224"
  | "SHA256"
  | "SHA384"
  | "SHA512";

export const TIMESTAMP_HASH_ALGORITHMS: TimestampHashAlgorithm[] = [
  "SHA256",
  "SHA384",
  "SHA512",
  "SHA224",
  "SHA1",
];

/**
 * TSA protokol tercihi:
 * - `tubitak`: TÜBİTAK ESYA protokolü.
 * - `standard`: standart RFC 3161 TSA (TÜBİTAK değil).
 *
 * Sağlayıcı eklerken bu değer TSA adresinden otomatik türetilir (KamuSM
 * host'larında `tubitak`), ancak kullanıcı isterse elle değiştirebilir.
 */
export type TsaProtocol = "tubitak" | "standard";

/** `TsaProtocol` → ajan'ın beklediği `tubitak` boolean'ı. */
export function tubitakFlag(protocol: TsaProtocol): boolean {
  return protocol === "tubitak";
}

/** Bir TSA adresinin host'unu çözer (şema yoksa http varsayılır). */
function tsaHost(tsaUrl: string): string {
  const trimmed = tsaUrl.trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  try {
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * TSA adresine göre protokolü türetir. KamuSM / TÜBİTAK host'ları
 * (örn. `zd.kamusm.gov.tr`, `tzd.kamusm.gov.tr`) → `tubitak`, aksi hâlde
 * `standard`.
 */
export function detectProtocol(tsaUrl: string): TsaProtocol {
  return /(^|\.)kamusm\.gov\.tr$/.test(tsaHost(tsaUrl)) ? "tubitak" : "standard";
}

/** Zaman damgası alma isteği (ajan `/timestamp/get`). */
export interface CreateTimestampRequest {
  documentPath: string;
  hashAlgorithm: TimestampHashAlgorithm;
  tsaUrl: string;
  tsUserId?: string;
  tsUserPassword?: string;
  /** `undefined` → host'tan otomatik tespit. */
  tubitak?: boolean;
  certReq?: boolean;
  useNonce?: boolean;
  /** Verilmezse token geçici dosyaya yazılır; kayıt yeri sonradan sorulur. */
  outputPath?: string;
}

/** Zaman damgası alma sonucu — token geçici dosyaya yazılır, metadata döner. */
export interface TimestampCreationResult {
  /** Token'ın yazıldığı geçici `.tst` dosyası yolu. */
  tempPath: string;
  timestamp?: string;
  tsaName?: string;
  serialNumber?: string;
  hashAlgorithm?: string;
  nonce?: string;
}

/** TÜBİTAK kontör sorgulama isteği. */
export interface TubitakCreditRequest {
  tsaUrl: string;
  tsUserId: string;
  tsUserPassword: string;
  tubitak?: boolean;
}

/** TÜBİTAK kontör sorgulama yanıtı. */
export interface TubitakCreditResult {
  remainingCredit?: number;
  customerId?: number;
  message?: string;
}

/** Zaman damgası özelliği durum bilgisi (ajan `/timestamp/status`). */
export interface TimestampStatus {
  available: boolean;
  credentialSource?: string;
  message?: string;
}

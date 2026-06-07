/**
 * Doğrulama domain tipleri. `mersel-dss-verifier-api-java` servisinin döndüğü
 * JSON şemasını (VerificationResult / SignatureInfo / CertificateInfo …)
 * birebir yansıtır. Tüm alanlar opsiyonel: servis `@JsonInclude(NON_NULL)`
 * ile boş alanları yanıttan çıkarır, ayrıca SIMPLE/COMPREHENSIVE moduna göre
 * dolu alanlar değişir.
 */

export type VerificationLevel = "SIMPLE" | "COMPREHENSIVE";

/** İmza dosya formatı (verifier enum'u). */
export type SignatureType =
  | "PADES"
  | "XADES"
  | "CADES"
  | "ASIC_S"
  | "ASIC_E"
  | "UNKNOWN";

/** XAdES paketleme tipi (W3C XMLDSig terminolojisi). */
export type SignaturePackaging = "ENVELOPED" | "ENVELOPING" | "DETACHED";

/** Sertifika zincirinin iptal (revocation) durum özeti. */
export type ChainRevocationStatus =
  | "ALL_GOOD"
  | "LEAF_REVOKED"
  | "LEAF_GOOD_CA_REVOKED"
  | "UNKNOWN"
  | "NOT_CHECKED";

/** Bir FAIL constraint'in DSS pipeline'ındaki rolü. */
export type FailureCategory = "ROOT_CAUSE" | "DERIVED" | "CASCADE";

/** Bir sertifikanın OCSP/CRL kaynaklı iptal detayı. */
export interface RevocationInfo {
  /** `OCSP` | `CRL`. */
  source?: string;
  /** `GOOD` | `REVOKED` | `UNKNOWN`. */
  status?: string;
  revocationDate?: string;
  revocationReason?: string;
  producedAt?: string;
  thisUpdate?: string;
  nextUpdate?: string;
  responderUrl?: string;
  /** `EXTERNAL` | `CACHED` | `REVOCATION_VALUES` … */
  origin?: string;
}

export interface CertificateInfo {
  subject?: string;
  commonName?: string;
  issuerDN?: string;
  serialNumber?: string;
  subjectSerialNumber?: string;
  notBefore?: string;
  notAfter?: string;
  keyUsage?: string;
  publicKeyAlgorithm?: string;
  publicKeySize?: number;
  signatureAlgorithm?: string;
  trusted?: boolean;
  expired?: boolean;
  valid?: boolean;
  revoked?: boolean;
  revocationReason?: string;
  revocationTime?: string;
  revocationDate?: string;
  revocation?: RevocationInfo;
  [key: string]: unknown;
}

export interface TimestampInfo {
  valid?: boolean;
  timestampTime?: string;
  timestampType?: string;
  tsaCertificate?: CertificateInfo;
  digestAlgorithm?: string;
  messageImprint?: string;
  serialNumber?: string;
  tsaName?: string;
  validationErrors?: string[];
  rootCause?: FailedConstraint;
  failedConstraints?: FailedConstraint[];
  [key: string]: unknown;
}

/** DSS DetailedReport içindeki NOT_OK constraint'in yapısal sunumu. */
export interface FailedConstraint {
  /** DSS i18n bundle anahtarı (örn. `BBB_XCV_ISCGKU`). */
  key?: string;
  /** Locale'e göre (varsayılan Türkçe) insan mesajı. */
  message?: string;
  category?: FailureCategory;
}

/** Adım-adım doğrulama kontrol bayrakları. */
export interface ValidationDetails {
  signatureIntact?: boolean;
  certificateChainValid?: boolean;
  certificateNotExpired?: boolean;
  certificateNotRevoked?: boolean;
  trustAnchorReached?: boolean;
  timestampValid?: boolean;
  cryptographicVerificationSuccessful?: boolean;
  revocationCheckPerformed?: boolean;
  additionalDetails?: Record<string, string>;
}

/** Yasal seviye (QES / AdES-QC / AdES) detayları. */
export interface QualificationDetails {
  /** `QES` | `AdES/QC` | `AdES` | `NA`. */
  qualificationLevel?: string;
  errors?: string[];
  warnings?: string[];
  info?: string[];
}

/** Mersel'in DSS kararını override ettiği (geçersiz → geçerli) durum kaydı. */
export interface AppliedSuppression {
  code?: string;
  title?: string;
  reason?: string;
  /** `INFO` | `WARN` | `CRITICAL`. */
  severity?: string;
  originalIndication?: string;
  originalSubIndication?: string;
  evidence?: Record<string, unknown>;
  docsUrl?: string;
  gateVersion?: string;
  allowedFailureKeys?: string[];
  observedFailureKeys?: string[];
  documentSha256?: string;
  documentSizeBytes?: number;
}

/** Mersel'in DSS reddini Türkiye'ye özgü tanı koduyla zenginleştirdiği kayıt. */
export interface AppliedRejection {
  code?: string;
  title?: string;
  reason?: string;
  /** `ERROR` | `FATAL`. */
  severity?: string;
  originalIndication?: string;
  originalSubIndication?: string;
  evidence?: Record<string, unknown>;
  docsUrl?: string;
}

export interface SignatureInfo {
  signatureId?: string;
  valid?: boolean;
  signatureFormat?: string;
  signatureLevel?: string;
  signaturePackaging?: SignaturePackaging;
  signingTime?: string;
  claimedSigningTime?: string;
  signerCertificate?: CertificateInfo;
  certificateChain?: CertificateInfo[];
  chainRevocationStatus?: ChainRevocationStatus;
  timestampInfo?: TimestampInfo;
  signatureAlgorithm?: string;
  digestAlgorithm?: string;
  validationErrors?: string[];
  rootCause?: FailedConstraint;
  failedConstraints?: FailedConstraint[];
  validationWarnings?: string[];
  /** `TOTAL_PASSED` | `PASSED` | `INDETERMINATE` | `FAILED` | `TOTAL_FAILED`. */
  indication?: string;
  subIndication?: string;
  qualificationDetails?: QualificationDetails;
  timestampCount?: number;
  policyIdentifier?: string;
  validationDetails?: ValidationDetails;
  appliedSuppressions?: AppliedSuppression[];
  appliedRejections?: AppliedRejection[];
  [key: string]: unknown;
}

export interface SignatureVerificationResult {
  valid?: boolean;
  status?: string;
  signatureType?: SignatureType;
  verificationTime?: string;
  signatureCount?: number;
  signatures?: SignatureInfo[];
  errors?: string[];
  warnings?: string[];
  validationDetails?: ValidationDetails;
  [key: string]: unknown;
}

export interface TimestampVerificationResult {
  valid?: boolean;
  status?: string;
  timestampTime?: string;
  tsaName?: string;
  digestAlgorithm?: string;
  messageImprint?: string;
  tsaCertificate?: CertificateInfo;
  errors?: string[];
  warnings?: string[];
  verificationTime?: string;
  [key: string]: unknown;
}

/** İmza doğrulama isteği. */
export interface VerifySignatureRequest {
  signedPath: string;
  originalPath?: string;
  level?: VerificationLevel;
  /** Tüm FAIL constraint'lerini (audit/forensic) iste. */
  includeFailedConstraints?: boolean;
}

/** e-Belge zarfından çıkarılıp doğrulanan tek bir imzalı belgenin sonucu. */
export interface EnvelopeDocumentResult {
  /** Zarf içindeki sıra (0 tabanlı). */
  index: number;
  /** Çevreleyen `Elements` bloğundaki `ElementType` (örn. `INVOICE`), varsa. */
  elementType?: string | null;
  /** Çıkarılan kök elemanın yerel adı (örn. `Invoice`). */
  rootElementName: string;
  /** Belge numarası — UBL kök seviyesindeki `cbc:ID` (varsa). */
  documentId?: string | null;
  /** ETTN — UBL kök seviyesindeki `cbc:UUID` (varsa). */
  uuid?: string | null;
  /** Doğrulama raporu. Doğrulama hata verdiyse `null`. */
  result?: SignatureVerificationResult | null;
  /** Bu belge doğrulanamadıysa hata mesajı. */
  error?: string | null;
}

/** Zarf doğrulamanın birleşik özeti. */
export interface EnvelopeVerificationResult {
  /** Zarf içinde tespit edilen imzalı belge sayısı. */
  documentCount: number;
  /** Geçerli olarak doğrulanan belge sayısı. */
  validCount: number;
  /** Her bir belgenin doğrulama sonucu. */
  documents: EnvelopeDocumentResult[];
}

/** Birleşik doküman doğrulama sonucu: dosya türüne göre zarf ya da tekil imza. */
export interface DocumentVerificationResult {
  /** `envelope`: SBD zarfı otomatik çözüldü · `signature`: tekil imzalı doküman. */
  kind: "envelope" | "signature";
  /** Zarf çözümlemesinin özeti (yalnızca `kind === "envelope"`). */
  envelope?: EnvelopeVerificationResult | null;
  /** Tekil imza doğrulama raporu (yalnızca `kind === "signature"`). */
  signature?: SignatureVerificationResult | null;
  /** Belge numarası — UBL kök seviyesindeki `cbc:ID` (tekil belgede, varsa). */
  documentId?: string | null;
  /** ETTN — UBL kök seviyesindeki `cbc:UUID` (tekil belgede, varsa). */
  uuid?: string | null;
}

/**
 * Doküman doğrulama isteği. Dosya bir e-Belge zarfıysa (StandardBusinessDocument)
 * otomatik tespit edilip içindeki tüm imzalı belgeler doğrulanır; değilse tekil
 * imza doğrulaması yapılır.
 */
export interface VerifyDocumentRequest {
  signedPath: string;
  /** Ayrık (detached) imza için orijinal doküman (tekil imzalarda). */
  originalPath?: string;
  level?: VerificationLevel;
  /** Tüm FAIL constraint'lerini (audit/forensic) iste. */
  includeFailedConstraints?: boolean;
}

/** Zaman damgası doğrulama isteği. */
export interface VerifyTimestampRequest {
  timestampPath: string;
  originalPath?: string;
  validateCertificate?: boolean;
}

/**
 * İmza domain tipleri. Agent servisi dinamik JSON döndüğü için alanlar
 * iyimser (optional) tanımlanır ve sunum katmanında savunmacı okunur.
 */

export type XadesContentType = "XADES_BES" | "COUNTER_SIGNATURE";

export type CertificatePurpose = "SIGNING" | "AUTHENTICATION" | "ENCRYPTION";

/** Bağlı kart okuyucusu / kart bilgisi. */
export interface SmartCard {
  terminalName: string;
  cardPresent?: boolean;
  cardType?: string;
  atr?: string;
  [key: string]: unknown;
}

/** Karttaki bir sertifika. */
export interface Certificate {
  certificateId: string;
  commonName?: string;
  serialNumber?: string;
  /** Sahip seri no — TCKN/VKN (vergi kimlik no). */
  subjectSerialNumber?: string;
  taxId?: string;
  subject?: string;
  issuerDN?: string;
  notBefore?: string;
  notAfter?: string;
  purpose?: string;
  [key: string]: unknown;
}

/** PAdES imza isteği. */
export interface PadesSignRequest {
  contentPath: string;
  terminalName: string;
  certificateId: string;
  pin: string;
  /** Belirtilmezse imza geçici bir dosyaya yazılır; kayıt yolu sonradan sorulur. */
  outputPath?: string;
}

/** XAdES imza isteği. */
export interface XadesSignRequest extends PadesSignRequest {
  contentType: XadesContentType;
}

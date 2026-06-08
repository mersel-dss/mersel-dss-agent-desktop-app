/**
 * e-Belge şema (XSD) + şematron doğrulama domain tipleri. `ebelge-xslt-service`
 * `/v1/validate` (otomatik tespit) uç noktasının sonucunu yansıtır.
 */

/** Tek bir şematron bulgusu (iş kuralı ihlali). */
export interface SchematronFinding {
  /** Kural kimliği (örn. `InvoiceIDCheck`). */
  ruleId?: string | null;
  /** İhlal edilen şematron test ifadesi (XPath). */
  test?: string | null;
  /** İnsan-okunur hata mesajı. */
  message?: string | null;
}

/** Bir belgenin şema + şematron doğrulama raporu. */
export interface ValidationReport {
  /** Servisin otomatik tespit ettiği belge tipi (örn. `INVOICE`). */
  detectedDocumentType?: string | null;
  /** Uygulanan XSD şemasının adı/yolu (bilgi amaçlı). */
  appliedXsd?: string | null;
  /** Uygulanan şematron paketinin adı/yolu (bilgi amaçlı). */
  appliedSchematron?: string | null;
  /** XSD şema doğrulaması geçti mi. */
  validSchema: boolean;
  /** Şematron (iş kuralı) doğrulaması geçti mi. */
  validSchematron: boolean;
  /** XSD şema hataları (serbest metin). */
  schemaErrors: string[];
  /** Şematron kural ihlalleri. */
  schematronErrors: SchematronFinding[];
  /** Doğrulama altyapısı hata verdiyse (örn. tip tespit edilemedi) mesaj. */
  errorMessage?: string | null;
}

/** Doğrulama isteği. */
export interface ValidateDocumentRequest {
  /** Doğrulanacak dosya yolu (imzalı belge ya da e-Belge zarfı). */
  signedPath: string;
  /** Zarf içindeki belge sırası (tekil belgede yok sayılır). */
  index?: number;
}

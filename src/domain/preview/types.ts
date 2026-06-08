/**
 * Önizleme (e-Belge → HTML) domain tipleri. `ebelge-xslt-service` üzerinden
 * dönüştürülen belge çıktısını ve zarf içeriğinin belge başlıklarını yansıtır.
 */

/** Önizleme için tespit edilen kaynak türü. */
export type PreviewKind = "envelope" | "single" | "binary";

/** Zarf içinden (ya da tekil dosyadan) çıkarılan önizlenebilir bir belgenin başlığı. */
export interface PreviewDocumentMeta {
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
}

/** Bir dosyadaki önizlenebilir belgelerin listesi (dönüşüm yapılmadan). */
export interface PreviewOutline {
  /** İçerik HTML olarak önizlenebilir mi? (PDF gibi ikili içerikte `false`.) */
  previewable: boolean;
  kind: PreviewKind;
  documents: PreviewDocumentMeta[];
}

/** Tek bir belgenin XSLT dönüşüm sonucu. */
export interface PreviewResult {
  /** Dönüştürülmüş HTML belgesi. */
  html: string;
  /** Belgenin kendi gömülü XSLT tasarımı kullanıldı mı. */
  embeddedUsed: boolean;
  /** Varsayılan (bundled) XSLT şablonu kullanıldı mı. */
  defaultUsed: boolean;
  /** Gömülü/özel XSLT başarısız olup varsayılana düşüldüyse hata mesajı. */
  customError?: string | null;
  /** İşlem süresi (ms), servis bildiriyorsa. */
  durationMs?: number | null;
}

/** Önizleme isteği. */
export interface PreviewDocumentRequest {
  /** Önizlenecek dosya yolu (imzalı belge ya da e-Belge zarfı). */
  signedPath: string;
  /** Zarf içindeki belge sırası (tekil belgede yok sayılır). */
  index?: number;
  /** XSLT dönüşüm tipi; verilmezse belge türünden çıkarılır. */
  transformType?: string;
  /** Belgenin kendi gömülü XSLT tasarımını kullan (varsayılan: true). */
  useEmbeddedXslt?: boolean;
}

/**
 * Önizleme port arayüzü.
 */

import type {
  PreviewDocumentRequest,
  PreviewOutline,
  PreviewResult,
} from "./types";

export interface PreviewGateway {
  /**
   * Dosyadaki önizlenebilir belgeleri listeler. e-Belge zarfı (SBD) otomatik
   * tespit edilip içindeki tüm belgelerin başlıkları çıkarılır. XSLT servisini
   * çağırmaz (dönüşüm yapmaz).
   */
  listDocuments(signedPath: string): Promise<PreviewOutline>;
  /** Belirli bir belgeyi XSLT servisi ile HTML'e dönüştürür. */
  previewDocument(request: PreviewDocumentRequest): Promise<PreviewResult>;
  /**
   * Belirli bir belgenin ham XML kaynağını UTF-8 metin olarak döner. Zarfsa
   * (SBD) `index`'teki belge çıkarılır; tekil dosyada içeriğin tamamı döner.
   * XSLT servisini çağırmaz (salt-okunur kaynak görüntüleyici içindir).
   */
  readDocumentSource(signedPath: string, index?: number): Promise<string>;
  /**
   * Dosyanın ham baytlarını döner. PAdES/PDF gibi ikili belgeleri uygulama
   * içinde gömülü PDF görüntüleyiciyle önizlemek için kullanılır.
   */
  readFileBytes(signedPath: string): Promise<ArrayBuffer>;
  /**
   * Dönüştürülmüş HTML'i geçici bir dosyaya yazıp sistemin varsayılan
   * tarayıcısında açar. Native yazdırma/PDF kullanılamadığında geri-dönüş
   * (fallback) olarak kullanılır. Yazılan geçici dosyanın yolunu döner.
   */
  openInBrowser(html: string, fileName: string): Promise<string>;
  /**
   * Belgeyi ayrı bir webview penceresinde açıp native yazdır panelini tetikler
   * (uygulama içinde, tüm platformlarda). macOS panelinde "PDF olarak kaydet" de
   * bulunur.
   */
  printDocument(html: string, fileName: string): Promise<void>;
  /**
   * Belgeyi tek tıkla PDF'e aktarıp `savePath`'e yazar (macOS: WKWebView.createPDF).
   * Native köprü yoksa `native_pdf_unsupported` hatası fırlatır.
   */
  exportPdf(html: string, fileName: string, savePath: string): Promise<string>;
}

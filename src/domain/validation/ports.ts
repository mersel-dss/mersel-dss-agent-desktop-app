/**
 * Şema/şematron doğrulama port arayüzü.
 */

import type { ValidateDocumentRequest, ValidationReport } from "./types";

export interface ValidationGateway {
  /**
   * Belirli bir belgeyi GİB resmi XSD şeması ve şematron kurallarına göre
   * doğrular. e-Belge zarfı (SBD) otomatik tespit edilip seçili belge çıkarılır.
   * Belge tipi servis tarafından otomatik tespit edilir.
   */
  validateDocument(request: ValidateDocumentRequest): Promise<ValidationReport>;
}

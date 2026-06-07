/**
 * Doğrulama port arayüzü.
 */

import type {
  DocumentVerificationResult,
  TimestampVerificationResult,
  VerifyDocumentRequest,
  VerifyTimestampRequest,
} from "./types";

export interface VerificationGateway {
  /**
   * İmzalı dokümanı doğrular; e-Belge zarfı (SBD) otomatik tespit edilir ve
   * içindeki tüm belgeler çözülüp doğrulanır.
   */
  verifyDocument(
    request: VerifyDocumentRequest,
  ): Promise<DocumentVerificationResult>;
  verifyTimestamp(
    request: VerifyTimestampRequest,
  ): Promise<TimestampVerificationResult>;
}

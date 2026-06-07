/**
 * `VerificationGateway` portunun Tauri gerçeklemesi.
 */

import type { VerificationGateway } from "@/domain/verification/ports";
import type {
  DocumentVerificationResult,
  TimestampVerificationResult,
  VerifyDocumentRequest,
  VerifyTimestampRequest,
} from "@/domain/verification/types";
import { call } from "./client";

export class TauriVerificationGateway implements VerificationGateway {
  verifyDocument(
    request: VerifyDocumentRequest,
  ): Promise<DocumentVerificationResult> {
    return call<DocumentVerificationResult>("verify_document", {
      signedPath: request.signedPath,
      originalPath: request.originalPath ?? null,
      level: request.level ?? "COMPREHENSIVE",
      includeFailedConstraints: request.includeFailedConstraints ?? false,
    });
  }

  verifyTimestamp(
    request: VerifyTimestampRequest,
  ): Promise<TimestampVerificationResult> {
    return call<TimestampVerificationResult>("verify_timestamp", {
      timestampPath: request.timestampPath,
      originalPath: request.originalPath ?? null,
      validateCertificate: request.validateCertificate ?? true,
    });
  }
}

/**
 * `VerificationGateway` portunun Tauri gerçeklemesi.
 */

import type { VerificationGateway } from "@/domain/verification/ports";
import type {
  SignatureVerificationResult,
  TimestampVerificationResult,
  VerifySignatureRequest,
  VerifyTimestampRequest,
} from "@/domain/verification/types";
import { call } from "./client";

export class TauriVerificationGateway implements VerificationGateway {
  verifySignature(
    request: VerifySignatureRequest,
  ): Promise<SignatureVerificationResult> {
    return call<SignatureVerificationResult>("verify_signature", {
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
